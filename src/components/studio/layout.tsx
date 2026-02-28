"use client";

import { StudioCanvas } from "./canvas";
import { StudioHeader } from "./header";
import { PromptComposer } from "./prompt-composer";
import { HistoryPanel } from "./history-panel";
import { GenerationControls } from "./generation-controls";
import { ApiKeyDialog } from "./api-key-dialog";
import { ImageViewer } from "./image-viewer";
import { useStudio } from "@/lib/store";
import { Clock, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function StudioLayout() {
  const { state, toggleHistory, toggleControls } = useStudio();
  
  return (
    <div className="flex h-dvh flex-col bg-[#F5F5F7] overflow-hidden text-neutral-900 selection:bg-blue-500/20">
      {/* Top Navigation Bar */}
      <StudioHeader />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative pb-4 px-4 pt-1 gap-4">
        {/* Left Sidebar: History */}
        <HistoryPanel />

        {/* Center Canvas & Prompt Composer */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-white rounded-3xl border border-black/[0.04] shadow-sm transition-all">
          
          {/* Main Content Actions - Floating Inside Canvas */}
          <div className="absolute top-4 left-4 right-4 z-20 flex justify-between pointer-events-none">
            <div className="pointer-events-auto">
              {!state.isHistoryOpen && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleHistory}
                      className="size-10 rounded-full bg-white/80 backdrop-blur-md text-neutral-600 shadow-sm border border-black/5 hover:text-black hover:border-black/10 transition-colors"
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
                      className="size-10 rounded-full bg-white/80 backdrop-blur-md text-neutral-600 shadow-sm border border-black/5 hover:text-black hover:border-black/10 transition-colors"
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

          <StudioCanvas />
          <PromptComposer />
        </main>

        {/* Right Sidebar: Controls */}
        <GenerationControls />
      </div>

      {/* Overlays */}
      <ApiKeyDialog />
      <ImageViewer />
    </div>
  );
}
