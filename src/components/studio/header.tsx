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
  const { googleApiKey, falApiKey, vertexAccessToken } = useSettingsStore();

  const hasAnyKey = !!googleApiKey || !!falApiKey || !!vertexAccessToken;

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between px-6 bg-gradient-to-b from-stone-50/80 to-transparent backdrop-blur-md">
      {/* Logo */}
      <div className="flex items-center">
        <span className="font-serif text-2xl tracking-tight font-medium text-black select-none">
          Ideo
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleHistory}
              className={cn(
                "size-10 rounded-full transition-colors",
                state.isHistoryOpen 
                  ? "bg-black/10 text-black" 
                  : "text-neutral-500 hover:bg-black/5 hover:text-black"
              )}
            >
              <Clock className="size-[1.1rem]" strokeWidth={2} />
              <span className="sr-only">Toggle history</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs">
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
                "size-10 rounded-full transition-colors",
                state.isControlsOpen 
                  ? "bg-black/10 text-black" 
                  : "text-neutral-500 hover:bg-black/5 hover:text-black"
              )}
            >
              <SlidersHorizontal className="size-[1.1rem]" strokeWidth={2} />
              <span className="sr-only">Toggle controls</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs">
            Controls
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={openApiKeyDialog}
              className="relative size-10 rounded-full text-neutral-500 hover:bg-black/5 hover:text-black transition-colors"
            >
              <Key className="size-[1.1rem]" strokeWidth={2} />
              <span
                className={cn(
                  "absolute top-[8px] right-[8px] size-2 rounded-full border-2 border-stone-50",
                  hasAnyKey ? "bg-green-500" : "bg-red-500"
                )}
              />
              <span className="sr-only">API Key</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs">
            {hasAnyKey ? "API keys configured" : "Set API keys"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
