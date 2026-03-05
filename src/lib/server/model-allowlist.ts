// ---------------------------------------------------------------------------
// Server-side model ID validation
// ---------------------------------------------------------------------------
// Allowlists are derived from the canonical MODELS registry. Only model IDs
// that appear in this list are accepted by generation routes — arbitrary
// strings from the client are rejected with 400.
// ---------------------------------------------------------------------------

import { MODELS } from "@/lib/types";
import type { Provider } from "@/lib/types";

/** Pre-computed sets of valid model `value` strings per provider. */
const allowlistsByProvider: Record<Provider, ReadonlySet<string>> = {
  google: new Set(MODELS.filter((m) => m.provider === "google").map((m) => m.value)),
  vertex: new Set(MODELS.filter((m) => m.provider === "vertex").map((m) => m.value)),
  fal: new Set(MODELS.filter((m) => m.provider === "fal").map((m) => m.value)),
  aiml: new Set(MODELS.filter((m) => m.provider === "aiml").map((m) => m.value)),
};

/**
 * Returns `true` if `modelId` is a recognised model for the given provider.
 * The check is O(1) against a pre-built Set.
 */
export function isAllowedModel(provider: Provider, modelId: string): boolean {
  return allowlistsByProvider[provider]?.has(modelId) ?? false;
}
