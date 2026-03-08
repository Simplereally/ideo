"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProviderConfig } from "./provider-config";
import { ProviderStatusBadge } from "./provider-status-badge";
import type { ProviderConfigurationState } from "./provider-state";

export interface ProviderCatalogItem {
  provider: ProviderConfig;
  state: ProviderConfigurationState;
  serverConnected: boolean;
  summary: string;
}

interface ProviderCatalogViewProps {
  items: ProviderCatalogItem[];
  onSelectProvider: (providerId: ProviderCatalogItem["provider"]["id"]) => void;
}

export function ProviderCatalogView({
  items,
  onSelectProvider,
}: ProviderCatalogViewProps) {
  return (
    <div className="space-y-3">
      {items.map(({ provider, state, serverConnected, summary }) => {
        const Icon = provider.icon;

        return (
          <article
            key={provider.id}
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              state.isConnected
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-border bg-muted/20",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl",
                    provider.accentBackgroundClassName,
                  )}
                >
                  <Icon
                    className={cn("size-4", provider.accentClassName)}
                    strokeWidth={2}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-foreground">
                      {provider.label}
                    </h3>
                    <ProviderStatusBadge
                      state={state}
                      serverConnected={serverConnected}
                    />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-foreground/85">
                    {provider.tagline}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {summary}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="size-3.5" strokeWidth={2} />
                {provider.docsLabel}
              </a>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl px-3 text-[11px] font-medium"
                onClick={() => onSelectProvider(provider.id)}
                aria-label={`Manage ${provider.label}`}
              >
                Manage
                <ChevronRight className="size-3.5" strokeWidth={2} />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
