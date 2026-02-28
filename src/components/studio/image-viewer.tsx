"use client";

import { Download, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/lib/store";
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

  function handleDownload() {
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

  function handleReusePrompt() {
    if (!image) return;
    setPrompt(image.prompt);
    closeImageViewer();
    toast.success("Prompt copied to composer");
  }

  const modelLabel =
    MODELS.find((m) => m.id === image?.model)?.label ??
    MODELS.find((m) => m.value === image?.model)?.label ??
    image?.model;

  return (
    <Dialog
      open={state.isImageViewerOpen}
      onOpenChange={(open) => {
        if (!open) closeImageViewer();
      }}
    >
      <DialogContent
        showCloseButton
        className="flex h-dvh max-h-dvh w-dvw max-w-dvw flex-col items-center justify-center gap-5 border-none bg-background/95 p-8 backdrop-blur-sm sm:max-w-dvw [&>[data-slot=dialog-close]]:top-5 [&>[data-slot=dialog-close]]:right-5 [&>[data-slot=dialog-close]]:rounded-lg [&>[data-slot=dialog-close]]:bg-white/80 [&>[data-slot=dialog-close]]:backdrop-blur-md [&>[data-slot=dialog-close]]:p-1.5 [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:hover:bg-white [&>[data-slot=dialog-close]]:shadow-sm [&>[data-slot=dialog-close]]:border [&>[data-slot=dialog-close]]:border-black/[0.06]"
      >
        {/* Hidden accessible title */}
        <DialogTitle className="sr-only">Image Viewer</DialogTitle>

        {image && (
          <>
            {/* Image */}
            <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] shadow-2xl shadow-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.imageUrl}
                alt={image.prompt}
                className="max-h-[70vh] max-w-[85vw] object-contain"
              />
            </div>

            {/* Image metadata */}
            <div className="flex max-w-2xl flex-col items-center gap-3 rounded-2xl bg-white/70 backdrop-blur-2xl border border-black/[0.06] px-6 py-4 shadow-sm">
              <p className="text-center text-[13px] leading-relaxed text-neutral-800">
                {image.prompt}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="text-[10px] rounded-lg bg-black/[0.04] text-neutral-600 border-0 font-medium">
                  {modelLabel}
                </Badge>
                <Badge variant="secondary" className="text-[10px] rounded-lg bg-black/[0.04] text-neutral-600 border-0 font-medium">
                  {image.aspectRatio}
                </Badge>
                <span className="text-[10px] text-neutral-400 font-medium">
                  {formatDate(image.createdAt)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 rounded-lg"
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReusePrompt}
                  className="gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 rounded-lg"
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
