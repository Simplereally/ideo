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
  variant?: "default" | "mobile" | "compact";
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

// Helper for compact date display
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function MetadataBadges({
  modelLabel,
  aspectRatio,
  timestamp,
  isVideo = false,
  provider,
  variant = "default",
  className,
}: MetadataBadgesProps) {
  // Compact variant for sheet peek state - single line
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        {isVideo ? (
          <Film className="size-4 text-muted-foreground" />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" />
        )}
        <span className="font-medium truncate max-w-[120px]">{modelLabel}</span>
        {timestamp && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground text-xs">
              {formatRelativeDate(timestamp)}
            </span>
          </>
        )}
      </div>
    );
  }

  const isMobileVariant = variant === "mobile";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Model */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-muted/50",
            isMobileVariant ? "size-10" : "size-8"
          )}
        >
          {isVideo ? (
            <Film className={cn("text-muted-foreground", isMobileVariant ? "size-4" : "size-3.5")} />
          ) : (
            <ImageIcon className={cn("text-muted-foreground", isMobileVariant ? "size-4" : "size-3.5")} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "uppercase tracking-wider text-muted-foreground/60 font-medium",
              isMobileVariant ? "text-xs" : "text-[10px]"
            )}
          >
            Model
          </p>
          <p
            className={cn(
              "font-medium truncate",
              isMobileVariant ? "text-sm" : "text-[13px]"
            )}
          >
            {modelLabel}
          </p>
        </div>
      </div>

      {/* Provider */}
      {provider && (
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg bg-muted/50",
              isMobileVariant ? "size-10" : "size-8"
            )}
          >
            <Server className={cn("text-muted-foreground", isMobileVariant ? "size-4" : "size-3.5")} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "uppercase tracking-wider text-muted-foreground/60 font-medium",
                isMobileVariant ? "text-xs" : "text-[10px]"
              )}
            >
              Provider
            </p>
            <p
              className={cn(
                "font-medium",
                isMobileVariant ? "text-sm" : "text-[13px]"
              )}
            >
              {PROVIDER_LABELS[provider] ?? provider}
            </p>
          </div>
        </div>
      )}

      {/* Aspect Ratio */}
      {aspectRatio && (
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg bg-muted/50",
              isMobileVariant ? "size-10" : "size-8"
            )}
          >
            <Ratio className={cn("text-muted-foreground", isMobileVariant ? "size-4" : "size-3.5")} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "uppercase tracking-wider text-muted-foreground/60 font-medium",
                isMobileVariant ? "text-xs" : "text-[10px]"
              )}
            >
              Aspect Ratio
            </p>
            <p
              className={cn(
                "font-medium",
                isMobileVariant ? "text-sm" : "text-[13px]"
              )}
            >
              {aspectRatio}
            </p>
          </div>
        </div>
      )}

      {/* Date */}
      {timestamp && (
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg bg-muted/50",
              isMobileVariant ? "size-10" : "size-8"
            )}
          >
            <Calendar className={cn("text-muted-foreground", isMobileVariant ? "size-4" : "size-3.5")} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "uppercase tracking-wider text-muted-foreground/60 font-medium",
                isMobileVariant ? "text-xs" : "text-[10px]"
              )}
            >
              Created
            </p>
            <p
              className={cn(
                "font-medium",
                isMobileVariant ? "text-sm" : "text-[13px]"
              )}
            >
              {formatDate(timestamp)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
