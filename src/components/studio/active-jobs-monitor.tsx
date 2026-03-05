"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useVideoJobsStore } from "@/store/video-jobs";
import { useStudio } from "@/lib/store";
import { MODELS } from "@/lib/types";
import type { VideoJob } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVideoModelLabel(modelId: string): string {
  return (
    MODELS.find((m) => m.id === modelId)?.label ??
    MODELS.find((m) => m.value === modelId)?.label ??
    modelId
  );
}

// ---------------------------------------------------------------------------
// Single Job Chip
// ---------------------------------------------------------------------------

function JobChip({
  job,
  onSelect,
  onCancel,
}: {
  job: VideoJob;
  onSelect: () => void;
  onCancel: () => void;
}) {
  const isQueued = job.status === "queued";

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5",
        "bg-card/95 backdrop-blur-md border border-border shadow-lg",
        "hover:shadow-xl hover:border-border transition-all",
        "cursor-pointer",
      )}
    >
      {/* Spinner */}
      <div className="relative flex items-center justify-center size-5 shrink-0">
        <div className="absolute inset-0 border-2 border-primary/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-primary rounded-full border-t-transparent animate-spin" />
      </div>

      {/* Label */}
      <div className="flex flex-col items-start min-w-0">
        <span className="text-[11px] font-semibold text-foreground truncate max-w-[140px]">
          {job.prompt.slice(0, 40)}{job.prompt.length > 40 ? "..." : ""}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">
          {isQueued ? "Queued" : "Generating"} &middot;{" "}
          {getVideoModelLabel(job.model)}
        </span>
      </div>

      {/* Cancel */}
      <button
        type="button"
        className="flex size-5 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        tabIndex={-1}
        title="Cancel job"
      >
        <X className="size-3" strokeWidth={2.5} />
      </button>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Active Jobs Monitor
// ---------------------------------------------------------------------------

export function ActiveJobsMonitor() {
  const jobs = useVideoJobsStore((s) => s.jobs);
  const selectJob = useVideoJobsStore((s) => s.selectJob);
  const cancelJob = useVideoJobsStore((s) => s.cancelJobLocal);
  const { selectImage } = useStudio();

  const activeJobs = jobs.filter(
    (j) => j.status === "queued" || j.status === "generating",
  );

  function handleSelect(jobId: string) {
    selectImage(null);
    selectJob(jobId);
  }

  if (activeJobs.length === 0) return null;

  return (
    <div className="absolute bottom-36 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {activeJobs.map((job) => (
          <div key={job.id} className="pointer-events-auto">
            <JobChip
              job={job}
              onSelect={() => handleSelect(job.id)}
              onCancel={() => cancelJob(job.id)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
