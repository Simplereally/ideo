"use client";

import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SecretInput } from "./secret-input";
import type { ProviderConfig, ProviderFieldConfig } from "./provider-config";
import { ProviderStatusBadge } from "./provider-status-badge";
import type { ProviderConfigurationState } from "./provider-state";

export interface ProviderFieldViewModel {
  field: ProviderFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

interface ProviderDetailViewProps {
  provider: ProviderConfig;
  state: ProviderConfigurationState;
  serverConnected: boolean;
  fields: ProviderFieldViewModel[];
  onBack: () => void;
  onClear: () => void;
}

export function ProviderDetailView({
  provider,
  state,
  serverConnected,
  fields,
  onBack,
  onClear,
}: ProviderDetailViewProps) {
  const Icon = provider.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-0.5 h-8 rounded-xl px-2 text-[11px] font-medium"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-2xl",
                  provider.accentBackgroundClassName,
                )}
              >
                <Icon
                  className={cn("size-4", provider.accentClassName)}
                  strokeWidth={2}
                />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">
                  {provider.label}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {provider.tagline}
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-[46ch] text-[12px] leading-relaxed text-muted-foreground">
              {provider.description} Changes save locally as you type and are
              attached per request.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ProviderStatusBadge state={state} serverConnected={serverConnected} />
          {state.hasAnyLocalValue ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-xl p-0"
              onClick={onClear}
              aria-label={`Clear ${provider.label} keys`}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          ) : null}
        </div>
      </div>

      {provider.DetailSlot ? <provider.DetailSlot providerId={provider.id} /> : null}

      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-foreground">
              Credentials
            </p>
            <p className="text-[11px] text-muted-foreground">
              Required fields must be filled for this provider to count as ready.
            </p>
          </div>
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3.5" strokeWidth={2} />
            {provider.docsLabel}
          </a>
        </div>

        <div className="space-y-4">
          {fields.map(({ field, value, onChange }) => (
            <div key={field.key} className="space-y-1.5">
              <Label
                htmlFor={`byok-${field.key}`}
                className="text-[11px] font-medium text-foreground"
              >
                {field.label}
                {field.required ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    Required
                  </span>
                ) : null}
              </Label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {field.description}
              </p>
              <SecretInput
                id={`byok-${field.key}`}
                value={value}
                onChange={onChange}
                placeholder={field.placeholder}
                isSecret={field.secret}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
