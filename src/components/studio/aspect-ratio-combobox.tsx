"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";
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
      {/* Trigger button - preserves exact look */}
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          "transition-colors",
          className
        )}
      >
        <ImageIcon className="size-4 opacity-50" />
        <span className="text-foreground font-semibold">
          {state.aspectRatio}
        </span>
      </button>

      {/* Dropdown content */}
      <ComboboxContent anchor={anchorRef} className="w-[200px]">
        <ComboboxInput placeholder="Search ratios..." className="h-9" />
        <ComboboxList>
          <ComboboxEmpty>No ratios found</ComboboxEmpty>

          {filteredRatios.map((ratio) => (
            <ComboboxItem key={ratio.value} value={ratio.value}>
              <div className="flex items-center gap-3 w-full">
                <span className="text-lg opacity-60 w-5 text-center">
                  {ratio.icon}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{ratio.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {ratio.label}
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
