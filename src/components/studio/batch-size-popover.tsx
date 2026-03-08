"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Layers3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/store";
import { getBatchSizeOptions, getModelConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BatchSizePopoverProps {
  className?: string;
}

function getBatchSizeLabel(value: number): string {
  return value === 1 ? "1 image" : `${value} images`;
}

export function BatchSizePopover({ className }: BatchSizePopoverProps) {
  const { state, setNumberOfImages } = useStudio();
  const [open, setOpen] = useState(false);

  const modelConfig = useMemo(() => getModelConfig(state.model), [state.model]);
  const batchSizeOptions = useMemo(
    () => getBatchSizeOptions(state.model),
    [state.model],
  );

  const handleSelect = useCallback(
    (value: number) => {
      setNumberOfImages(value);
      setOpen(false);
    },
    [setNumberOfImages],
  );

  if (modelConfig?.kind === "video" || batchSizeOptions.length <= 1) {
    return null;
  }

  const selectedBatchSize = batchSizeOptions.includes(state.numberOfImages)
    ? state.numberOfImages
    : batchSizeOptions[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "transition-colors",
            className,
          )}
          aria-label={`Batch size: ${getBatchSizeLabel(selectedBatchSize)}`}
        >
          <Layers3 className="size-4 opacity-50" />
          <span className="text-foreground font-semibold">
            {selectedBatchSize}x
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-48 p-1.5">
        <div className="flex flex-col gap-1">
          {batchSizeOptions.map((value) => {
            const isSelected = value === selectedBatchSize;

            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelect(value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{value}x</span>
                  <span className="text-xs text-muted-foreground">
                    {getBatchSizeLabel(value)}
                  </span>
                </div>
                <Check
                  className={cn(
                    "size-4 text-primary transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
