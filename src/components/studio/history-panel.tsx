"use client";

import { X, Aperture } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
        "ios-list-item group relative flex w-full gap-3 p-3 text-left",
        isSelected && "selected"
      )}
    >
      {/* Thumbnail */}
      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-black/5 border border-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt={image.prompt}
          className="size-full object-cover"
        />
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="line-clamp-2 text-xs font-medium leading-relaxed text-black">
          {image.prompt}
        </p>
        <span className="text-[10px] font-medium text-neutral-400">
          {timeAgo(image.createdAt)}
        </span>
      </div>

      {/* Remove button — visible on hover */}
      <button
        type="button"
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-white shadow-sm border border-black/5 text-neutral-400 opacity-0 transition-all hover:text-[#FF3B30] hover:scale-105 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        tabIndex={-1}
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </button>
  );
}

export function HistoryPanel() {
  const { state, selectImage, removeImage, clearHistory, toggleHistory } = useStudio();

  return (
    <AnimatePresence initial={false}>
      {state.isHistoryOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 250 }}
          className="flex flex-col border-r border-black/[0.06] bg-[#F5F5F7] shrink-0"
        >
          <div className="w-[320px] h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-sm font-semibold text-black tracking-tight">History</h2>
              <div className="flex items-center gap-2">
                {state.history.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-[11px] font-semibold text-[#0071E3] hover:text-[#005bb5]"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            {state.history.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 opacity-40">
                <Aperture className="size-12 text-black" strokeWidth={1} />
                <p className="text-sm font-medium text-black">No history</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 px-4 pb-4">
                <ScrollArea className="h-full ios-list">
                  <div className="flex flex-col">
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
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
