"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useImageJobsStore } from "@/store/image-jobs";
import type { ImageJob } from "@/store/image-jobs";
import { useStudio } from "@/lib/store";
import { useVideoJobsStore } from "@/store/video-jobs";
import { MODELS, PROVIDER_SHORT_LABELS } from "@/lib/types";
import type { Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_ACCENT: Record<Provider, { dot: string; ring: string }> = {
  google: { dot: "bg-blue-500", ring: "border-blue-500/40" },
  vertex: { dot: "bg-emerald-500", ring: "border-emerald-500/40" },
  fal: { dot: "bg-violet-500", ring: "border-violet-500/40" },
  aiml: { dot: "bg-orange-500", ring: "border-orange-500/40" },
  airforce: { dot: "bg-sky-500", ring: "border-sky-500/40" },
};

/** Snappy tween — everything under 200ms feel. */
const CARD_TRANSITION = {
  type: "tween" as const,
  duration: 0.14,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

const STRIP_TRANSITION = {
  type: "tween" as const,
  duration: 0.18,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getModelLabel(modelId: string): string {
  return (
    MODELS.find((m) => m.id === modelId)?.label ??
    MODELS.find((m) => m.value === modelId)?.label ??
    modelId
  );
}

function truncatePrompt(prompt: string, maxLen = 44): string {
  if (prompt.length <= maxLen) return prompt;
  const trimmed = prompt.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.4 ? trimmed.slice(0, lastSpace) : trimmed) + "\u2026";
}

function formatElapsed(createdAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/** Time-based urgency tint for the elapsed counter. */
function elapsedColor(createdAt: number, now: number): string {
  const seconds = Math.floor((now - createdAt) / 1000);
  if (seconds < 30) return "text-muted-foreground";
  return "text-amber-500/80";
}

// ---------------------------------------------------------------------------
// Status Indicator — lightweight, provider-branded
// ---------------------------------------------------------------------------

const StatusIndicator = memo(function StatusIndicator({
  status,
  provider,
}: {
  status: "queued" | "generating";
  provider: Provider;
}) {
  const accent = PROVIDER_ACCENT[provider];

  if (status === "queued") {
    return (
      <div className="relative flex items-center justify-center size-[18px] shrink-0">
        <Clock className="size-3 text-muted-foreground/70" strokeWidth={2.2} />
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center size-[18px] shrink-0">
      <div className="absolute inset-0 rounded-full border-[1.5px] border-border/50" />
      <div
        className={cn(
          "absolute inset-0 rounded-full border-[1.5px] border-t-transparent animate-spin",
          accent.ring,
        )}
        style={{ animationDuration: "0.8s" }}
      />
      <div className={cn("size-1.5 rounded-full", accent.dot)} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Single Card
// ---------------------------------------------------------------------------

const PendingCard = memo(function PendingCard({
  job,
  now,
  onCancel,
  onSelect,
}: {
  job: ImageJob;
  now: number;
  onCancel: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isQueued = job.status === "queued";
  const elapsed = formatElapsed(job.createdAt, now);
  const providerLabel = PROVIDER_SHORT_LABELS[job.provider] ?? job.provider;
  const accent = PROVIDER_ACCENT[job.provider];

  const handleCancel = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCancel(job.id);
    },
    [job.id, onCancel],
  );

  const handleSelect = useCallback(() => {
    onSelect(job.id);
  }, [job.id, onSelect]);

  return (
    <motion.div
      layout
      layoutId={job.id}
      initial={{ opacity: 0, scale: 0.96, x: -6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: -6 }}
      transition={CARD_TRANSITION}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "group/card relative flex items-center gap-2 text-left",
        "rounded-lg px-2.5 py-[7px]",
        // Surface
        "bg-card/95 backdrop-blur-md",
        "border border-border/50",
        "shadow-sm",
        // Inner highlight — subtle top edge
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:rounded-t-lg",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.07] before:to-transparent",
        // Hover — instant, sharp
        "hover:border-border/80 hover:bg-card",
        "transition-[border-color,background-color] duration-100",
        // Sizing
        "max-w-[260px] min-w-0 shrink-0",
        // Active tap feedback (CSS only, no JS re-render)
        "active:scale-[0.985]",
      )}
    >
      {/* Status indicator */}
      <StatusIndicator
        status={isQueued ? "queued" : "generating"}
        provider={job.provider}
      />

      {/* Content */}
      <div className="flex flex-col min-w-0 flex-1 gap-[3px]">
        <span className="text-[11px] font-medium text-foreground/90 leading-tight truncate">
          {truncatePrompt(job.prompt)}
        </span>
        <div className="flex items-center gap-1 text-[10px] leading-none">
          <span className={cn("size-[5px] rounded-full shrink-0", accent.dot)} />
          <span className="text-muted-foreground/70 truncate">
            {providerLabel} · {isQueued ? "Queued" : "Generating"} · {getModelLabel(job.model)}
          </span>
          <span className="mx-0.5" />
          <span
            className={cn(
              "tabular-nums font-medium shrink-0 transition-colors duration-300",
              elapsedColor(job.createdAt, now),
            )}
          >
            {elapsed}
          </span>
          {job.attempts > 1 && (
            <span className="text-muted-foreground/40 shrink-0 ml-0.5">
              #{job.attempts}
            </span>
          )}
        </div>
      </div>

      {/* Cancel button — immediate reveal, no delay */}
      <button
        type="button"
        onClick={handleCancel}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "flex items-center justify-center size-[18px] rounded-md shrink-0",
          "text-muted-foreground/40",
          "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100",
          "hover:text-destructive hover:bg-destructive/10",
          "active:bg-destructive/15 active:scale-95",
          "transition-[opacity,color,background-color] duration-75",
          "cursor-pointer",
        )}
        aria-label="Cancel generation"
      >
        <X className="size-3" strokeWidth={2.5} />
      </button>
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// Strip
// ---------------------------------------------------------------------------

export function PendingImageJobsStrip() {
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Select the stable `jobs` array reference — deriving with .filter() inside
  // a selector returns a new array every call, which breaks useSyncExternalStore's
  // server snapshot caching requirement.
  const jobs = useImageJobsStore((s) => s.jobs);
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === "queued" || j.status === "generating"),
    [jobs],
  );
  const cancelJob = useImageJobsStore((s) => s.cancelJobLocal);
  const selectImageJob = useImageJobsStore((s) => s.selectJob);
  const selectVideoJob = useVideoJobsStore((s) => s.selectJob);
  const { selectImage } = useStudio();

  // Tick the elapsed timer every second while jobs are active.
  useEffect(() => {
    if (activeJobs.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeJobs.length]);

  // Auto-scroll to the newest card when a job is added.
  const prevCountRef = useRef(activeJobs.length);
  useEffect(() => {
    if (activeJobs.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
    prevCountRef.current = activeJobs.length;
  }, [activeJobs.length]);

  const handleCancel = useCallback(
    (id: string) => cancelJob(id),
    [cancelJob],
  );

  const handleSelect = useCallback(
    (id: string) => {
      selectImage(null);
      selectVideoJob(null);
      selectImageJob(id);
    },
    [selectImage, selectVideoJob, selectImageJob],
  );

  const jobCount = activeJobs.length;

  return (
    <AnimatePresence mode="popLayout">
      {jobCount > 0 && (
        <motion.div
          key="strip"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={STRIP_TRANSITION}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2 pb-1.5">
            {/* Job count pill — only when 2+ jobs */}
            {jobCount > 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={CARD_TRANSITION}
                className={cn(
                  "flex items-center gap-1 shrink-0",
                  "rounded-md px-1.5 py-[7px]",
                  "text-[10px] font-semibold tabular-nums text-muted-foreground/70",
                )}
              >
                <span className="size-1.5 rounded-full bg-primary/30 animate-pulse" />
                {jobCount}
              </motion.div>
            )}

            {/* Cards — horizontal scroll on mobile, flex-wrap on desktop */}
            <div
              ref={scrollRef}
              className={cn(
                "flex gap-1.5 min-w-0 flex-1",
                // Mobile: horizontal scroll, hide scrollbar
                "overflow-x-auto",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                // Desktop: allow wrapping
                "sm:flex-wrap sm:overflow-x-visible",
              )}
            >
              <AnimatePresence mode="popLayout">
                {activeJobs.map((job) => (
                  <PendingCard
                    key={job.id}
                    job={job}
                    now={now}
                    onCancel={handleCancel}
                    onSelect={handleSelect}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
