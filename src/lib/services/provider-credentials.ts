import type { Provider } from "@/lib/types";
import type { SettingsState } from "@/store/settings";

// ---------------------------------------------------------------------------
// BYOK credential shapes — provider-specific structures included in request
// bodies so server routes can use client-supplied keys instead of env vars.
// ---------------------------------------------------------------------------

/** Single API key for google / fal / aiml. */
export interface SimpleKeyCredentials {
  apiKey: string;
}

/** Vertex requires a GCP access token + project metadata. */
export interface VertexCredentials {
  accessToken: string;
  projectId: string;
  location: string;
}

/**
 * Discriminated union of all possible credential shapes.
 * `undefined` means "no client-side key configured — fall back to server env".
 */
export type ProviderCredentials = SimpleKeyCredentials | VertexCredentials | undefined;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build provider-appropriate credentials from the settings store state.
 *
 * Returns `undefined` when the user has not configured a key for the given
 * provider, which signals the server route to fall back to its own env vars.
 *
 * @remarks This function is intentionally pure — no side-effects, no logging.
 * Callers must never log the returned value.
 */
export function buildProviderCredentials(
  provider: Provider,
  settings: Pick<
    SettingsState,
    | "googleApiKey"
    | "falApiKey"
    | "aimlApiKey"
    | "airforceApiKey"
    | "vertexAccessToken"
    | "vertexProjectId"
    | "vertexLocation"
  >,
): ProviderCredentials {
  switch (provider) {
    case "google": {
      const key = settings.googleApiKey.trim();
      return key ? { apiKey: key } : undefined;
    }
    case "fal": {
      const key = settings.falApiKey.trim();
      return key ? { apiKey: key } : undefined;
    }
    case "aiml": {
      const key = settings.aimlApiKey.trim();
      return key ? { apiKey: key } : undefined;
    }
    case "airforce": {
      const key = settings.airforceApiKey.trim();
      return key ? { apiKey: key } : undefined;
    }
    case "vertex": {
      const token = settings.vertexAccessToken.trim();
      const projectId = settings.vertexProjectId.trim();
      // Both accessToken and projectId are required; location has a default.
      if (!token || !projectId) return undefined;
      return {
        accessToken: token,
        projectId,
        location: settings.vertexLocation.trim() || "us-central1",
      };
    }
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Payload injector
// ---------------------------------------------------------------------------

/**
 * Merge credentials into a request payload object.
 *
 * When credentials are present they are added under the `credentials` key.
 * When absent (user hasn't configured BYOK), the payload is returned unchanged
 * so the server can fall back to env-based keys.
 *
 * @returns A new object — never mutates the input.
 */
export function injectCredentials<T extends object>(
  payload: T,
  credentials: ProviderCredentials,
): T & { credentials?: ProviderCredentials } {
  if (!credentials) return payload;
  return { ...payload, credentials };
}
