"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  type Provider,
  type ModelConfig,
  getModelConfig,
  getModelsForProvider,
} from "@/lib/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ModelDropdownProps {
  provider: Provider;
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelDropdown({
  provider,
  value,
  onChange,
  disabled = false,
}: ModelDropdownProps) {
  const [open, setOpen] = React.useState(false);

  // Get models for current provider
  const providerModels = React.useMemo(
    () => getModelsForProvider(provider),
    [provider],
  );

  // Determine if we need kind grouping (provider has both image and video)
  const hasImageModels = providerModels.some((m) => m.kind === "image");
  const hasVideoModels = providerModels.some((m) => m.kind === "video");
  const hasMixedKinds = hasImageModels && hasVideoModels;

  // Split models by kind for grouped rendering
  const imageModels = React.useMemo(
    () => providerModels.filter((m) => m.kind === "image"),
    [providerModels],
  );
  const videoModels = React.useMemo(
    () => providerModels.filter((m) => m.kind === "video"),
    [providerModels],
  );

  // Get current model config for the display label
  const selectedModel = getModelConfig(value);

  const handleSelect = React.useCallback(
    (modelId: string) => {
      onChange(modelId);
      setOpen(false);
    },
    [onChange],
  );

  const renderModelItem = (model: ModelConfig) => (
    <CommandItem
      key={model.id}
      value={`${model.label} ${model.description} ${model.value}`}
      onSelect={() => handleSelect(model.id)}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{model.label}</span>
        <span className="text-xs text-muted-foreground">
          {model.description}
        </span>
      </div>
      <Check
        className={cn(
          "ml-auto size-4",
          model.id === value ? "opacity-100" : "opacity-0",
        )}
      />
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Select model"
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
          className={cn(
            "inline-flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-all",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "outline-none",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <span className="truncate">
            {selectedModel?.label ?? "Select model…"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            {hasMixedKinds ? (
              <>
                {imageModels.length > 0 && (
                  <CommandGroup heading="Image Models">
                    {imageModels.map(renderModelItem)}
                  </CommandGroup>
                )}
                {videoModels.length > 0 && (
                  <CommandGroup heading="Video Models">
                    {videoModels.map(renderModelItem)}
                  </CommandGroup>
                )}
              </>
            ) : (
              <CommandGroup>
                {providerModels.map(renderModelItem)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
