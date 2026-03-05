"use client";

import { Download, Copy, Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/lib/store";
import { useVideoJobsStore } from "@/store/video-jobs";
import { MODELS } from "@/lib/types";
import { toast } from "sonner";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImageViewer() {
  const { state, closeImageViewer, setPrompt } = useStudio();
  const image = state.selectedImage;

  // Video job state — show video in viewer if a completed job is selected and viewer is open
  const selectedJobId = useVideoJobsStore((s) => s.selectedJobId);
  const jobs = useVideoJobsStore((s) => s.jobs);
  const selectedVideoJob =
    selectedJobId && state.isImageViewerOpen
      ? jobs.find(
          (j) => j.id === selectedJobId && j.status === "completed" && j.resultUrl,
        ) ?? null
      : null;

  const showVideo = !!selectedVideoJob;
  const showImage = !showVideo && !!image;

  function handleImageDownload() {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image.imageUrl;
    link.download = `ideo-${image.id}.png`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleVideoDownload() {
    if (!selectedVideoJob?.resultUrl) return;
    const link = document.createElement("a");
    link.href = selectedVideoJob.resultUrl;
    link.download = `ideo-video-${selectedVideoJob.id}.mp4`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleReusePrompt() {
    const prompt = showVideo ? selectedVideoJob?.prompt : image?.prompt;
    if (!prompt) return;
    setPrompt(prompt);
    closeImageViewer();
    toast.success("Prompt copied to composer");
  }

  const modelId = showVideo ? selectedVideoJob?.model : image?.model;
  const modelLabel =
    MODELS.find((m) => m.id === modelId)?.label ??
    MODELS.find((m) => m.value === modelId)?.label ??
    modelId;

  const timestamp = showVideo
    ? selectedVideoJob?.createdAt
    : image?.createdAt;

  const prompt = showVideo ? selectedVideoJob?.prompt : image?.prompt;

  const aspectRatio = showVideo
    ? selectedVideoJob?.params?.aspectRatio
    : image?.aspectRatio;

  return (
    <Dialog
      open={state.isImageViewerOpen}
      onOpenChange={(open) => {
        if (!open) closeImageViewer();
      }}
    >
      <DialogContent
        showCloseButton
        className="flex h-dvh max-h-dvh w-dvw max-w-dvw flex-col items-center justify-center gap-5 border-none bg-background/95 p-8 backdrop-blur-sm sm:max-w-dvw [&>[data-slot=dialog-close]]:top-5 [&>[data-slot=dialog-close]]:right-5 [&>[data-slot=dialog-close]]:rounded-lg [&>[data-slot=dialog-close]]:bg-card/80 [&>[data-slot=dialog-close]]:backdrop-blur-md [&>[data-slot=dialog-close]]:p-1.5 [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:hover:bg-card [&>[data-slot=dialog-close]]:shadow-sm [&>[data-slot=dialog-close]]:border [&>[data-slot=dialog-close]]:border-border"
      >
        {/* Hidden accessible title */}
        <DialogTitle className="sr-only">
          {showVideo ? "Video Viewer" : "Image Viewer"}
        </DialogTitle>

        {/* ----- Video content ----- */}
        {showVideo && selectedVideoJob && (
          <>
            <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/10">
              <video
                src={selectedVideoJob.resultUrl}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="max-h-[70vh] max-w-[85vw] object-contain"
              />
            </div>

            <div className="flex max-w-2xl flex-col items-center gap-3 rounded-2xl bg-card/70 backdrop-blur-2xl border border-border px-6 py-4 shadow-sm">
              <p className="text-center text-[13px] leading-relaxed text-foreground">
                {selectedVideoJob.prompt}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge
                  variant="secondary"
                  className="text-[10px] rounded-lg bg-muted text-muted-foreground border-0 font-medium gap-1"
                >
                  <Film className="size-3" />
                  {modelLabel}
                </Badge>
                {aspectRatio && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] rounded-lg bg-muted text-muted-foreground border-0 font-medium"
                  >
                    {aspectRatio}
                  </Badge>
                )}
                {timestamp && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {formatDate(timestamp)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleVideoDownload}
                  className="gap-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReusePrompt}
                  className="gap-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <Copy className="size-3.5" />
                  Use Prompt
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ----- Image content (unchanged) ----- */}
        {showImage && image && (
          <>
            {/* Image */}
            <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.imageUrl}
                alt={image.prompt}
                className="max-h-[70vh] max-w-[85vw] object-contain"
              />
            </div>

            {/* Image metadata */}
            <div className="flex max-w-2xl flex-col items-center gap-3 rounded-2xl bg-card/70 backdrop-blur-2xl border border-border px-6 py-4 shadow-sm">
              <p className="text-center text-[13px] leading-relaxed text-foreground">
                {image.prompt}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge
                  variant="secondary"
                  className="text-[10px] rounded-lg bg-muted text-muted-foreground border-0 font-medium"
                >
                  {modelLabel}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px] rounded-lg bg-muted text-muted-foreground border-0 font-medium"
                >
                  {image.aspectRatio}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {formatDate(image.createdAt)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleImageDownload}
                  className="gap-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReusePrompt}
                  className="gap-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <Copy className="size-3.5" />
                  Use Prompt
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
