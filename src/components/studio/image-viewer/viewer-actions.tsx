"use client";

import { Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewerActionsProps {
  onDownload: () => void;
  onUsePrompt: () => void;
  className?: string;
}

export function ViewerActions({
  onDownload,
  onUsePrompt,
  className,
}: ViewerActionsProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={onDownload}
        className={cn(
          "w-full justify-start gap-2.5 h-10",
          "bg-muted/50 hover:bg-muted border-0",
          "text-[12px] font-medium text-foreground/80 hover:text-foreground",
          "rounded-xl transition-all duration-200"
        )}
      >
        <Download className="size-4" />
        Download
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={onUsePrompt}
        className={cn(
          "w-full justify-start gap-2.5 h-10",
          "bg-muted/50 hover:bg-muted border-0",
          "text-[12px] font-medium text-foreground/80 hover:text-foreground",
          "rounded-xl transition-all duration-200"
        )}
      >
        <Copy className="size-4" />
        Use Prompt
      </Button>
    </div>
  );
}
