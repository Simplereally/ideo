"use client";

import { useState, useRef } from "react";
import {
  Maximize2,
  Download,
  Film,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { useVideoJobsStore } from "@/store/video-jobs";
import { MODELS } from "@/lib/types";
import type { VideoJob } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_SELECTION_TRANSITION = {
  enter: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  exit: { duration: 0.12, ease: [0.4, 0, 1, 1] as const },
};

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

function VideoPlayer({
  job,
  onDownload,
}: {
  job: VideoJob;
  onDownload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      key={`video-player-${job.id}`}
      initial={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex items-center justify-center p-8 w-full h-full"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] transition-shadow duration-500 group",
          "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)] hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)]",
          "border border-border",
        )}
      >
        <video
          ref={videoRef}
          src={job.resultUrl}
          controls
          autoPlay
          muted
          loop
          playsInline
          className="max-h-[calc(100dvh-14rem)] max-w-[calc(100vw-6rem)] object-contain bg-muted"
        />

        {/* Hover overlay */}
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 flex items-start justify-end p-6 bg-gradient-to-b from-background/40 via-transparent to-transparent pointer-events-none"
            >
              <div className="pointer-events-auto flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-10 rounded-full bg-card/90 text-foreground backdrop-blur-md hover:bg-card shadow-lg hover:scale-105 transition-all"
                  onClick={onDownload}
                >
                  <Download className="size-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Canvas
// ---------------------------------------------------------------------------

export function StudioCanvas() {
  const { state, openImageViewer, resetStatus, setPrompt, setModel } =
    useStudio();
  const [imageHover, setImageHover] = useState(false);

  const { status, selectedImage, error } = state;

  // Video job state
  const selectedJobId = useVideoJobsStore((s) => s.selectedJobId);
  const jobs = useVideoJobsStore((s) => s.jobs);
  const selectJob = useVideoJobsStore((s) => s.selectJob);
  const retryJob = useVideoJobsStore((s) => s.retryJob);

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

  function handleVideoRetry() {
    if (!selectedVideoJob) return;
    const payload = retryJob(selectedVideoJob.id);
    if (payload) {
      setModel(payload.model);
      setPrompt(payload.params.prompt);
    }
    selectJob(null);
  }

  function handleVideoDismiss() {
    selectJob(null);
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pb-32">
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
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: IMAGE_SELECTION_TRANSITION.enter,
            }}
            exit={{
              opacity: 0,
              scale: 1.01,
              transition: IMAGE_SELECTION_TRANSITION.exit,
            }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-8"
          >
            <div
              className={cn(
                "pointer-events-auto relative overflow-hidden rounded-[2rem] transition-shadow duration-300 group",
                "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)] hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)]",
                "border border-border",
              )}
              onMouseEnter={() => setImageHover(true)}
              onMouseLeave={() => setImageHover(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.prompt}
                className="block max-h-[calc(100dvh-14rem)] max-w-[calc(100vw-6rem)] object-contain bg-muted"
              />

              {/* Hover overlay */}
              <AnimatePresence>
                {imageHover && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-background/60 via-transparent to-transparent p-6"
                  >
                    {/* Actions */}
                    <div className="pointer-events-auto flex items-center gap-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-10 rounded-full bg-card/90 text-foreground backdrop-blur-md hover:bg-card shadow-lg hover:scale-105 transition-all"
                        onClick={() => openImageViewer(selectedImage)}
                      >
                        <Maximize2 className="size-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-10 rounded-full bg-card/90 text-foreground backdrop-blur-md hover:bg-card shadow-lg hover:scale-105 transition-all"
                        onClick={handleImageDownload}
                      >
                        <Download className="size-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
