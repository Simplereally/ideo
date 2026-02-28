"use client";

import { useState, useMemo, useEffect } from "react";
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
    <span className="font-sans text-[11px] font-bold text-neutral-400 tracking-wide uppercase px-2">
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Current model capabilities
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

  if (!mounted) return null;

  return (
    <AnimatePresence initial={false}>
      {state.isControlsOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 250 }}
          className="flex flex-col shrink-0 h-full overflow-hidden"
        >
          <div className="w-[340px] h-full flex flex-col bg-white rounded-3xl border border-black/[0.04] shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04] bg-white z-10 shrink-0">
              <h2 className="text-[15px] font-semibold text-black tracking-tight">Settings</h2>
              <button
                type="button"
                onClick={toggleControls}
                className="flex size-7 items-center justify-center rounded-full bg-black/5 text-neutral-500 transition-colors hover:bg-black/10 hover:text-black"
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-8 p-6 pb-12">
                  
                  {/* ---- Model ---- */}
                  <section className="space-y-3">
                    <SectionLabel>Model</SectionLabel>
                    <div className="flex flex-col gap-6 pt-1">
                      {groupedModels.map((group) => (
                        <div key={group.provider} className="space-y-2">
                          <span className="text-[10px] font-bold tracking-widest text-[#0071E3] uppercase px-2">
                            {group.label}
                          </span>
                          <div className="ios-list">
                            {group.models.map((model) => {
                              const isSelected = state.model === model.id;
                              return (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => setModel(model.id)}
                                  className={cn(
                                    "ios-list-item flex items-center justify-between gap-2 w-full p-3.5 transition-colors",
                                    isSelected && "selected"
                                  )}
                                >
                                  <div className="flex flex-col gap-0.5 text-left">
                                    <span className={cn(
                                      "text-[13px] font-medium tracking-tight",
                                      isSelected ? "text-[#0071E3]" : "text-black"
                                    )}>
                                      {model.label}
                                    </span>
                                    <span className="text-[11px] text-neutral-500">
                                      {model.description}
                                    </span>
                                  </div>
                                  {isSelected && <Check className="size-4 text-[#0071E3]" strokeWidth={2.5} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <Separator className="bg-black/5 mx-2" />

                  {/* ---- Aspect Ratio ---- */}
                  <section className="space-y-4">
                    <SectionLabel>Aspect Ratio</SectionLabel>
                    <div className="grid grid-cols-3 gap-2 px-2">
                      {ASPECT_RATIOS.map((ar) => {
                        const isSelected = state.aspectRatio === ar.value;
                        return (
                          <button
                            key={ar.value}
                            type="button"
                            onClick={() => setAspectRatio(ar.value as AspectRatio)}
                            className={cn(
                              "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 transition-all",
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

                  <Separator className="bg-black/5 mx-2" />

                  {/* ---- Advanced Parameters ---- */}
                  <section className="px-2">
                    <Collapsible
                      open={advancedOpen}
                      onOpenChange={setAdvancedOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between group py-2"
                        >
                          <span className="font-sans text-[13px] font-medium text-black">
                            Advanced Parameters
                          </span>
                          <div className="flex size-6 items-center justify-center rounded-full bg-black/5 group-hover:bg-black/10 transition-colors">
                            <ChevronDown
                              className={cn(
                                "size-3.5 text-neutral-500 transition-transform duration-300",
                                advancedOpen && "rotate-180"
                              )}
                              strokeWidth={2}
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
                                className="text-xs font-semibold text-neutral-700"
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
                                  className="w-full resize-none rounded-xl border border-black/5 bg-black/[0.02] px-3.5 py-3 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:bg-black/5"
                                />
                              </div>
                            </div>
                          )}

                          {/* Guidance Scale — fal models only */}
                          {caps?.guidanceScale && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-neutral-700">
                                  Guidance Scale
                                </span>
                                <span className="font-sans text-xs font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-md">
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
                                <span className="text-xs font-semibold text-neutral-700">
                                  Inference Steps
                                </span>
                                <span className="font-sans text-xs font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-md">
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
                                <span className="text-xs font-semibold text-neutral-700">
                                  Seed
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSeed(String(Math.floor(Math.random() * 2147483647)))}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] hover:text-[#005bb5] transition-colors"
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
                                  className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 font-mono text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:bg-black/5"
                                />
                              </div>
                            </div>
                          )}

                          {/* Safety Tolerance — fal-pro only (1-6 slider) */}
                          {caps?.safetyTolerance && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-neutral-700">
                                  Safety Tolerance
                                </span>
                                <span className="font-sans text-xs font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-md">
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
                                <span className="text-[10px] font-semibold text-neutral-400">Strict</span>
                                <span className="text-[10px] font-semibold text-neutral-400">Permissive</span>
                              </div>
                            </div>
                          )}

                          {/* Safety Checker toggle — fal dev/realism only */}
                          {caps?.enableSafetyChecker && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-black/5">
                              <span className="text-sm font-semibold text-neutral-700">
                                Safety Checker
                              </span>
                              <Switch
                                checked={state.enableSafetyChecker}
                                onCheckedChange={setEnableSafetyChecker}
                                className="data-[state=checked]:bg-[#0071E3]"
                              />
                            </div>
                          )}

                          {/* Enhance Prompt toggle — vertex imagen models */}
                          {caps?.enhancePrompt && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-black/5">
                              <span className="text-sm font-semibold text-neutral-700">
                                Enhance Prompt
                              </span>
                              <Switch
                                checked={state.enhancePrompt}
                                onCheckedChange={setEnhancePrompt}
                                className="data-[state=checked]:bg-[#0071E3]"
                              />
                            </div>
                          )}

                          {/* Person Generation — vertex imagen models */}
                          {caps?.personGeneration && (
                            <div className="space-y-3">
                              <span className="text-xs font-semibold text-neutral-700">
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
                                      "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
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
                            <span className="text-xs font-semibold text-neutral-700">
                              Batch Size
                            </span>
                            <div className="flex gap-2 p-1 bg-black/5 rounded-xl">
                              {[1, 2, 3, 4].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setNumberOfImages(n)}
                                  className={cn(
                                    "flex-1 py-1.5 text-sm font-bold rounded-lg transition-all",
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

                          {!hasAdvancedControls && (
                            <div className="p-4 rounded-xl bg-[#0071E3]/5 border border-[#0071E3]/10">
                              <p className="text-xs font-semibold text-[#0071E3] text-center">
                                This specific model does not expose additional tuning parameters.
                              </p>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
