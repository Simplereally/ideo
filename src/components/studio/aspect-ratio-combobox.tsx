"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useStudio } from "@/lib/store";
import { ASPECT_RATIOS } from "@/lib/types";
import type { AspectRatio } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ratioLabel, ratioOrientation } from "@/lib/aspect-ratio-utils";

function RatioIcon({ ratio, className }: { ratio: string; className?: string }) {
  const orientation = ratioOrientation(ratio);

  return (
    <span
      className={cn(
        "inline-block rounded-[2px] border-[1.5px] border-current shrink-0",
        orientation === "wide" && "w-[18px] h-[13px]",
        orientation === "tall" && "w-[13px] h-[18px]",
        orientation === "square" && "w-[15px] h-[15px]",
        className,
      )}
    />
  );
}

interface AspectRatioComboboxProps {
  className?: string;
}

export function AspectRatioCombobox({ className }: AspectRatioComboboxProps) {
  const { state, setAspectRatio } = useStudio();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);

  // Filter ratios based on input
  const filteredRatios = useMemo(() => {
    const search = inputValue.toLowerCase().trim();
    if (!search) return ASPECT_RATIOS;

    return ASPECT_RATIOS.filter(
      (ratio) =>
        ratio.value.toLowerCase().includes(search) ||
        ratio.label.toLowerCase().includes(search)
    );
  }, [inputValue]);

  const handleSelect = useCallback(
    (value: string | null) => {
      if (!value) return;
      setAspectRatio(value as AspectRatio);
      setOpen(false);
      setInputValue("");
    },
    [setAspectRatio]
  );

  return (
    <Combobox
      open={open}
      onOpenChange={setOpen}
      value={state.aspectRatio}
      onValueChange={handleSelect}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
    >
      {/* Trigger button */}
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          "transition-colors",
          className
        )}
      >
        <RatioIcon ratio={state.aspectRatio} className="opacity-50" />
        <span className="text-foreground font-semibold">
          {ratioLabel(state.aspectRatio)} ({state.aspectRatio})
        </span>
      </button>

      {/* Dropdown content */}
      <ComboboxContent anchor={anchorRef} className="w-[220px]">
        <ComboboxInput placeholder="Search ratios..." className="h-9" />
        <ComboboxList>
          <ComboboxEmpty>No ratios found</ComboboxEmpty>

          {filteredRatios.map((ratio) => (
            <ComboboxItem key={ratio.value} value={ratio.value}>
              <div className="flex items-center gap-2.5 w-full">
                <RatioIcon ratio={ratio.value} className="opacity-60" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{ratioLabel(ratio.value)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {ratio.value}
                  </span>
                </div>
              </div>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
