"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
  type ReactNode,
} from "react";
import { Check, ImagePlus, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { getMaxPromptLength, getModelConfig, isVideoModel } from "@/lib/types";
import { useGenerationActions } from "./generation-actions";
import { ModelCombobox } from "./model-combobox";
import { AspectRatioCombobox } from "./aspect-ratio-combobox";
import { BatchSizePopover } from "./batch-size-popover";
import { MOBILE_BREAKPOINT } from "@/lib/constants";
import { ratioLabel, ratioOrientation } from "@/lib/aspect-ratio-utils";
import { uploadReferenceImage } from "@/lib/services/reference-image-upload";
import { toast } from "sonner";

const COLLAPSED_TEXTAREA_HEIGHT = 63;
const MAX_TEXTAREA_HEIGHT = 240;

function RatioIcon({ ratio, className }: { ratio: string; className?: string }) {
  const orientation = ratioOrientation(ratio);

  return (
    <span
      className={cn(
        "inline-block rounded-[2px] border-[1.5px] border-current shrink-0",
        orientation === "wide" && "w-[18px] h-[13px]",
        orientation === "tall" && "w-[13px] h-[18px]",
        orientation === "square" && "w-[15px] h-[15px]",
        className,
      )}
    />
  );
}

type VideoComposerControl = {
  key: string;
  label: string;
  value: string;
  options: string[];
  displayLabel?: (option: string) => string;
  onSelect: (value: string) => void;
  icon: ReactNode;
};

function ComposerOptionPopover({
  label,
  value,
  options,
  displayLabel,
  onSelect,
  icon,
}: {
  label: string;
  value: string;
  options: string[];
  displayLabel?: (option: string) => string;
  onSelect: (value: string) => void;
  icon: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (options.length <= 1) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "transition-colors",
          )}
          aria-label={`${label}: ${value}`}
        >
          {icon}
          <span className="text-foreground font-semibold">
            {displayLabel ? `${displayLabel(value)} (${value})` : value}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-52 p-1.5">
        <div className="flex flex-col gap-1">
          {options.map((option) => {
            const isSelected = option === value;
            const optionLabel = displayLabel ? displayLabel(option) : option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <div className="flex items-center gap-2.5">
                  {displayLabel && (
                    <RatioIcon ratio={option} className="opacity-60" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{optionLabel}</span>
                    <span className="text-[10px] text-muted-foreground">{option}</span>
                  </div>
                </div>
                <Check
                  className={cn(
                    "size-4 text-primary transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PromptComposer() {
  const {
    state,
    setPrompt,
    setVideoImageUrl,
    setVideoAspectRatio,
    setVideoResolution,
    setUseSelectedImageAsVideoReference,
  } = useStudio();
  const { generateFromCurrentState } = useGenerationActions();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState(
    COLLAPSED_TEXTAREA_HEIGHT,
  );
  const [isUploadingReferenceImage, setIsUploadingReferenceImage] = useState(false);
  const [hasPendingReferenceImageUpload, setHasPendingReferenceImageUpload] =
    useState(false);
  const [pendingReferenceImageUrl, setPendingReferenceImageUrl] = useState<
    string | null
  >(null);

  const maxPromptLength = useMemo(
    () => getMaxPromptLength(state.model),
    [state.model],
  );

  const modelConfig = useMemo(() => getModelConfig(state.model), [state.model]);
  const supportsReferenceImagePaste = useMemo(
    () => modelConfig?.kind === "video" && !!modelConfig.capabilities.imageUrl,
    [modelConfig],
  );
  const canUseSelectedImageAsReference =
    supportsReferenceImagePaste && state.selectedImage !== null;
  const videoComposerControls = useMemo(() => {
    if (modelConfig?.kind !== "video") return [];

    const controls: VideoComposerControl[] = [];

    if (modelConfig.capabilities.videoAspectRatios?.length) {
      controls.push({
        key: "ratio",
        label: "Ratio",
        value: state.videoAspectRatio,
        options: modelConfig.capabilities.videoAspectRatios,
        displayLabel: ratioLabel,
        onSelect: setVideoAspectRatio,
        icon: <RatioIcon ratio={state.videoAspectRatio} className="opacity-50" />,
      });
    }

    if (modelConfig.capabilities.resolutionOptions?.length) {
      controls.push({
        key: "quality",
        label: "Quality",
        value: state.videoResolution,
        options: modelConfig.capabilities.resolutionOptions,
        onSelect: setVideoResolution,
        icon: <ImagePlus className="size-4 opacity-50" />,
      });
    }

    return controls;
  }, [
    modelConfig,
    setVideoAspectRatio,
    setVideoResolution,
    state.videoAspectRatio,
    state.videoResolution,
  ]);
  const activeReferenceImages = useMemo(
    () => [
      state.videoImageUrl
        ? {
            key: "pasted",
            label: "Pasted image",
            imageUrl: state.videoImageUrl,
            onRemove: () => setVideoImageUrl(""),
          }
        : null,
      state.useSelectedImageAsVideoReference && state.selectedImage
        ? {
            key: "selected",
            label: "Selected image",
            imageUrl: state.selectedImage.imageUrl,
            onRemove: () => setUseSelectedImageAsVideoReference(false),
          }
        : null,
    ].filter(
      (
        item,
      ): item is {
        key: string;
        label: string;
        imageUrl: string;
        onRemove: () => void;
      } => item !== null,
    ),
    [
      setUseSelectedImageAsVideoReference,
      setVideoImageUrl,
      state.selectedImage,
      state.useSelectedImageAsVideoReference,
      state.videoImageUrl,
    ],
  );
  const hasReferencePreview =
    isUploadingReferenceImage || activeReferenceImages.length > 0;
  const isWaitingForReferenceImageState =
    hasPendingReferenceImageUpload &&
    (!pendingReferenceImageUrl || state.videoImageUrl !== pendingReferenceImageUrl);
  const isReferenceImageReady = !isWaitingForReferenceImageState;

  useEffect(() => {
    if (window.innerWidth >= MOBILE_BREAKPOINT) {
      textareaRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (
      hasPendingReferenceImageUpload &&
      pendingReferenceImageUrl &&
      state.videoImageUrl === pendingReferenceImageUrl
    ) {
      setHasPendingReferenceImageUpload(false);
      setPendingReferenceImageUrl(null);
    }
  }, [hasPendingReferenceImageUpload, pendingReferenceImageUrl, state.videoImageUrl]);

  const syncTextareaHeight = useCallback((expanded: boolean, promptValue: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!promptValue) {
      setTextareaHeight(COLLAPSED_TEXTAREA_HEIGHT);
      return;
    }

    const previousHeight = textarea.style.height;
    textarea.style.height = "0px";
    const measuredHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = previousHeight;

    setTextareaHeight(
      expanded
        ? Math.max(COLLAPSED_TEXTAREA_HEIGHT, measuredHeight)
        : COLLAPSED_TEXTAREA_HEIGHT,
    );
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight(isPromptFocused, state.prompt);
  }, [isPromptFocused, state.prompt, syncTextareaHeight]);

  const handleGenerate = useCallback(() => {
    if (!state.prompt.trim() || !isReferenceImageReady) {
      return;
    }

    void generateFromCurrentState();
  }, [generateFromCurrentState, isReferenceImageReady, state.prompt]);

  const handlePasteReferenceImage = useCallback(
    async (file: File) => {
      if (!supportsReferenceImagePaste) {
        toast.error("This model does not support reference images");
        return;
      }

      setHasPendingReferenceImageUpload(true);
      setPendingReferenceImageUrl(null);
      setIsUploadingReferenceImage(true);
      try {
        const imageUrl = await uploadReferenceImage(file);
        setPendingReferenceImageUrl(imageUrl);
        setVideoImageUrl(imageUrl);
        toast.success("Reference image attached");
      } catch (error) {
        setHasPendingReferenceImageUpload(false);
        setPendingReferenceImageUrl(null);
        const message =
          error instanceof Error ? error.message : "Failed to attach reference image";
        toast.error(message);
      } finally {
        setIsUploadingReferenceImage(false);
      }
    },
    [setVideoImageUrl, supportsReferenceImagePaste],
  );

  const canGenerate = state.prompt.trim().length > 0 && isReferenceImageReady;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      // Skip if focus is inside an editable element — the textarea's own
      // onKeyDown already handles Cmd/Ctrl+Enter there. Listening here too
      // would enqueue the generation twice.
      if (
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (canGenerate) handleGenerate();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGenerate, handleGenerate]);

  return (
    <motion.div layout className="flex justify-center">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 190, damping: 24, mass: 0.9 }}
        className="flex w-full max-w-3xl flex-col gap-3"
      >
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 190, damping: 24, mass: 0.9 }}
          className={cn(
            "bg-card rounded-lg sm:rounded-xl transition-all duration-300",
            "shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border",
            "minimal-focus",
          )}
        >
          <motion.div layout className="px-3 sm:px-4 pt-0.5 pb-1">
            {hasReferencePreview && (
              <div className="mb-2 rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {isUploadingReferenceImage
                      ? "Uploading reference image..."
                      : `${activeReferenceImages.length} reference image${activeReferenceImages.length === 1 ? "" : "s"} ready`}
                  </span>
                  {isUploadingReferenceImage && (
                    <div className="size-4 animate-pulse rounded bg-muted" />
                  )}
                </div>

                {activeReferenceImages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeReferenceImages.map((reference) => (
                      <div
                        key={reference.key}
                        className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reference.imageUrl}
                          alt={`${reference.label} preview`}
                          className="size-7 rounded object-cover"
                        />
                        <span className="max-w-28 truncate text-xs text-muted-foreground">
                          {reference.label}
                        </span>
                        <button
                          type="button"
                          onClick={reference.onRemove}
                          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Remove ${reference.label.toLowerCase()}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={state.prompt}
              onChange={(event) => {
                const value = event.target.value;
                if (value.length <= maxPromptLength) {
                  setPrompt(value);
                } else {
                  setPrompt(value.slice(0, maxPromptLength));
                }
              }}
              onFocus={() => {
                setIsPromptFocused(true);
              }}
              onBlur={() => {
                setIsPromptFocused(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canGenerate) {
                    handleGenerate();
                  }
                  return;
                }

                if (!event.metaKey && !event.ctrlKey && event.key.length === 1) {
                  const textarea = event.currentTarget;
                  const selectionLength =
                    textarea.selectionEnd - textarea.selectionStart;
                  const currentLength = state.prompt.length;

                  if (
                    selectionLength > 0 &&
                    currentLength - selectionLength + 1 <= maxPromptLength
                  ) {
                    return;
                  }

                  if (currentLength >= maxPromptLength) {
                    event.preventDefault();
                  }
                }
              }}
              onPaste={(event) => {
                const clipboardItems = event.clipboardData?.items;
                if (supportsReferenceImagePaste) {
                  const imageItem = Array.from(clipboardItems ?? []).find((item) =>
                    item.type.startsWith("image/"),
                  );

                  if (imageItem) {
                    const file = imageItem.getAsFile();
                    if (file) {
                      event.preventDefault();
                      void handlePasteReferenceImage(file);
                      return;
                    }
                  }
                }

                const paste = event.clipboardData.getData("text");
                const textarea = event.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectionLength = end - start;
                const available =
                  maxPromptLength - (state.prompt.length - selectionLength);

                if (paste.length > available) {
                  event.preventDefault();
                  const truncated = paste.slice(0, Math.max(0, available));
                  const before = state.prompt.slice(0, start);
                  const after = state.prompt.slice(end);
                  const nextValue = (before + truncated + after).slice(
                    0,
                    maxPromptLength,
                  );

                  setPrompt(nextValue);

                  requestAnimationFrame(() => {
                    textarea.selectionStart = textarea.selectionEnd =
                      start + truncated.length;
                  });
                }
              }}
              placeholder="Describe your vision..."
              rows={1}
              className={cn(
                "studio-composer-input",
                "w-full resize-none bg-transparent pt-0 text-foreground focus:outline-none transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "font-serif text-base leading-relaxed placeholder:text-muted-foreground/50",
                "selection:bg-primary/20 selection:text-primary",
              )}
              style={{ height: `${textareaHeight}px` }}
              disabled={false}
            />
          </motion.div>

          <motion.div
            layout
            className="border-t border-border/60 px-3 pb-3 pt-2.5"
          >
            {/* Row 1: Model selector full width */}
            <div className="flex items-center min-w-0 ml-1">
              <ModelCombobox />
            </div>

            {/* Row 2: Options left, Generate right */}
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div className="flex items-center gap-1 min-w-0">
                {!isVideoModel(state.model) && (
                  <>
                    <AspectRatioCombobox />
                    <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
                    <BatchSizePopover />
                  </>
                )}
                {videoComposerControls.map((control) => (
                  <ComposerOptionPopover
                    key={control.key}
                    label={control.label}
                    value={control.value}
                    options={control.options}
                    displayLabel={control.displayLabel}
                    onSelect={control.onSelect}
                    icon={control.icon}
                  />
                ))}
                {canUseSelectedImageAsReference && (
                  <div className="ml-1 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                    <span>Use Image</span>
                    <Switch
                      checked={state.useSelectedImageAsVideoReference}
                      onCheckedChange={setUseSelectedImageAsVideoReference}
                      aria-label="Use selected image as video reference"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pr-1 shrink-0">
                <span
                  className={cn(
                    "text-xs font-sans tabular-nums tracking-tight transition-colors",
                    state.prompt.length >= maxPromptLength
                      ? "text-destructive font-medium"
                      : state.prompt.length > maxPromptLength - 500
                        ? "text-amber-500"
                        : "text-muted-foreground/55",
                  )}
                >
                  {state.prompt.length}/{maxPromptLength}
                </span>
                <Button
                  size="default"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={cn(
                    "rounded-full bg-primary px-6 font-sans font-medium tracking-tight text-primary-foreground shadow-md transition-all duration-200 h-10",
                    canGenerate
                      ? "hover:scale-105 hover:bg-primary/90 opacity-100"
                      : "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Sparkles className="mr-2 size-4" />
                  Generate
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
