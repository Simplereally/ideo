"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptDisplay } from "./prompt-display";
import { MetadataBadges } from "./metadata-badges";
import { ViewerActions } from "./viewer-actions";
import { cn } from "@/lib/utils";
import { INFO_PANEL_WIDTH } from "@/lib/constants";
import type { Provider } from "@/lib/types";

interface InfoPanelProps {
  prompt: string;
  negativePrompt?: string;
  modelLabel: string;
  aspectRatio?: string;
  timestamp?: number;
  isVideo?: boolean;
  provider?: Provider;
  onDownload: () => void;
  onUsePrompt: () => void;
  className?: string;
}

export function InfoPanel({
  prompt,
  negativePrompt,
  modelLabel,
  aspectRatio,
  timestamp,
  isVideo = false,
  provider,
  onDownload,
  onUsePrompt,
  className,
}: InfoPanelProps) {
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);

  const toggleNegativePrompt = useCallback(() => {
    setShowNegativePrompt((prev) => !prev);
  }, []);

  return (
    <aside
      className={cn(
        `flex h-full w-[${INFO_PANEL_WIDTH}px] shrink-0 flex-col overflow-hidden`,
        "border-r border-border/50 bg-card/95",
        className
      )}
    >
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-6 p-6">
          {/* Header */}
          <div>
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
              Generation Details
            </h2>
          </div>

          {/* Prompt Section - header is now inside PromptDisplay */}
          <PromptDisplay prompt={prompt} />

          {/* Negative Prompt Section */}
          {negativePrompt && (
            <div className="space-y-2">
              <button
                onClick={toggleNegativePrompt}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] uppercase tracking-wider",
                  "text-muted-foreground/60 hover:text-muted-foreground font-medium",
                  "transition-colors duration-200"
                )}
              >
                Negative Prompt
                {showNegativePrompt ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </button>
              {showNegativePrompt && (
                <p className="text-[12px] leading-relaxed text-foreground/70 font-light">
                  {negativePrompt}
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border/40" />

          {/* Metadata Section */}
          <MetadataBadges
            modelLabel={modelLabel}
            aspectRatio={aspectRatio}
            timestamp={timestamp}
            isVideo={isVideo}
            provider={provider}
          />

          {/* Divider */}
          <div className="h-px bg-border/40" />

          {/* Actions */}
          <ViewerActions onDownload={onDownload} onUsePrompt={onUsePrompt} />
        </div>
      </ScrollArea>
    </aside>
  );
}
