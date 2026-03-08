"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ProviderStatus } from "@/app/api/providers/status/route";
import { PROVIDER_CONFIGS } from "@/components/studio/api-integrations/provider-config";
import { getProviderConfigurationState } from "@/components/studio/api-integrations/provider-state";
import type { Provider } from "@/lib/types";
import { useProviderStatus } from "@/hooks/use-provider-status";
import { useSettingsStore, type SettingsState } from "@/store/settings";

/**
 * The exact SettingsState keys read by provider field configs.
 * Derived once at module load from the static PROVIDER_CONFIGS so the
 * Zustand selector below subscribes only to fields that actually matter.
 */
const PROVIDER_SETTING_KEYS: (keyof SettingsState)[] = [
  ...new Set(
    PROVIDER_CONFIGS.flatMap((p) => p.fields.map((f) => f.key)),
  ),
];

const selectProviderSettings = (state: SettingsState) => {
  const slice: Record<string, string> = {};
  for (const key of PROVIDER_SETTING_KEYS) {
    slice[key] = state[key];
  }
  return slice as Pick<SettingsState, (typeof PROVIDER_SETTING_KEYS)[number]>;
};

export function getConfiguredProviders(
  settings: Parameters<typeof getProviderConfigurationState>[1],
  status: ProviderStatus,
): Provider[] {
  return PROVIDER_CONFIGS.filter((provider) =>
    getProviderConfigurationState(provider.id, settings, status[provider.id]).isConnected,
  ).map((provider) => provider.id);
}

export function useConfiguredProviders() {
  const settings = useSettingsStore(useShallow(selectProviderSettings));
  const { status, loading } = useProviderStatus();

  const configuredProviders = useMemo(
    () => getConfiguredProviders(settings, status),
    [settings, status],
  );

  return { configuredProviders, status, loading };
}
