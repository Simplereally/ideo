"use client";

import { X, Aperture } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { GeneratedImage } from "@/lib/types";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function HistoryItem({
  image,
  isSelected,
  onSelect,
  onRemove,
}: {
  image: GeneratedImage;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "thumbnail-hover group relative flex w-full gap-3 rounded-lg p-2 text-left transition-colors",
        "hover:bg-surface-elevated",
        isSelected && "border border-amber/40 bg-amber-subtle"
      )}
    >
      {/* Thumbnail */}
      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt={image.prompt}
          className="size-full object-cover"
        />
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <p className="line-clamp-2 text-xs leading-snug text-foreground">
          {image.prompt}
        </p>
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(image.createdAt)}
        </span>
      </div>

      {/* Remove button — visible on hover */}
      <button
        type="button"
        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        tabIndex={-1}
      >
        <X className="size-3" />
      </button>
    </button>
  );
}

export function HistoryPanel() {
  const { state, selectImage, removeImage, clearHistory, toggleHistory } = useStudio();

  return (
    <AnimatePresence>
      {state.isHistoryOpen && (
        <motion.aside
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="glass-panel fixed top-14 bottom-0 left-0 z-30 flex w-[280px] flex-col border-r border-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">History</h2>
            <div className="flex items-center gap-2">
              {state.history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={toggleHistory}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          {state.history.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
              <Aperture className="size-10 text-amber/[0.08]" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">No images yet</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-1 p-2">
                {state.history.map((image) => (
                  <HistoryItem
                    key={image.id}
                    image={image}
                    isSelected={state.selectedImage?.id === image.id}
                    onSelect={() => selectImage(image)}
                    onRemove={() => removeImage(image.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
