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
                          <span className="font-sans t
