"use client";

import { useState, type FocusEvent, type ReactNode } from "react";
import {
  X,
  Aperture,
  Film,
  Loader2,
  AlertCircle,
  Ban,
  RotateCcw,
  Copy,
  ImageIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudio } from "@/lib/store";
import { useVideoJobsStore } from "@/store/video-jobs";
import { useImageJobsStore } from "@/store/image-jobs";
import type { ImageJob, ImageJobStatus } from "@/store/image-jobs";
import { MODELS } from "@/lib/types";
import type { GeneratedImage, VideoGenerationStatus, VideoJob } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGenerationActions } from "./generation-actions";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  buildHistoryPanelViewModel,
  HISTORY_FILTER_OPTIONS,
  type HistoryFilter,
  type HistoryPanelItem,
} from "./history-panel.model";

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
    MODELS.find((model) => model.id === modelId)?.label ??
    MODELS.find((model) => model.value === modelId)?.label ??
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

function ActionIconButton({
  label,
  onClick,
  className,
  children,
  isVisible = true,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
  isVisible?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-hidden={!isVisible}
      title={label}
      disabled={!isVisible}
      tabIndex={isVisible ? 0 : -1}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex size-6 items-center justify-center rounded-full bg-card shadow-sm border border-border transition-all",
        !isVisible && "pointer-events-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

function useRowActionVisibility() {
  const [isVisible, setIsVisible] = useState(false);

  function showActions() {
    setIsVisible(true);
  }

  function hideActions(event: FocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsVisible(false);
  }

  return {
    isVisible,
    containerProps: {
      onMouseEnter: showActions,
      onMouseLeave: () => setIsVisible(false),
      onFocusCapture: showActions,
      onBlurCapture: hideActions,
    },
  };
}

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
  const { isVisible, containerProps } = useRowActionVisibility();

  return (
    <div
      {...containerProps}
      className={cn(
        "ios-list-item group relative flex w-full gap-3 p-3",
        isSelected && "selected",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.imageUrl}
            alt={image.prompt}
            className="size-full object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground">
            {image.prompt}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">
              {getModelLabel(image.model)}
            </span>
            <span className="text-[10px] text-muted-foreground/40">&middot;</span>
            <span className="text-[10px] font-medium text-muted-foreground">
              {timeAgo(image.createdAt)}
            </span>
          </div>
        </div>
      </button>

      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100">
        <ActionIconButton
          label="Copy prompt"
          onClick={() => {
            void copyPromptToClipboard(image.prompt);
          }}
          isVisible={isVisible}
          className="text-muted-foreground hover:text-foreground hover:scale-105"
        >
          <Copy className="size-3" strokeWidth={2.5} />
        </ActionIconButton>
        <ActionIconButton
          label="Remove image"
          onClick={onRemove}
          isVisible={isVisible}
          className="text-muted-foreground hover:text-destructive hover:scale-105"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </ActionIconButton>
      </div>
    </div>
  );
}

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
  const { isVisible, containerProps } = useRowActionVisibility();
  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const isActive = job.status === "queued" || job.status === "generating";

  return (
    <div
      {...containerProps}
      className={cn(
        "ios-list-item group relative flex w-full gap-3 p-3",
        isSelected && "selected",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className={cn(
            "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border",
            job.status === "completed" ? "bg-muted" : "bg-muted/50",
          )}
        >
          {job.status === "completed" && job.resultUrl ? (
            <Film className="size-5 text-emerald-500" strokeWidth={1.5} />
          ) : (
            <StatusIcon
              className={cn("size-5", cfg.color, isActive && "animate-spin")}
              strokeWidth={1.5}
            />
          )}
        </div>

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
      </button>

      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100">
        <ActionIconButton
          label="Copy prompt"
          onClick={() => {
            void copyPromptToClipboard(job.prompt);
          }}
          isVisible={isVisible}
          className="text-muted-foreground hover:text-foreground hover:scale-105"
        >
          <Copy className="size-3" strokeWidth={2.5} />
        </ActionIconButton>

        {job.status === "error" && (
          <ActionIconButton
            label="Retry failed video generation"
            onClick={onRetry}
            isVisible={isVisible}
            className="text-muted-foreground hover:text-primary hover:scale-105"
          >
            <RotateCcw className="size-3" strokeWidth={2.5} />
          </ActionIconButton>
        )}

        {isActive && (
          <ActionIconButton
            label="Cancel video generation"
            onClick={onCancel}
            isVisible={isVisible}
            className="text-muted-foreground hover:text-destructive hover:scale-105"
          >
            <Ban className="size-3" strokeWidth={2.5} />
          </ActionIconButton>
        )}

        {!isActive && (
          <ActionIconButton
            label="Remove video"
            onClick={onRemove}
            isVisible={isVisible}
            className="text-muted-foreground hover:text-destructive hover:scale-105"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </ActionIconButton>
        )}
      </div>
    </div>
  );
}

function ImageJobItem({
  job,
  onCancel,
  onRemove,
  onRetry,
}: {
  job: ImageJob;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { isVisible, containerProps } = useRowActionVisibility();
  const cfg = IMAGE_JOB_STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const isActive = job.status === "queued" || job.status === "generating";
  const canRetry = job.status === "error";

  return (
    <div
      {...containerProps}
      className="ios-list-item group relative flex w-full gap-3 p-3 text-left"
    >
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry failed image generation"
          title="Retry failed image generation"
          className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-primary transition-all hover:scale-[1.03] hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            <span className="text-[8px] font-semibold uppercase tracking-[0.08em]">
              Retry
            </span>
          </div>
        </button>
      ) : (
        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
          <StatusIcon
            className={cn("size-5", cfg.color, isActive && "animate-spin")}
            strokeWidth={1.5}
          />
        </div>
      )}

      <button
        type="button"
        tabIndex={canRetry ? -1 : 0}
        onClick={() => {
          void copyPromptToClipboard(job.prompt);
        }}
        aria-label={`Image job: ${job.prompt}`}
        className="flex min-w-0 flex-1 cursor-default items-start gap-3 text-left focus:outline-none"
      >
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
      </button>

      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100">
        <ActionIconButton
          label="Copy prompt"
          onClick={() => {
            void copyPromptToClipboard(job.prompt);
          }}
          isVisible={isVisible}
          className="text-muted-foreground hover:text-foreground hover:scale-105"
        >
          <Copy className="size-3" strokeWidth={2.5} />
        </ActionIconButton>

        {canRetry && (
          <ActionIconButton
            label="Retry failed image generation"
            onClick={onRetry}
            isVisible={isVisible}
            className="text-muted-foreground hover:text-primary hover:scale-105"
          >
            <RotateCcw className="size-3" strokeWidth={2.5} />
          </ActionIconButton>
        )}

        {isActive && (
          <ActionIconButton
            label="Cancel image generation"
            onClick={onCancel}
            isVisible={isVisible}
            className="text-muted-foreground hover:text-destructive hover:scale-105"
          >
            <Ban className="size-3" strokeWidth={2.5} />
          </ActionIconButton>
        )}

        {!isActive && (
          <ActionIconButton
            label="Remove image job"
            onClick={onRemove}
            isVisible={isVisible}
            className="text-muted-foreground hover:text-destructive hover:scale-105"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </ActionIconButton>
        )}
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

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

export function HistoryPanel({ overlay }: { overlay?: boolean } = {}) {
  const { state, selectImage, removeImage, clearHistory, toggleHistory } =
    useStudio();
  const { retryImageJob, retryVideoJob } = useGenerationActions();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const videoJobs = useVideoJobsStore((store) => store.jobs);
  const selectedJobId = useVideoJobsStore((store) => store.selectedJobId);
  const selectVideoJob = useVideoJobsStore((store) => store.selectJob);
  const removeVideoJob = useVideoJobsStore((store) => store.removeJob);
  const cancelVideoJob = useVideoJobsStore((store) => store.cancelJobLocal);
  const clearTerminalVideoJobs = useVideoJobsStore(
    (store) => store.clearTerminalJobs,
  );

  const imageJobs = useImageJobsStore((store) => store.jobs);
  const cancelImageJob = useImageJobsStore((store) => store.cancelJobLocal);
  const removeImageJob = useImageJobsStore((store) => store.removeJob);
  const clearTerminalImageJobs = useImageJobsStore(
    (store) => store.clearTerminalJobs,
  );

  const viewModel = buildHistoryPanelViewModel({
    filter,
    savedImages: state.history,
    selectedImageId: state.selectedImage?.id ?? null,
    videoJobs,
    selectedVideoJobId: selectedJobId,
    imageJobs,
  });

  function closeOverlayAfterSelection() {
    if (overlay && isMobile && state.isHistoryOpen) {
      toggleHistory();
    }
  }

  function handleSelectImage(image: GeneratedImage) {
    selectVideoJob(null);
    selectImage(image);
    closeOverlayAfterSelection();
  }

  function handleSelectVideoJob(jobId: string) {
    selectImage(null);
    selectVideoJob(jobId);
    closeOverlayAfterSelection();
  }

  function handleClearAll() {
    clearHistory();
    clearTerminalVideoJobs();
    clearTerminalImageJobs();
  }

  function renderSectionItem(item: HistoryPanelItem) {
    switch (item.kind) {
      case "saved-image":
        return (
          <HistoryItem
            key={item.key}
            image={item.image}
            isSelected={item.isSelected}
            onSelect={() => handleSelectImage(item.image)}
            onRemove={() => removeImage(item.image.id)}
          />
        );
      case "video-job":
        return (
          <VideoJobItem
            key={item.key}
            job={item.job}
            isSelected={item.isSelected}
            onSelect={() => handleSelectVideoJob(item.job.id)}
            onRemove={() => removeVideoJob(item.job.id)}
            onCancel={() => cancelVideoJob(item.job.id)}
            onRetry={() => {
              void retryVideoJob(item.job.id);
            }}
          />
        );
      case "image-job":
        return (
          <ImageJobItem
            key={item.key}
            job={item.job}
            onCancel={() => cancelImageJob(item.job.id)}
            onRemove={() => removeImageJob(item.job.id)}
            onRetry={() => void retryImageJob(item.job.id)}
          />
        );
      default:
        return null;
    }
  }

  const panelContent = (
    <div className="flex h-full flex-col rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          History
        </h2>
        <div className="flex items-center gap-3">
          {viewModel.hasAnyItems && (
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
            aria-label="Close history panel"
            className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {!viewModel.hasAnyItems ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 opacity-40">
          <Aperture className="size-12 text-foreground" strokeWidth={1} />
          <p className="text-sm font-medium text-foreground">No history</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 px-4 pb-4">
          <div className="px-2 pb-3">
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(value) => {
                if (value) {
                  setFilter(value as HistoryFilter);
                }
              }}
              variant="outline"
              className="w-full rounded-full border border-border bg-muted/50 p-1"
              aria-label="History filters"
            >
              {HISTORY_FILTER_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={`Show ${option.label.toLowerCase()} history`}
                  className="flex-1 rounded-full border-0 px-3 text-xs font-semibold text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {!viewModel.hasVisibleItems && viewModel.emptyState ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center opacity-50">
              <Aperture className="size-10 text-foreground" strokeWidth={1} />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {viewModel.emptyState.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {viewModel.emptyState.description}
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full ios-list">
              <div className="flex flex-col">
                {viewModel.sections.map((section) => (
                  <div key={section.id}>
                    {section.showDivider && <SectionDivider label={section.label} />}
                    {section.items.map((item) => renderSectionItem(item))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return <div className="h-full w-full">{panelContent}</div>;
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: state.isHistoryOpen ? HISTORY_WIDTH : 0 }}
      transition={PANEL_TRANSITION.width}
      className="flex h-full shrink-0 flex-col overflow-hidden"
    >
      <motion.div
        initial={false}
        animate={{ opacity: state.isHistoryOpen ? 1 : 0 }}
        transition={{
          duration: 0.2,
          ease: [0.32, 0.72, 0, 1],
          delay: state.isHistoryOpen ? 0.05 : 0,
        }}
        aria-hidden={!state.isHistoryOpen}
        inert={!state.isHistoryOpen}
        className="h-full min-w-[320px]"
      >
        {panelContent}
      </motion.div>
    </motion.aside>
  );
}
