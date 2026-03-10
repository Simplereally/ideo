import { describe, expect, it, vi, beforeEach } from "vitest";
import { AirforceVideoError } from "@/lib/services/airforce-video";
import {
  AirforceSubmissionCancelledError,
  extractAirforceRetryDirective,
  queueAirforceSubmission,
  resetAirforceSubmissionQueueForTests,
} from "./airforce-submission-queue";

describe("extractAirforceRetryDirective", () => {
  it("parses provider wait windows from the Airforce minute-limit message", () => {
    const directive = extractAirforceRetryDirective({
      upstreamStatus: 429,
      message:
        "Rate limit exceeded (1 request(s) per minute). Try again in 56 seconds. discord.gg/airforce",
    });

    expect(directive).toEqual({
      kind: "provider-wait",
      delayMs: 56_250,
      message:
        "Rate limit exceeded (1 request(s) per minute). Try again in 56 seconds. discord.gg/airforce",
    });
  });

  it("treats upstream 429s without a provider wait window as immediate retries", () => {
    const directive = extractAirforceRetryDirective(
      new AirforceVideoError(429, "Too many requests", {
        upstreamStatus: 429,
      }),
    );

    expect(directive).toEqual({
      kind: "immediate-429",
      delayMs: 0,
      message: "Too many requests",
    });
  });

  it("detects global rate limit errors and retries instantly", () => {
    const directive = extractAirforceRetryDirective(
      new AirforceVideoError(
        429,
        "Global rate limit exceeded (1 requests per second). Try again in 1.0 seconds. Or upgrade at api.airforce - discord.gg/airforce",
        { upstreamStatus: 429 },
      ),
    );

    expect(directive).toEqual({
      kind: "global-rate-limit",
      delayMs: 0,
      message:
        "Global rate limit exceeded (1 requests per second). Try again in 1.0 seconds. Or upgrade at api.airforce - discord.gg/airforce",
    });
  });

  it("detects global rate limit errors regardless of upstream status", () => {
    const directive = extractAirforceRetryDirective({
      upstreamStatus: 500,
      message:
        "Global rate limit exceeded (1 requests per second). Try again in 1.0 seconds. Or upgrade at api.airforce - discord.gg/airforce",
    });

    expect(directive).not.toBeNull();
    expect(directive!.kind).toBe("global-rate-limit");
  });

  it("ignores non-upstream-429 errors", () => {
    const directive = extractAirforceRetryDirective(
      new AirforceVideoError(500, "Upstream failed", {
        upstreamStatus: 500,
      }),
    );

    expect(directive).toBeNull();
  });
});

describe("queueAirforceSubmission", () => {
  beforeEach(() => {
    resetAirforceSubmissionQueueForTests();
  });

  it("retries after the provider-directed wait window", async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({
        upstreamStatus: 429,
        message:
          "Rate limit exceeded (1 request(s) per minute). Try again in 12 seconds. discord.gg/airforce",
      })
      .mockResolvedValueOnce("done");

    const result = await queueAirforceSubmission(operation, { sleep });

    expect(result).toBe("done");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(12_250);
  });

  it("retries immediate upstream 429s without waiting", async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({
        upstreamStatus: 429,
        message: "Too many requests",
      })
      .mockResolvedValueOnce("done");

    const result = await queueAirforceSubmission(operation, { sleep });

    expect(result).toBe("done");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it("serializes queued submissions across callers", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const firstPromise = queueAirforceSubmission(async () => {
      events.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first:end");
      return "first";
    });

    const secondPromise = queueAirforceSubmission(async () => {
      events.push("second:start");
      events.push("second:end");
      return "second";
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst?.();

    await expect(firstPromise).resolves.toBe("first");
    await expect(secondPromise).resolves.toBe("second");
    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("retries global rate limit errors transparently", async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({
        upstreamStatus: 429,
        message:
          "Global rate limit exceeded (1 requests per second). Try again in 1.0 seconds. Or upgrade at api.airforce - discord.gg/airforce",
      })
      .mockResolvedValueOnce("done");

    const result = await queueAirforceSubmission(operation, { sleep });

    expect(result).toBe("done");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it("stops before execution when the queued job was cancelled", async () => {
    await expect(
      queueAirforceSubmission(
        async () => "never",
        {
          isCancelled: () => true,
        },
      ),
    ).rejects.toBeInstanceOf(AirforceSubmissionCancelledError);
  });
});
