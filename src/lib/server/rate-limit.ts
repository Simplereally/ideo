// ---------------------------------------------------------------------------
// Lightweight in-memory per-IP rate limiter (server-only)
// ---------------------------------------------------------------------------
// Uses a sliding-window counter stored in a Map. No external dependencies.
// Suitable for single-process deployments (Vercel serverless / Edge).
//
// IMPORTANT: In multi-instance deployments (horizontal scaling), this limits
// per-instance, not globally. For global rate-limiting, use an external store.
// ---------------------------------------------------------------------------

interface WindowEntry {
  /** Request count in the current window. */
  count: number;
  /** Timestamp (ms) when the current window started. */
  windowStart: number;
}

export interface RateLimiterOptions {
  /** Maximum requests allowed per window. @default 20 */
  maxRequests?: number;
  /** Window duration in milliseconds. @default 60_000 (1 minute) */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Unix-ms timestamp when the current window resets. */
  resetAt: number;
}

export function createRateLimiter(opts: RateLimiterOptions = {}) {
  const maxRequests = opts.maxRequests ?? 20;
  const windowMs = opts.windowMs ?? 60_000;
  const store = new Map<string, WindowEntry>();

  // Periodic cleanup to prevent unbounded memory growth.
  // Runs every 5 minutes, evicts entries whose window has fully elapsed.
  const CLEANUP_INTERVAL = 5 * 60_000;
  let lastCleanup = Date.now();

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
      if (now - entry.windowStart >= windowMs) {
        store.delete(key);
      }
    }
  }

  return function check(ip: string): RateLimitResult {
    const now = Date.now();
    cleanup(now);

    let entry = store.get(ip);

    // Reset window if expired.
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
      store.set(ip, entry);
    }

    const resetAt = entry.windowStart + windowMs;

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt,
    };
  };
}

// ---------------------------------------------------------------------------
// Shared limiter instance for generation routes.
// 20 requests per minute per IP — generous for interactive use, blocks abuse.
// ---------------------------------------------------------------------------
export const generationLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60_000,
});

// ---------------------------------------------------------------------------
// Helper: extract client IP from a Next.js Request
// ---------------------------------------------------------------------------

export function getClientIp(request: Request): string {
  // Vercel / Cloudflare set these headers.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain multiple IPs; the first is the client.
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Fallback — should not happen in production behind a reverse proxy.
  return "unknown";
}

// ---------------------------------------------------------------------------
// Convenience: build a 429 NextResponse with standard headers
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
