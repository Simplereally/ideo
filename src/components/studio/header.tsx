"use client";

import { Clock, SlidersHorizontal, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudio } from "@/lib/store";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";

export function StudioHeader() {
  const { state, toggleHistory, toggleControls, openApiKeyDialog } =
    useStudio();
  const { googleApiKey, falApiKey } = useSettingsStore();

  const hasAnyKey = !!googleApiKey || !!falApiKey;

  return (
    <header className="glass-panel fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border px-4">
      {/* Logo */}
      <div className="flex items-center">
        <span className="font-serif text-xl italic text-amber select-none">
          ideo
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleHistory}
              className={cn(
                "size-9 hover:bg-amber-subtle",
                state.isHistoryOpen && "text-amber bg-amber-subtle"
              )}
            >
              <Clock className="size-4" />
              <span className="sr-only">Toggle history</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            History
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleControls}
              className={cn(
                "size-9 hover:bg-amber-subtle",
                state.isControlsOpen && "text-amber bg-amber-subtle"
              )}
            >
              <SlidersHorizontal className="size-4" />
              <span className="sr-only">Toggle controls</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            Controls
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={openApiKeyDialog}
              className="relative size-9 hover:bg-amber-subtle"
            >
              <Key className="size-4" />
              <span
                className={cn(
                  "absolute top-1.5 right-1.5 size-2 rounded-full",
                  hasAnyKey ? "bg-green-500" : "bg-amber"
                )}
              />
              <span className="sr-only">API Key</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            {hasAnyKey ? "API keys configured" : "Set API keys"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
