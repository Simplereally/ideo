"use client";

import { useState, useCallback, useMemo } from "react";
import {
  KeyRound,
  Cloud,
  Sparkles,
  ExternalLink,
  CircleCheck,
  CircleX,
  Cpu,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/lib/store";
import { useProviderStatus } from "@/hooks/use-provider-status";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
type ProviderId = "google" | "vertex" | "fal" | "aiml";

/** Fields each provider needs for BYOK. `required` means the field must be
 *  user-supplied for the provider to count as "key set". Fields with sensible
 *  defaults (like vertexLocation) are not required. */
export const PROVIDER_FIELDS: Record<
  ProviderId,
  { key: string; label: string; placeholder: string; secret: boolean; required: boolean }[]
> = {
  google: [
    {
      key: "googleApiKey",
      label: "API Key",
      placeholder: "AIza…",
      secret: true,
      required: true,
    },
  ],
  vertex: [
    {
      key: "vertexProjectId",
      label: "Project ID",
      placeholder: "my-gcp-project",
      secret: false,
      required: true,
    },
    {
      key: "vertexLocation",
      label: "Location",
      placeholder: "us-central1",
      secret: false,
      required: false,
    },
    {
      key: "vertexAccessToken",
      label: "Access Token",
      placeholder: "ya29.…",
      secret: true,
      required: true,
    },
  ],
  fal: [
    {
      key: "falApiKey",
      label: "API Key",
      placeholder: "fal_…",
      secret: true,
      required: true,
    },
  ],
  aiml: [
    {
      key: "aimlApiKey",
      label: "API Key",
      placeholder: "sk-…",
      secret: true,
      required: true,
    },
  ],
};

const PROVIDERS: {
  id: ProviderId;
  label: string;
  tagline: string;
  accent: string;
  accentBg: string;
  icon: React.ElementType;
  docsUrl: string;
  docsLabel: string;
}[] = [
  {
    id: "google",
    label: "Google AI",
    tagline: "Imagen 3 via AI Studio",
    accent: "text-blue-600 dark:text-blue-400",
    accentBg: "bg-blue-500/10",
    icon: KeyRound,
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "Docs",
  },
  {
    id: "vertex",
    label: "Vertex AI",
    tagline: "Imagen 3 & 4 via GCP",
    accent: "text-emerald-600 dark:text-emerald-400",
    accentBg: "bg-emerald-500/10",
    icon: Cloud,
    docsUrl:
      "https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview",
    docsLabel: "Docs",
  },
  {
    id: "fal",
    label: "Fal AI",
    tagline: "FLUX models",
    accent: "text-violet-600 dark:text-violet-400",
    accentBg: "bg-violet-500/10",
    icon: Sparkles,
    docsUrl: "https://fal.ai/dashboard/keys",
    docsLabel: "Docs",
  },
  {
    id: "aiml",
    label: "AI/ML",
    tagline: "Multi-provider image API",
    accent: "text-orange-600 dark:text-orange-400",
    accentBg: "bg-orange-500/10",
    icon: Cpu,
    docsUrl: "https://docs.aimlapi.com/",
    docsLabel: "Docs",
  },
];

/* ─── Key-set status badge ─── */
function KeyStatus({
  hasKey,
  serverConnected,
}: {
  hasKey: boolean;
  serverConnected: boolean;
}) {
  if (hasKey) {
    return (
      <Badge
        variant="secondary"
        className="h-5 gap-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 text-[10px] font-semibold px-2"
      >
        <CircleCheck className="size-3" strokeWidth={2.5} />
        Key set
      </Badge>
    );
  }
  if (serverConnected) {
    return (
      <Badge
        variant="secondary"
        className="h-5 gap-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 border-0 text-[10px] font-semibold px-2"
      >
        <CircleCheck className="size-3" strokeWidth={2.5} />
        Server key
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="h-5 gap-1 rounded-lg bg-muted text-muted-foreground border-0 text-[10px] font-medium px-2"
    >
      <CircleX className="size-3" strokeWidth={2} />
      Not configured
    </Badge>
  );
}

/* ─── Secret input with reveal toggle ─── */
function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  isSecret,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isSecret: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={isSecret && !revealed ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-[12px] font-mono pr-9 rounded-lg bg-muted/50 border-border"
        autoComplete="off"
      />
      {isSecret && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0.5 top-0.5 h-7 w-7 p-0"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? "Hide value" : "Reveal value"}
        >
          {revealed ? (
            <EyeOff className="size-3.5 text-muted-foreground" />
          ) : (
            <Eye className="size-3.5 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
}

/* ─── Provider section with inline editing ─── */
function ProviderSection({
  provider,
  serverConnected,
}: {
  provider: (typeof PROVIDERS)[number];
  serverConnected: boolean;
}) {
  const store = useSettingsStore();
  const fields = PROVIDER_FIELDS[provider.id];

  // Compute "has key" — any non-empty required field for this provider.
  // Fields with defaults (like vertexLocation) are not considered.
  const hasKey = fields.some((f) => {
    if (!f.required) return false;
    const val = store[f.key as keyof typeof store];
    return typeof val === "string" && val.length > 0;
  });

  const handleClear = useCallback(() => {
    for (const field of fields) {
      const setter = `set${field.key.charAt(0).toUpperCase()}${field.key.slice(1)}` as keyof typeof store;
      const fn = store[setter];
      if (typeof fn === "function") {
        // Reset to default — for vertexLocation use "us-central1"
        (fn as (v: string) => void)(
          field.key === "vertexLocation" ? "us-central1" : "",
        );
      }
    }
  }, [store, fields]);

  const Icon = provider.icon;

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        hasKey || serverConnected
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-border bg-muted/30",
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-xl",
              provider.accentBg,
            )}
          >
            <Icon className={cn("size-4", provider.accent)} strokeWidth={2} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {provider.label}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {provider.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <KeyStatus hasKey={hasKey} serverConnected={serverConnected} />
          {hasKey && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleClear}
              aria-label={`Clear ${provider.label} keys`}
            >
              <Trash2 className="size-3 text-muted-foreground" />
            </Button>
          )}
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3" strokeWidth={2} />
            {provider.docsLabel}
          </a>
        </div>
      </div>

      {/* Inline key inputs */}
      <div className="px-4 pb-3 space-y-2">
        {fields.map((field) => {
          const storeKey = field.key as keyof typeof store;
          const value = store[storeKey] as string;
          const setter = `set${field.key.charAt(0).toUpperCase()}${field.key.slice(1)}` as keyof typeof store;
          const setFn = store[setter] as (v: string) => void;

          return (
            <div key={field.key} className="space-y-1">
              <Label
                htmlFor={`byok-${field.key}`}
                className="text-[11px] text-muted-foreground font-medium"
              >
                {field.label}
              </Label>
              <SecretInput
                id={`byok-${field.key}`}
                value={value}
                onChange={setFn}
                placeholder={field.placeholder}
                isSecret={field.secret}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function ApiKeyDialog() {
  const { state, closeApiKeyDialog } = useStudio();
  const { status, loading } = useProviderStatus();
  const store = useSettingsStore();

  const configuredCount = useMemo(() => {
    let count = 0;
    for (const p of PROVIDERS) {
      const fields = PROVIDER_FIELDS[p.id];
      const hasKey = fields.some((f) => {
        if (!f.required) return false;
        const val = store[f.key as keyof typeof store];
        return typeof val === "string" && val.length > 0;
      });
      if (hasKey || status[p.id]) count++;
    }
    return count;
  }, [status, store]);

  return (
    <Dialog
      open={state.isApiKeyDialogOpen}
      onOpenChange={(open) => {
        if (!open) closeApiKeyDialog();
      }}
    >
      <DialogContent
        className={cn(
          "sm:max-w-[480px] rounded-2xl p-0 gap-0 overflow-hidden",
          "bg-card/80 backdrop-blur-2xl backdrop-saturate-150",
          "border border-border",
          "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.02)]",
        )}
        showCloseButton={false}
      >
        {/* ═══════ Header ═══════ */}
        <div className="px-6 pt-6 pb-4 space-y-1.5">
          <DialogHeader className="space-y-1.5 text-left p-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[15px] font-semibold text-foreground tracking-tight">
                API Integrations
              </DialogTitle>
              {loading ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0 text-[10px] font-semibold px-2 tabular-nums"
                >
                  {`${configuredCount}/4 connected`}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-[12px] text-muted-foreground leading-relaxed">
              Enter your own API keys below. Keys are stored locally in your
              browser and sent to the server per-request.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator className="bg-border" />

        {/* ═══════ Provider list with inline BYOK inputs ═══════ */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {PROVIDERS.map((p) => (
            <ProviderSection
              key={p.id}
              provider={p}
              serverConnected={status[p.id]}
            />
          ))}
        </div>

        {/* ═══════ Footer ═══════ */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-muted/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => closeApiKeyDialog()}
            className="h-8 rounded-lg px-3.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
