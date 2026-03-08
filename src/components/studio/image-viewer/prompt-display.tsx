"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TRUNCATE_LENGTH = 300;

interface PromptDisplayProps {
  prompt: string;
  className?: string;
}

export function PromptDisplay({ prompt, className }: PromptDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = prompt.length > TRUNCATE_LENGTH;

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied to clipboard");
    } catch {
      toast.error("Failed to copy prompt");
    }
  }, [prompt]);

  const displayText =
    shouldTruncate && !isExpanded
      ? `${prompt.slice(0, TRUNCATE_LENGTH).trim()}...`
      : prompt;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with copy button */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
          Prompt
        </h3>
        <button
          onClick={handleCopyPrompt}
          className={cn(
            "flex size-6 items-center justify-center rounded-lg",
            "bg-muted/50 hover:bg-muted",
            "text-muted-foreground hover:text-foreground",
            "transition-all duration-200"
          )}
          title="Copy prompt"
        >
          <Copy className="size-3" strokeWidth={2.5} />
        </button>
      </div>

      {/* Prompt text */}
      <p
        className={cn(
          "text-[13px] leading-relaxed text-foreground/90 font-light tracking-wide",
          "transition-all duration-300 ease-out",
          shouldTruncate && !isExpanded && "min-h-[8.5rem]"
        )}
      >
        {displayText}
      </p>

      {shouldTruncate && (
        <button
          onClick={toggleExpand}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium",
            "text-muted-foreground/70 hover:text-foreground",
            "transition-colors duration-200"
          )}
        >
          {isExpanded ? (
            <>
              Show less
              <ChevronUp className="size-3" />
            </>
          ) : (
            <>
              Show more
              <ChevronDown className="size-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
