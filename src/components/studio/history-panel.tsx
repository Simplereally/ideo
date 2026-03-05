"use client";

import { X, Aperture, Film, Loader2, AlertCircle, Ban, RotateCcw, Copy, ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudio } from "@/lib/store";
import { useVideoJobsStore, getCompletedJobs, getActiveJobs, getErroredJobs } from "@/store/video-jobs";
import { useImageJobsStore, getActiveImageJobs } from "@/store/image-jobs";
import type { ImageJob, ImageJobStatus } from "@/store/image-jobs";
import { MODELS } from "@/lib/types";
import type { VideoJob, VideoGenerationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { GeneratedImage } from "@/lib/types";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getModelLabel(modelId: string): string {
  return (
    MODELS.find((m) => m.id === modelId)?.label ??
    MODELS.find((m) => m.value === modelId)?.label ??
    modelId
  );
}

async function copyPromptToClipboard(prompt: string) {
  try {
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt copied");
  } catch {
    toast.error("Failed to copy prompt");
  }
}

const STATUS_CONFIG: Record<
  VideoGenerationStatus,
  { label: string; color: string; icon: typeof Film }
> = {
  queued: { label: "Queued", color: "text-muted-foreground", icon: Loader2 },
  generating: { label: "Generating", color: "text-primary", icon: Loader2 },
  completed: { label: "Completed", color: "text-emerald-500", icon: Film },
  error: { label: "Failed", color: "text-destructive", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", icon: Ban },
};

const IMAGE_JOB_STATUS_CONFIG: Record<
  ImageJobStatus,
  { label: string; color: string; icon: typeof Loader2 }
> = {
  queued: { label: "Queued", color: "text-muted-foreground", icon: Loader2 },
  generating: { label: "Generating", color: "text-primary", icon: Loader2 },
  completed: { label: "Completed", color: "text-emerald-500", icon: ImageIcon },
  error: { label: "Failed", color: "text-destructive", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", icon: Ban },
};

// ---------------------------------------------------------------------------
// Image History Item (unchanged)
// ---------------------------------------------------------------------------

function HistoryItem({
  image,
  isSelected,
  onSelect,
  onRemove,
}: {
  image: GeneratedImage;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "ios-list-item group relative flex w-full gap-3 p-3 text-left",
        isSelected && "selected"
      )}
    >
      {/* Thumbnail */}
      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt={image.prompt}
          className="size-full object-cover"
        />
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground">
          {image.prompt}
        </p>
        <span className="text-[10px] font-medium text-muted-foreground">
          {timeAgo(image.createdAt)}
        </span>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {/* Copy prompt */}
        <div
          role="button"
          className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-foreground hover:scale-105 transition-all cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            copyPromptToClipboard(image.prompt);
          }}
          title="Copy prompt"
        >
          <Copy className="size-3" strokeWidth={2.5} />
        </div>

        {/* Remove */}
        <div
          role="button"
          className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-destructive hover:scale-105 transition-all cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Video Job Item
// ---------------------------------------------------------------------------

function VideoJobItem({
  job,
  isSelected,
  onSelect,
  onRemove,
  onCancel,
  onRetry,
}: {
  job: VideoJob;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const isActive = job.status === "queued" || job.status === "generating";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "ios-list-item group relative flex w-full gap-3 p-3 text-left",
        isSelected && "selected",
      )}
    >
      {/* Thumbnail placeholder / status icon */}
      <div
        className={cn(
          "relative flex items-center justify-center size-12 shrink-0 overflow-hidden rounded-lg border border-border",
          job.status === "completed" ? "bg-muted" : "bg-muted/50",
        )}
      >
        {job.status === "completed" && job.resultUrl ? (
          // Show first frame via poster-less video (browsers will show first frame)
          <Film className="size-5 text-emerald-500" strokeWidth={1.5} />
        ) : (
          <StatusIcon
            className={cn(
              "size-5",
              cfg.color,
              isActive && "animate-spin",
            )}
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground">
          {job.prompt}
        </p>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[10px] font-semibold", cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-muted-foreground/40">&middot;</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {getModelLabel(job.model)}
          </span>
          <span className="text-[10px] text-muted-foreground/40">&middot;</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {timeAgo(job.createdAt)}
          </span>
        </div>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {/* Copy prompt */}
        <div
          role="button"
          className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-foreground hover:scale-105 transition-all cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            copyPromptToClipboard(job.prompt);
          }}
          title="Copy prompt"
        >
          <Copy className="size-3" strokeWidth={2.5} />
        </div>

        {/* Retry for errored jobs */}
        {job.status === "error" && (
          <div
            role="button"
            className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-primary hover:scale-105 transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            title="Retry"
          >
            <RotateCcw className="size-3" strokeWidth={2.5} />
          </div>
        )}

        {/* Cancel for active jobs */}
        {isActive && (
          <div
            role="button"
            className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-destructive hover:scale-105 transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            title="Cancel"
          >
            <Ban className="size-3" strokeWidth={2.5} />
          </div>
        )}

        {/* Remove for terminal states */}
        {!isActive && (
          <div
            role="button"
            className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-destructive hover:scale-105 transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Active Image Job Item
// ---------------------------------------------------------------------------

function ActiveImageJobItem({
  job,
  onCancel,
  onRemove,
}: {
  job: ImageJob;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const cfg = IMAGE_JOB_STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const isActive = job.status === "queued" || job.status === "generating";

  return (
    <div className="ios-list-item group relative flex w-full gap-3 p-3 text-left">
      {/* Status icon */}
      <div className="relative flex items-center justify-center size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/50">
        <StatusIcon
          className={cn(
            "size-5",
            cfg.color,
            isActive && "animate-spin",
          )}
          strokeWidth={1.5}
        />
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground">
          {job.prompt}
        </p>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[10px] font-semibold", cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-muted-foreground/40">&middot;</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {getModelLabel(job.model)}
          </span>
          <span className="text-[10px] text-muted-foreground/40">&middot;</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {timeAgo(job.createdAt)}
          </span>
        </div>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {/* Copy prompt */}
        <div
          role="button"
          className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-foreground hover:scale-105 transition-all cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            copyPromptToClipboard(job.prompt);
          }}
          title="Copy prompt"
        >
          <Copy className="size-3" strokeWidth={2.5} />
        </div>

        {/* Cancel for active jobs */}
        {isActive && (
          <div
            role="button"
            className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-destructive hover:scale-105 transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            title="Cancel"
          >
            <Ban className="size-3" strokeWidth={2.5} />
          </div>
        )}

        {/* Remove for terminal states */}
        {!isActive && (
          <div
            role="button"
            className="flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border text-muted-foreground hover:text-destructive hover:scale-105 transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Divider
// ---------------------------------------------------------------------------

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel constants
// ---------------------------------------------------------------------------

const HISTORY_WIDTH = 320;

const PANEL_TRANSITION = {
  width: {
    type: "tween" as const,
    duration: 0.3,
    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
  },
  opacity: {
    type: "tween" as const,
    duration: 0.2,
    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
    delay: 0.05,
  },
};

// ---------------------------------------------------------------------------
// HistoryPanel
// ---------------------------------------------------------------------------

export function HistoryPanel({ overlay }: { overlay?: boolean } = {}) {
  const { state, selectImage, removeImage, clearHistory, toggleHistory } =
    useStudio();

  // Video jobs state
  const videoJobs = useVideoJobsStore((s) => s.jobs);
  const selectedJobId = useVideoJobsStore((s) => s.selectedJobId);
  const selectVideoJob = useVideoJobsStore((s) => s.selectJob);
  const removeVideoJob = useVideoJobsStore((s) => s.removeJob);
  const cancelVideoJob = useVideoJobsStore((s) => s.cancelJobLocal);
  const retryVideoJob = useVideoJobsStore((s) => s.retryJob);
  const clearCompletedVideoJobs = useVideoJobsStore(
    (s) => s.clearCompletedJobs,
  );

  // Image jobs state
  const imageJobs = useImageJobsStore((s) => s.jobs);
  const cancelImageJob = useImageJobsStore((s) => s.cancelJobLocal);
  const removeImageJob = useImageJobsStore((s) => s.removeJob);
  const clearTerminalImageJobs = useImageJobsStore((s) => s.clearTerminalJobs);

  const { setPrompt, setModel } = useStudio();

  // Partition video jobs
  const activeVideoJobs = videoJobs.filter(
    (j) => j.status === "queued" || j.status === "generating",
  );
  const completedVideoJobs = videoJobs.filter(
    (j) => j.status === "completed",
  );
  const terminalVideoJobs = videoJobs.filter(
    (j) => j.status === "error" || j.status === "cancelled",
  );

  // Partition image jobs (only show non-completed — completed go to history)
  const activeImageJobs = imageJobs.filter(
    (j) => j.status === "queued" || j.status === "generating",
  );
  const terminalImageJobs = imageJobs.filter(
    (j) => j.status === "error" || j.status === "cancelled",
  );

  const hasImages = state.history.length > 0;
  const hasVideoJobs = videoJobs.length > 0;
  const hasActiveOrTerminalImageJobs = activeImageJobs.length > 0 || terminalImageJobs.length > 0;
  const isEmpty = !hasImages && !hasVideoJobs && !hasActiveOrTerminalImageJobs;

  // Selecting a video job should deselect the image, and vice versa
  function handleSelectImage(image: GeneratedImage) {
    selectVideoJob(null);
    selectImage(image);
  }

  function handleSelectVideoJob(jobId: string) {
    selectImage(null);
    selectVideoJob(jobId);
  }

  function handleRetryVideoJob(jobId: string) {
    const payload = retryVideoJob(jobId);
    if (payload) {
      setModel(payload.model);
      setPrompt(payload.params.prompt);
    }
  }

  function handleClearAll() {
    clearHistory();
    clearCompletedVideoJobs();
    clearTerminalImageJobs();
  }

  // -- Shared panel content --
  const panelContent = (
    <div className="h-full flex flex-col bg-card rounded-3xl border border-border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          History
        </h2>
        <div className="flex items-center gap-3">
          {(hasImages || hasVideoJobs || hasActiveOrTerminalImageJobs) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-semibold text-primary hover:text-primary/80"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={toggleHistory}
            className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 opacity-40">
          <Aperture className="size-12 text-foreground" strokeWidth={1} />
          <p className="text-sm font-medium text-foreground">No history</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-4 pb-4">
          <ScrollArea className="h-full ios-list">
            <div className="flex flex-col">
              {/* Active image jobs — shown at the top */}
              {activeImageJobs.length > 0 && (
                <>
                  <SectionDivider label="Active Images" />
                  {activeImageJobs.map((job) => (
                    <ActiveImageJobItem
                      key={job.id}
                      job={job}
                      onCancel={() => cancelImageJob(job.id)}
                      onRemove={() => removeImageJob(job.id)}
                    />
                  ))}
                </>
              )}

              {/* Active video jobs */}
              {activeVideoJobs.length > 0 && (
                <>
                  <SectionDivider label="Active Videos" />
                  {activeVideoJobs.map((job) => (
                    <VideoJobItem
                      key={job.id}
                      job={job}
                      isSelected={selectedJobId === job.id}
                      onSelect={() => handleSelectVideoJob(job.id)}
                      onRemove={() => removeVideoJob(job.id)}
                      onCancel={() => cancelVideoJob(job.id)}
                      onRetry={() => handleRetryVideoJob(job.id)}
                    />
                  ))}
                </>
              )}

              {/* Errored / cancelled jobs */}
              {(terminalVideoJobs.length > 0 || terminalImageJobs.length > 0) && (
                <>
                  <SectionDivider label="Needs Attention" />
                  {terminalImageJobs.map((job) => (
                    <ActiveImageJobItem
                      key={job.id}
                      job={job}
                      onCancel={() => cancelImageJob(job.id)}
                      onRemove={() => removeImageJob(job.id)}
                    />
                  ))}
                  {terminalVideoJobs.map((job) => (
                    <VideoJobItem
                      key={job.id}
                      job={job}
                      isSelected={selectedJobId === job.id}
                      onSelect={() => handleSelectVideoJob(job.id)}
                      onRemove={() => removeVideoJob(job.id)}
                      onCancel={() => cancelVideoJob(job.id)}
                      onRetry={() => handleRetryVideoJob(job.id)}
                    />
                  ))}
                </>
              )}

              {/* Completed videos */}
              {completedVideoJobs.length > 0 && (
                <>
                  <SectionDivider label="Videos" />
                  {completedVideoJobs.map((job) => (
                    <VideoJobItem
                      key={job.id}
                      job={job}
                      isSelected={selectedJobId === job.id}
                      onSelect={() => handleSelectVideoJob(job.id)}
                      onRemove={() => removeVideoJob(job.id)}
                      onCancel={() => cancelVideoJob(job.id)}
                      onRetry={() => handleRetryVideoJob(job.id)}
                    />
                  ))}
                </>
              )}

              {/* Images */}
              {hasImages && (
                <>
                  {(hasVideoJobs || hasActiveOrTerminalImageJobs) && <SectionDivider label="Images" />}
                  {state.history.map((image) => (
                    <HistoryItem
                      key={image.id}
                      image={image}
                      isSelected={
                        !selectedJobId &&
                        state.selectedImage?.id === image.id
                      }
                      onSelect={() => handleSelectImage(image)}
                      onRemove={() => removeImage(image.id)}
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  // Overlay mode: parent handles positioning & transform. Render at full size.
  if (overlay) {
    return <div className="h-full w-full">{panelContent}</div>;
  }

  // Desktop mode: animated width sidebar in flex flow.
  return (
    <motion.aside
      initial={false}
      animate={{ width: state.isHistoryOpen ? HISTORY_WIDTH : 0 }}
      transition={PANEL_TRANSITION.width}
      className="flex flex-col shrink-0 h-full overflow-hidden"
    >
      <motion.div
        initial={false}
        animate={{ opacity: state.isHistoryOpen ? 1 : 0 }}
        transition={{
          duration: 0.2,
          ease: [0.32, 0.72, 0, 1],
          delay: state.isHistoryOpen ? 0.05 : 0,
        }}
        className="min-w-[320px] h-full"
      >
        {panelContent}
      </motion.div>
    </motion.aside>
  );
}
