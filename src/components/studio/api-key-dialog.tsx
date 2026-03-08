"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Provider } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import { useProviderStatus } from "@/hooks/use-provider-status";
import { useSettingsStore } from "@/store/settings";
import {
  PROVIDER_CONFIGS,
  PROVIDER_FIELDS,
  getProviderConfig,
} from "./api-integrations/provider-config";
import { ProviderCatalogView } from "./api-integrations/provider-catalog-view";
import { ProviderDetailView } from "./api-integrations/provider-detail-view";
import {
  clearProviderFields,
  getProviderConfigurationState,
  getProviderFieldValue,
  setProviderFieldValue,
} from "./api-integrations/provider-state";

function getProviderSummary(
  localState: ReturnType<typeof getProviderConfigurationState>["localState"],
  completedRequiredFieldCount: number,
  requiredFieldCount: number,
  serverConnected: boolean,
) {
  if (localState === "complete") {
    return "Stored locally and sent only with requests you make.";
  }

  if (localState === "partial") {
    const fallback = serverConnected ? " Server credentials are also available." : "";
    return `${completedRequiredFieldCount}/${requiredFieldCount} required fields entered.${fallback}`;
  }

  if (serverConnected) {
    return "Configured on the server. Add your own key if you want per-user isolation.";
  }

  return "No local credentials saved yet.";
}

export { PROVIDER_FIELDS };

export function ApiKeyDialog() {
  const { state, closeApiKeyDialog } = useStudio();
  const { status, loading } = useProviderStatus();
  const store = useSettingsStore();
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);

  useEffect(() => {
    if (!state.isApiKeyDialogOpen) {
      setActiveProvider(null);
    }
  }, [state.isApiKeyDialogOpen]);

  const providerItems = useMemo(
    () =>
      PROVIDER_CONFIGS.map((provider) => {
        const providerState = getProviderConfigurationState(
          provider.id,
          store,
          status[provider.id],
        );

        return {
          provider,
          state: providerState,
          serverConnected: status[provider.id],
          summary: getProviderSummary(
            providerState.localState,
            providerState.completedRequiredFieldCount,
            providerState.requiredFieldCount,
            status[provider.id],
          ),
        };
      }),
    [status, store],
  );

  const configuredCount = providerItems.filter((item) => item.state.isConnected).length;

  const activeItem = activeProvider
    ? providerItems.find((item) => item.provider.id === activeProvider) ?? null
    : null;

  const handleClose = useCallback(() => {
    setActiveProvider(null);
    closeApiKeyDialog();
  }, [closeApiKeyDialog]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose();
      }
    },
    [handleClose],
  );

  const handleBack = useCallback(() => {
    setActiveProvider(null);
  }, []);

  const handleSelectProvider = useCallback((providerId: Provider) => {
    setActiveProvider(providerId);
  }, []);

  const handleClearActiveProvider = useCallback(() => {
    if (!activeProvider) return;
    clearProviderFields(store, activeProvider);
  }, [activeProvider, store]);

  const activeFieldModels = useMemo(() => {
    if (!activeProvider) return [];

    const provider = getProviderConfig(activeProvider);

    return provider.fields.map((field) => ({
      field,
      value: getProviderFieldValue(store, field),
      onChange: (value: string) => setProviderFieldValue(store, field, value),
    }));
  }, [activeProvider, store]);

  return (
    <Dialog open={state.isApiKeyDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden rounded-2xl border border-border bg-card/85 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.02)] backdrop-blur-2xl backdrop-saturate-150 sm:max-w-[560px]",
        )}
        showCloseButton={false}
      >
        <div className="space-y-1.5 px-6 pb-4 pt-6">
          <DialogHeader className="space-y-1.5 p-0 text-left">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-[15px] font-semibold tracking-tight text-foreground">
                {activeItem ? activeItem.provider.label : "API Integrations"}
              </DialogTitle>
              {loading ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : !activeItem ? (
                <Badge
                  variant="secondary"
                  className="h-6 rounded-lg border-0 bg-amber-500/10 px-2 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-400"
                >
                  {`${configuredCount}/${providerItems.length} connected`}
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="max-w-[52ch] text-[12px] leading-relaxed text-muted-foreground">
              {activeItem
                ? "Provider-specific credentials save locally in your browser and are forwarded per request."
                : "Pick a provider first, then enter only the credentials that provider needs. This scales cleanly as the provider catalog grows."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator className="bg-border" />

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          {activeItem ? (
            <ProviderDetailView
              provider={activeItem.provider}
              state={activeItem.state}
              serverConnected={activeItem.serverConnected}
              fields={activeFieldModels}
              onBack={handleBack}
              onClear={handleClearActiveProvider}
            />
          ) : (
            <ProviderCatalogView
              items={providerItems}
              onSelectProvider={handleSelectProvider}
            />
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border bg-muted/40 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 rounded-lg px-3.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
