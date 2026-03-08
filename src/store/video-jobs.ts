import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  VideoGenerationStatus,
  VideoJob,
  VideoRequestParams,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Retry payload — what `retryJob` hands back to the caller
// ---------------------------------------------------------------------------

export interface VideoRetryPayload {
  model: string;
  provider: VideoJob["provider"];
  params: VideoRequestParams;
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface VideoJobsState {
  /** All tracked jobs, newest first. */
  jobs: VideoJob[];
  /** Currently-selected job id (for detail view). */
  selectedJobId: string | null;
  /** Ids of jobs that are still in-flight (queued | generating). */
  activeJobIds: string[];

  // ---- mutations ----
  addJob: (job: VideoJob) => void;
  updateJob: (id: string, patch: Partial<VideoJob>) => void;
  setJobStatus: (
    id: string,
    status: VideoGenerationStatus,
    patch?: Partial<VideoJob>,
  ) => void;
  markJobCompleted: (
    id: string,
    videoUrl: string,
    patch?: Partial<VideoJob>,
  ) => void;
  markJobError: (id: string, message: string, patch?: Partial<VideoJob>) => void;
  cancelJobLocal: (id: string) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;
  clearTerminalJobs: () => void;
  selectJob: (id: string | null) => void;
  /**
   * Build a retry payload from an existing job.
   * Returns `null` if the job doesn't exist.
   * Pure data extraction — no side-effects.
   */
  retryJob: (id: string) => VideoRetryPayload | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: ReadonlySet<VideoGenerationStatus> = new Set([
  "queued",
  "generating",
]);

const TERMINAL_STATUSES: ReadonlySet<VideoGenerationStatus> = new Set([
  "completed",
  "error",
  "cancelled",
]);

function deriveActiveIds(jobs: VideoJob[]): string[] {
  return jobs.filter((j) => ACTIVE_STATUSES.has(j.status)).map((j) => j.id);
}

function resolveSelectedJobId(
  jobs: VideoJob[],
  selectedJobId: string | null,
): string | null {
  return selectedJobId && jobs.some((job) => job.id === selectedJobId)
    ? selectedJobId
    : null;
}

function now(): number {
  return Date.now();
}

/**
 * Apply a patch to a single job by id inside the jobs array.
 * Returns a new array (immutable update) and bumps `updatedAt`.
 */
function patchJob(
  jobs: VideoJob[],
  id: string,
  patch: Partial<VideoJob>,
): VideoJob[] {
  return jobs.map((j) =>
    j.id === id ? { ...j, ...patch, updatedAt: now() } : j,
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useVideoJobsStore = create<VideoJobsState>()(
  persist(
    (set, get) => ({
      jobs: [],
      selectedJobId: null,
      activeJobIds: [],

      // ---- mutations ----

      addJob: (job) =>
        set((s) => {
          const jobs = [job, ...s.jobs];
          return { jobs, activeJobIds: deriveActiveIds(jobs) };
        }),

      updateJob: (id, patch) =>
        set((s) => {
          const jobs = patchJob(s.jobs, id, patch);
          return { jobs, activeJobIds: deriveActiveIds(jobs) };
        }),

      setJobStatus: (id, status, patch) =>
        set((s) => {
          const jobs = patchJob(s.jobs, id, { ...patch, status });
          return { jobs, activeJobIds: deriveActiveIds(jobs) };
        }),

      markJobCompleted: (id, videoUrl, patch) =>
        set((s) => {
          const jobs = patchJob(s.jobs, id, {
            ...patch,
            status: "completed",
            resultUrl: videoUrl,
          });
          return { jobs, activeJobIds: deriveActiveIds(jobs) };
        }),

      markJobError: (id, message, patch) =>
        set((s) => {
          const jobs = patchJob(s.jobs, id, {
            ...patch,
            status: "error",
            error: message,
          });
          return { jobs, activeJobIds: deriveActiveIds(jobs) };
        }),

      cancelJobLocal: (id) =>
        set((s) => {
          const jobs = patchJob(s.jobs, id, { status: "cancelled" });
          return { jobs, activeJobIds: deriveActiveIds(jobs) };
        }),

      removeJob: (id) =>
        set((s) => {
          const jobs = s.jobs.filter((j) => j.id !== id);
          return {
            jobs,
            activeJobIds: deriveActiveIds(jobs),
            selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
          };
        }),

      clearCompletedJobs: () =>
        set((s) => {
          const jobs = s.jobs.filter((j) => j.status !== "completed");
          return {
            jobs,
            activeJobIds: deriveActiveIds(jobs),
            selectedJobId: resolveSelectedJobId(jobs, s.selectedJobId),
          };
        }),

      clearTerminalJobs: () =>
        set((s) => {
          const jobs = s.jobs.filter((j) => !TERMINAL_STATUSES.has(j.status));
          return {
            jobs,
            activeJobIds: deriveActiveIds(jobs),
            selectedJobId: resolveSelectedJobId(jobs, s.selectedJobId),
          };
        }),

      selectJob: (id) => set({ selectedJobId: id }),

      retryJob: (id) => {
        const job = get().jobs.find((j) => j.id === id);
        if (!job) return null;
        return {
          model: job.model,
          provider: job.provider,
          params: { ...job.params },
        };
      },
    }),
    {
      name: "ideo-video-jobs",
    },
  ),
);

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/** Select only jobs with status `queued` or `generating`. */
export function getActiveJobs(state: VideoJobsState): VideoJob[] {
  return state.jobs.filter((j) => ACTIVE_STATUSES.has(j.status));
}

/** Select only jobs with status `completed`. */
export function getCompletedJobs(state: VideoJobsState): VideoJob[] {
  return state.jobs.filter((j) => j.status === "completed");
}

/** Select only jobs with status `error`. */
export function getErroredJobs(state: VideoJobsState): VideoJob[] {
  return state.jobs.filter((j) => j.status === "error");
}
