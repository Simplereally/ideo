"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { useStudio } from "@/lib/store";
import {
  MODELS,
  getImageModels,
  PROVIDER_SHORT_LABELS,
  PROVIDER_LABELS,
} from "@/lib/types";
import type { Provider, ModelConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useConfiguredProviders } from "@/hooks/use-configured-providers";

const PROVIDER_DOT_COLORS: Record<Provider, string> = {
  google: "bg-blue-500",
  vertex: "bg-emerald-500",
  fal: "bg-violet-500",
  aiml: "bg-orange-500",
  airforce: "bg-sky-500",
};

interface ModelComboboxProps {
  className?: string;
}

export function ModelCombobox({ className }: ModelComboboxProps) {
  const { state, setModel, setProvider } = useStudio();
  const { configuredProviders, loading } = useConfiguredProviders();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);

  // Get image models grouped by provider
  const imageModels = useMemo(() => getImageModels(), []);
  const availableProviderSet = useMemo(
    () => new Set<Provider>(configuredProviders),
    [configuredProviders],
  );
  const availableModels = useMemo(
    () =>
      imageModels.filter((model) => availableProviderSet.has(model.provider)),
    [availableProviderSet, imageModels],
  );
  const hasConfiguredModels = availableModels.length > 0;

  // Current selection display
  const currentModel = useMemo(
    () =>
      MODELS.find((m) => m.id === state.model) ??
      MODELS.find((m) => m.value === state.model),
    [state.model]
  );
  const fallbackModel = availableModels[0];
  const activeModel =
    currentModel && availableProviderSet.has(currentModel.provider)
      ? currentModel
      : fallbackModel;

  const modelLabel =
    activeModel?.label ??
    (configuredProviders.length === 0 ? "Configure integration" : state.model);
  const providerLabel = activeModel
    ? PROVIDER_SHORT_LABELS[activeModel.provider] ?? activeModel.provider
    : "No provider";

  useEffect(() => {
    if (loading) return;
    if (!fallbackModel) return;
    if (currentModel && availableProviderSet.has(currentModel.provider)) return;

    setProvider(fallbackModel.provider);
    setModel(fallbackModel.id);
  }, [availableProviderSet, currentModel, fallbackModel, loading, setModel, setProvider]);

  // Filter models based on input
  const filteredModelsByProvider = useMemo(() => {
    const search = inputValue.toLowerCase().trim();
    const result: Record<Provider, ModelConfig[]> = {
      google: [],
      vertex: [],
      fal: [],
      aiml: [],
      airforce: [],
    };

    for (const model of availableModels) {
      const matchesSearch =
        !search ||
        model.label.toLowerCase().includes(search) ||
        model.description.toLowerCase().includes(search) ||
        PROVIDER_LABELS[model.provider].toLowerCase().includes(search) ||
        PROVIDER_SHORT_LABELS[model.provider].toLowerCase().includes(search);

      if (matchesSearch) {
        result[model.provider].push(model);
      }
    }

    return result;
  }, [availableModels, inputValue]);

  // Check if any results exist
  const hasResults = useMemo(
    () => Object.values(filteredModelsByProvider).some((arr) => arr.length > 0),
    [filteredModelsByProvider]
  );

  const handleSelect = useCallback(
    (modelId: string | null) => {
      if (!modelId) return;
      const model = MODELS.find((m) => m.id === modelId);
      if (model) {
        setProvider(model.provider);
        setModel(model.id);
      }
      setOpen(false);
      setInputValue("");
    },
    [setModel, setProvider]
  );

  return (
    <Combobox
      open={open}
      onOpenChange={setOpen}
      value={activeModel?.id ?? state.model}
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
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          "transition-colors min-w-0",
          className
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full shrink-0",
            activeModel ? PROVIDER_DOT_COLORS[activeModel.provider] : "bg-muted-foreground/30"
          )}
        />
        <span className="truncate">{providerLabel}</span>
        <span className="text-muted-foreground/40 shrink-0">/</span>
        <span className="text-foreground font-semibold truncate">
          {modelLabel}
        </span>
      </button>

      {/* Dropdown content */}
      <ComboboxContent
        anchor={anchorRef}
        className="w-[320px]"
      >
        <ComboboxInput
          placeholder="Search models..."
          className="h-9"
        />
        <ComboboxList>
          <ComboboxEmpty>
            {configuredProviders.length === 0
              ? "Configure an API integration to view models"
              : hasConfiguredModels
                ? "No models found"
                : "No configured models available"}
          </ComboboxEmpty>

          {configuredProviders.map((provider) => {
            const models = filteredModelsByProvider[provider];
            if (models.length === 0) return null;

            return (
              <ComboboxGroup key={provider}>
                <ComboboxLabel>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        PROVIDER_DOT_COLORS[provider]
                      )}
                    />
                    {PROVIDER_LABELS[provider]}
                  </span>
                </ComboboxLabel>
                {models.map((model) => (
                  <ComboboxItem key={model.id} value={model.id}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{model.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.description}
                      </span>
                    </div>
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            );
          })}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
