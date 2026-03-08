// ---------------------------------------------------------------------------
// Extract BYOK credentials from request body.
//
// The client sends credentials nested under `body.credentials`, but legacy
// callers may still send `body.apiKey` or `body.vertex` at the top level.
// These helpers normalise both shapes into a single value, preferring the
// new nested form.
// ---------------------------------------------------------------------------

import type { VertexClientFields } from "./resolve-keys";

/** Minimal shape accepted by extractApiKey — no index signature required. */
interface ApiKeyBody {
  credentials?: { apiKey?: unknown };
  apiKey?: unknown;
}

/** Minimal shape accepted by extractVertexCredentials. */
interface VertexBody {
  credentials?: VertexClientFields;
  vertex?: VertexClientFields;
}

/**
 * Extract a single API key from the request body.
 *
 * Precedence: `body.credentials.apiKey` > `body.apiKey`.
 */
export function extractApiKey(body: ApiKeyBody): string | undefined {
  const nested =
    typeof body.credentials?.apiKey === "string"
      ? body.credentials.apiKey
      : undefined;
  const legacy =
    typeof body.apiKey === "string" ? body.apiKey : undefined;
  return nested ?? legacy;
}

/**
 * Extract Vertex AI credentials from the request body.
 *
 * Precedence: `body.credentials` > `body.vertex`.
 */
export function extractVertexCredentials(
  body: VertexBody,
): VertexClientFields | undefined {
  return body.credentials ?? body.vertex;
}
