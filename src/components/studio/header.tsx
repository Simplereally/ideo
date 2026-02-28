"use client";

import { Key } from "lucide-react";
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
  const { openApiKeyDialog } = useStudio();
  const { googleApiKey, falApiKey, vertexAccessToken } = useSettingsStore();

  const hasAnyKey = !!googleApiKey || !!falApiKey || !!vertexAccessToken;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between px-6 z-40 bg-transparent">
      {/* Logo */}
      <div className="flex items-center">
        <span className="font-serif text-[1.6rem] tracking-tight font-medium text-black select-none">
          Ideo
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={openApiKeyDialog}
              className="relative size-10 rounded-full bg-white text-neutral-600 shadow-sm border border-black/5 hover:text-black hover:border-black/10 transition-colors"
            >
              <Key className="size-[1.1rem]" strokeWidth={2} />
              <span
                className={cn(
                  "absolute top-[6px] right-[6px] size-2.5 rounded-full border-2 border-white",
                  hasAnyKey ? "bg-[#34C759]" : "bg-[#FF3B30]"
                )}
              />
              <span className="sr-only">API Key</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">
            {hasAnyKey ? "API keys configured" : "Set API keys"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
