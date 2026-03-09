"use client";

import { cn } from "@/lib/utils";

interface ImageNavDotsProps {
  total: number;
  current: number;
  className?: string;
}

export function ImageNavDots({ total, current, className }: ImageNavDotsProps) {
  if (total <= 1) return null;

  // Show max 7 dots, with ellipsis behavior for large sets
  const maxDots = 7;
  const showEllipsis = total > maxDots;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5",
        className
      )}
      role="tablist"
      aria-label={`Image ${current + 1} of ${total}`}
    >
      {Array.from({ length: Math.min(total, maxDots) }).map((_, idx) => {
        const isActive = idx === current || (showEllipsis && idx === maxDots - 1 && current >= maxDots - 1);

        return (
          <div
            key={idx}
            role="tab"
            aria-selected={idx === current}
            className={cn(
              "rounded-full transition-all duration-200",
              isActive
                ? "h-1.5 w-4 bg-foreground"
                : "size-1.5 bg-foreground/30"
            )}
          />
        );
      })}
    </div>
  );
}
