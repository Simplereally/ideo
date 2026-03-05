// ---------------------------------------------------------------------------
// BYOK credential resolution: client-provided key > env var > missing.
// Pure functions with no side effects — safe to unit-test without mocking.
// ---------------------------------------------------------------------------

/**
 * Result of credential resolution.
 * Exactly one of `value` or `error` is set.
 */
export type KeyResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Single-key providers (Google, Fal, AIML)
// ---------------------------------------------------------------------------

/**
 * Resolve a single API key from a client-provided value or an env var.
 *
 * Precedence: `clientKey` (if non-empty string) > `envValue` > error.
 */
export function resolveApiKey(
  clientKey: string | undefined | null,
  envValue: string | undefined,
  providerLabel: string,
): KeyResult<string> {
  const key = nonEmpty(clientKey) ?? nonEmpty(envValue);
  if (!key) {
    return {
      ok: false,
      error: `No API key available for ${providerLabel}. Provide one in the request or configure it on the server.`,
    };
  }
  return { ok: true, value: key };
}

// ---------------------------------------------------------------------------
// Vertex AI (multi-field)
// ---------------------------------------------------------------------------

export interface VertexCredentials {
  accessToken: string;
  projectId: string;
  location: string;
}

export interface VertexClientFields {
  accessToken?: string;
  projectId?: string;
  location?: string;
}

/**
 * Resolve Vertex AI credentials.
 *
 * For each field the precedence is: client value > env var > (default for
 * location, error for the rest).
 */
export function resolveVertexCredentials(
  client: VertexClientFields | undefined | null,
  env: {
    accessToken?: string;
    projectId?: string;
    location?: string;
  },
): KeyResult<VertexCredentials> {
  const accessToken =
    nonEmpty(client?.accessToken) ?? nonEmpty(env.accessToken);
  const projectId = nonEmpty(client?.projectId) ?? nonEmpty(env.projectId);
  const location =
    nonEmpty(client?.location) ?? nonEmpty(env.location) ?? "us-central1";

  if (!accessToken || !projectId) {
    const missing: string[] = [];
    if (!accessToken) missing.push("accessToken");
    if (!projectId) missing.push("projectId");
    return {
      ok: false,
      error: `Missing Vertex AI credentials: ${missing.join(", ")}. Provide them in the request or configure them on the server.`,
    };
  }

  return { ok: true, value: { accessToken, projectId, location } };
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/** Return the string if it is non-empty after trimming, else `undefined`. */
function nonEmpty(v: string | undefined | null): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return undefined;
}
