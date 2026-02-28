"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
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
  STYLE_PRESETS,
  type AspectRatio,
  type ImageStyle,
} from "@/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

export function GenerationControls() {
  const {
    state,
    setModel,
    setAspectRatio,
    setStyle,
    setNegativePrompt,
    setGuidanceScale,
    setNumberOfImages,
    toggleControls,
  } = useStudio();

  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <AnimatePresence>
      {state.isControlsOpen && (
        <motion.aside
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="glass-panel fixed top-14 right-0 bottom-0 z-30 flex w-[320px] flex-col border-l border-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium text-foreground">Controls</h2>
            <button
              type="button"
              onClick={toggleControls}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-5 p-5">
              {/* ---- Model ---- */}
              <section className="space-y-3">
                <SectionLabel>Model</SectionLabel>
                <div className="flex flex-col gap-2">
                  {MODELS.map((model) => (
                    <button
                      key={model.value}
                      type="button"
                      onClick={() => setModel(model.value)}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                        state.model === model.value
                          ? "border-amber/40 bg-amber-subtle text-foreground"
                          : "border-border bg-transparent text-muted-foreground hover:border-border hover:bg-surface-elevated hover:text-foreground"
                      )}
                    >
                      <span className="text-sm font-medium">
                        {model.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {model.description}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <Separator />

              {/* ---- Aspect Ratio ---- */}
              <section className="space-y-3">
                <SectionLabel>Aspect Ratio</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      type="button"
                      onClick={() => setAspectRatio(ar.value as AspectRatio)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-all",
                        state.aspectRatio === ar.value
                          ? "border-amber/40 bg-amber-subtle text-foreground"
                          : "border-border bg-transparent text-muted-foreground hover:border-border hover:bg-surface-elevated hover:text-foreground"
                      )}
                    >
                      <span className="text-base leading-none">{ar.icon}</span>
                      <span className="text-[10px]">{ar.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <Separator />

              {/* ---- Style ---- */}
              <section className="space-y-3">
                <SectionLabel>Style</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setStyle(preset.value as ImageStyle)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-all",
                        state.style === preset.value
                          ? "border-amber/40 bg-amber text-background"
                          : "border-border bg-transparent text-muted-foreground hover:border-border hover:bg-surface-elevated hover:text-foreground"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>

              <Separator />

              {/* ---- Advanced ---- */}
              <Collapsible
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between"
                  >
                    <SectionLabel>Advanced</SectionLabel>
                    <ChevronDown
                      className={cn(
                        "size-3.5 text-muted-foreground transition-transform",
                        advancedOpen && "rotate-180"
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-5 pt-4">
                    {/* Negative prompt */}
                    <div className="space-y-2">
                      <label
                        htmlFor="negative-prompt"
                        className="text-xs text-muted-foreground"
                      >
                        Negative Prompt
                      </label>
                      <textarea
                        id="negative-prompt"
                        value={state.negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="Elements to avoid..."
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-amber/40 focus:outline-none"
                      />
                    </div>

                    {/* Guidance Scale */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Guidance Scale
                        </span>
                        <span className="font-mono text-xs text-amber">
                          {state.guidanceScale}
                        </span>
                      </div>
                      <Slider
                        value={[state.guidanceScale]}
                        onValueChange={([val]) => setGuidanceScale(val)}
                        min={1}
                        max={20}
                        step={0.5}
                        className="w-full"
                      />
                    </div>

                    {/* Number of Images */}
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">
                        Number of Images
                      </span>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map((n) => (
                          <Button
                            key={n}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNumberOfImages(n)}
                            className={cn(
                              "h-8 w-10 font-mono text-xs",
                              state.numberOfImages === n
                                ? "border border-amber/40 bg-amber-subtle text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                    </div>
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
