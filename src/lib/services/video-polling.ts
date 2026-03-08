import type { VideoGenerationStatus } from "@/lib/types";
import type { VideoGenerationResult } from "./video-generation-types";

// ---------------------------------------------------------------------------
// Video generation polling utility
// ---------------------------------------------------------------------------

/** Statuses that will never change — stop polling once reached. */
const TERMINAL_STATUSES: ReadonlySet<VideoGenerationStatus> = new Set([
  "completed",
  "error",
  "cancelled",
]);

export function isTerminalStatus(status: VideoGenerationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface PollOptions {
  /** Base interval in ms for the first tick. Subsequent ticks grow via backoff. @default 10_000 */
  intervalMs?: number;
  /** Maximum interval the backoff can reach. @default 60_000 */
  maxIntervalMs?: number;
  /** Backoff multiplier applied after each tick. @default 1.4 */
  backoffFactor?: number;
  /** Maximum total time before giving up. @default 900_000 (15 min) */
  timeoutMs?: number;
  /**
   * Called after every successful poll tick with the latest result.
   * Useful for logging or lightweight side-effects.
   */
  onTick?: (result: VideoGenerationResult, elapsedMs: number) => void;
  /**
   * Called whenever the normalized status changes compared to the
   * previous tick. First tick always fires.
   */
  onStatus?: (status: VideoGenerationStatus, result: VideoGenerationResult) => void;
}

export interface PollHandle {
  /** Resolves with the final result once a terminal status is reached or timeout fires. */
  promise: Promise<VideoGenerationResult>;
  /** Abort polling early. The promise will resolve with the last known result. */
  cancel: () => void;
}

// ---------------------------------------------------------------------------
// Core polling loop
// ---------------------------------------------------------------------------

/**
 * Poll a single video generation until it reaches a terminal status or the
 * timeout expires.
 *
 * The `fetcher` parameter decouples this utility from the HTTP layer — callers
 * pass a closure over `getVideoGeneration(...)` so the poller stays
 * framework-agnostic and easily testable.
 *
 * @param fetcher — async function that returns a normalized video result for one poll tick.
 * @param opts    — interval, timeout, and optional callbacks.
 * @returns       A handle with a promise (final result) and a cancel function.
 */
export function pollVideoGeneration(
  fetcher: () => Promise<VideoGenerationResult>,
  opts: PollOptions = {},
): PollHandle {
  const baseInterval = opts.intervalMs ?? 10_000;
  const maxInterval = opts.maxIntervalMs ?? 60_000;
  const backoffFactor = opts.backoffFactor ?? 1.4;
  const timeoutMs = opts.timeoutMs ?? 15 * 60 * 1000;

  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let tickCount = 0;

  // Resolve the outer promise from inside the loop.
  let resolve: (result: VideoGenerationResult) => void;

  const promise = new Promise<VideoGenerationResult>((_resolve) => {
    resolve = _resolve;
  });

  const cleanup = () => {
    if (timerId != null) clearTimeout(timerId);
    if (timeoutId != null) clearTimeout(timeoutId);
    timerId = null;
    timeoutId = null;
  };

  /**
   * Compute the next interval with capped exponential backoff + jitter.
   * Jitter is ±20% of the computed interval to decorrelate concurrent polls.
   */
  function nextInterval(): number {
    const raw = Math.min(baseInterval * Math.pow(backoffFactor, tickCount), maxInterval);
    const jitter = raw * 0.2 * (Math.random() * 2 - 1); // ±20%
    return Math.max(1_000, Math.round(raw + jitter));
  }

  // Track the last status for the `onStatus` delta callback.
  let lastStatus: VideoGenerationStatus | null = null;
  let lastResult: VideoGenerationResult | null = null;
  const startTime = Date.now();

  const tick = async () => {
    if (cancelled) return;

    try {
      const result = await fetcher();

      // Guard: if cancel/timeout fired while the fetch was in-flight, discard
      // the result to prevent stale state updates.
      if (cancelled) return;

      lastResult = result;
      const elapsed = Date.now() - startTime;

      opts.onTick?.(result, elapsed);

      if (result.status !== lastStatus) {
        opts.onStatus?.(result.status, result);
        lastStatus = result.status;
      }

      if (isTerminalStatus(result.status)) {
        cleanup();
        resolve(result);
        return;
      }
    } catch (err) {
      // Non-fatal: network hiccups shouldn't abort the whole poll loop.
      // We continue to the next tick; the timeout guard still applies.
      // If the caller needs visibility into transient errors they can
      // wrap their fetcher with try/catch logging.
    }

    if (!cancelled) {
      tickCount++;
      timerId = setTimeout(tick, nextInterval());
    }
  };

  // Timeout guard — resolve with the last known result (or a synthetic error).
  timeoutId = setTimeout(() => {
    cancelled = true;
    cleanup();

    if (lastResult) {
      resolve({
        ...lastResult,
        status: lastResult.status === "completed" ? "completed" : "error",
        error: lastResult.error ?? "Polling timed out",
      });
    } else {
      resolve({
        id: "",
        status: "error",
        videoUrl: null,
        error: "Polling timed out before any response was received",
        meta: {},
      });
    }
  }, timeoutMs);

  // Kick off immediately (no initial delay).
  tick();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      cleanup();
      if (lastResult) {
        resolve(lastResult);
      } else {
        resolve({
          id: "",
          status: "cancelled",
          videoUrl: null,
          error: "Polling cancelled before any response",
          meta: {},
        });
      }
    },
  };
}
