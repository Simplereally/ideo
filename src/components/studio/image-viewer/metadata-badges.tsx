"use client";

import { Film, ImageIcon, Calendar, Ratio, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";
import { PROVIDER_LABELS } from "@/lib/types";

interface MetadataBadgesProps {
  modelLabel: string;
  aspectRatio?: string;
  timestamp?: number;
  isVideo?: boolean;
  provider?: Provider;
  className?: string;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MetadataBadges({
  modelLabel,
  aspectRatio,
  timestamp,
  isVideo = false,
  provider,
  className,
}: MetadataBadgesProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Model */}
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
          {isVideo ? (
            <Film className="size-3.5 text-muted-foreground" />
          ) : (
            <ImageIcon className="size-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
            Model
          </p>
          <p className="text-[13px] text-foreground font-medium truncate">
            {modelLabel}
          </p>
        </div>
      </div>

      {/* Provider */}
      {provider && (
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
            <Server className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              Provider
            </p>
            <p className="text-[13px] text-foreground font-medium">
              {PROVIDER_LABELS[provider] ?? provider}
            </p>
          </div>
        </div>
      )}

      {/* Aspect Ratio */}
      {aspectRatio && (
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
            <Ratio className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              Aspect Ratio
            </p>
            <p className="text-[13px] text-foreground font-medium">
              {aspectRatio}
            </p>
          </div>
        </div>
      )}

      {/* Date */}
      {timestamp && (
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
            <Calendar className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              Created
            </p>
            <p className="text-[13px] text-foreground font-medium">
              {formatDate(timestamp)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
