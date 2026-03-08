"use client";

import { Key, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudio } from "@/lib/store";
import { useProviderStatus } from "@/hooks/use-provider-status";
import { cn } from "@/lib/utils";

export function StudioHeader() {
  const { openApiKeyDialog } = useStudio();
  const { status } = useProviderStatus();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const hasConfiguredProviders =
    status.google || status.vertex || status.fal || status.aiml;

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="z-40 flex h-12 shrink-0 items-center justify-between px-3 sm:h-13 sm:px-4">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="select-none font-serif text-[1.35rem] font-medium tracking-tight text-foreground sm:text-[1.45rem]">
          Ideo
        </span>
        <div className="hidden items-center gap-2 rounded-full border border-border bg-card/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-sm sm:flex">
          <span
            className={cn(
              "size-1.5 rounded-full",
              hasConfiguredProviders ? "bg-emerald-500" : "bg-destructive",
            )}
          />
          <span>{hasConfiguredProviders ? "Providers Ready" : "Keys Needed"}</span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="size-9 rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-border hover:text-foreground"
            >
              {mounted ? (
                resolvedTheme === "dark" ? (
                  <Sun className="size-[1.1rem]" strokeWidth={2} />
                ) : (
                  <Moon className="size-[1.1rem]" strokeWidth={2} />
                )
              ) : (
                <Sun className="size-[1.1rem]" strokeWidth={2} />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">
            {mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={openApiKeyDialog}
              className="relative size-9 rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-border hover:text-foreground"
            >
              <Key className="size-[1.1rem]" strokeWidth={2} />
              <span
                className={cn(
                  "absolute top-[6px] right-[6px] size-2.5 rounded-full border-2 border-card",
                  hasConfiguredProviders ? "bg-emerald-500" : "bg-destructive"
                )}
              />
              <span className="sr-only">API Key</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">
            {hasConfiguredProviders ? "API keys configured" : "Set API keys"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
