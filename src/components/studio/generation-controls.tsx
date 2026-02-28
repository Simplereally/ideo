"use client";

import { useState, useMemo } from "react";
import { ChevronDown, X, Shuffle, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  MODELS,
  ASPECT_RATIOS,
  PROVIDER_LABELS,
  getModelConfig,
  type AspectRatio,
  type Provider,
  type ModelConfig,
} from "@/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-xs font-medium text-neutral-400">
      {children}
    </span>
  );
}

export function GenerationControls() {
  const {
    state,
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
  } = useStudio();

  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Current model capabilities — drives which controls render
  const modelConfig = useMemo(
    () => getModelConfig(state.model),
    [state.model],
  );
  const caps = modelConfig?.capabilities;

  // Whether any advanced controls exist for the current model
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

  // Group models by provider for rendering
  const groupedModels = useMemo(() => {
    const groups: { provider: Provider; label: string; models: ModelConfig[] }[] = [];
    let currentProvider: Provider | null = null;
    for (const model of MODELS) {
      if (model.provider !== currentProvider) {
        currentProvider = model.provider;
        groups.push({
          provider: model.provider,
          label: PROVIDER_LABELS[model.provider],
          models: [],
        });
      }
      groups[groups.length - 1].models.push(model);
    }
    return groups;
  }, []);

  return (
    <AnimatePresence>
      {state.isControlsOpen && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed top-20 right-6 bottom-6 z-30 flex w-[320px] flex-col rounded-[2rem] bg-white/80 backdrop-blur-2xl border border-black/5 shadow-2xl shadow-black/5 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-4 bg-white/50">
            <h2 className="text-sm font-semibold text-black">Settings</h2>
            <button
              type="button"
              onClick={toggleControls}
              className="flex size-7 items-center justify-center rounded-full bg-black/5 text-neutral-500 transition-colors hover:bg-black/10 hover:text-black"
            >
              <X className="size-3.5" strokeWidth={2.5} />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-8 p-6">
              {/* ---- Model (grouped by provider) ---- */}
              <section className="space-y-4">
                <SectionLabel>Model Selection</SectionLabel>
                <div className="flex flex-col gap-6">
                  {groupedModels.map((group) => (
                    <div key={group.provider} className="space-y-3">
                      <span className="text-[11px] font-semibold tracking-wider text-brand-blue uppercase">
                        {group.label}
                      </span>
                      <div className="flex flex-col gap-2">
                        {group.models.map((model) => {
                          const isSelected = state.model === model.id;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => setModel(model.id)}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-xl p-3 text-left transition-all",
                                isSelected
                                  ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20"
                                  : "bg-black/5 text-neutral-600 hover:bg-black/10 hover:text-black"
                              )}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium">
                                  {model.label}
                                </span>
                                <span className={cn("text-xs opacity-70", isSelected ? "text-blue-100" : "text-neutral-500")}>
                                  {model.description}
                                </span>
                              </div>
                              {isSelected && <Check className="size-4" strokeWidth={3} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <Separator className="bg-black/5" />

              {/* ---- Aspect Ratio ---- */}
              <section className="space-y-4">
                <SectionLabel>Aspect Ratio</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((ar) => {
                    const isSelected = state.aspectRatio === ar.value;
                    return (
                      <button
                        key={ar.value}
                        type="button"
                        onClick={() => setAspectRatio(ar.value as AspectRatio)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 transition-all",
                          isSelected
                            ? "bg-black text-white shadow-md"
                            : "bg-black/5 text-neutral-500 hover:bg-black/10 hover:text-black"
                        )}
                      >
                        <span className="text-lg leading-none opacity-80">{ar.icon}</span>
                        <span className="font-sans text-[11px] font-medium">{ar.value}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator className="bg-black/5" />

              {/* ---- Advanced (provider-aware) ---- */}
              <Collapsible
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between group"
                  >
                    <SectionLabel>Advanced Parameters</SectionLabel>
                    <div className="flex size-6 items-center justify-center rounded-full bg-black/5 group-hover:bg-black/10 transition-colors">
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-neutral-500 transition-transform duration-300",
                          advancedOpen && "rotate-180"
                        )}
                        strokeWidth={2.5}
                      />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-6 pt-6">
                    {/* Negative prompt — capability-gated */}
                    {caps?.negativePrompt && (
                      <div className="space-y-2">
                        <label
                          htmlFor="negative-prompt"
                          className="text-xs font-medium text-neutral-700"
                        >
                          Negative Prompt
                        </label>
                        <div className="animated-underline">
                          <textarea
                            id="negative-prompt"
                            value={state.negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="Describe what to avoid..."
                            rows={2}
                            className="w-full resize-none rounded-xl border-0 bg-black/5 px-4 py-3 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:bg-black/5"
                          />
                        </div>
                      </div>
                    )}

                    {/* Guidance Scale — fal models only */}
                    {caps?.guidanceScale && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-700">
                            Guidance Scale
                          </span>
                          <span className="font-sans text-xs font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md">
                            {state.guidanceScale}
                          </span>
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

                    {/* Inference Steps — fal models only */}
                    {caps?.numInferenceSteps && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-700">
                            Inference Steps
                          </span>
                          <span className="font-sans text-xs font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md">
                            {state.numInferenceSteps}
                          </span>
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

                    {/* Seed — models that support it */}
                    {caps?.seed && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-700">
                            Seed
                          </span>
                          <button
                            type="button"
                            onClick={() => setSeed(String(Math.floor(Math.random() * 2147483647)))}
                            className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:text-blue-700 transition-colors"
                          >
                            <Shuffle className="size-3" strokeWidth={2.5} />
                            Randomize
                          </button>
                        </div>
                        <div className="animated-underline">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={state.seed}
                            onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))}
                            placeholder="Random"
                            className="w-full rounded-xl border-0 bg-black/5 px-4 py-2.5 font-sans text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:bg-black/5"
                          />
                        </div>
                      </div>
                    )}

                    {/* Safety Tolerance — fal-pro only (1-6 slider) */}
                    {caps?.safetyTolerance && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-700">
                            Safety Tolerance
                          </span>
                          <span className="font-sans text-xs font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md">
                            {state.safetyTolerance}
                          </span>
                        </div>
                        <Slider
                          value={[state.safetyTolerance]}
                          onValueChange={([val]) => setSafetyTolerance(val)}
                          min={caps.safetyTolerance.min}
                          max={caps.safetyTolerance.max}
                          step={caps.safetyTolerance.step}
                          className="w-full"
                        />
                        <div className="flex justify-between px-1">
                          <span className="text-[10px] font-medium text-neutral-400">Strict</span>
                          <span className="text-[10px] font-medium text-neutral-400">Permissive</span>
                        </div>
                      </div>
                    )}

                    {/* Safety Checker toggle — fal dev/realism only */}
                    {caps?.enableSafetyChecker && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/5">
                        <span className="text-sm font-medium text-neutral-700">
                          Safety Checker
                        </span>
                        <Switch
                          checked={state.enableSafetyChecker}
                          onCheckedChange={setEnableSafetyChecker}
                          className="data-[state=checked]:bg-brand-blue"
                        />
                      </div>
                    )}

                    {/* Enhance Prompt toggle — vertex imagen models */}
                    {caps?.enhancePrompt && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/5">
                        <span className="text-sm font-medium text-neutral-700">
                          Enhance Prompt
                        </span>
                        <Switch
                          checked={state.enhancePrompt}
                          onCheckedChange={setEnhancePrompt}
                          className="data-[state=checked]:bg-brand-blue"
                        />
                      </div>
                    )}

                    {/* Person Generation — vertex imagen models */}
                    {caps?.personGeneration && (
                      <div className="space-y-3">
                        <span className="text-xs font-medium text-neutral-700">
                          Person Generation
                        </span>
                        <div className="flex gap-2 p-1 bg-black/5 rounded-xl">
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
                                "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
                                state.personGeneration === opt.value
                                  ? "bg-white text-black shadow-sm"
                                  : "text-neutral-500 hover:text-black"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Number of Images — always available */}
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-neutral-700">
                        Batch Size
                      </span>
                      <div className="flex gap-2 p-1 bg-black/5 rounded-xl">
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setNumberOfImages(n)}
                            className={cn(
                              "flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all",
                              state.numberOfImages === n
                                ? "bg-white text-black shadow-sm"
                                : "text-neutral-500 hover:text-black"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hint when no provider-specific controls */}
                    {!hasAdvancedControls && (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-xs font-medium text-brand-blue text-center">
                          This specific model does not expose additional tuning parameters.
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
