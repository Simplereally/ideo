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
        "thumbnail-hover group relative flex w-full gap-3 rounded-2xl p-2.5 text-left transition-all duration-300",
        "hover:bg-black/5",
        isSelected && "bg-white shadow-md shadow-black/5 ring-1 ring-black/5"
      )}
    >
      {/* Thumbnail */}
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black/5 border border-black/5">
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
        className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-white/90 shadow-sm text-neutral-400 opacity-0 transition-all hover:text-red-500 hover:scale-105 group-hover:opacity-100"
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
    <AnimatePresence>
      {state.isHistoryOpen && (
        <motion.aside
          initial={{ x: -360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -360, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed top-20 left-6 bottom-6 z-30 flex w-[320px] flex-col rounded-[2rem] bg-white/80 backdrop-blur-2xl border border-black/5 shadow-2xl shadow-black/5 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-4 bg-white/50">
            <h2 className="text-sm font-semibold text-black">History</h2>
            <div className="flex items-center gap-3">
              {state.history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs font-medium text-neutral-400 transition-colors hover:text-red-500"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={toggleHistory}
                className="flex size-7 items-center justify-center rounded-full bg-black/5 text-neutral-500 transition-colors hover:bg-black/10 hover:text-black"
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Content */}
          {state.history.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 opacity-40">
              <Aperture className="size-12 text-black" strokeWidth={1} />
              <p className="text-sm font-medium text-black">No images yet</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-1.5 p-3">
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
