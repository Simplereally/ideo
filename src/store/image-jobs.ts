import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AspectRatio, Provider } from "@/lib/types";
import type { ImageGenerationRequest } from "@/lib/types/generation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageJobStatus =
  | "queued"
  | "generating"
  | "completed"
  | "error"
  | "cancelled";

export interface ImageJob {
  id: string;
  prompt: string;
  model: string;
  provider: Provider;
  aspectRatio: AspectRatio;
  /** Full request payload for resume/retry. */
  payload: ImageGenerationRequest;
  status: ImageJobStatus;
  /** Number of times we have attempted the fetch (incremented by startJob). */
  attempts: number;
  createdAt: number;
  updatedAt: number;
  /** Resulting image URL on success. */
  resultUrl?: string;
  /** Error message on failure. */
  error?: string;
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ImageJobsState {
  /** All tracked jobs, newest first. */
  jobs: ImageJob[];

  // ---- mutations ----
  addJob: (job: ImageJob) => void;
  startJob: (id: string) => void;
  markJobCompleted: (id: string, resultUrl: string) => void;
  markJobError: (id: string, message: string) => void;
  cancelJobLocal: (id: string) => void;
  removeJob: (id: string) => void;
  clearTerminalJobs: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): number {
  return Date.now();
}

function patchJob(
  jobs: ImageJob[],
  id: string,
  patch: Partial<ImageJob>,
): ImageJob[] {
  return jobs.map((j) =>
    j.id === id ? { ...j, ...patch, updatedAt: now() } : j,
  );
}

// ---------------------------------------------------------------------------
// Persist config
// ---------------------------------------------------------------------------

export const IMAGE_JOBS_PERSIST_NAME = "ideo-image-jobs";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useImageJobsStore = create<ImageJobsState>()(
  persist(
    (set) => ({
      jobs: [],

      addJob: (job) =>
        set((s) => ({ jobs: [job, ...s.jobs] })),

      startJob: (id) =>
        set((s) => ({
          jobs: patchJob(s.jobs, id, {
            status: "generating",
            attempts: (s.jobs.find((j) => j.id === id)?.attempts ?? 0) + 1,
          }),
        })),

      markJobCompleted: (id, resultUrl) =>
        set((s) => ({
          jobs: patchJob(s.jobs, id, { status: "completed", resultUrl }),
        })),

      markJobError: (id, message) =>
        set((s) => ({
          jobs: patchJob(s.jobs, id, { status: "error", error: message }),
        })),

      cancelJobLocal: (id) =>
        set((s) => ({
          jobs: patchJob(s.jobs, id, { status: "cancelled" }),
        })),

      removeJob: (id) =>
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== id),
        })),

      clearTerminalJobs: () =>
        set((s) => ({
          jobs: s.jobs.filter(
            (j) =>
              j.status !== "completed" &&
              j.status !== "error" &&
              j.status !== "cancelled",
          ),
        })),
    }),
    {
      name: IMAGE_JOBS_PERSIST_NAME,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: ReadonlySet<ImageJobStatus> = new Set([
  "queued",
  "generating",
]);

/** Jobs with status `queued` or `generating`. */
export function getActiveImageJobs(state: ImageJobsState): ImageJob[] {
  return state.jobs.filter((j) => ACTIVE_STATUSES.has(j.status));
}

/** Jobs with status `completed`. */
export function getCompletedImageJobs(state: ImageJobsState): ImageJob[] {
  return state.jobs.filter((j) => j.status === "completed");
}

/** Jobs with status `error`. */
export function getErroredImageJobs(state: ImageJobsState): ImageJob[] {
  return state.jobs.filter((j) => j.status === "error");
}
