"use client";

import { useMemo } from "react";
import type { ProviderStatus } from "@/app/api/providers/status/route";
import { PROVIDER_CONFIGS } from "@/components/studio/api-integrations/provider-config";
import { getProviderConfigurationState } from "@/components/studio/api-integrations/provider-state";
import type { Provider } from "@/lib/types";
import { useProviderStatus } from "@/hooks/use-provider-status";
import { useSettingsStore } from "@/store/settings";

export function getConfiguredProviders(
  settings: Parameters<typeof getProviderConfigurationState>[1],
  status: ProviderStatus,
): Provider[] {
  return PROVIDER_CONFIGS.filter((provider) =>
    getProviderConfigurationState(provider.id, settings, status[provider.id]).isConnected,
  ).map((provider) => provider.id);
}

export function useConfiguredProviders() {
  const settings = useSettingsStore();
  const { status, loading } = useProviderStatus();

  const configuredProviders = useMemo(
    () => getConfiguredProviders(settings, status),
    [settings, status],
  );

  return { configuredProviders, status, loading };
}
