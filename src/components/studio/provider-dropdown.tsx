"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { type Provider, PROVIDER_LABELS, getProviders } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderDropdownProps {
  value: Provider;
  onChange: (provider: Provider) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_PROVIDERS: Provider[] = getProviders();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProviderDropdown({
  value,
  onChange,
  disabled = false,
}: ProviderDropdownProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Select provider"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
            "transition-all",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <span className="truncate">{PROVIDER_LABELS[value]}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search providers…" />
          <CommandList>
            <CommandEmpty>No provider found.</CommandEmpty>
            <CommandGroup>
              {ALL_PROVIDERS.map((provider) => (
                <CommandItem
                  key={provider}
                  value={PROVIDER_LABELS[provider]}
                  onSelect={() => {
                    if (provider !== value) {
                      onChange(provider);
                    }
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      provider === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>{PROVIDER_LABELS[provider]}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
