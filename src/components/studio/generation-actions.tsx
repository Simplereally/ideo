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
import { pollVideoGeneration, type PollHandle } from "@/lib/services/video-polling";
import { useVideoJobsStore } from "@/store/video-jobs";
import { useImageJobsStore, type ImageJob, type ImageRetryPayload } from "@/store/image-jobs";
import { useSettingsStore } from "@/store/settings";
import { buildProviderCredentials, injectCredentials } from "@/lib/services/provider-credentials";
import { toast } from "sonner";
import type {
  GeneratedImageResult,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "@/lib/types/generation";
import { validateImageGenerationResponse } from "@/lib/types/generation";

const MAX_IMAGE_JOB_ATTEMPTS = 2;

interface GenerationActionsContextValue {
  generateFromCurrentState: () => Promise<void>;
  retryVideoJob: (jobId: string) => Promise<void>;
  retryImageJob: (jobId: string) => void;
  isSubmittingVideo: boolean;
}

const GenerationActionsContext =
  createContext<GenerationActionsContextValue | null>(null);

function buildVideoParamsFromState(state: StudioState): VideoRequestParams | null {
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
  if (caps.imageUrl && state.videoImageUrl) {
    params.imageUrl = state.videoImageUrl;
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

export function GenerationActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { state, completeGeneration, setPrompt } = useStudio();
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  const addVideoJob = useVideoJobsStore((s) => s.addJob);
  const setVideoJobStatus = useVideoJobsStore((s) => s.setJobStatus);
  const markVideoJobCompleted = useVideoJobsStore((s) => s.markJobCompleted);
  const markVideoJobError = useVideoJobsStore((s) => s.markJobError);
  const removeVideoJob = useVideoJobsStore((s) => s.removeJob);
  const selectVideoJob = useVideoJobsStore((s) => s.selectJob);

  const addImageJob = useImageJobsStore((s) => s.addJob);
  const startImageJob = useImageJobsStore((s) => s.startJob);
  const markImageJobCompleted = useImageJobsStore((s) => s.markJobCompleted);
  const markImageJobError = useImageJobsStore((s) => s.markJobError);
  const removeImageJob = useImageJobsStore((s) => s.removeJob);

  const pollHandlesRef = useRef<Map<string, PollHandle>>(new Map());
  const imageAbortRef = useRef<Map<string, AbortController>>(new Map());
  const hasResumedImageJobs = useRef(false);
  const isSubmittingVideoRef = useRef(false);

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
      if (useImageJobsStore.getState().jobs.find((entry) => entry.id === job.id)?.status === "cancelled") {
        return;
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

      fetch(providerRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(livePayload),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data: ImageGenerationResponse & { error?: string } = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `${job.provider} generation failed`);
          }
          validateImageGenerationResponse(data, job.provider);
          const images = getGeneratedImages(data);
          return images;
        })
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
          if ((error as Error).name === "AbortError") return;
          const message =
            error instanceof Error ? error.message : "Image generation failed";
          markImageJobError(job.id, message);
          toast.error(message);
        })
        .finally(() => {
          imageAbortRef.current.delete(job.id);
        });
    },
    [completeGeneration, markImageJobCompleted, markImageJobError, startImageJob],
  );

  const submitVideoJob = useCallback(
    async ({
      model,
      provider,
      params,
      clearPrompt,
      selectNewJob,
      replaceJobId,
      successToastTitle,
    }: {
      model: string;
      provider: VideoJob["provider"];
      params: VideoRequestParams;
      clearPrompt: boolean;
      selectNewJob: boolean;
      replaceJobId?: string;
      successToastTitle: string;
    }) => {
      const modelConfig = getModelConfig(model);
      if (!modelConfig || modelConfig.kind !== "video") return;

      const prompt = params.prompt.trim();
      if (!prompt) return;
      if (isSubmittingVideoRef.current) return;

      isSubmittingVideoRef.current = true;
      setIsSubmittingVideo(true);
      try {
        const credentials = buildProviderCredentials(
          provider,
          useSettingsStore.getState(),
        );

        const createResult = await createVideoGeneration({
          provider,
          model: modelConfig.value,
          params: { ...params, prompt },
          credentials,
        });

        const timestamp = Date.now();
        addVideoJob({
          id: createResult.id,
          model,
          provider,
          prompt,
          params: { ...params, prompt },
          status: createResult.status,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        if (replaceJobId) {
          removeVideoJob(replaceJobId);
        }
        if (selectNewJob) {
          selectVideoJob(createResult.id);
        }

        if (clearPrompt) {
          setPrompt("");
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
        const message =
          error instanceof Error
            ? error.message
            : "Failed to start video generation";
        toast.error(message);
      } finally {
        isSubmittingVideoRef.current = false;
        setIsSubmittingVideo(false);
      }
    },
    [
      addVideoJob,
      markVideoJobCompleted,
      removeVideoJob,
      selectVideoJob,
      setPrompt,
      startPollingJob,
    ],
  );

  const generateFromCurrentState = useCallback(async () => {
    if (!state.prompt.trim()) return;

    const videoParams = buildVideoParamsFromState(state);
    if (videoParams) {
      await submitVideoJob({
        model: state.model,
        provider: state.provider,
        params: videoParams,
        clearPrompt: true,
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
        clearPrompt: false,
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
      .jobs.filter((job) => job.status === "queued" || job.status === "generating");

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
