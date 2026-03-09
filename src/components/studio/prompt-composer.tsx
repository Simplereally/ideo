"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { getMaxPromptLength, isVideoModel } from "@/lib/types";
import { useGenerationActions } from "./generation-actions";
import { PendingImageJobsStrip } from "./pending-image-jobs-strip";
import { PendingVideoJobsStrip } from "./pending-video-jobs-strip";
import { ModelCombobox } from "./model-combobox";
import { AspectRatioCombobox } from "./aspect-ratio-combobox";
import { BatchSizePopover } from "./batch-size-popover";
import { MOBILE_BREAKPOINT } from "@/lib/constants";

const COLLAPSED_TEXTAREA_HEIGHT = 63;
const MAX_TEXTAREA_HEIGHT = 240;

export function PromptComposer() {
  const { state, setPrompt } = useStudio();
  const { generateFromCurrentState } = useGenerationActions();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState(
    COLLAPSED_TEXTAREA_HEIGHT,
  );

  const maxPromptLength = useMemo(
    () => getMaxPromptLength(state.model),
    [state.model],
  );

  useEffect(() => {
    if (window.innerWidth >= MOBILE_BREAKPOINT) {
      textareaRef.current?.focus();
    }
  }, []);

  const syncTextareaHeight = useCallback((expanded: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!textarea.value) {
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
    syncTextareaHeight(isPromptFocused);
  }, [isPromptFocused, state.prompt, syncTextareaHeight]);

  const handleGenerate = useCallback(() => {
    void generateFromCurrentState();
  }, [generateFromCurrentState]);

  const canGenerate = state.prompt.trim().length > 0;

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
        <PendingVideoJobsStrip />
        <PendingImageJobsStrip />

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
