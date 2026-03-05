"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sparkles, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";

import { cn } from "@/lib/utils";
import { MODELS, getModelConfig, getMaxPromptLength, PROVIDER_SHORT_LABELS } from "@/lib/types";
import type { GeneratedImage, Provider, VideoRequestParams, VideoJob } from "@/lib/types";
import { toast } from "sonner";
import type { ImageGenerationRequest, ImageGenerationResponse } from "@/lib/types/generation";
import { motion, AnimatePresence } from "framer-motion";
import { createVideoGeneration, getVideoGeneration } from "@/lib/services/aiml-video";
import { pollVideoGeneration } from "@/lib/services/video-polling";
import type { PollHandle } from "@/lib/services/video-polling";
import { useVideoJobsStore, getActiveJobs } from "@/store/video-jobs";
import { useImageJobsStore, getActiveImageJobs } from "@/store/image-jobs";
import type { ImageJob } from "@/store/image-jobs";
import { useSettingsStore } from "@/store/settings";
import { buildProviderCredentials, injectCredentials } from "@/lib/services/provider-credentials";
import { PendingImageJobsStrip } from "./pending-image-jobs-strip";



/** Max retry attempts for persisted image job recovery. */
const MAX_IMAGE_JOB_ATTEMPTS = 2;

export function PromptComposer() {
  const {
    state,
    setPrompt,
    completeGeneration,
    toggleControls,
  } = useStudio();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Derive max prompt length from the currently-selected model's capabilities.
  const maxPromptLength = useMemo(() => getMaxPromptLength(state.model), [state.model]);

  // --- Double-submit guard for video creation ---
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  // --- Video polling lifecycle ---
  const pollHandlesRef = useRef<Map<string, PollHandle>>(new Map());
  const { addJob, setJobStatus, markJobCompleted, markJobError } =
    useVideoJobsStore();

  // --- Image jobs store ---
  const {
    addJob: addImageJob,
    startJob: startImageJob,
    markJobCompleted: markImageJobCompleted,
    markJobError: markImageJobError,
  } = useImageJobsStore();

  // --- AbortController map for in-flight image requests ---
  const imageAbortRef = useRef<Map<string, AbortController>>(new Map());

  // ---- Helper: start polling a single job by id ----
  const startPollingJob = useCallback(
    (jobId: string) => {
      // Don't start duplicate poll handles
      if (pollHandlesRef.current.has(jobId)) return;

      const handle = pollVideoGeneration(
        () => getVideoGeneration(jobId),
        {
          onStatus: (status, result) => {
            // (b) Prevent overwrite race: check current store status before applying
            const currentJob = useVideoJobsStore.getState().jobs.find((j) => j.id === jobId);
            if (currentJob?.status === "cancelled") {
              // Job was cancelled locally — ignore poll update and clean up
              pollHandlesRef.current.get(jobId)?.cancel();
              pollHandlesRef.current.delete(jobId);
              return;
            }

            if (status === "completed" && result.videoUrl) {
              markJobCompleted(jobId, result.videoUrl);
              toast.success("Video ready!", {
                description: `Job ${jobId.slice(0, 8)}...`,
              });
              pollHandlesRef.current.delete(jobId);
            } else if (status === "error") {
              markJobError(jobId, result.error ?? "Video generation failed");
              toast.error("Video generation failed", {
                description: result.error ?? "Unknown error",
              });
              pollHandlesRef.current.delete(jobId);
            } else if (status === "cancelled") {
              setJobStatus(jobId, "cancelled");
              pollHandlesRef.current.delete(jobId);
            } else {
              // In-progress status update (queued -> generating, etc.)
              setJobStatus(jobId, status);
            }
          },
        },
      );

      pollHandlesRef.current.set(jobId, handle);

      // Handle timeout resolution from the promise
      handle.promise.then((finalResult) => {
        if (pollHandlesRef.current.has(jobId)) {
          pollHandlesRef.current.delete(jobId);
          if (finalResult.status === "error" && finalResult.error?.includes("timed out")) {
            markJobError(jobId, finalResult.error);
            toast.error("Video generation timed out", {
              description: finalResult.error,
            });
          }
        }
      });
    },
    [markJobCompleted, markJobError, setJobStatus],
  );

  // (a) Resume polling for persisted active jobs on mount
  // P10: No client API key needed — polling routes through server proxy.
  useEffect(() => {
    const activeJobs = getActiveJobs(useVideoJobsStore.getState());
    for (const job of activeJobs) {
      startPollingJob(job.id);
    }
  }, [startPollingJob]);

  // (c) Subscribe to store changes and cancel handles for jobs moved to cancelled
  useEffect(() => {
    const unsub = useVideoJobsStore.subscribe((state, prevState) => {
      for (const job of state.jobs) {
        if (job.status === "cancelled") {
          const prevJob = prevState.jobs.find((j) => j.id === job.id);
          if (prevJob && prevJob.status !== "cancelled") {
            // Job just transitioned to cancelled — stop its poll handle
            const handle = pollHandlesRef.current.get(job.id);
            if (handle) {
              handle.cancel();
              pollHandlesRef.current.delete(job.id);
            }
          }
        }
      }
    });
    return unsub;
  }, []);

  // Cancel all active polls on unmount
  useEffect(() => {
    const handles = pollHandlesRef.current;
    return () => {
      handles.forEach((h) => h.cancel());
      handles.clear();
    };
  }, []);

  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize helper
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  // ---------------------------------------------------------------------------
  // Video generation — non-blocking, fire-and-forget with polling
  // ---------------------------------------------------------------------------
  const handleVideoGenerate = useCallback(async () => {
    const prompt = state.prompt.trim();
    if (!prompt) return;

    // Double-submit guard
    if (isSubmittingVideo) return;

    const modelConfig = getModelConfig(state.model);
    if (!modelConfig || modelConfig.kind !== "video") return;

    const caps = modelConfig.capabilities;
    const apiModelId = modelConfig.value;

    // Build VideoRequestParams — only include capability-supported fields
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
    if (caps.enhancePrompt) {
      params.enhancePrompt = state.enhancePrompt;
    }
    if (caps.seed && state.seed) {
      params.seed = parseInt(state.seed, 10);
    }

    setIsSubmittingVideo(true);
    try {
      // Snapshot BYOK credentials for the active provider (aiml for video).
      const credentials = buildProviderCredentials(
        state.provider,
        useSettingsStore.getState(),
      );

      const createResult = await createVideoGeneration({
        model: apiModelId,
        params,
        credentials,
      });

      const now = Date.now();
      const job: VideoJob = {
        id: createResult.id,
        model: state.model,
        provider: state.provider,
        prompt,
        params,
        status: createResult.status,
        createdAt: now,
        updatedAt: now,
      };

      addJob(job);
      toast.success("Video generation submitted", {
        description: `Job ${createResult.id.slice(0, 8)}... is queued.`,
      });

      // Clear prompt so the composer is ready for the next one
      setPrompt("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      // Start non-blocking polling
      startPollingJob(createResult.id);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to start video generation";
      toast.error(message);
    } finally {
      setIsSubmittingVideo(false);
    }
  }, [
    state.prompt,
    state.negativePrompt,
    state.model,
    state.provider,
    state.duration,
    state.videoResolution,
    state.videoAspectRatio,
    state.generateAudio,
    state.enhancePrompt,
    state.seed,
    isSubmittingVideo,
    setPrompt,
    addJob,
    startPollingJob,
  ]);

  // ---------------------------------------------------------------------------
  // Image generation — fire a single image fetch for a given job
  // ---------------------------------------------------------------------------
  const executeImageJob = useCallback(
    (job: ImageJob) => {
      // Abort if already cancelled
      if (useImageJobsStore.getState().jobs.find((j) => j.id === job.id)?.status === "cancelled") return;

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
        .then(async (res) => {
          const data: ImageGenerationResponse & { error?: string } = await res.json();
          if (!res.ok) throw new Error(data.error || `${job.provider} generation failed`);
          return data.imageUrl;
        })
        .then((imageUrl) => {
          // Respect local cancellation even if network completes.
          const currentJob = useImageJobsStore
            .getState()
            .jobs.find((j) => j.id === job.id);
          if (currentJob?.status === "cancelled") return;

          // Complete in image jobs store
          markImageJobCompleted(job.id, imageUrl);

          // Also push to Studio history so existing selection/history behaviour is preserved
          const image: GeneratedImage = {
            id: job.id,
            prompt: job.prompt,
            negativePrompt: job.payload.negativePrompt ?? undefined,
            imageUrl,
            aspectRatio: job.aspectRatio,
            model: job.model,
            provider: job.provider,
            createdAt: job.createdAt,
          };
          completeGeneration(image);
        })
        .catch((err: unknown) => {
          if ((err as Error).name === "AbortError") return; // unmount / cancel
          const message = err instanceof Error ? err.message : "Image generation failed";
          markImageJobError(job.id, message);
          toast.error(message);
        })
        .finally(() => {
          imageAbortRef.current.delete(job.id);
        });
    },
    [startImageJob, markImageJobCompleted, markImageJobError, completeGeneration],
  );

  // ---------------------------------------------------------------------------
  // On mount: resume/recover persisted active image jobs
  // ---------------------------------------------------------------------------
  const hasResumedImageJobs = useRef(false);
  useEffect(() => {
    if (hasResumedImageJobs.current) return;
    hasResumedImageJobs.current = true;

    const activeJobs = getActiveImageJobs(useImageJobsStore.getState());
    for (const job of activeJobs) {
      if (job.attempts >= MAX_IMAGE_JOB_ATTEMPTS) {
        markImageJobError(job.id, "Generation interrupted — exceeded retry limit");
      } else {
        executeImageJob(job);
      }
    }
  }, [executeImageJob, markImageJobError]);

  // Cancel all in-flight image requests on unmount
  useEffect(() => {
    const abortMap = imageAbortRef.current;
    return () => {
      abortMap.forEach((c) => c.abort());
      abortMap.clear();
    };
  }, []);

  // Cancel in-flight image requests when a job is cancelled locally.
  useEffect(() => {
    const unsub = useImageJobsStore.subscribe((state, prevState) => {
      for (const job of state.jobs) {
        if (job.status !== "cancelled") continue;
        const prev = prevState.jobs.find((j) => j.id === job.id);
        if (!prev || prev.status === "cancelled") continue;

        const controller = imageAbortRef.current.get(job.id);
        if (controller) {
          controller.abort();
          imageAbortRef.current.delete(job.id);
        }
      }
    });
    return unsub;
  }, []);

  const handleGenerate = useCallback(async () => {
    // All image generation providers now use server routes —
    // no client-side API key required (but BYOK keys are forwarded when set).
    if (!state.prompt.trim()) return;

    // --- Video models take a completely separate path ---
    const selectedModelConfig = getModelConfig(state.model);
    if (selectedModelConfig?.kind === "video") {
      handleVideoGenerate();
      return;
    }

    // --- Image models: concurrent, non-blocking ---

    const currentModelConfig = getModelConfig(state.model);
    const caps = currentModelConfig?.capabilities;
    const apiModelId = currentModelConfig?.value ?? state.model;

    // Build the canonical payload
    const payload: ImageGenerationRequest = {
      prompt: state.prompt,
      model: apiModelId,
      provider: state.provider,
      aspectRatio: state.aspectRatio,
    };

    // Provider-specific optional fields
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
    // Z Image Turbo: always send 8 inference steps (hardcoded, no slider)
    if (apiModelId === "alibaba/z-image-turbo") {
      payload.numInferenceSteps = 8;
    }
    if (caps?.safetyTolerance) {
      payload.safetyTolerance = state.safetyTolerance;
    }
    if (caps?.enableSafetyChecker !== undefined) {
      payload.enableSafetyChecker = state.enableSafetyChecker;
    }

    // Create an image job record
    const jobId = crypto.randomUUID();
    const now = Date.now();
    const job: ImageJob = {
      id: jobId,
      prompt: state.prompt,
      model: state.model,
      provider: state.provider,
      aspectRatio: state.aspectRatio,
      // Store the credential-free payload. Credentials are injected at execution
      // time so secrets are not persisted to localStorage.
      payload,
      status: "queued",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    addImageJob(job);

    // Fire the request (non-blocking)
    executeImageJob(job);
  }, [
    state.provider,
    state.prompt,
    state.negativePrompt,
    state.aspectRatio,
    state.model,
    state.guidanceScale,
    state.numInferenceSteps,
    state.seed,
    state.safetyTolerance,
    state.enableSafetyChecker,
    state.enhancePrompt,
    state.personGeneration,
    handleVideoGenerate,
    addImageJob,
    executeImageJob,
  ]);

  const hasImage = !!state.selectedImage;

  // All providers use server-side keys — generation is always available.
  // No global lock: multiple concurrent image generations are allowed.
  const canGenerate = state.prompt.trim().length > 0;

  const modelLabel =
    MODELS.find((m) => m.id === state.model)?.label ??
    MODELS.find((m) => m.value === state.model)?.label ??
    state.model;

  const providerLabel = PROVIDER_SHORT_LABELS[state.provider] ?? state.provider;

  const PROVIDER_DOT_COLORS: Record<Provider, string> = {
    google: "bg-blue-500",
    vertex: "bg-emerald-500",
    fal: "bg-violet-500",
    aiml: "bg-orange-500",
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canGenerate) handleGenerate();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleGenerate, canGenerate]);

  return (
    <motion.div
      initial={false}
      animate={{
        bottom: hasImage ? "1.5rem" : "50%",
        y: hasImage ? 0 : "50%",
      }}
      transition={{ type: "spring", damping: 30, stiffness: 200 }}
      className="absolute inset-x-0 z-40 flex justify-center px-3 sm:px-4 pointer-events-none"
    >
      <div className="w-full max-w-3xl flex flex-col gap-3 pointer-events-auto">
        {/* Pending image generation cards */}
        <PendingImageJobsStrip />

        <div
          className={cn(
            "bg-card rounded-2xl sm:rounded-[2rem] transition-all duration-300",
            "shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border",
            "minimal-focus",
          )}
        >
          {/* Main Input Area */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
            <textarea
              ref={textareaRef}
              value={state.prompt}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= maxPromptLength) {
                  setPrompt(value);
                } else {
                  setPrompt(value.slice(0, maxPromptLength));
                }
                autoResize(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canGenerate) {
                    handleGenerate();
                  }
                  return;
                }

                // Block character input when at limit (allow control keys)
                if (
                  !e.metaKey &&
                  !e.ctrlKey &&
                  e.key.length === 1 // printable character
                ) {
                  const textarea = e.currentTarget;
                  const selectionLength = textarea.selectionEnd - textarea.selectionStart;
                  const currentLength = state.prompt.length;

                  // If text is selected, typing replaces it — allow if result fits
                  if (selectionLength > 0 && currentLength - selectionLength + 1 <= maxPromptLength) {
                    return;
                  }

                  // Block if at or over limit with no selection to replace
                  if (currentLength >= maxPromptLength) {
                    e.preventDefault();
                  }
                }
              }}
              onPaste={(e) => {
                const paste = e.clipboardData.getData("text");
                const textarea = e.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectionLength = end - start;
                const available = maxPromptLength - (state.prompt.length - selectionLength);
                if (paste.length > available) {
                  e.preventDefault();
                  const truncated = paste.slice(0, Math.max(0, available));
                  const before = state.prompt.slice(0, start);
                  const after = state.prompt.slice(end);
                  const newValue = (before + truncated + after).slice(0, maxPromptLength);
                  setPrompt(newValue);
                  // Restore cursor position after React re-render
                  requestAnimationFrame(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + truncated.length;
                    autoResize(textarea);
                  });
                }
              }}
              placeholder="Describe your vision..."
              rows={1}
              className={cn(
                "w-full resize-none bg-transparent text-foreground focus:outline-none",
                "font-serif text-base leading-relaxed placeholder:text-muted-foreground/50",
                "selection:bg-primary/20 selection:text-primary",
              )}
              disabled={false}
            />
            {/* Character counter */}
            {state.prompt.length > 0 && (
              <div className="flex justify-end pt-1 pb-0.5">
                <span
                  className={cn(
                    "text-xs font-sans tabular-nums tracking-tight transition-colors",
                    state.prompt.length >= maxPromptLength
                      ? "text-destructive font-medium"
                      : state.prompt.length > maxPromptLength - 500
                        ? "text-amber-500"
                        : "text-muted-foreground/50",
                  )}
                >
                  {state.prompt.length}/{maxPromptLength}
                </span>
              </div>
            )}
          </div>

          {/* Controls Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pt-2">
            {/* Left Controls */}
            <div className="flex items-center gap-1.5 ml-2 min-w-0">
              <button
                type="button"
                onClick={toggleControls}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-w-0"
              >
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    PROVIDER_DOT_COLORS[state.provider],
                  )}
                />
                <span className="truncate">{providerLabel}</span>
                <span className="text-muted-foreground/40 shrink-0">/</span>
                <span className="text-foreground font-semibold truncate">{modelLabel}</span>
              </button>
              <div className="w-px h-4 bg-border mx-1 shrink-0 hidden sm:block" />
              <button
                type="button"
                onClick={toggleControls}
                className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ImageIcon className="size-4 opacity-50" />
                <span className="text-foreground font-semibold">{state.aspectRatio}</span>
              </button>
            </div>

            {/* Right side */}
            <div className="flex items-center pr-1 shrink-0">
              <AnimatePresence mode="popLayout">
                {canGenerate && (
                  <motion.div
                    key="generate"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Button
                      size="default"
                      onClick={handleGenerate}
                      className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform duration-200 px-6 h-10 shadow-md font-sans font-medium tracking-tight"
                    >
                      <Sparkles className="size-4 mr-2" />
                      Generate
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Helper text — hidden on narrow screens */}
        <AnimatePresence>
          {!hasImage && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden sm:block text-center text-sm text-muted-foreground font-sans tracking-tight pt-2"
            >
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded-md text-xs mx-0.5 font-sans text-muted-foreground">
                Enter
              </kbd>{" "}
              to generate,{" "}
              <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded-md text-xs mx-0.5 font-sans text-muted-foreground">
                Shift + Enter
              </kbd>{" "}
              for new line
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
