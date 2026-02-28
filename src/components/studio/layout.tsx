"use client";

import { StudioCanvas } from "./canvas";
import { StudioHeader } from "./header";
import { PromptComposer } from "./prompt-composer";
import { HistoryPanel } from "./history-panel";
import { GenerationControls } from "./generation-controls";
import { ApiKeyDialog } from "./api-key-dialog";
import { ImageViewer } from "./image-viewer";
import { useStudio } from "@/lib/store";

export function StudioLayout() {
  const { state } = useStudio();
  
  return (
    <div className="flex h-dvh flex-col bg-[#F5F5F7] overflow-hidden text-neutral-900 selection:bg-blue-500/20">
      {/* Top Navigation Bar */}
      <StudioHeader />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: History */}
        <HistoryPanel />

        {/* Center Canvas & Prompt Composer */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-white rounded-tl-[2rem] border-t border-l border-black/[0.06] shadow-[-8px_-8px_24px_rgba(0,0,0,0.02)] transition-all">
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