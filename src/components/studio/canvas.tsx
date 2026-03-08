"use client";

import { useState, useRef, useLayoutEffect } from "react";
import {
  Maximize2,
  Download,
  Film,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudio } from "@/lib/store";
import { useVideoJobsStore } from "@/store/video-jobs";
import { MODELS } from "@/lib/types";
import type { VideoJob } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEDIA_FRAME_CLASS_NAME =
  "relative overflow-hidden rounded-[2rem] border border-border bg-muted/35 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)]";

function useMeasuredStageSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function getVideoModelLabel(modelId: string): string {
  return (
    MODELS.find((m) => m.id === modelId)?.label ??
    MODELS.find((m) => m.value === modelId)?.label ??
    modelId
  );
}

// ---------------------------------------------------------------------------
// Sub-components for video states
// ---------------------------------------------------------------------------

function VideoProcessingState({ job }: { job: VideoJob }) {
  const isQueued = job.status === "queued";
  return (
    <motion.div
      key={`video-processing-${job.id}`}
      initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
      className="flex flex-col items-center gap-6"
    >
      <div className="relative flex items-center justify-center size-20">
        <div className="absolute inset-0 border-[3px] border-border rounded-full" />
        <div className="absolute inset-0 border-[3px] border-primary rounded-full border-t-transparent animate-spin" />
        <Film className="size-6 text-primary" strokeWidth={1.5} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="font-serif text-2xl text-muted-foreground animate-pulse">
          {isQueued ? "Queued" : "Generating video"}
        </p>
        <p className="text-xs text-muted-foreground/60 max-w-xs text-center truncate">
          {getVideoModelLabel(job.model)} &middot; &ldquo;{job.prompt.slice(0, 60)}
          {job.prompt.length > 60 ? "..." : ""}&rdquo;
        </p>
      </div>
    </motion.div>
  );
}

function VideoCancelledState({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      key="video-cancelled"
      initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      className="flex flex-col items-center gap-4 bg-card/50 backdrop-blur-xl p-8 rounded-[2rem] border border-border shadow-2xl shadow-black/5"
    >
      <XCircle className="size-10 text-muted-foreground" strokeWidth={1.5} />
      <p className="max-w-sm text-center text-sm font-medium text-foreground">
        Video generation was cancelled
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onDismiss}
        className="rounded-full text-muted-foreground hover:text-foreground mt-2"
      >
        Dismiss
      </Button>
    </motion.div>
  );
}

function VideoErrorState({
  job,
  onDismiss,
}: {
  job: VideoJob;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      key="video-error"
      initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      className="flex flex-col items-center gap-4 bg-card/50 backdrop-blur-xl p-8 rounded-[2rem] border border-destructive/30 shadow-2xl shadow-black/5"
    >
      <AlertCircle className="size-10 text-destructive" strokeWidth={1.5} />
      <div className="flex flex-col items-center gap-1.5">
        <p className="max-w-sm text-center text-sm font-medium text-foreground">
          Video generation failed
        </p>
        {job.error && (
          <p className="max-w-xs text-center text-xs text-muted-foreground">
            {job.error}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onDismiss}
        className="rounded-full text-muted-foreground hover:text-foreground mt-2"
      >
        Dismiss
      </Button>
    </motion.div>
  );
}

function VideoPlayer({
  job,
  onDownload,
}: {
  job: VideoJob;
  onDownload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  const { ref: stageRef, size } = useMeasuredStageSize<HTMLDivElement>();

  return (
    <motion.div
      key={`video-player-${job.id}`}
      initial={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full w-full items-center justify-center px-4 py-3 sm:px-6 sm:py-4"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div ref={stageRef} className="relative h-full w-full">
        <div className="absolute inset-0 grid place-items-center">
          <div
            className={cn(MEDIA_FRAME_CLASS_NAME, "hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)]")}
            style={{
              maxWidth: size.width || undefined,
              maxHeight: size.height || undefined,
            }}
          >
            <video
              ref={videoRef}
              src={job.resultUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="block max-h-full max-w-full object-contain"
            />
          </div>
        </div>

        {/* Download action — always in the DOM for accessibility */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-end p-6 pointer-events-none",
            "transition-opacity duration-200",
            hover ? "opacity-100" : "opacity-0 focus-within:opacity-100",
          )}
        >
          <div className="pointer-events-auto flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-10 rounded-full bg-card/90 text-foreground backdrop-blur-md hover:bg-card shadow-lg hover:scale-105 transition-all"
                  onClick={onDownload}
                  aria-label="Download video"
                  title="Download video"
                >
                  <Download className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="text-xs font-medium">
                Download video
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Canvas
// ---------------------------------------------------------------------------

export function StudioCanvas() {
  const { state, openImageViewer } = useStudio();

  const { status, selectedImage } = state;
  const [showImageControls, setShowImageControls] = useState(false);
  const imagePreviewRef = useRef<HTMLImageElement>(null);
  const imageControlsRef = useRef<HTMLDivElement>(null);

  // Video job state
  const selectedJobId = useVideoJobsStore((s) => s.selectedJobId);
  const jobs = useVideoJobsStore((s) => s.jobs);
  const selectJob = useVideoJobsStore((s) => s.selectJob);

  const selectedVideoJob = selectedJobId
    ? jobs.find((j) => j.id === selectedJobId) ?? null
    : null;

  // Determine what to show: image takes precedence over video when both seem selected,
  // but the stores are mutually exclusive (selecting one clears the other at the UI level).
  const showImage = !selectedVideoJob && selectedImage;
  const showVideo = !!selectedVideoJob;

  function handleImageDownload() {
    if (!selectedImage) return;
    const link = document.createElement("a");
    link.href = selectedImage.imageUrl;
    link.download = `ideo-${selectedImage.id}.png`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleVideoDownload() {
    if (!selectedVideoJob?.resultUrl) return;
    const link = document.createElement("a");
    link.href = selectedVideoJob.resultUrl;
    link.download = `ideo-video-${selectedVideoJob.id}.mp4`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleVideoDismiss() {
    selectJob(null);
  }

  function handleImagePreviewClick(
    e: React.MouseEvent<HTMLButtonElement>,
    image: NonNullable<typeof selectedImage>
  ) {
    // Ignore pointer clicks on letterboxed whitespace inside the full-size button.
    // Keep keyboard activation (detail === 0) working for accessibility.
    if (e.detail > 0 && e.target === e.currentTarget) return;
    openImageViewer(image);
  }

  function handleImageMouseEnter() {
    setShowImageControls(true);
  }

  function handleImageMouseLeave(e: React.MouseEvent<HTMLImageElement>) {
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && imageControlsRef.current?.contains(nextTarget)) return;
    setShowImageControls(false);
  }

  function handleImageControlsMouseEnter() {
    setShowImageControls(true);
  }

  function handleImageControlsMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && imagePreviewRef.current?.contains(nextTarget)) return;
    setShowImageControls(false);
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden px-3 py-2 sm:px-4 sm:py-3">
      <AnimatePresence mode="sync">
        {/* ---- Image Generating State ---- */}
        {status === "generating" && !showVideo && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative flex items-center justify-center size-20">
              <div className="absolute inset-0 border-[3px] border-border rounded-full" />
              <div className="absolute inset-0 border-[3px] border-primary rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="font-serif text-2xl text-muted-foreground animate-pulse">
              Synthesizing
            </p>
          </motion.div>
        )}

        {/* ---- Selected Video Job: processing ---- */}
        {showVideo &&
          (selectedVideoJob.status === "queued" ||
            selectedVideoJob.status === "generating") && (
            <VideoProcessingState job={selectedVideoJob} />
          )}

        {/* ---- Selected Video Job: cancelled ---- */}
        {showVideo && selectedVideoJob.status === "cancelled" && (
          <VideoCancelledState onDismiss={handleVideoDismiss} />
        )}

        {/* ---- Selected Video Job: error ---- */}
        {showVideo && selectedVideoJob.status === "error" && (
          <VideoErrorState
            job={selectedVideoJob}
            onDismiss={handleVideoDismiss}
          />
        )}

        {/* ---- Selected Video Job: completed — Video player ---- */}
        {showVideo &&
          selectedVideoJob.status === "completed" &&
          selectedVideoJob.resultUrl && (
            <VideoPlayer
              job={selectedVideoJob}
              onDownload={handleVideoDownload}
            />
          )}

        {/* ---- Complete State — Show selected image ---- */}
        {status !== "generating" && status !== "error" && showImage && (
          <motion.div
            key={selectedImage.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-1"
          >
            {/*
              The image frame is sized purely by CSS:
              - w-full h-full: fills the padded inset
              - object-contain: preserves aspect ratio, fits entirely, never bleeds
              - No JS-measured constraints, no ResizeObserver delay → zero jank
              The parent flex centering + padding keeps uniform inset from all edges.
            */}
            <div
              className={cn(
                "pointer-events-auto group relative flex items-center justify-center w-full h-full",
              )}
            >
              <button
                type="button"
                onClick={(e) => handleImagePreviewClick(e, selectedImage)}
                className="flex h-full w-full items-center justify-center rounded-[2rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Open image preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imagePreviewRef}
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  onMouseEnter={handleImageMouseEnter}
                  onMouseLeave={handleImageMouseLeave}
                  className={cn(
                    "max-w-full max-h-full cursor-zoom-in object-contain",
                    "rounded-[2rem] border border-border bg-muted/35",
                    "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)]",
                    "transition-shadow duration-300",
                    "hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)]",
                  )}
                />
              </button>

              {/* Hover/Focus controls */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-end justify-center pb-8",
                  "opacity-0 transition-opacity duration-200",
                  "group-focus-within:opacity-100",
                  showImageControls && "opacity-100",
                )}
              >
                <div
                  ref={imageControlsRef}
                  onMouseEnter={handleImageControlsMouseEnter}
                  onMouseLeave={handleImageControlsMouseLeave}
                  className={cn(
                    "pointer-events-auto flex items-center gap-3",
                    "translate-y-2 transition-transform duration-300",
                    "group-focus-within:translate-y-0",
                    showImageControls && "translate-y-0",
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-10 rounded-full bg-card/90 text-foreground backdrop-blur-md hover:bg-card shadow-lg hover:scale-105 transition-all"
                        onClick={() => openImageViewer(selectedImage)}
                        aria-label="Expand image preview"
                      >
                        <Maximize2 className="size-4" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8} className="text-xs font-medium">
                      Expand preview
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-10 rounded-full bg-card/90 text-foreground backdrop-blur-md hover:bg-card shadow-lg hover:scale-105 transition-all"
                        onClick={handleImageDownload}
                        aria-label="Download image"
                      >
                        <Download className="size-4" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8} className="text-xs font-medium">
                      Download image
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ---- Empty/Idle State ---- */}
        {status !== "generating" &&
          status !== "error" &&
          !showImage &&
          !showVideo && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center opacity-40 pointer-events-none"
            />
          )}
      </AnimatePresence>
    </div>
  );
}
