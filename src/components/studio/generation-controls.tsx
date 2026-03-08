"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronDown, X, Shuffle, Film, Image as ImageIcon, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
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
  ASPECT_RATIOS,
  getBatchSizeOptions,
  getModelConfig,
  type AspectRatio,
  type ModelCapabilities,
  type VideoShotType,
} from "@/lib/types";
import { ProviderDropdown } from "@/components/studio/provider-dropdown";
import { ModelDropdown } from "@/components/studio/model-dropdown";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIDEBAR_WIDTH = 340;

const PANEL_TRANSITION = {
  width: { type: "tween" as const, duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
  opacity: { type: "tween" as const, duration: 0.2, ease: [0.32, 0.72, 0, 1] as [number, number, number, number], delay: 0.05 },
};

// ---------------------------------------------------------------------------
// Presentational: Primitives
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[11px] font-bold text-muted-foreground tracking-wide uppercase px-2">
      {children}
    </span>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  footer,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="font-sans text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      {footer}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  renderLabel,
  className: buttonClassName,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  renderLabel?: (v: T) => string;
  className?: string;
}) {
  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        {options.map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "flex-1 py-1.5 text-sm font-bold rounded-lg transition-all",
              value === opt
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              buttonClassName,
            )}
          >
            {renderLabel ? renderLabel(opt) : String(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational: Aspect Ratio Selector
// ---------------------------------------------------------------------------

function AspectRatioSelector({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
}) {
  return (
    <section className="space-y-4">
      <SectionLabel>Aspect Ratio</SectionLabel>
      <div className="grid grid-cols-3 gap-2 px-2">
        {ASPECT_RATIOS.map((ar) => {
          const isSelected = value === ar.value;
          return (
            <button
              key={ar.value}
              type="button"
              onClick={() => onChange(ar.value)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <span className="text-lg leading-none opacity-80">{ar.icon}</span>
              <span className="font-sans text-[11px] font-medium">{ar.value}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presentational: Advanced Parameters
// ---------------------------------------------------------------------------

const PERSON_GEN_OPTIONS = [
  { value: "DONT_ALLOW", label: "None" },
  { value: "ALLOW_ADULT", label: "Adults" },
  { value: "ALLOW_ALL", label: "All" },
] as const;

interface AdvancedParametersProps {
  caps: ModelCapabilities | undefined;
  hasAdvancedControls: boolean;
  batchSizeOptions: number[];
  // State values
  negativePrompt: string;
  guidanceScale: number;
  numInferenceSteps: number;
  seed: string;
  safetyTolerance: number;
  enableSafetyChecker: boolean;
  enhancePrompt: boolean;
  personGeneration: string;
  numberOfImages: number;
  // Handlers
  onNegativePromptChange: (v: string) => void;
  onGuidanceScaleChange: (v: number) => void;
  onNumInferenceStepsChange: (v: number) => void;
  onSeedChange: (v: string) => void;
  onSeedRandomize: () => void;
  onSafetyToleranceChange: (v: number) => void;
  onEnableSafetyCheckerChange: (v: boolean) => void;
  onEnhancePromptChange: (v: boolean) => void;
  onPersonGenerationChange: (v: string) => void;
  onNumberOfImagesChange: (v: number) => void;
}

function AdvancedParameters({
  caps,
  hasAdvancedControls,
  batchSizeOptions,
  negativePrompt,
  guidanceScale,
  numInferenceSteps,
  seed,
  safetyTolerance,
  enableSafetyChecker,
  enhancePrompt,
  personGeneration,
  numberOfImages,
  onNegativePromptChange,
  onGuidanceScaleChange,
  onNumInferenceStepsChange,
  onSeedChange,
  onSeedRandomize,
  onSafetyToleranceChange,
  onEnableSafetyCheckerChange,
  onEnhancePromptChange,
  onPersonGenerationChange,
  onNumberOfImagesChange,
}: AdvancedParametersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="px-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between group py-2"
          >
            <span className="font-sans text-[13px] font-medium text-foreground">
              Advanced Parameters
            </span>
            <div className="flex size-6 items-center justify-center rounded-full bg-muted group-hover:bg-muted/80 transition-colors">
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform duration-300",
                  isOpen && "rotate-180",
                )}
                strokeWidth={2}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-6 pt-6">
            {/* Negative Prompt */}
            {caps?.negativePrompt && (
              <div className="space-y-2">
                <label
                  htmlFor="negative-prompt"
                  className="text-xs font-semibold text-foreground"
                >
                  Negative Prompt
                </label>
                <div className="animated-underline">
                  <textarea
                    id="negative-prompt"
                    value={negativePrompt}
                    onChange={(e) => onNegativePromptChange(e.target.value)}
                    placeholder="Describe what to avoid..."
                    rows={2}
                    className="w-full resize-none rounded-xl border border-border bg-input px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted"
                  />
                </div>
              </div>
            )}

            {/* Guidance Scale */}
            {caps?.guidanceScale && (
              <SliderField
                label="Guidance Scale"
                value={guidanceScale}
                onChange={onGuidanceScaleChange}
                min={caps.guidanceScale.min}
                max={caps.guidanceScale.max}
                step={caps.guidanceScale.step}
              />
            )}

            {/* Inference Steps */}
            {caps?.numInferenceSteps && (
              <SliderField
                label="Inference Steps"
                value={numInferenceSteps}
                onChange={onNumInferenceStepsChange}
                min={caps.numInferenceSteps.min}
                max={caps.numInferenceSteps.max}
                step={caps.numInferenceSteps.step}
              />
            )}

            {/* Seed */}
            {caps?.seed && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Seed</span>
                  <button
                    type="button"
                    onClick={onSeedRandomize}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Shuffle className="size-3" strokeWidth={2.5} />
                    Randomize
                  </button>
                </div>
                <div className="animated-underline">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={seed}
                    onChange={(e) => onSeedChange(e.target.value.replace(/\D/g, ""))}
                    placeholder="Random"
                    className="w-full rounded-xl border border-border bg-input px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted"
                  />
                </div>
              </div>
            )}

            {/* Safety Tolerance */}
            {caps?.safetyTolerance && (
              <SliderField
                label="Safety Tolerance"
                value={safetyTolerance}
                onChange={onSafetyToleranceChange}
                min={caps.safetyTolerance.min}
                max={caps.safetyTolerance.max}
                step={caps.safetyTolerance.step}
                footer={
                  <div className="flex justify-between px-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Strict
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Permissive
                    </span>
                  </div>
                }
              />
            )}

            {/* Safety Checker */}
            {caps?.enableSafetyChecker && (
              <ToggleField
                label="Safety Checker"
                checked={enableSafetyChecker}
                onCheckedChange={onEnableSafetyCheckerChange}
              />
            )}

            {/* Enhance Prompt */}
            {caps?.enhancePrompt && (
              <ToggleField
                label="Enhance Prompt"
                checked={enhancePrompt}
                onCheckedChange={onEnhancePromptChange}
              />
            )}

            {/* Person Generation */}
            {caps?.personGeneration && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-foreground">
                  Person Generation
                </span>
                <div className="flex gap-2 p-1 bg-muted rounded-xl">
                  {PERSON_GEN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onPersonGenerationChange(opt.value)}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        personGeneration === opt.value
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {batchSizeOptions.length > 1 && (
              <SegmentedControl
                label="Batch Size"
                options={batchSizeOptions}
                value={numberOfImages}
                onChange={onNumberOfImagesChange}
              />
            )}

            {/* Empty-state hint */}
            {!hasAdvancedControls && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs font-semibold text-primary text-center">
                  This specific model does not expose additional tuning parameters.
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presentational: Video Parameters
// ---------------------------------------------------------------------------

interface VideoParametersProps {
  caps: ModelCapabilities | undefined;
  // State values
  duration: number;
  videoResolution: string;
  videoAspectRatio: string;
  generateAudio: boolean;
  videoImageUrl: string;
  videoAudioUrl: string;
  videoShotType: VideoShotType;
  negativePrompt: string;
  seed: string;
  enhancePrompt: boolean;
  // Handlers
  onDurationChange: (v: number) => void;
  onVideoResolutionChange: (v: string) => void;
  onVideoAspectRatioChange: (v: string) => void;
  onGenerateAudioChange: (v: boolean) => void;
  onVideoImageUrlChange: (v: string) => void;
  onVideoAudioUrlChange: (v: string) => void;
  onVideoShotTypeChange: (v: VideoShotType) => void;
  onNegativePromptChange: (v: string) => void;
  onSeedChange: (v: string) => void;
  onSeedRandomize: () => void;
  onEnhancePromptChange: (v: boolean) => void;
}

function VideoAspectRatioSelector({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const iconForRatio = (r: string) => {
    if (r === "1:1") return "\u25A1"; // □
    if (r === "16:9" || r === "4:3") return "\u25AD"; // ▭
    if (r === "9:16" || r === "3:4") return "\u25AF"; // ▯
    return "\u25A1";
  };

  return (
    <section className="space-y-4">
      <SectionLabel>Aspect Ratio</SectionLabel>
      <div className="grid grid-cols-3 gap-2 px-2">
        {options.map((ratio) => {
          const isSelected = value === ratio;
          return (
            <button
              key={ratio}
              type="button"
              onClick={() => onChange(ratio)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <span className="text-lg leading-none opacity-80">{iconForRatio(ratio)}</span>
              <span className="font-sans text-[11px] font-medium">{ratio}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function VideoParameters({
  caps,
  duration,
  videoResolution,
  videoAspectRatio,
  generateAudio,
  videoImageUrl,
  videoAudioUrl,
  videoShotType,
  negativePrompt,
  seed,
  enhancePrompt,
  onDurationChange,
  onVideoResolutionChange,
  onVideoAspectRatioChange,
  onGenerateAudioChange,
  onVideoImageUrlChange,
  onVideoAudioUrlChange,
  onVideoShotTypeChange,
  onNegativePromptChange,
  onSeedChange,
  onSeedRandomize,
  onEnhancePromptChange,
}: VideoParametersProps) {
  const hasDuration = !!caps?.durationOptions?.length;
  const hasResolution = !!caps?.resolutionOptions?.length;
  const hasAudio = !!caps?.generateAudio;
  const hasImageUrl = !!caps?.imageUrl;
  const hasAudioUrl = !!caps?.audioUrl;
  const hasShotType = !!caps?.shotType;
  const hasNegativePrompt = !!caps?.negativePrompt;
  const hasSeed = !!caps?.seed;
  const hasEnhancePrompt = !!caps?.enhancePrompt;

  const hasAnyControl =
    hasDuration || hasResolution || hasAudio || hasImageUrl || hasAudioUrl || hasShotType || hasNegativePrompt || hasSeed || hasEnhancePrompt;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 px-2">
        <Film className="size-3.5 text-primary" strokeWidth={2.5} />
        <SectionLabel>Video Settings</SectionLabel>
      </div>

      {/* Duration */}
      {hasDuration && (
        <div className="px-2">
          <SegmentedControl
            label="Duration (seconds)"
            options={caps!.durationOptions!}
            value={duration}
            onChange={onDurationChange}
            renderLabel={(v) => `${v}s`}
          />
        </div>
      )}

      {/* Resolution */}
      {hasResolution && (
        <div className="px-2">
          <SegmentedControl
            label="Resolution"
            options={caps!.resolutionOptions!}
            value={videoResolution}
            onChange={onVideoResolutionChange}
          />
        </div>
      )}

      {/* Generate Audio */}
      {hasAudio && (
        <div className="px-2">
          <ToggleField
            label="Generate Audio"
            checked={generateAudio}
            onCheckedChange={onGenerateAudioChange}
          />
        </div>
      )}

      {/* Shot Type */}
      {hasShotType && (
        <div className="px-2">
          <SegmentedControl<VideoShotType>
            label="Shot Type"
            options={["single", "multi"]}
            value={videoShotType}
            onChange={onVideoShotTypeChange}
            renderLabel={(v) => v === "single" ? "Single" : "Multi"}
          />
        </div>
      )}

      {/* Reference Image URL */}
      {hasImageUrl && (
        <div className="space-y-2 px-2">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="size-3 text-muted-foreground" strokeWidth={2.5} />
            <span className="text-xs font-semibold text-foreground">Reference Image URL</span>
          </div>
          <div className="animated-underline">
            <input
              type="url"
              value={videoImageUrl}
              onChange={(e) => onVideoImageUrlChange(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted"
            />
          </div>
        </div>
      )}

      {/* Reference Audio URL */}
      {hasAudioUrl && (
        <div className="space-y-2 px-2">
          <div className="flex items-center gap-1.5">
            <Volume2 className="size-3 text-muted-foreground" strokeWidth={2.5} />
            <span className="text-xs font-semibold text-foreground">Reference Audio URL</span>
          </div>
          <div className="animated-underline">
            <input
              type="url"
              value={videoAudioUrl}
              onChange={(e) => onVideoAudioUrlChange(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted"
            />
          </div>
        </div>
      )}

      {/* Negative Prompt */}
      {hasNegativePrompt && (
        <div className="space-y-2 px-2">
          <label
            htmlFor="video-negative-prompt"
            className="text-xs font-semibold text-foreground"
          >
            Negative Prompt
          </label>
          <div className="animated-underline">
            <textarea
              id="video-negative-prompt"
              value={negativePrompt}
              onChange={(e) => onNegativePromptChange(e.target.value)}
              placeholder="Describe what to avoid..."
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-input px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted"
            />
          </div>
        </div>
      )}

      {/* Seed */}
      {hasSeed && (
        <div className="space-y-3 px-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Seed</span>
            <button
              type="button"
              onClick={onSeedRandomize}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Shuffle className="size-3" strokeWidth={2.5} />
              Randomize
            </button>
          </div>
          <div className="animated-underline">
            <input
              type="text"
              inputMode="numeric"
              value={seed}
              onChange={(e) => onSeedChange(e.target.value.replace(/\D/g, ""))}
              placeholder="Random"
              className="w-full rounded-xl border border-border bg-input px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted"
            />
          </div>
        </div>
      )}

      {/* Enhance Prompt */}
      {hasEnhancePrompt && (
        <div className="px-2">
          <ToggleField
            label="Enhance Prompt"
            checked={enhancePrompt}
            onCheckedChange={onEnhancePromptChange}
          />
        </div>
      )}

      {/* Empty-state hint */}
      {!hasAnyControl && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mx-2">
          <p className="text-xs font-semibold text-primary text-center">
            This video model does not expose additional tuning parameters.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presentational: Panel Header
// ---------------------------------------------------------------------------

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card z-10 shrink-0">
      <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
        Settings
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close settings"
        className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useHasAdvancedControls(caps: ModelCapabilities | undefined): boolean {
  return !!(
    caps?.negativePrompt ||
    caps?.guidanceScale ||
    caps?.numInferenceSteps ||
    caps?.seed ||
    caps?.safetyTolerance ||
    caps?.enableSafetyChecker ||
    caps?.enhancePrompt ||
    caps?.personGeneration
  );
}

// ---------------------------------------------------------------------------
// Feature: GenerationControls (container)
// ---------------------------------------------------------------------------

export function GenerationControls({ overlay }: { overlay?: boolean } = {}) {
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
    setDuration,
    setVideoResolution,
    setVideoAspectRatio,
    setGenerateAudio,
    setVideoImageUrl,
    setVideoAudioUrl,
    setVideoShotType,
    toggleControls,
  } = useStudio();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const modelConfig = useMemo(() => getModelConfig(state.model), [state.model]);
  const caps = modelConfig?.capabilities;
  const isVideo = modelConfig?.kind === "video";
  const hasAdvanced = useHasAdvancedControls(caps);

  if (!mounted) return null;

  // -- Shared panel content --
  const panelContent = (
    <div className="h-full flex flex-col bg-card rounded-3xl border border-border shadow-sm">
      <PanelHeader onClose={toggleControls} />

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-8 p-6 pb-12">
            {/* Provider */}
            <section className="space-y-3">
              <SectionLabel>Provider</SectionLabel>
              <div className="px-2">
                <ProviderDropdown
                  value={state.provider}
                  onChange={setProvider}
                />
              </div>
            </section>

            {/* Model */}
            <section className="space-y-3">
              <SectionLabel>Model</SectionLabel>
              <div className="px-2">
                <ModelDropdown
                  provider={state.provider}
                  value={state.model}
                  onChange={setModel}
                />
              </div>
            </section>

            <Separator className="bg-border mx-2" />

            {/* ---- Mode-aware controls ---- */}
            {isVideo ? (
              <>
                {caps?.videoAspectRatios?.length ? (
                  <>
                    <VideoAspectRatioSelector
                      options={caps.videoAspectRatios}
                      value={state.videoAspectRatio}
                      onChange={setVideoAspectRatio}
                    />
                    <Separator className="bg-border mx-2" />
                  </>
                ) : null}

                <VideoParameters
                  caps={caps}
                  duration={state.duration}
                  videoResolution={state.videoResolution}
                  videoAspectRatio={state.videoAspectRatio}
                  generateAudio={state.generateAudio}
                  videoImageUrl={state.videoImageUrl}
                  videoAudioUrl={state.videoAudioUrl}
                  videoShotType={state.videoShotType}
                  negativePrompt={state.negativePrompt}
                  seed={state.seed}
                  enhancePrompt={state.enhancePrompt}
                  onDurationChange={setDuration}
                  onVideoResolutionChange={setVideoResolution}
                  onVideoAspectRatioChange={setVideoAspectRatio}
                  onGenerateAudioChange={setGenerateAudio}
                  onVideoImageUrlChange={setVideoImageUrl}
                  onVideoAudioUrlChange={setVideoAudioUrl}
                  onVideoShotTypeChange={setVideoShotType}
                  onNegativePromptChange={setNegativePrompt}
                  onSeedChange={setSeed}
                  onSeedRandomize={() =>
                    setSeed(String(Math.floor(Math.random() * 2147483647)))
                  }
                  onEnhancePromptChange={setEnhancePrompt}
                />
              </>
            ) : (
              <>
                <AspectRatioSelector
                  value={state.aspectRatio}
                  onChange={setAspectRatio}
                />

                <Separator className="bg-border mx-2" />

                <AdvancedParameters
                  caps={caps}
                  hasAdvancedControls={hasAdvanced}
                  batchSizeOptions={getBatchSizeOptions(state.model)}
                  negativePrompt={state.negativePrompt}
                  guidanceScale={state.guidanceScale}
                  numInferenceSteps={state.numInferenceSteps}
                  seed={state.seed}
                  safetyTolerance={state.safetyTolerance}
                  enableSafetyChecker={state.enableSafetyChecker}
                  enhancePrompt={state.enhancePrompt}
                  personGeneration={state.personGeneration}
                  numberOfImages={state.numberOfImages}
                  onNegativePromptChange={setNegativePrompt}
                  onGuidanceScaleChange={setGuidanceScale}
                  onNumInferenceStepsChange={setNumInferenceSteps}
                  onSeedChange={setSeed}
                  onSeedRandomize={() =>
                    setSeed(String(Math.floor(Math.random() * 2147483647)))
                  }
                  onSafetyToleranceChange={setSafetyTolerance}
                  onEnableSafetyCheckerChange={setEnableSafetyChecker}
                  onEnhancePromptChange={setEnhancePrompt}
                  onPersonGenerationChange={setPersonGeneration}
                  onNumberOfImagesChange={setNumberOfImages}
                />
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  // Overlay mode: parent handles positioning & transform.
  if (overlay) {
    return <div className="h-full w-full">{panelContent}</div>;
  }

  // Desktop mode: animated width sidebar in flex flow.
  return (
    <motion.aside
      initial={false}
      animate={{ width: state.isControlsOpen ? SIDEBAR_WIDTH : 0 }}
      transition={PANEL_TRANSITION.width}
      className="flex flex-col shrink-0 h-full overflow-hidden"
      aria-hidden={!state.isControlsOpen}
      {...(!state.isControlsOpen && { inert: true })}
    >
      <motion.div
        initial={false}
        animate={{ opacity: state.isControlsOpen ? 1 : 0 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1], delay: state.isControlsOpen ? 0.05 : 0 }}
        className="min-w-[340px] h-full"
      >
        {panelContent}
      </motion.div>
    </motion.aside>
  );
}
