"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  X,
  Shuffle,
  Check,
  AlertCircle,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useStudio } from "@/lib/store";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";
import {
  ASPECT_RATIOS,
  PROVIDER_LABELS,
  getModelConfig,
  getModelsForProvider,
  type AspectRatio,
  type Provider,
} from "@/lib/types";

const PROVIDERS: Provider[] = ["google", "vertex", "fal"];

const PROVIDER_ACCENT: Record<Provider, { dot: string; bg: string; text: string; ring: string }> = {
  google: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/8 hover:bg-blue-500/12",
    text: "text-blue-600",
    ring: "ring-blue-500/25",
  },
  vertex: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/8 hover:bg-emerald-500/12",
    text: "text-emerald-600",
    ring: "ring-emerald-500/25",
  },
  fal: {
    dot: "bg-violet-500",
    bg: "bg-violet-500/8 hover:bg-violet-500/12",
    text: "text-violet-600",
    ring: "ring-violet-500/25",
  },
};

function SectionHeader({
  children,
  badge,
}: {
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-neutral-500 tracking-wider uppercase select-none">
        {children}
      </span>
      {badge}
    </div>
  );
}

export function GenerationControls() {
  const {
    state,
    setProvider,
    setModel,
    setAspectRatio,
    setNegativePrompt,
    setGuidanceScale,
    setNumberOfImages,
    setNumInferenceSteps,
    setSeed,
    setSafetyTolerance,
    setEnableSafetyChecker,
    setEnhancePrompt,
    setPersonGeneration,
    toggleControls,
    openApiKeyDialog,
  } = useStudio();

  const { googleApiKey, falApiKey, vertexAccessToken, vertexProjectId } =
    useSettingsStore();

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const hasKey: Record<Provider, boolean> = useMemo(
    () => ({
      google: !!googleApiKey,
      vertex: !!vertexAccessToken && !!vertexProjectId,
      fal: !!falApiKey,
    }),
    [googleApiKey, falApiKey, vertexAccessToken, vertexProjectId],
  );

  const providerModels = useMemo(
    () => getModelsForProvider(state.provider),
    [state.provider],
  );

  const modelConfig = useMemo(
    () => getModelConfig(state.model),
    [state.model],
  );
  const caps = modelConfig?.capabilities;

  const hasAdvancedControls = !!(
    caps?.negativePrompt ||
    caps?.guidanceScale ||
    caps?.numInferenceSteps ||
    caps?.seed ||
    caps?.safetyTolerance ||
    caps?.enableSafetyChecker ||
    caps?.enhancePrompt ||
    caps?.personGeneration
  );

  return (
    <AnimatePresence>
      {state.isControlsOpen && (
        <motion.aside
          initial={{ x: -380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -380, opacity: 0 }}
          transition={{ type: "spring", damping: 32, stiffness: 320 }}
          className={cn(
            "fixed top-20 left-5 bottom-5 z-50",
            "flex w-[340px] flex-col",
            "rounded-2xl",
            "bg-white/70 backdrop-blur-2xl backdrop-saturate-150",
            "border border-black/[0.06]",
            "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.02)]",
            "overflow-hidden",
          )}
        >
          {/* ═══════ Header ═══════ */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04] bg-white/40">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10">
                <SlidersHorizontal className="size-4 text-amber-600" strokeWidth={2} />
              </div>
              <span className="text-base font-semibold text-neutral-800 tracking-tight">
                Controls
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleControls}
              className="size-8 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-black/5"
            >
              <X className="size-4" strokeWidth={2.5} />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-7 p-6">
              {/* ═══════ Provider ═══════ */}
              <section className="space-y-3.5">
                <SectionHeader>Provider</SectionHeader>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => {
                    const isSelected = state.provider === p;
                    const accent = PROVIDER_ACCENT[p];
                    return (
                      <Tooltip key={p}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setProvider(p)}
                            className={cn(
                              "relative flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-center transition-all duration-200",
                              isSelected
                                ? cn(accent.bg, accent.text, "ring-1", accent.ring, "font-semibold")
                                : "bg-black/[0.03] text-neutral-500 hover:bg-black/[0.06] hover:text-neutral-700",
                            )}
                          >
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0 transition-colors",
                                hasKey[p] ? accent.dot : "bg-neutral-300",
                              )}
                            />
                            <span className="text-sm font-medium leading-none">
                              {PROVIDER_LABELS[p].split(" ")[0]}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-sm">
                          {PROVIDER_LABELS[p]}
                          {!hasKey[p] && " — No API key"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Missing key warning */}
                {!hasKey[state.provider] && (
                  <button
                    type="button"
                    onClick={openApiKeyDialog}
                    className="flex items-center gap-3 rounded-xl bg-amber-50/80 border border-amber-200/40 px-4 py-3 text-left transition-colors hover:bg-amber-100/60 w-full group"
                  >
                    <AlertCircle className="size-4 shrink-0 text-amber-500" strokeWidth={2} />
                    <span className="text-sm font-medium text-amber-700 leading-snug">
                      API key required.{" "}
                      <span className="underline underline-offset-2 group-hover:text-amber-900 transition-colors">
                        Configure
                      </span>
                    </span>
                  </button>
                )}
              </section>

              <Separator className="bg-black/[0.04]" />

              {/* ═══════ Model ═══════ */}
              <section className="space-y-3.5">
                <SectionHeader
                  badge={
                    <Badge variant="secondary" className="text-[11px] px-2 py-0.5 h-5 rounded-md bg-black/[0.04] text-neutral-500 font-medium border-0">
                      {providerModels.length}
                    </Badge>
                  }
                >
                  Model
                </SectionHeader>
                <div className="flex flex-col gap-1.5">
                  {providerModels.map((model) => {
                    const isSelected = state.model === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setModel(model.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200",
                          isSelected
                            ? "bg-neutral-900 text-white shadow-sm shadow-neutral-900/20"
                            : "bg-transparent text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900",
                        )}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-semibold tracking-tight truncate">
                            {model.label}
                          </span>
                          <span
                            className={cn(
                              "text-xs leading-snug truncate",
                              isSelected ? "text-neutral-400" : "text-neutral-400",
                            )}
                          >
                            {model.description}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="size-4 shrink-0 text-amber-400" strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator className="bg-black/[0.04]" />

              {/* ═══════ Aspect Ratio ═══════ */}
              <section className="space-y-3.5">
                <SectionHeader>Aspect Ratio</SectionHeader>
                <div className="grid grid-cols-5 gap-1.5">
                  {ASPECT_RATIOS.map((ar) => {
                    const isSelected = state.aspectRatio === ar.value;
                    const supported =
                      !caps?.aspectRatios ||
                      caps.aspectRatios.includes(ar.value);
                    return (
                      <Tooltip key={ar.value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              supported && setAspectRatio(ar.value as AspectRatio)
                            }
                            className={cn(
                              "flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all duration-200",
                              !supported && "opacity-25 cursor-not-allowed",
                              isSelected
                                ? "bg-neutral-900 text-white shadow-sm"
                                : "bg-black/[0.03] text-neutral-500 hover:bg-black/[0.06] hover:text-neutral-700",
                            )}
                          >
                            <span className="text-base leading-none opacity-70">{ar.icon}</span>
                            <span className="text-[11px] font-semibold tracking-tight">{ar.value}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-sm">
                          {ar.label}{!supported && " (unsupported)"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </section>

              <Separator className="bg-black/[0.04]" />

              {/* ═══════ Advanced Parameters ═══════ */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between group py-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <SectionHeader>Advanced</SectionHeader>
                      {hasAdvancedControls && (
                        <Zap className="size-3.5 text-amber-500" strokeWidth={2} />
                      )}
                    </div>
                    <div className="flex size-7 items-center justify-center rounded-lg bg-black/[0.04] group-hover:bg-black/[0.08] transition-colors">
                      <ChevronDown
                        className={cn(
                          "size-4 text-neutral-500 transition-transform duration-300",
                          advancedOpen && "rotate-180",
                        )}
                        strokeWidth={2.5}
                      />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-6 pt-5">
                    {/* Negative Prompt */}
                    {caps?.negativePrompt && (
                      <div className="space-y-2.5">
                        <Label
                          htmlFor="negative-prompt"
                          className="text-sm font-medium text-neutral-600"
                        >
                          Negative Prompt
                        </Label>
                        <textarea
                          id="negative-prompt"
                          value={state.negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder="What to avoid..."
                          rows={2}
                          className="w-full resize-none rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/30 transition-all"
                        />
                      </div>
                    )}

                    {/* Guidance Scale */}
                    {caps?.guidanceScale && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-neutral-600">
                            Guidance Scale
                          </Label>
                          <Badge variant="secondary" className="text-xs h-6 px-2.5 rounded-lg bg-amber-50 text-amber-700 border-0 font-semibold tabular-nums">
                            {state.guidanceScale}
                          </Badge>
                        </div>
                        <Slider
                          value={[state.guidanceScale]}
                          onValueChange={([val]) => setGuidanceScale(val)}
                          min={caps.guidanceScale.min}
                          max={caps.guidanceScale.max}
                          step={caps.guidanceScale.step}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Inference Steps */}
                    {caps?.numInferenceSteps && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-neutral-600">
                            Inference Steps
                          </Label>
                          <Badge variant="secondary" className="text-xs h-6 px-2.5 rounded-lg bg-amber-50 text-amber-700 border-0 font-semibold tabular-nums">
                            {state.numInferenceSteps}
                          </Badge>
                        </div>
                        <Slider
                          value={[state.numInferenceSteps]}
                          onValueChange={([val]) => setNumInferenceSteps(val)}
                          min={caps.numInferenceSteps.min}
                          max={caps.numInferenceSteps.max}
                          step={caps.numInferenceSteps.step}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Seed */}
                    {caps?.seed && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-neutral-600">
                            Seed
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSeed(
                                String(Math.floor(Math.random() * 2147483647)),
                              )
                            }
                            className="h-7 px-2.5 gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50/80"
                          >
                            <Shuffle className="size-3" strokeWidth={2.5} />
                            Random
                          </Button>
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={state.seed}
                          onChange={(e) =>
                            setSeed(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="Random"
                          className="h-10 rounded-xl border-black/[0.06] bg-black/[0.02] px-4 font-mono text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/30"
                        />
                      </div>
                    )}

                    {/* Safety Tolerance */}
                    {caps?.safetyTolerance && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-neutral-600">
                            Safety Tolerance
                          </Label>
                          <Badge variant="secondary" className="text-xs h-6 px-2.5 rounded-lg bg-amber-50 text-amber-700 border-0 font-semibold tabular-nums">
                            {state.safetyTolerance}
                          </Badge>
                        </div>
                        <Slider
                          value={[state.safetyTolerance]}
                          onValueChange={([val]) => setSafetyTolerance(val)}
                          min={caps.safetyTolerance.min}
                          max={caps.safetyTolerance.max}
                          step={caps.safetyTolerance.step}
                          className="w-full"
                        />
                        <div className="flex justify-between px-0.5">
                          <span className="text-[11px] font-medium text-neutral-400">
                            Strict
                          </span>
                          <span className="text-[11px] font-medium text-neutral-400">
                            Permissive
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Safety Checker */}
                    {caps?.enableSafetyChecker && (
                      <div className="flex items-center justify-between rounded-xl bg-black/[0.02] border border-black/[0.04] px-4 py-3.5">
                        <Label className="text-sm font-medium text-neutral-700">
                          Safety Checker
                        </Label>
                        <Switch
                          checked={state.enableSafetyChecker}
                          onCheckedChange={setEnableSafetyChecker}
                        />
                      </div>
                    )}

                    {/* Enhance Prompt */}
                    {caps?.enhancePrompt && (
                      <div className="flex items-center justify-between rounded-xl bg-black/[0.02] border border-black/[0.04] px-4 py-3.5">
                        <Label className="text-sm font-medium text-neutral-700">
                          Enhance Prompt
                        </Label>
                        <Switch
                          checked={state.enhancePrompt}
                          onCheckedChange={setEnhancePrompt}
                        />
                      </div>
                    )}

                    {/* Person Generation */}
                    {caps?.personGeneration && (
                      <div className="space-y-2.5">
                        <Label className="text-sm font-medium text-neutral-600">
                          Person Generation
                        </Label>
                        <div className="flex gap-1.5 p-1.5 bg-black/[0.03] rounded-xl border border-black/[0.04]">
                          {[
                            { value: "DONT_ALLOW", label: "None" },
                            { value: "ALLOW_ADULT", label: "Adults" },
                            { value: "ALLOW_ALL", label: "All" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPersonGeneration(opt.value)}
                              className={cn(
                                "flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                                state.personGeneration === opt.value
                                  ? "bg-white text-neutral-900 shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-700",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Batch Size */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-neutral-600">
                        Batch Size
                      </Label>
                      <div className="flex gap-1.5 p-1.5 bg-black/[0.03] rounded-xl border border-black/[0.04]">
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setNumberOfImages(n)}
                            className={cn(
                              "flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 tabular-nums",
                              state.numberOfImages === n
                                ? "bg-white text-neutral-900 shadow-sm"
                                : "text-neutral-500 hover:text-neutral-700",
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* No advanced controls hint */}
                    {!hasAdvancedControls && (
                      <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/30">
                        <p className="text-sm font-medium text-amber-700 text-center leading-relaxed">
                          This model does not expose additional tuning parameters.
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
