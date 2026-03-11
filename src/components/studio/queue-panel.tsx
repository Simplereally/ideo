"use client";

import { useEffect, useMemo, useState } from "react";
import { Film, ImageIcon, LoaderCircle, X } from "lucide-react";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudio } from "@/lib/store";
import { MODELS, PROVIDER_SHORT_LABELS, type Provider, type VideoJob } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useImageJobsStore, type ImageJob } from "@/store/image-jobs";
import { useVideoJobsStore } from "@/store/video-jobs";

const QUEUE_WIDTH = 304;

const PANEL_TRANSITION = {
  width: {
    type: "tween" as const,
    duration: 0.3,
    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
  },
  opacity: {
    duration: 0.2,
    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
  },
};

const PROVIDER_ACCENT: Record<Provider, { dot: string; ring: string }> = {
  google: { dot: "bg-blue-500", ring: "border-blue-500/40" },
  vertex: { dot: "bg-emerald-500", ring: "border-emerald-500/40" },
  fal: { dot: "bg-violet-500", ring: "border-violet-500/40" },
  aiml: { dot: "bg-orange-500", ring: "border-orange-500/40" },
  airforce: { dot: "bg-sky-500", ring: "border-sky-500/40" },
};

type QueueItem =
  | {
      kind: "image";
      id: string;
      job: ImageJob;
      isSelected: boolean;
    }
  | {
      kind: "video";
      id: string;
      job: VideoJob;
      isSelected: boolean;
    };

function getModelLabel(modelId: string): string {
  return (
    MODELS.find((model) => model.id === modelId)?.label ??
    MODELS.find((model) => model.value === modelId)?.label ??
    modelId
  );
}

function formatElapsed(createdAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function elapsedTone(createdAt: number, now: number): string {
  return now - createdAt >= 30_000 ? "text-amber-500" : "text-muted-foreground";
}

function getQueueStatus(item: QueueItem): {
  label: string;
  tone: string;
  isGenerating: boolean;
} {
  if (item.kind === "video" && item.job.requestPending) {
    return {
      label: "Submitting",
      tone: "text-amber-500",
      isGenerating: false,
    };
  }

  if (item.job.status === "generating") {
    return {
      label: "Generating",
      tone: "text-primary",
      isGenerating: true,
    };
  }

  return {
    label: "Queued",
    tone: "text-amber-500",
    isGenerating: false,
  };
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1 pt-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/70" />
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function QueueCard({
  item,
  now,
  onSelect,
  onCancel,
}: {
  item: QueueItem;
  now: number;
  onSelect: (item: QueueItem) => void;
  onCancel: (item: QueueItem) => void;
}) {
  const providerAccent = PROVIDER_ACCENT[item.job.provider];
  const providerLabel = PROVIDER_SHORT_LABELS[item.job.provider] ?? item.job.provider;
  const elapsed = formatElapsed(item.job.createdAt, now);
  const status = getQueueStatus(item);
  const modelLabel = getModelLabel(item.job.model);
  const mediaLabel = item.kind === "image" ? "Image" : "Video";
  const MediaIcon = item.kind === "image" ? ImageIcon : Film;
  const attempts = item.kind === "image" ? item.job.attempts : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={item.isSelected}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
      className={cn(
        "group relative rounded-[22px] border px-3 py-3 text-left transition-all duration-200",
        "bg-background/80 shadow-[0_12px_30px_rgba(0,0,0,0.03)] backdrop-blur-sm",
        item.isSelected
          ? "border-amber-500/40 bg-amber-500/[0.05] shadow-[0_18px_40px_rgba(217,119,6,0.12)]"
          : "border-border/70 hover:border-border hover:bg-background",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <MediaIcon className="size-3" strokeWidth={2.1} />
              {mediaLabel}
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.12em]",
                status.tone,
              )}
            >
              {status.label}
            </span>
          </div>

          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {item.job.prompt}
          </p>

          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", providerAccent.dot)} />
            <span className="truncate">{providerLabel}</span>
            <span className="text-muted-foreground/40">&middot;</span>
            <span className="truncate">{modelLabel}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium">
            <span className={cn("tabular-nums", elapsedTone(item.job.createdAt, now))}>
              {elapsed}
            </span>
            {attempts && attempts > 1 ? (
              <>
                <span className="text-muted-foreground/40">&middot;</span>
                <span className="text-muted-foreground">Try {attempts}</span>
              </>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCancel(item);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          aria-label={item.kind === "image" ? "Cancel image generation" : "Cancel video generation"}
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export function QueuePanel({ overlay }: { overlay?: boolean } = {}) {
  const { state, selectImage, toggleQueue } = useStudio();
  const isMobile = useIsMobile();
  const [now, setNow] = useState(() => Date.now());

  const imageJobs = useImageJobsStore((store) => store.jobs);
  const selectedImageJobId = useImageJobsStore((store) => store.selectedJobId);
  const selectImageJob = useImageJobsStore((store) => store.selectJob);
  const cancelImageJob = useImageJobsStore((store) => store.cancelJobLocal);
  const videoJobs = useVideoJobsStore((store) => store.jobs);
  const selectedVideoJobId = useVideoJobsStore((store) => store.selectedJobId);
  const selectVideoJob = useVideoJobsStore((store) => store.selectJob);
  const cancelVideoJob = useVideoJobsStore((store) => store.cancelJobLocal);

  const imageItems = useMemo<QueueItem[]>(
    () =>
      imageJobs
        .filter((job) => job.status === "queued" || job.status === "generating")
        .map((job) => ({
          kind: "image" as const,
          id: job.id,
          job,
          isSelected: selectedImageJobId === job.id,
        })),
    [imageJobs, selectedImageJobId],
  );

  const videoItems = useMemo<QueueItem[]>(
    () =>
      videoJobs
        .filter((job) => job.status === "queued" || job.status === "generating")
        .map((job) => ({
          kind: "video" as const,
          id: job.id,
          job,
          isSelected: selectedVideoJobId === job.id,
        })),
    [selectedVideoJobId, videoJobs],
  );

  const generatingItems = useMemo(
    () => [...imageItems, ...videoItems].filter((item) => item.job.status === "generating"),
    [imageItems, videoItems],
  );

  const queuedItems = useMemo(
    () => [...imageItems, ...videoItems].filter((item) => item.job.status === "queued"),
    [imageItems, videoItems],
  );

  const totalCount = generatingItems.length + queuedItems.length;

  useEffect(() => {
    if (totalCount === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [totalCount]);

  function closeOverlayAfterSelection() {
    if (overlay && isMobile && state.isQueueOpen) {
      toggleQueue();
    }
  }

  function handleSelect(item: QueueItem) {
    selectImage(null);

    if (item.kind === "image") {
      selectVideoJob(null);
      selectImageJob(item.id);
    } else {
      selectImageJob(null);
      selectVideoJob(item.id);
    }

    closeOverlayAfterSelection();
  }

  function handleCancel(item: QueueItem) {
    if (item.kind === "image") {
      cancelImageJob(item.id);
      return;
    }

    cancelVideoJob(item.id);
  }

  const summaryLabel =
    generatingItems.length > 0 && queuedItems.length > 0
      ? `${generatingItems.length} running · ${queuedItems.length} queued`
      : generatingItems.length > 0
        ? `${generatingItems.length} running`
        : queuedItems.length > 0
          ? `${queuedItems.length} queued`
          : "Queued and generating jobs live here";

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Queue</h2>
          <p className="mt-1 text-xs text-muted-foreground">{summaryLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {totalCount > 0 ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {totalCount}
            </span>
          ) : null}
          <button
            type="button"
            onClick={toggleQueue}
            aria-label="Close queue panel"
            className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-3">
        <div className="flex h-full flex-col overflow-hidden rounded-[22px] border border-border/70 bg-muted/[0.35] p-1.5">
          {totalCount === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center opacity-60">
              <LoaderCircle className="size-10 text-foreground/70" strokeWidth={1.5} />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Queue is clear</p>
                <p className="text-xs text-muted-foreground">
                  New generations stack here until they finish or fail.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-3 p-1.5 pr-2">
                {generatingItems.length > 0 ? (
                  <section className="space-y-2">
                    <SectionHeader label="Generating" count={generatingItems.length} />
                    {generatingItems.map((item) => (
                      <QueueCard
                        key={item.id}
                        item={item}
                        now={now}
                        onSelect={handleSelect}
                        onCancel={handleCancel}
                      />
                    ))}
                  </section>
                ) : null}

                {queuedItems.length > 0 ? (
                  <section className="space-y-2">
                    <SectionHeader label="Queued" count={queuedItems.length} />
                    {queuedItems.map((item) => (
                      <QueueCard
                        key={item.id}
                        item={item}
                        now={now}
                        onSelect={handleSelect}
                        onCancel={handleCancel}
                      />
                    ))}
                  </section>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );

  if (overlay) {
    return <div className="h-full w-full">{panelContent}</div>;
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: state.isQueueOpen ? QUEUE_WIDTH : 0 }}
      transition={PANEL_TRANSITION.width}
      className="flex h-full shrink-0 flex-col overflow-hidden"
    >
      <motion.div
        initial={false}
        animate={{ opacity: state.isQueueOpen ? 1 : 0 }}
        transition={{
          ...PANEL_TRANSITION.opacity,
          delay: state.isQueueOpen ? 0.05 : 0,
        }}
        aria-hidden={!state.isQueueOpen}
        inert={!state.isQueueOpen}
        className="h-full min-w-[304px]"
      >
        {panelContent}
      </motion.div>
    </motion.aside>
  );
}
