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
    <header className="flex h-16 shrink-0 items-center justify-between px-6 z-40 bg-transparent">
      {/* Logo */}
      <div className="flex items-center">
        <span className="font-serif text-[1.6rem] tracking-tight font-medium text-foreground select-none">
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
              onClick={toggleTheme}
              className="size-10 rounded-full bg-card text-muted-foreground shadow-sm border border-border hover:text-foreground hover:border-border transition-colors"
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
              className="relative size-10 rounded-full bg-card text-muted-foreground shadow-sm border border-border hover:text-foreground hover:border-border transition-colors"
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
