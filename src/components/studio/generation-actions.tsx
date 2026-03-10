"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStudio, type StudioState } from "@/lib/store";
import {
  getMaxImagesForModel,
  getModelConfig,
  type GeneratedImage,
  type Provider,
  type VideoJob,
  type VideoRequestParams,
} from "@/lib/types";
import { createVideoGeneration, getVideoGeneration } from "@/lib/services/video-generation";
import { AirforceVideoError } from "@/lib/services/airforce-video";
import {
  AirforceSubmissionCancelledError,
  queueAirforceSubmission,
} from "@/lib/services/airforce-submission-queue";
import { pollVideoGeneration, type PollHandle } from "@/lib/services/video-polling";
import { useVideoJobsStore } from "@/store/video-jobs";
import { useImageJobsStore, type ImageJob, type ImageRetryPayload } from "@/store/image-jobs";
import { useSettingsStore } from "@/store/settings";
import { normalizeReferenceImageUrl } from "@/lib/services/reference-image-upload";
import { buildProviderCredentials, injectCredentials } from "@/lib/services/provider-credentials";
import { toast } from "sonner";
import type {
  GeneratedImageResult,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "@/lib/types/generation";
import { validateImageGenerationResponse } from "@/lib/types/generation";
import { getSelectedCanvasImageSource } from "@/lib/canvas-selection";
import { applyVideoReferenceImagesToParams } from "@/lib/video-reference-images";

const MAX_IMAGE_JOB_ATTEMPTS = 2;

function buildReferenceImageUrls(state: StudioState): {
  imageUrl?: string;
  imageUrls: string[];
} {
  const imageUrls = Array.from(
    new Set(
      [
        state.videoImageUrl || undefined,
        state.videoImageUrl2 || undefined,
        state.useSelectedImageAsVideoReference
          ? state.selectedImage?.imageUrl
          : undefined,
      ].filter((url): url is string => !!url),
    ),
  ).slice(0, 2);

  return {
    imageUrl: state.videoImageUrl || undefined,
    imageUrls,
  };
}

function isPublicProviderReferenceUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    return !new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]).has(hostname);
  } catch {
    return false;
  }
}

async function normalizeVideoReferenceParams(
  model: string,
  provider: Provider,
  params: VideoRequestParams,
): Promise<VideoRequestParams> {
  const modelConfig = getModelConfig(model);
  if (provider !== "airforce" || modelConfig?.value !== "grok-imagine-video") {
    return params;
  }

  const sourceImageUrls = Array.from(
    new Set(
      [params.imageUrl, ...(params.imageUrls ?? [])].filter(
        (url): url is string => typeof url === "string" && url.trim().length > 0,
      ),
    ),
  ).slice(0, 2);

  if (sourceImageUrls.length === 0) {
    return params;
  }

  const normalizedEntries = await Promise.all(
    sourceImageUrls.map(async (url) => {
      try {
        const normalizedUrl = await normalizeReferenceImageUrl(url);
        return [url, isPublicProviderReferenceUrl(normalizedUrl) ? normalizedUrl : url] as const;
      } catch (error) {
        console.warn(
          "[generation-actions] reference image normalization failed; using original URL",
          { model, provider, url, error },
        );
        return [url, url] as const;
      }
    }),
  );

  const normalizedBySourceUrl = new Map(normalizedEntries);
  const normalizedImageUrls = sourceImageUrls.map(
    (url) => normalizedBySourceUrl.get(url) ?? url,
  );
  const normalizedPrimaryUrl =
    params.imageUrl && params.imageUrl.trim().length > 0
      ? normalizedBySourceUrl.get(params.imageUrl) ?? params.imageUrl
      : undefined;

  return {
    ...params,
    imageUrl: normalizedPrimaryUrl,
    imageUrls: Array.from(new Set(normalizedImageUrls)),
  };
}

interface GenerationActionsContextValue {
  generateFromCurrentState: () => Promise<void>;
  retryVideoJob: (jobId: string) => Promise<void>;
  retryImageJob: (jobId: string) => void;
  isSubmittingVideo: boolean;
}

const GenerationActionsContext =
  createContext<GenerationActionsContextValue | null>(null);

function buildVideoParamsFromState(
  state: StudioState,
  selectedCanvasImageUrl: string | null,
): VideoRequestParams | null {
  const modelConfig = getModelConfig(state.model);
  if (!modelConfig || modelConfig.kind !== "video") return null;

  const prompt = state.prompt.trim();
  if (!prompt) return null;

  const caps = modelConfig.capabilities;
  const params: VideoRequestParams = { prompt };

  if (caps.negativePrompt && state.negativePrompt) {
    params.negativePrompt = state.negativePrompt;
  }
  if (caps.durationOptions?.length) {
    params.duration = state.duration;
  }
  if (caps.resolutionOptions?.length) {
    params.resolution = state.videoResolution;
  }
  if (caps.videoAspectRatios?.length) {
    params.aspectRatio = state.videoAspectRatio;
  }
  if (caps.generateAudio) {
    params.generateAudio = state.generateAudio;
  }
  if (caps.imageUrl) {
    const referenceImages = buildReferenceImageUrls(state);
    if (referenceImages.imageUrl) {
      params.imageUrl = referenceImages.imageUrl;
    }
    if (referenceImages.imageUrls.length > 0) {
      params.imageUrls = referenceImages.imageUrls;
    }
  }
  if (caps.audioUrl && state.videoAudioUrl) {
    params.audioUrl = state.videoAudioUrl;
  }
  if (caps.shotType) {
    params.shotType = state.videoShotType;
  }
  if (caps.enhancePrompt) {
    params.enhancePrompt = state.enhancePrompt;
  }
  if (caps.seed && state.seed) {
    params.seed = parseInt(state.seed, 10);
  }

  if (state.useSelectedImageForVideo && selectedCanvasImageUrl) {
    return applyVideoReferenceImagesToParams(state.model, params, [selectedCanvasImageUrl]);
  }

  return params;
}

function buildImagePayloadFromState(
  state: StudioState,
): { payload: ImageGenerationRequest; prompt: string } | null {
  const modelConfig = getModelConfig(state.model);
  if (modelConfig?.kind === "video") return null;

  if (!state.prompt.trim()) return null;

  const caps = modelConfig?.capabilities;
  const apiModelId = modelConfig?.value ?? state.model;

  const payload: ImageGenerationRequest = {
    prompt: state.prompt,
    model: apiModelId,
    provider: state.provider,
    aspectRatio: state.aspectRatio,
  };

  if (caps?.seed && state.seed) {
    payload.seed = parseInt(state.seed, 10);
  }
  if (caps?.negativePrompt && state.negativePrompt) {
    payload.negativePrompt = state.negativePrompt;
  }
  if (caps?.enhancePrompt) {
    payload.enhancePrompt = state.enhancePrompt;
  }
  if (caps?.personGeneration) {
    payload.personGeneration = state.personGeneration;
  }
  if (caps?.guidanceScale) {
    payload.guidanceScale = state.guidanceScale;
  }
  if (caps?.numInferenceSteps) {
    payload.numInferenceSteps = state.numInferenceSteps;
  }
  if (apiModelId === "alibaba/z-image-turbo") {
    // Z Image Turbo's API accepts num_inference_steps in range [1, 8].
    // The upstream default is 2, but 8 produces significantly better quality
    // with negligible latency cost on this turbo model. Hardcoded to avoid
    // exposing a user-facing slider for a single model.
    payload.numInferenceSteps = 8;
  }
  if (caps?.safetyTolerance) {
    payload.safetyTolerance = state.safetyTolerance;
  }
  if (caps?.enableSafetyChecker !== undefined) {
    payload.enableSafetyChecker = state.enableSafetyChecker;
  }
  payload.numberOfImages = Math.min(
    state.numberOfImages,
    getMaxImagesForModel(state.model),
  );

  return { payload, prompt: state.prompt };
}

function getGeneratedImages(
  response: ImageGenerationResponse,
): GeneratedImageResult[] {
  if (response.images?.length) {
    return response.images;
  }
  if (response.imageUrl) {
    return [{ imageUrl: response.imageUrl, seed: response.seed }];
  }

  return [];
}

function createRetryImageJob(retryPayload: ImageRetryPayload): ImageJob {
  const timestamp = Date.now();
  return {
    id: crypto.randomUUID(),
    prompt: retryPayload.prompt,
    model: retryPayload.model,
    provider: retryPayload.provider,
    aspectRatio: retryPayload.aspectRatio,
    payload: { ...retryPayload.payload },
    status: "queued",
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

type ImageGenerationError = Error & {
  status?: number;
  upstreamStatus?: number;
  upstreamBody?: unknown;
};

async function buildImageGenerationError(
  response: Response,
  provider: Provider,
): Promise<ImageGenerationError> {
  const fallbackMessage = `${provider} generation failed`;
  let message = fallbackMessage;
  let upstreamStatus: number | undefined;
  let upstreamBody: unknown;

  const rawText = await response.text().catch(() => "");
  if (rawText.trim()) {
    try {
      const parsed = JSON.parse(rawText) as {
        error?: string | { message?: string };
        message?: string;
        upstreamStatus?: number;
        upstreamBody?: unknown;
      };

      if (typeof parsed.error === "string") {
        message = parsed.error;
      } else if (parsed.error?.message) {
        message = parsed.error.message;
      } else if (parsed.message) {
        message = parsed.message;
      }

      if (typeof parsed.upstreamStatus === "number") {
        upstreamStatus = parsed.upstreamStatus;
      }
      if (parsed.upstreamBody !== undefined) {
        upstreamBody = parsed.upstreamBody;
      }
    } catch {
      message = rawText.slice(0, 200);
    }
  }

  const error = new Error(message) as ImageGenerationError;
  error.name = "ImageGenerationError";
  error.status = response.status;
  error.upstreamStatus = upstreamStatus;
  error.upstreamBody = upstreamBody;
  return error;
}

export function GenerationActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { state, completeGeneration } = useStudio();
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  const addVideoJob = useVideoJobsStore((s) => s.addJob);
  const replaceVideoJob = useVideoJobsStore((s) => s.replaceJob);
  const updateVideoJob = useVideoJobsStore((s) => s.updateJob);
  const setVideoJobStatus = useVideoJobsStore((s) => s.setJobStatus);
  const markVideoJobCompleted = useVideoJobsStore((s) => s.markJobCompleted);
  const markVideoJobError = useVideoJobsStore((s) => s.markJobError);
  const selectVideoJob = useVideoJobsStore((s) => s.selectJob);

  const addImageJob = useImageJobsStore((s) => s.addJob);
  const setImageJobStatus = useImageJobsStore((s) => s.setJobStatus);
  const startImageJob = useImageJobsStore((s) => s.startJob);
  const markImageJobCompleted = useImageJobsStore((s) => s.markJobCompleted);
  const markImageJobError = useImageJobsStore((s) => s.markJobError);
  const removeImageJob = useImageJobsStore((s) => s.removeJob);

  const pollHandlesRef = useRef<Map<string, PollHandle>>(new Map());
  const imageAbortRef = useRef<Map<string, AbortController>>(new Map());
  const hasResumedImageJobs = useRef(false);
  const pendingVideoSubmissionCountRef = useRef(0);

  const startPollingJob = useCallback(
    (jobId: string, provider: Provider) => {
      if (pollHandlesRef.current.has(jobId)) return;

      const handle = pollVideoGeneration(
        () =>
          getVideoGeneration({
            provider,
            generationId: jobId,
            credentials: buildProviderCredentials(
              provider,
              useSettingsStore.getState(),
            ),
          }),
        {
          onStatus: (status, result) => {
            const currentJob = useVideoJobsStore
              .getState()
              .jobs.find((job) => job.id === jobId);

            if (currentJob?.status === "cancelled") {
              pollHandlesRef.current.get(jobId)?.cancel();
              pollHandlesRef.current.delete(jobId);
              return;
            }

            if (status === "completed" && result.videoUrl) {
              markVideoJobCompleted(jobId, result.videoUrl);
              toast.success("Video ready!", {
                description: `Job ${jobId.slice(0, 8)}...`,
              });
              pollHandlesRef.current.delete(jobId);
              return;
            }

            if (status === "error") {
              markVideoJobError(jobId, result.error ?? "Video generation failed");
              toast.error("Video generation failed", {
                description: result.error ?? "Unknown error",
              });
              pollHandlesRef.current.delete(jobId);
              return;
            }

            if (status === "cancelled") {
              setVideoJobStatus(jobId, "cancelled");
              pollHandlesRef.current.delete(jobId);
              return;
            }

            setVideoJobStatus(jobId, status);
          },
        },
      );

      pollHandlesRef.current.set(jobId, handle);

      handle.promise.then((finalResult) => {
        if (!pollHandlesRef.current.has(jobId)) return;

        pollHandlesRef.current.delete(jobId);
        if (finalResult.status === "error" && finalResult.error?.includes("timed out")) {
          markVideoJobError(jobId, finalResult.error);
          toast.error("Video generation timed out", {
            description: finalResult.error,
          });
        }
      });
    },
    [markVideoJobCompleted, markVideoJobError, setVideoJobStatus],
  );

  const executeImageJob = useCallback(
    (job: ImageJob) => {
      const isCancelled = () =>
        useImageJobsStore.getState().jobs.find((entry) => entry.id === job.id)?.status ===
        "cancelled";

      if (isCancelled()) {
        return;
      }

      const runRequest = async () => {
        if (isCancelled()) {
          throw new AirforceSubmissionCancelledError();
        }

        startImageJob(job.id);

        const controller = new AbortController();
        imageAbortRef.current.set(job.id, controller);

        const providerRoute = `/api/generate/${job.provider}`;
        const credentials = buildProviderCredentials(
          job.provider,
          useSettingsStore.getState(),
        );
        const livePayload = injectCredentials(job.payload, credentials);

        try {
          const response = await fetch(providerRoute, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(livePayload),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw await buildImageGenerationError(response, job.provider);
          }

          const data = (await response.json()) as ImageGenerationResponse;
          validateImageGenerationResponse(data, job.provider);
          return getGeneratedImages(data);
        } finally {
          imageAbortRef.current.delete(job.id);
        }
      };

      const requestPromise =
        job.provider === "airforce"
          ? queueAirforceSubmission(runRequest, {
              isCancelled,
              onRetryScheduled: (directive) => {
                if (directive.kind === "provider-wait") {
                  setImageJobStatus(job.id, "queued");
                }
              },
            })
          : runRequest();

      requestPromise
        .then((generatedImages) => {
          const currentJob = useImageJobsStore
            .getState()
            .jobs.find((entry) => entry.id === job.id);
          if (currentJob?.status === "cancelled") return;

          markImageJobCompleted(job.id, generatedImages[0].imageUrl);

          // Reverse so the last image is completed first; since completeGeneration
          // prepends to history, this preserves the original 1→N order in display.
          generatedImages.toReversed().forEach((generatedImage, indexFromEnd) => {
            const imageIndex = generatedImages.length - 1 - indexFromEnd;
            const image: GeneratedImage = {
              id:
                generatedImages.length === 1
                  ? job.id
                  : `${job.id}:${imageIndex}`,
              prompt: job.prompt,
              negativePrompt: job.payload.negativePrompt ?? undefined,
              imageUrl: generatedImage.imageUrl,
              aspectRatio: job.aspectRatio,
              model: job.model,
              provider: job.provider,
              createdAt: job.createdAt,
              seed: generatedImage.seed,
            };
            completeGeneration(image);
          });
        })
        .catch((error: unknown) => {
          if (
            (error as Error).name === "AbortError" ||
            error instanceof AirforceSubmissionCancelledError
          ) {
            return;
          }

          const message =
            error instanceof Error ? error.message : "Image generation failed";
          markImageJobError(job.id, message);
          toast.error(message);
        });
    },
    [
      completeGeneration,
      markImageJobCompleted,
      markImageJobError,
      setImageJobStatus,
      startImageJob,
    ],
  );

  const submitVideoJob = useCallback(
    async ({
      model,
      provider,
      params,
      selectNewJob,
      replaceJobId,
      successToastTitle,
    }: {
      model: string;
      provider: VideoJob["provider"];
      params: VideoRequestParams;
      selectNewJob: boolean;
      replaceJobId?: string;
      successToastTitle: string;
    }) => {
      const modelConfig = getModelConfig(model);
      if (!modelConfig || modelConfig.kind !== "video") return;

      const prompt = params.prompt.trim();
      if (!prompt) return;

      const timestamp = Date.now();
      const pendingJobId = crypto.randomUUID();
      const pendingJob: VideoJob = {
        id: pendingJobId,
        model,
        provider,
        prompt,
        params: { ...params, prompt },
        status: "queued",
        createdAt: timestamp,
        updatedAt: timestamp,
        requestPending: true,
      };

      if (replaceJobId) {
        replaceVideoJob(replaceJobId, pendingJob);
      } else {
        addVideoJob(pendingJob);
      }
      if (selectNewJob) {
        selectVideoJob(pendingJobId);
      }

      pendingVideoSubmissionCountRef.current += 1;
      setIsSubmittingVideo(true);

      try {
        const requestParams = await normalizeVideoReferenceParams(
          model,
          provider,
          { ...params, prompt },
        );
        const credentials = buildProviderCredentials(
          provider,
          useSettingsStore.getState(),
        );

        const createResult =
          provider === "airforce"
            ? await queueAirforceSubmission(
                () => {
                  const currentJob = useVideoJobsStore
                    .getState()
                    .jobs.find((job) => job.id === pendingJobId);
                  if (currentJob?.status === "cancelled") {
                    throw new AirforceSubmissionCancelledError();
                  }

                  return createVideoGeneration({
                    provider,
                    model: modelConfig.value,
                    params: requestParams,
                    credentials,
                  });
                },
                {
                  isCancelled: () =>
                    useVideoJobsStore
                      .getState()
                      .jobs.find((job) => job.id === pendingJobId)?.status === "cancelled",
                  onRetryScheduled: (directive) => {
                    if (directive.kind === "provider-wait") {
                      updateVideoJob(pendingJobId, {
                        status: "queued",
                        requestPending: true,
                      });
                    }
                  },
                },
              )
            : await createVideoGeneration({
                provider,
                model: modelConfig.value,
                params: requestParams,
                credentials,
              });

        const latestPendingJob = useVideoJobsStore
          .getState()
          .jobs.find((job) => job.id === pendingJobId);
        if (latestPendingJob?.status === "cancelled") {
          replaceVideoJob(pendingJobId, {
            id: createResult.id,
            model,
            provider,
            prompt,
            params: requestParams,
            status: "cancelled",
            createdAt: timestamp,
            updatedAt: timestamp,
            requestPending: false,
          });
          return;
        }

        replaceVideoJob(pendingJobId, {
          id: createResult.id,
          model,
          provider,
          prompt,
          params: requestParams,
          status: createResult.status,
          createdAt: timestamp,
          updatedAt: timestamp,
          requestPending: false,
        });

        if (selectNewJob) {
          selectVideoJob(createResult.id);
        }

        if (createResult.status === "completed" && createResult.videoUrl) {
          markVideoJobCompleted(createResult.id, createResult.videoUrl);
          toast.success(successToastTitle, {
            description: "Video generated successfully.",
          });
          return;
        }

        toast.success(successToastTitle, {
          description: `Job ${createResult.id.slice(0, 8)}... is queued.`,
        });

        startPollingJob(createResult.id, provider);
      } catch (error: unknown) {
        const latestPendingJob = useVideoJobsStore
          .getState()
          .jobs.find((job) => job.id === pendingJobId);
        if (
          latestPendingJob?.status === "cancelled" ||
          error instanceof AirforceSubmissionCancelledError
        ) {
          return;
        }

        const message =
          (error instanceof Error && error.message) ||
          "Failed to start video generation";
        markVideoJobError(pendingJobId, message);
        toast.error(message);

        if (error instanceof AirforceVideoError) {
          console.error("[AirforceVideoError]", message, {
            httpStatus: error.httpStatus,
            diagnostics: error.diagnostics,
            raw: error.raw,
          });
        }
      } finally {
        pendingVideoSubmissionCountRef.current = Math.max(
          0,
          pendingVideoSubmissionCountRef.current - 1,
        );
        setIsSubmittingVideo(pendingVideoSubmissionCountRef.current > 0);
      }
    },
    [
      addVideoJob,
      markVideoJobCompleted,
      markVideoJobError,
      replaceVideoJob,
      selectVideoJob,
      startPollingJob,
      updateVideoJob,
    ],
  );

  const generateFromCurrentState = useCallback(async () => {
    if (!state.prompt.trim()) return;

    const selectedCanvasImage = getSelectedCanvasImageSource({
      selectedImage: state.selectedImage,
      selectedVideoJobId: useVideoJobsStore.getState().selectedJobId,
      imageJobs: useImageJobsStore.getState().jobs,
      selectedImageJobId: useImageJobsStore.getState().selectedJobId,
    });

    const videoParams = buildVideoParamsFromState(
      state,
      selectedCanvasImage?.url ?? null,
    );
    if (videoParams) {
      await submitVideoJob({
        model: state.model,
        provider: state.provider,
        params: videoParams,
        selectNewJob: true,
        successToastTitle: "Video generation submitted",
      });
      return;
    }

    const imageRequest = buildImagePayloadFromState(state);
    if (!imageRequest) return;

    const timestamp = Date.now();
    const job: ImageJob = {
      id: crypto.randomUUID(),
      prompt: imageRequest.prompt,
      model: state.model,
      provider: state.provider,
      aspectRatio: state.aspectRatio,
      payload: imageRequest.payload,
      status: "queued",
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    addImageJob(job);
    executeImageJob(job);
  }, [addImageJob, executeImageJob, state, submitVideoJob]);

  const retryVideoJob = useCallback(
    async (jobId: string) => {
      const retryPayload = useVideoJobsStore.getState().retryJob(jobId);
      if (!retryPayload) return;

      await submitVideoJob({
        model: retryPayload.model,
        provider: retryPayload.provider,
        params: retryPayload.params,
        selectNewJob: true,
        replaceJobId: jobId,
        successToastTitle: "Video generation retried",
      });
    },
    [submitVideoJob],
  );

  const retryImageJob = useCallback(
    (jobId: string) => {
      const retryPayload = useImageJobsStore.getState().retryJob(jobId);
      if (!retryPayload) return;

      const retryJob = createRetryImageJob(retryPayload);
      addImageJob(retryJob);
      removeImageJob(jobId);
      executeImageJob(retryJob);
    },
    [addImageJob, executeImageJob, removeImageJob],
  );

  useEffect(() => {
    const activeJobs = useVideoJobsStore
      .getState()
      .jobs.filter(
        (job) =>
          !job.requestPending &&
          (job.status === "queued" || job.status === "generating"),
      );

    for (const job of activeJobs) {
      startPollingJob(job.id, job.provider);
    }
  }, [startPollingJob]);

  useEffect(() => {
    const unsubscribe = useVideoJobsStore.subscribe((current, previous) => {
      for (const job of current.jobs) {
        if (job.status !== "cancelled") continue;

        const previousJob = previous.jobs.find((entry) => entry.id === job.id);
        if (!previousJob || previousJob.status === "cancelled") continue;

        const handle = pollHandlesRef.current.get(job.id);
        if (!handle) continue;

        handle.cancel();
        pollHandlesRef.current.delete(job.id);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const pollHandles = pollHandlesRef.current;
    return () => {
      pollHandles.forEach((handle) => { handle.cancel(); });
      pollHandles.clear();
    };
  }, []);

  useEffect(() => {
    if (hasResumedImageJobs.current) return;
    hasResumedImageJobs.current = true;

    const activeJobs = useImageJobsStore
      .getState()
      .jobs.filter((job) => job.status === "queued" || job.status === "generating");

    for (const job of activeJobs) {
      if (job.attempts >= MAX_IMAGE_JOB_ATTEMPTS) {
        markImageJobError(job.id, "Generation interrupted — exceeded retry limit");
      } else {
        markImageJobError(job.id, "Generation interrupted — refresh requires manual retry");
      }
    }
  }, [markImageJobError]);

  useEffect(() => {
    const abortControllers = imageAbortRef.current;
    return () => {
      abortControllers.forEach((controller) => { controller.abort(); });
      abortControllers.clear();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = useImageJobsStore.subscribe((current, previous) => {
      for (const job of current.jobs) {
        if (job.status !== "cancelled") continue;

        const previousJob = previous.jobs.find((entry) => entry.id === job.id);
        if (!previousJob || previousJob.status === "cancelled") continue;

        const controller = imageAbortRef.current.get(job.id);
        if (!controller) continue;

        controller.abort();
        imageAbortRef.current.delete(job.id);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo<GenerationActionsContextValue>(
    () => ({
      generateFromCurrentState,
      retryVideoJob,
      retryImageJob,
      isSubmittingVideo,
    }),
    [generateFromCurrentState, isSubmittingVideo, retryImageJob, retryVideoJob],
  );

  return (
    <GenerationActionsContext.Provider value={value}>
      {children}
    </GenerationActionsContext.Provider>
  );
}

export function useGenerationActions(): GenerationActionsContextValue {
  const context = useContext(GenerationActionsContext);
  if (!context) {
    throw new Error(
      "useGenerationActions must be used within a <GenerationActionsProvider>",
    );
  }
  return context;
}
