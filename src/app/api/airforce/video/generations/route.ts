import { NextResponse } from "next/server";
import { uploadBase64ToR2 } from "@/lib/server/upload";
import { isAllowedModel } from "@/lib/server/model-allowlist";
import { extractApiKey } from "@/lib/server/extract-credentials";
import { generationLimiter, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { resolveApiKey } from "@/lib/server/resolve-keys";
import {
  logGenerationProviderError,
  logGenerationRequest,
  logGenerationResponse,
  logGenerationTextResponse,
} from "@/lib/server/generation-debug";
import {
  AirforceVideoProviderError,
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

function addGrokImageToVideoErrorHint(
  requestBody: Record<string, unknown>,
  upstreamStatus: number,
  message: string,
): string {
  if (upstreamStatus !== 400) return message;
  if (requestBody.model !== "grok-imagine-video") return message;
  if (!Array.isArray(requestBody.image_urls) || requestBody.image_urls.length === 0) {
    return message;
  }

  const normalizedMessage = message.trim();
  const isOpaqueProvider400 =
    /provider error \(400 bad request\)/i.test(normalizedMessage) ||
    normalizedMessage === "Airforce API returned HTTP 400";

  if (!isOpaqueProvider400) {
    return message;
  }

  return `${normalizedMessage} Airforce Grok image-to-video sometimes rejects specific prompt and reference-image combinations with an opaque 400. This request shape is valid; try a less suggestive prompt or a different reference image.`;
}

function isAirforceProviderError(error: unknown): error is AirforceVideoProviderError {
  return (
    error instanceof AirforceVideoProviderError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "AirforceVideoProviderError" &&
      typeof (error as { httpStatus?: unknown }).httpStatus === "number")
  );
}

async function parseUpstreamError(upstream: Response): Promise<UpstreamErrorDetail> {
  const rawText = await upstream.text().catch(() => "");
  const fallbackMessage = `Airforce API returned HTTP ${upstream.status}`;

  if (!rawText.trim()) {
    return {
      message: fallbackMessage,
      upstreamStatus: upstream.status,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as {
      message?: string;
      detail?: string;
      details?: unknown;
      error?: string | { message?: string; detail?: string; details?: unknown };
    };

    if (typeof parsed.error === "string") {
      return {
        message: parsed.error,
        upstreamStatus: upstream.status,
        upstreamBody: parsed,
      };
    }

    if (parsed.error && typeof parsed.error === "object" && parsed.error.message) {
      const detailText =
        typeof parsed.error.detail === "string" ? ` - ${parsed.error.detail}` : "";
      return {
        message: `${parsed.error.message}${detailText}`,
        upstreamStatus: upstream.status,
        upstreamBody: parsed.error.details ?? parsed,
      };
    }

    if (parsed.message) {
      return {
        message: parsed.message,
        upstreamStatus: upstream.status,
        upstreamBody: parsed.details ?? parsed,
      };
    }

    if (parsed.detail) {
      return {
        message: parsed.detail,
        upstreamStatus: upstream.status,
        upstreamBody: parsed.details ?? parsed,
      };
    }

    return {
      message: fallbackMessage,
      upstreamStatus: upstream.status,
      upstreamBody: parsed,
    };
  } catch {
    return {
      message: rawText.slice(0, 500) || fallbackMessage,
      upstreamStatus: upstream.status,
      upstreamBody: rawText.slice(0, 1000),
    };
  }
}

function normalizeRouteBody(body: RouteBody): VideoRequestParams {
  const imageUrlsFromArray = Array.isArray(body.image_urls)
    ? body.image_urls.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : undefined;

  return {
    ...body,
    imageUrl: body.imageUrl ?? imageUrlsFromArray?.[0],
    imageUrls: body.imageUrls ?? imageUrlsFromArray,
  };
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
  const keyResult = resolveApiKey(clientKey, process.env.AIRFORCE_API_KEY, "Airforce");
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 401 });
  }
  const apiKey = keyResult.value;

  if (!body.model || typeof body.model !== "string" || !body.prompt?.trim()) {
    return NextResponse.json({ error: "`model` and `prompt` are required" }, { status: 400 });
  }

  if (!isAllowedModel("airforce", body.model)) {
    return NextResponse.json({ error: `Invalid model: ${body.model}` }, { status: 400 });
  }

  if (!isSupportedAirforceVideoModel(body.model)) {
    return NextResponse.json(
      { error: `Model ${body.model} is not supported by the Airforce video adapter.` },
      { status: 400 },
    );
  }

  let upstreamBody: Record<string, unknown> | null = null;

  try {
    const normalizedBody = normalizeRouteBody(body);
    upstreamBody = await buildAirforceVideoRequest(body.model, normalizedBody);
    logGenerationRequest("POST api/airforce/video/generations", upstreamBody);

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
      errorDetail.message = addGrokImageToVideoErrorHint(
        upstreamBody,
        errorDetail.upstreamStatus,
        errorDetail.message,
      );
      logGenerationResponse("POST api/airforce/video/generations", errorDetail);

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
    logGenerationTextResponse(
      "POST api/airforce/video/generations",
      upstream.status,
      rawText,
    );

    const items = extractAirforceVideoItems(rawText);
    logGenerationResponse("POST api/airforce/video/generations", items);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No video output generated by Airforce API" },
        { status: 502 },
      );
    }

    const lastItem = items[items.length - 1];
    let videoUrl: string | null = null;

    if (lastItem.url) {
      videoUrl = lastItem.url;
    } else if (lastItem.b64_json) {
      videoUrl = await uploadBase64ToR2(lastItem.b64_json, "video/mp4", "mp4");
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
    if (isAirforceProviderError(error)) {
      logGenerationProviderError(
        "POST api/airforce/video/generations",
        200,
        error.httpStatus,
        error.providerPayload,
      );

      return NextResponse.json(
        {
          error: addGrokImageToVideoErrorHint(
            upstreamBody ?? {},
            error.httpStatus,
            error.message,
          ),
          upstreamStatus: error.httpStatus,
          upstreamBody: error.providerPayload,
        },
        { status: error.httpStatus },
      );
    }

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
