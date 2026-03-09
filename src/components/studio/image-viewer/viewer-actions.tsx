"use client";

import { Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewerActionsProps {
  onDownload: () => void;
  onUsePrompt: () => void;
  variant?: "default" | "mobile" | "compact";
  className?: string;
}

export function ViewerActions({
  onDownload,
  onUsePrompt,
  variant = "default",
  className,
}: ViewerActionsProps) {
  // Compact variant: icon-only buttons for peek state
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDownload}
          className="size-10 rounded-xl bg-muted/50 hover:bg-muted active:scale-95"
        >
          <Download className="size-4" />
          <span className="sr-only">Download</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUsePrompt}
          className="size-10 rounded-xl bg-muted/50 hover:bg-muted active:scale-95"
        >
          <Copy className="size-4" />
          <span className="sr-only">Use Prompt</span>
        </Button>
      </div>
    );
  }

  const isMobile = variant === "mobile";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant="secondary"
        size={isMobile ? "default" : "sm"}
        onClick={onDownload}
        className={cn(
          "w-full justify-start gap-2.5",
          isMobile ? "h-12" : "h-10",
          "bg-muted/50 hover:bg-muted border-0",
          "font-medium text-foreground/80 hover:text-foreground",
          "rounded-xl transition-all duration-200",
          "active:scale-[0.98]"
        )}
      >
        <Download className={isMobile ? "size-5" : "size-4"} />
        Download
      </Button>

      <Button
        variant="secondary"
        size={isMobile ? "default" : "sm"}
        onClick={onUsePrompt}
        className={cn(
          "w-full justify-start gap-2.5",
          isMobile ? "h-12" : "h-10",
          "bg-muted/50 hover:bg-muted border-0",
          "font-medium text-foreground/80 hover:text-foreground",
          "rounded-xl transition-all duration-200",
          "active:scale-[0.98]"
        )}
      >
        <Copy className={isMobile ? "size-5" : "size-4"} />
        Use Prompt
      </Button>
    </div>
  );
}
