"use client";

import { useEffect, useState } from "react";
import { StudioCanvas } from "./canvas";
import { StudioHeader } from "./header";
import { PromptComposer } from "./prompt-composer";
import { HistoryPanel } from "./history-panel";
import { GenerationControls } from "./generation-controls";
import { ApiKeyDialog } from "./api-key-dialog";
import { ImageViewer } from "./image-viewer";
import { ActiveJobsMonitor } from "./active-jobs-monitor";
import { GenerationActionsProvider } from "./generation-actions";
import { useStudio } from "@/lib/store";
import { Clock, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const LG_BREAKPOINT = 1024;

function useIsLg() {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    setIsLg(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isLg;
}

export function StudioLayout() {
  const { state, toggleHistory, toggleControls } = useStudio();
  const isLg = useIsLg();

  // On small screens, any open panel should show a backdrop scrim
  const hasOverlayPanel =
    !isLg && (state.isHistoryOpen || state.isControlsOpen);

  function dismissOverlay() {
    if (state.isHistoryOpen) toggleHistory();
    if (state.isControlsOpen) toggleControls();
  }

  return (
    <GenerationActionsProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground selection:bg-blue-500/20">
        {/* Top Navigation Bar */}
        <StudioHeader />

        {/* Main Workspace Area */}
        <div className="relative flex flex-1 gap-2 overflow-hidden px-2 pb-2 pt-0 sm:gap-3 sm:px-3 sm:pb-3">
          {/* ---- Desktop: sidebars participate in flex flow ---- */}
          {/* Left Sidebar: History (desktop inline) */}
          <div className="hidden lg:flex shrink-0">
            <HistoryPanel />
          </div>

          {/* Center Canvas & Prompt Composer */}
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all sm:rounded-3xl">
            {/* Main Content Actions - Floating Inside Canvas */}
            <div className="pointer-events-none absolute top-3 left-3 right-3 z-20 flex justify-between sm:top-4 sm:left-4 sm:right-4">
              <div className="pointer-events-auto">
                {!state.isHistoryOpen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleHistory}
                        className="size-9 rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:border-border hover:text-foreground sm:size-10"
                      >
                        <Clock className="size-[1.1rem]" strokeWidth={2} />
                        <span className="sr-only">Toggle history</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">
                      History
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="pointer-events-auto">
                {!state.isControlsOpen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleControls}
                        className="size-9 rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:border-border hover:text-foreground sm:size-10"
                      >
                        <SlidersHorizontal className="size-[1.1rem]" strokeWidth={2} />
                        <span className="sr-only">Toggle controls</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">
                      Settings
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <StudioCanvas />
              <ActiveJobsMonitor />
            </div>
            <div className="shrink-0 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
              <PromptComposer />
            </div>
          </main>

          {/* Right Sidebar: Controls (desktop inline) */}
          <div className="hidden lg:flex shrink-0">
            <GenerationControls />
          </div>

          {/* ---- Mobile/Tablet: panels as overlay sheets ---- */}
          {/* Backdrop scrim */}
          {hasOverlayPanel && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
              onClick={dismissOverlay}
              aria-hidden
            />
          )}

          {/* History panel overlay */}
          <div
            className={cn(
              "lg:hidden fixed inset-y-0 left-0 z-50 w-[min(320px,85vw)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] p-2",
              state.isHistoryOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <HistoryPanel overlay />
          </div>

          {/* Controls panel overlay */}
          <div
            className={cn(
              "lg:hidden fixed inset-y-0 right-0 z-50 w-[min(340px,85vw)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] p-2",
              state.isControlsOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            <GenerationControls overlay />
          </div>
        </div>

        {/* Overlays */}
        <ApiKeyDialog />
        <ImageViewer />
      </div>
    </GenerationActionsProvider>
  );
}
