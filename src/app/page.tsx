import { StudioCanvas } from "@/components/studio/canvas";
import { StudioHeader } from "@/components/studio/header";
import { PromptComposer } from "@/components/studio/prompt-composer";
import { HistoryPanel } from "@/components/studio/history-panel";
import { GenerationControls } from "@/components/studio/generation-controls";
import { ApiKeyDialog } from "@/components/studio/api-key-dialog";
import { ImageViewer } from "@/components/studio/image-viewer";
import { FilmGrain } from "@/components/studio/film-grain";

export default function Home() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <FilmGrain />
      <StudioHeader />
      <StudioCanvas />
      <HistoryPanel />
      <GenerationControls />
      <PromptComposer />
      <ApiKeyDialog />
      <ImageViewer />
    </div>
  );
}
