import { NextResponse } from "next/server";
import { uploadBase64ToR2 } from "@/lib/server/upload";
import { isAllowedModel } from "@/lib/server/model-allowlist";
import { extractApiKey } from "@/lib/server/extract-credentials";
import { generationLimiter, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { resolveApiKey } from "@/lib/server/resolve-keys";
import {
  buildAirforceVideoRequest,
  extractAirforceVideoItems,
  isSupportedAirforceVideoModel,
} from "@/lib/server/airforce-video";
import type { VideoRequestParams } from "@/lib/types";
import type { VideoGenerationResult } from "@/lib/services/video-generation-types";

const UPSTREAM = "https://api.airforce/v1/images/generations";

interface RouteBody extends VideoRequestParams {
  model?: string;
  credentials?: { apiKey?: string };
  image_urls?: string[];
}

interface UpstreamErrorDetail {
  message: string;
  upstreamStatus: number;
  upstreamBody?: unknown;
}

/**
 * Parse upstream error response and return structured detail.
 * Preserves full upstream JSON payload when available for diagnostics.
 */
async function parseUpstreamError(upstream: Response): Promise<UpstreamErrorDetail> {
  const rawText = await upstream.text().catch(() => "");
  const fallbackMessage = `Airforce API returned HTTP ${upstream.status}`;

  if (!rawText.trim()) {
    return {
      message: fallbackMessage,
      upstreamStatus: upstream.status,
    };
  }

  // Attempt to parse as JSON for structured error info
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;

    // Extract a human-readable message from common error shapes
    let message: string | undefined;
    if (typeof parsed.error === "string") {
      message = parsed.error;
    } else if (
      parsed.error &&
      typeof parsed.error === "object" &&
      "message" in parsed.error &&
      typeof (parsed.error as { message?: unknown }).message === "string"
    ) {
      message = (parsed.error as { message: string }).message;
    } else if (typeof parsed.message === "string") {
      message = parsed.message;
    } else if (typeof parsed.detail === "string") {
      message = parsed.detail;
    }

    return {
      message: message ?? fallbackMessage,
      upstreamStatus: upstream.status,
      upstreamBody: parsed,
    };
  } catch {
    // Not JSON; return truncated raw text
    return {
      message: rawText.slice(0, 500) || fallbackMessage,
      upstreamStatus: upstream.status,
      upstreamBody: rawText.slice(0, 1000),
    };
  }
}

export async function POST(request: Request) {
  const rl = generationLimiter(getClientIp(request));
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: RouteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientKey = extractApiKey(body);
  const keyResult = resolveApiKey(
    clientKey,
    process.env.AIRFORCE_API_KEY,
    "Airforce",
  );
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 401 });
  }
  const apiKey = keyResult.value;

  if (!body.model || typeof body.model !== "string" || !body.prompt?.trim()) {
    return NextResponse.json(
      { error: "`model` and `prompt` are required" },
      { status: 400 },
    );
  }

  if (!isAllowedModel("airforce", body.model)) {
    return NextResponse.json(
      { error: `Invalid model: ${body.model}` },
      { status: 400 },
    );
  }

  if (!isSupportedAirforceVideoModel(body.model)) {
    return NextResponse.json(
      { error: `Model ${body.model} is not supported by the Airforce video adapter.` },
      { status: 400 },
    );
  }

  try {
    const normalizedBody: VideoRequestParams = {
      ...body,
      imageUrl:
        body.imageUrl ??
        (Array.isArray(body.image_urls) && typeof body.image_urls[0] === "string"
          ? body.image_urls[0]
          : undefined),
    };
    const upstreamBody = buildAirforceVideoRequest(body.model, normalizedBody);
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!upstream.ok) {
      const errorDetail = await parseUpstreamError(upstream);
      // Include sent request shape for 500-class errors to aid contract debugging
      const responseBody: Record<string, unknown> = {
        error: errorDetail.message,
        upstreamStatus: errorDetail.upstreamStatus,
        upstreamBody: errorDetail.upstreamBody,
      };
      if (upstream.status >= 500) {
        responseBody.sentRequestBody = upstreamBody;
      }
      return NextResponse.json(responseBody, { status: upstream.status });
    }

    const rawText = await upstream.text();
    const items = extractAirforceVideoItems(rawText);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "No video output generated by Airforce API" },
        { status: 502 },
      );
    }

    const firstItem = items[0];
    let videoUrl: string | null = null;

    if (firstItem.url) {
      videoUrl = firstItem.url;
    } else if (firstItem.b64_json) {
      videoUrl = await uploadBase64ToR2(firstItem.b64_json, "video/mp4", "mp4");
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Airforce video response did not include a usable URL" },
        { status: 502 },
      );
    }

    const result: VideoGenerationResult = {
      id: crypto.randomUUID(),
      status: "completed",
      videoUrl,
      error: null,
      meta: {
        model: body.model,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Airforce video generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Airforce video generations return a final result and do not support polling." },
    { status: 405 },
  );
}
