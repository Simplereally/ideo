"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PromptDisplay } from "./prompt-display";
import { MetadataBadges } from "./metadata-badges";
import { ViewerActions } from "./viewer-actions";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { Provider } from "@/lib/types";
import {
  MOBILE_SHEET_PEEK_HEIGHT,
  MOBILE_SHEET_EXPANDED_RATIO,
} from "@/lib/constants";

interface MobileInfoSheetProps {
  prompt: string;
  negativePrompt?: string;
  modelLabel: string;
  aspectRatio?: string;
  timestamp?: number;
  isVideo?: boolean;
  provider?: Provider;
  onDownload: () => void;
  onUsePrompt: () => void;
}

export function MobileInfoSheet({
  prompt,
  negativePrompt,
  modelLabel,
  aspectRatio,
  timestamp,
  isVideo = false,
  provider,
  onDownload,
  onUsePrompt,
}: MobileInfoSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [expandedHeight, setExpandedHeight] = useState(0);

  // Calculate expanded height based on viewport
  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight;
      setExpandedHeight(Math.round(vh * MOBILE_SHEET_EXPANDED_RATIO));
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Hide hint after first expansion or after 5 seconds
  useEffect(() => {
    if (isExpanded) {
      setShowHint(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  const peekHeight = MOBILE_SHEET_PEEK_HEIGHT;

  return (
    <div 
      style={{ height: peekHeight, flexShrink: 0 }} 
      className="relative overflow-visible w-full max-w-lg mx-auto"
    >
      <motion.div
        className={cn(
          "overflow-hidden",
          "bg-card/95 backdrop-blur-md",
          "border-t border-border/50",
          "shadow-[0_-4px_20px_rgba(0,0,0,0.15)]",
          "rounded-t-2xl"
        )}
        style={{
          height: expandedHeight || peekHeight,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        initial={false}
        animate={{ y: isExpanded ? -(expandedHeight - peekHeight) : 0 }}
        transition={{ type: "spring", damping: 40, stiffness: 500 }}
      >
      {/* Drag handle / toggle area */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          "flex flex-col items-center w-full pt-2 pb-1",
          "cursor-pointer active:bg-muted/30 transition-colors"
        )}
      >
        {/* Drag handle pill */}
        <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />

        {/* Swipe hint or collapse indicator */}
        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
          {isExpanded ? (
            <>
              <ChevronDown className="size-3" />
              <span>Tap to collapse</span>
            </>
          ) : showHint ? (
            <span className="animate-bounce flex items-center gap-1">
              <ChevronUp className="size-3" />
              <span>Tap for details</span>
            </span>
          ) : (
            <>
              <ChevronUp className="size-3" />
              <span>Details</span>
            </>
          )}
        </div>
      </button>

      {/* Scrollable content area */}
      <div
        ref={contentRef}
        className={cn(
          "overflow-y-auto overscroll-contain",
          "px-4"
        )}
        style={{
          height: `calc(${expandedHeight}px - 52px - env(safe-area-inset-bottom))`,
        }}
      >
        {/* Peek state: compact metadata + action buttons (always visible) */}
        <div className="flex items-center justify-between gap-4 pb-3">
          <MetadataBadges
            modelLabel={modelLabel}
            timestamp={timestamp}
            isVideo={isVideo}
            variant="compact"
          />
          <ViewerActions
            onDownload={onDownload}
            onUsePrompt={onUsePrompt}
            variant="compact"
          />
        </div>

        {/* Expanded content */}
        <motion.div
          initial={false}
          animate={{ 
            opacity: isExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-4 pb-6"
          style={{ pointerEvents: isExpanded ? "auto" : "none" }}
        >
          <div className="h-px bg-border/40" />

          <PromptDisplay prompt={prompt} variant="mobile" />

          {negativePrompt && (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground/60 font-medium">
                Negative Prompt
              </p>
              <p className="text-sm leading-relaxed text-foreground/70">
                {negativePrompt}
              </p>
            </div>
          )}

          <div className="h-px bg-border/40" />

          <MetadataBadges
            modelLabel={modelLabel}
            aspectRatio={aspectRatio}
            timestamp={timestamp}
            isVideo={isVideo}
            provider={provider}
            variant="mobile"
          />

          <div className="h-px bg-border/40" />

          <ViewerActions
            onDownload={onDownload}
            onUsePrompt={onUsePrompt}
            variant="mobile"
          />
        </motion.div>
      </div>
    </motion.div>
  </div>
  );
}
