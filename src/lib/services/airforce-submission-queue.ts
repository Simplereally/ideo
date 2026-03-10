import { AirforceVideoError } from "@/lib/services/airforce-video";

const PER_MINUTE_RATE_LIMIT_RE =
  /rate limit exceeded\s*\(1 request\(s\) per minute\).*?try again in\s+(\d{1,2})\s+seconds?/i;
const TRY_AGAIN_SECONDS_RE = /try again in\s+(\d{1,2})\s+seconds?/i;
const RATE_LIMIT_BUFFER_MS = 250;
const MIN_RETRY_SECONDS = 1;
const MAX_RETRY_SECONDS = 60;
const DEFAULT_MAX_IMMEDIATE_429_RETRIES = 2;

export interface AirforceRetryDirective {
  kind: "provider-wait" | "immediate-429";
  delayMs: number;
  message: string;
}

export interface QueueAirforceSubmissionOptions {
  isCancelled?: () => boolean;
  onRetryScheduled?: (directive: AirforceRetryDirective) => void;
  sleep?: (delayMs: number) => Promise<void>;
  maxImmediate429Retries?: number;
}

export class AirforceSubmissionCancelledError extends Error {
  constructor() {
    super("Airforce submission cancelled before execution");
    this.name = "AirforceSubmissionCancelledError";
  }
}

function hasOwnNumber(value: unknown, key: string): number | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    key in value &&
    typeof (value as Record<string, unknown>)[key] === "number"
  ) {
    return (value as Record<string, number>)[key];
  }

  return undefined;
}

function collectStrings(value: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 3 || value == null) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (typeof value !== "object") return [];
  if (seen.has(value)) return [];

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry, seen, depth + 1));
  }

  return Object.values(value).flatMap((entry) => collectStrings(entry, seen, depth + 1));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseRetryDelayMs(message: string): number | null {
  const providerMatch = message.match(PER_MINUTE_RATE_LIMIT_RE);
  const genericMatch = providerMatch ?? message.match(TRY_AGAIN_SECONDS_RE);
  const rawSeconds = genericMatch?.[1];
  if (!rawSeconds) return null;

  const parsedSeconds = Number.parseInt(rawSeconds, 10);
  if (!Number.isFinite(parsedSeconds)) return null;

  const clampedSeconds = Math.min(
    MAX_RETRY_SECONDS,
    Math.max(MIN_RETRY_SECONDS, parsedSeconds),
  );

  return clampedSeconds * 1000 + RATE_LIMIT_BUFFER_MS;
}

function getStatuses(error: unknown): { httpStatus?: number; upstreamStatus?: number } {
  if (error instanceof AirforceVideoError) {
    return {
      httpStatus: error.httpStatus,
      upstreamStatus: error.diagnostics.upstreamStatus,
    };
  }

  return {
    httpStatus: hasOwnNumber(error, "httpStatus") ?? hasOwnNumber(error, "status"),
    upstreamStatus:
      hasOwnNumber(error, "upstreamStatus") ??
      (typeof error === "object" &&
      error !== null &&
      "diagnostics" in error &&
      typeof (error as { diagnostics?: unknown }).diagnostics === "object"
        ? hasOwnNumber((error as { diagnostics?: unknown }).diagnostics, "upstreamStatus")
        : undefined),
  };
}

function getMessages(error: unknown): string[] {
  if (error instanceof AirforceVideoError) {
    return uniqueStrings([
      error.message,
      ...collectStrings(error.raw),
      ...collectStrings(error.diagnostics.upstreamBody),
    ]);
  }

  if (error instanceof Error) {
    return uniqueStrings([error.message, ...collectStrings(error)]);
  }

  return uniqueStrings(collectStrings(error));
}

export function extractAirforceRetryDirective(
  error: unknown,
): AirforceRetryDirective | null {
  const { upstreamStatus } = getStatuses(error);
  if (upstreamStatus !== 429) {
    return null;
  }

  const messages = getMessages(error);
  for (const message of messages) {
    const delayMs = parseRetryDelayMs(message);
    if (delayMs != null) {
      return {
        kind: "provider-wait",
        delayMs,
        message,
      };
    }
  }

  return {
    kind: "immediate-429",
    delayMs: 0,
    message: messages[0] ?? "Airforce upstream returned HTTP 429",
  };
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

class AirforceSubmissionQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  reset() {
    this.tail = Promise.resolve();
  }
}

const queue = new AirforceSubmissionQueue();

export function resetAirforceSubmissionQueueForTests(): void {
  queue.reset();
}

export async function queueAirforceSubmission<T>(
  operation: () => Promise<T>,
  options: QueueAirforceSubmissionOptions = {},
): Promise<T> {
  return queue.enqueue(async () => {
    let immediateRetryCount = 0;

    while (true) {
      if (options.isCancelled?.()) {
        throw new AirforceSubmissionCancelledError();
      }

      try {
        return await operation();
      } catch (error) {
        if (options.isCancelled?.()) {
          throw new AirforceSubmissionCancelledError();
        }

        const directive = extractAirforceRetryDirective(error);
        if (!directive) {
          throw error;
        }

        if (directive.kind === "immediate-429") {
          immediateRetryCount += 1;
          if (immediateRetryCount > (options.maxImmediate429Retries ?? DEFAULT_MAX_IMMEDIATE_429_RETRIES)) {
            throw error;
          }
        } else {
          immediateRetryCount = 0;
        }

        options.onRetryScheduled?.(directive);
        await (options.sleep ?? defaultSleep)(directive.delayMs);
      }
    }
  });
}
