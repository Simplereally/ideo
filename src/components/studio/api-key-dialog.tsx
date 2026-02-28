"use client";

import { useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Cloud,
  Sparkles,
  ExternalLink,
  CircleCheck,
  CircleX,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudio } from "@/lib/store";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
type ProviderTab = "google" | "vertex" | "fal";

const PROVIDER_META: Record<
  ProviderTab,
  {
    label: string;
    tagline: string;
    accent: string;
    accentBg: string;
    icon: React.ElementType;
    docsUrl: string;
    docsLabel: string;
  }
> = {
  google: {
    label: "Google AI",
    tagline: "Imagen 3 via AI Studio",
    accent: "text-blue-600",
    accentBg: "bg-blue-500/10",
    icon: KeyRound,
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "Get API Key",
  },
  vertex: {
    label: "Vertex AI",
    tagline: "Imagen 3 & 4 via GCP",
    accent: "text-emerald-600",
    accentBg: "bg-emerald-500/10",
    icon: Cloud,
    docsUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview",
    docsLabel: "Vertex Docs",
  },
  fal: {
    label: "Fal AI",
    tagline: "FLUX models",
    accent: "text-violet-600",
    accentBg: "bg-violet-500/10",
    icon: Sparkles,
    docsUrl: "https://fal.ai/dashboard/keys",
    docsLabel: "Get API Key",
  },
};

/* ─── Secret input with toggle ─── */
function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  onEnter,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onEnter?: () => void;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative group">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border-black/[0.06] bg-black/[0.02] pl-3.5 pr-10 text-[13px] font-mono text-neutral-800 placeholder:text-neutral-400 placeholder:font-sans focus-visible:ring-amber-500/20 focus-visible:border-amber-500/30 transition-all"
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-1/2 right-2 -translate-y-1/2 size-6 text-neutral-400 hover:text-neutral-600 hover:bg-transparent"
        onClick={() => setShow(!show)}
      >
        {show ? (
          <EyeOff className="size-3.5" />
        ) : (
          <Eye className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

/* ─── Connection badge ─── */
function ConnectionStatus({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <Badge variant="secondary" className="h-5 gap-1 rounded-lg bg-emerald-50 text-emerald-700 border-0 text-[10px] font-semibold px-2">
        <CircleCheck className="size-3" strokeWidth={2.5} />
        Connected
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="h-5 gap-1 rounded-lg bg-neutral-100 text-neutral-500 border-0 text-[10px] font-medium px-2">
      <CircleX className="size-3" strokeWidth={2} />
      Not set
    </Badge>
  );
}

/* ─── Main Component ─── */
export function ApiKeyDialog() {
  const { state, closeApiKeyDialog } = useStudio();
  const {
    googleApiKey,
    falApiKey,
    vertexProjectId,
    vertexLocation,
    vertexAccessToken,
    setGoogleApiKey,
    setFalApiKey,
    setVertexProjectId,
    setVertexLocation,
    setVertexAccessToken,
  } = useSettingsStore();

  const [localGoogle, setLocalGoogle] = useState(googleApiKey);
  const [localFal, setLocalFal] = useState(falApiKey);
  const [localVertexProject, setLocalVertexProject] = useState(vertexProjectId || "");
  const [localVertexLocation, setLocalVertexLocation] = useState(vertexLocation || "us-central1");
  const [localVertexToken, setLocalVertexToken] = useState(vertexAccessToken || "");
  const [activeTab, setActiveTab] = useState<ProviderTab>("google");

  const hasAnyKey = !!googleApiKey || !!falApiKey || !!vertexAccessToken;

  const connectedCount = useMemo(() => {
    let count = 0;
    if (googleApiKey) count++;
    if (vertexAccessToken && vertexProjectId) count++;
    if (falApiKey) count++;
    return count;
  }, [googleApiKey, vertexAccessToken, vertexProjectId, falApiKey]);

  const isConnected: Record<ProviderTab, boolean> = useMemo(
    () => ({
      google: !!googleApiKey,
      vertex: !!vertexAccessToken && !!vertexProjectId,
      fal: !!falApiKey,
    }),
    [googleApiKey, falApiKey, vertexAccessToken, vertexProjectId],
  );

  function handleOpen(open: boolean) {
    if (open) {
      setLocalGoogle(googleApiKey);
      setLocalFal(falApiKey);
      setLocalVertexProject(vertexProjectId || "");
      setLocalVertexLocation(vertexLocation || "us-central1");
      setLocalVertexToken(vertexAccessToken || "");
    } else {
      closeApiKeyDialog();
    }
  }

  function handleSave() {
    setGoogleApiKey(localGoogle.trim());
    setFalApiKey(localFal.trim());
    setVertexProjectId(localVertexProject.trim());
    setVertexLocation(localVertexLocation.trim() || "us-central1");
    setVertexAccessToken(localVertexToken.trim());
    closeApiKeyDialog();
  }

  function handleRemove() {
    setGoogleApiKey("");
    setFalApiKey("");
    setVertexProjectId("");
    setVertexLocation("us-central1");
    setVertexAccessToken("");
    setLocalGoogle("");
    setLocalFal("");
    setLocalVertexProject("");
    setLocalVertexLocation("us-central1");
    setLocalVertexToken("");
    closeApiKeyDialog();
  }

  const hasChanges =
    localGoogle.trim() !== googleApiKey ||
    localFal.trim() !== falApiKey ||
    localVertexProject.trim() !== (vertexProjectId || "") ||
    localVertexLocation.trim() !== (vertexLocation || "us-central1") ||
    localVertexToken.trim() !== (vertexAccessToken || "");

  return (
    <Dialog open={state.isApiKeyDialogOpen} onOpenChange={handleOpen}>
      <DialogContent
        className={cn(
          "sm:max-w-[480px] rounded-2xl p-0 gap-0 overflow-hidden",
          "bg-white/80 backdrop-blur-2xl backdrop-saturate-150",
          "border border-black/[0.06]",
          "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.02)]",
        )}
        showCloseButton={false}
      >
        {/* ═══════ Header ═══════ */}
        <div className="px-6 pt-6 pb-4 space-y-1.5">
          <DialogHeader className="space-y-1.5 text-left p-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[15px] font-semibold text-neutral-900 tracking-tight">
                API Integrations
              </DialogTitle>
              <Badge variant="secondary" className="h-5 rounded-lg bg-amber-50 text-amber-700 border-0 text-[10px] font-semibold px-2 tabular-nums">
                {connectedCount}/3 connected
              </Badge>
            </div>
            <DialogDescription className="text-[12px] text-neutral-500 leading-relaxed">
              Connect your API keys to start generating. Keys are stored locally in your browser.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator className="bg-black/[0.04]" />

        {/* ═══════ Provider Tabs ═══════ */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProviderTab)} className="gap-0">
          <div className="px-6 pt-3 bg-white/40">
            <TabsList className="w-full bg-black/[0.03] rounded-xl h-9 p-1 gap-0">
              {(["google", "vertex", "fal"] as ProviderTab[]).map((tab) => {
                const meta = PROVIDER_META[tab];
                return (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className={cn(
                      "flex-1 rounded-lg text-[11px] font-semibold gap-1.5 h-full transition-all data-[state=active]:shadow-sm",
                      "data-[state=active]:bg-white data-[state=active]:text-neutral-900",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        isConnected[tab] ? "bg-emerald-500" : "bg-neutral-300",
                      )}
                    />
                    {meta.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* ─── Google Tab ─── */}
          <TabsContent value="google" className="px-6 py-5 space-y-4 outline-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn("flex size-8 items-center justify-center rounded-xl", PROVIDER_META.google.accentBg)}>
                  <KeyRound className={cn("size-4", PROVIDER_META.google.accent)} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">{PROVIDER_META.google.label}</p>
                  <p className="text-[11px] text-neutral-500">{PROVIDER_META.google.tagline}</p>
                </div>
              </div>
              <ConnectionStatus connected={isConnected.google} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-key" className="text-[11px] font-medium text-neutral-500">
                API Key
              </Label>
              <SecretInput
                id="google-key"
                value={localGoogle}
                onChange={setLocalGoogle}
                placeholder="AIzaSy..."
                onEnter={handleSave}
              />
            </div>

            <a
              href={PROVIDER_META.google.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 hover:text-amber-700 transition-colors"
            >
              <ExternalLink className="size-3" strokeWidth={2} />
              {PROVIDER_META.google.docsLabel}
            </a>
          </TabsContent>

          {/* ─── Vertex Tab ─── */}
          <TabsContent value="vertex" className="px-6 py-5 space-y-4 outline-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn("flex size-8 items-center justify-center rounded-xl", PROVIDER_META.vertex.accentBg)}>
                  <Cloud className={cn("size-4", PROVIDER_META.vertex.accent)} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">{PROVIDER_META.vertex.label}</p>
                  <p className="text-[11px] text-neutral-500">{PROVIDER_META.vertex.tagline}</p>
                </div>
              </div>
              <ConnectionStatus connected={isConnected.vertex} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vertex-project" className="text-[11px] font-medium text-neutral-500">
                  Project ID
                </Label>
                <Input
                  id="vertex-project"
                  type="text"
                  value={localVertexProject}
                  onChange={(e) => setLocalVertexProject(e.target.value)}
                  placeholder="my-gcp-project"
                  className="h-10 rounded-xl border-black/[0.06] bg-black/[0.02] px-3.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vertex-location" className="text-[11px] font-medium text-neutral-500">
                  Location
                </Label>
                <Input
                  id="vertex-location"
                  type="text"
                  value={localVertexLocation}
                  onChange={(e) => setLocalVertexLocation(e.target.value)}
                  placeholder="us-central1"
                  className="h-10 rounded-xl border-black/[0.06] bg-black/[0.02] px-3.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vertex-token" className="text-[11px] font-medium text-neutral-500">
                Access Token
              </Label>
              <SecretInput
                id="vertex-token"
                value={localVertexToken}
                onChange={setLocalVertexToken}
                placeholder="ya29.a0..."
                onEnter={handleSave}
              />
              <p className="text-[10px] text-neutral-400 leading-relaxed pl-0.5">
                Run{" "}
                <code className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-neutral-600 font-mono text-[10px]">
                  gcloud auth print-access-token
                </code>{" "}
                for a temporary token.
              </p>
            </div>

            <a
              href={PROVIDER_META.vertex.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 hover:text-amber-700 transition-colors"
            >
              <ExternalLink className="size-3" strokeWidth={2} />
              {PROVIDER_META.vertex.docsLabel}
            </a>
          </TabsContent>

          {/* ─── Fal Tab ─── */}
          <TabsContent value="fal" className="px-6 py-5 space-y-4 outline-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn("flex size-8 items-center justify-center rounded-xl", PROVIDER_META.fal.accentBg)}>
                  <Sparkles className={cn("size-4", PROVIDER_META.fal.accent)} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">{PROVIDER_META.fal.label}</p>
                  <p className="text-[11px] text-neutral-500">{PROVIDER_META.fal.tagline}</p>
                </div>
              </div>
              <ConnectionStatus connected={isConnected.fal} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fal-key" className="text-[11px] font-medium text-neutral-500">
                API Key
              </Label>
              <SecretInput
                id="fal-key"
                value={localFal}
                onChange={setLocalFal}
                placeholder="key_id:key_secret"
                onEnter={handleSave}
              />
            </div>

            <a
              href={PROVIDER_META.fal.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 hover:text-amber-700 transition-colors"
            >
              <ExternalLink className="size-3" strokeWidth={2} />
              {PROVIDER_META.fal.docsLabel}
            </a>
          </TabsContent>
        </Tabs>

        {/* ═══════ Footer ═══════ */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-black/[0.04] bg-neutral-50/50">
          <div>
            {hasAnyKey && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemove}
                    className="h-8 gap-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg px-3"
                  >
                    <Trash2 className="size-3" strokeWidth={2} />
                    Clear All
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Remove all API keys
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => closeApiKeyDialog()}
              className="h-8 rounded-lg px-3.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 hover:bg-black/[0.04]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges}
              className={cn(
                "h-8 rounded-lg px-4 text-[11px] font-semibold shadow-sm transition-all",
                "bg-neutral-900 text-white hover:bg-neutral-800",
                "disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none",
              )}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
