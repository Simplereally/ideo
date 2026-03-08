import { useEffect, useState } from "react";
import type { ProviderStatus } from "@/app/api/providers/status/route";

const EMPTY: ProviderStatus = { google: false, vertex: false, fal: false, aiml: false, airforce: false };

/**
 * Fetches server-side provider configuration status once on mount.
 * Returns `{ status, loading }` — status is all-false while loading.
 */
export function useProviderStatus() {
  const [status, setStatus] = useState<ProviderStatus>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/providers/status")
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data: ProviderStatus) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        /* leave status as EMPTY */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading };
}
