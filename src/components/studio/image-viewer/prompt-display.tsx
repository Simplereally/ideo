"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PromptDisplayProps {
  prompt: string;
  variant?: "default" | "mobile";
  className?: string;
}

export function PromptDisplay({
  prompt,
  variant = "default",
  className,
}: PromptDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const TRUNCATE_LENGTH = variant === "mobile" ? 200 : 300;
  const shouldTruncate = prompt.length > TRUNCATE_LENGTH;

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy prompt");
    }
  }, [prompt]);

  const displayText =
    shouldTruncate && !isExpanded
      ? `${prompt.slice(0, TRUNCATE_LENGTH).trim()}...`
      : prompt;

  const isMobile = variant === "mobile";

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with copy button */}
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "uppercase tracking-wider text-muted-foreground/60 font-medium",
            isMobile ? "text-xs" : "text-[10px]"
          )}
        >
          Prompt
        </h3>
        <button
          onClick={handleCopyPrompt}
          className={cn(
            "flex items-center justify-center rounded-lg",
            "bg-muted/50 hover:bg-muted active:scale-95",
            "text-muted-foreground hover:text-foreground",
            "transition-all duration-200",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isMobile ? "size-10" : "size-6"
          )}
          title="Copy prompt"
        >
          {copied ? (
            <Check className={cn("text-green-500", isMobile ? "size-4" : "size-3")} strokeWidth={2.5} />
          ) : (
            <Copy className={isMobile ? "size-4" : "size-3"} strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Prompt text */}
      <p
        className={cn(
          "leading-relaxed text-foreground/90 font-light tracking-wide",
          "transition-all duration-300 ease-out",
          isMobile ? "text-sm" : "text-[13px]",
          shouldTruncate && !isExpanded && !isMobile && "min-h-[8.5rem]"
        )}
      >
        {displayText}
      </p>

      {shouldTruncate && (
        <button
          onClick={toggleExpand}
          className={cn(
            "inline-flex items-center gap-1 font-medium",
            "text-muted-foreground/70 hover:text-foreground",
            "transition-colors duration-200",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            // Larger tap target on mobile
            isMobile ? "text-sm py-1" : "text-[11px]"
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
