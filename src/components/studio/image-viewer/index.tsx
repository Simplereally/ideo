"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "./info-panel";
import { TouchImage } from "./touch-image";
import { MobileInfoSheet } from "./mobile-info-sheet";
import { ImageNavDots } from "./image-nav-dots";
import { useStudio } from "@/lib/store";
import { useVideoJobsStore } from "@/store/video-jobs";
import { MODELS } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  INFO_PANEL_WIDTH,
  MOBILE_SHEET_PEEK_HEIGHT,
} from "@/lib/constants";
import { useIsMobile } from "@/hooks/use-mobile";
const VALID_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MOBILE_MEDIA_GUTTER = 20;

/** Extract a valid image file extension from a URL, or return a safe fallback. */
function getImageExtension(url: string): string {
  try {
    const pathname = new URL(decodeURIComponent(url)).pathname;
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex !== -1) {
      const ext = pathname.slice(dotIndex + 1).toLowerCase();
      if (VALID_IMAGE_EXTENSIONS.has(ext)) return `.${ext}`;
    }
  } catch {
    // malformed URL — fall through to default
  }
  return ".img";
}

/** Desktop max dimension styles derived from INFO_PANEL_WIDTH. */
const desktopMediaMaxStyles: CSSProperties = {
  maxHeight: "calc(100vh - 12px)",
  maxWidth: `calc(100vw - ${INFO_PANEL_WIDTH}px - 12px)`,
};

/** Mobile max dimension styles - leave room for sheet peek. */
const mobileMediaMaxStyles: CSSProperties = {
  maxHeight: `calc(100dvh - ${MOBILE_SHEET_PEEK_HEIGHT + MOBILE_MEDIA_GUTTER}px)`,
  maxWidth: "calc(100vw - 16px)",
};

export function ImageViewer() {
  const { state, closeImageViewer, openImageViewer, setPrompt } = useStudio();
  const image = state.selectedImage;
  const isMobile = useIsMobile();

  // Responsive media max styles
  const mediaMaxStyles = isMobile ? mobileMediaMaxStyles : desktopMediaMaxStyles;

  // Zoom state
  const [zoomed, setZoomed] = useState(false);
  const [isZoomable, setIsZoomable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomPointRef = useRef<{ xPct: number; yPct: number } | null>(null);

  // Video job state
  const selectedJobId = useVideoJobsStore((s) => s.selectedJobId);
  const jobs = useVideoJobsStore((s) => s.jobs);
  const selectedVideoJob =
    selectedJobId && state.isImageViewerOpen
      ? jobs.find(
          (j) =>
            j.id === selectedJobId && j.status === "completed" && j.resultUrl
        ) ?? null
      : null;

  const showVideo = !!selectedVideoJob;
  const showImage = !showVideo && !!image;

  // Derive metadata
  const modelId = showVideo ? selectedVideoJob?.model : image?.model;
  const modelLabel =
    MODELS.find((m) => m.id === modelId)?.label ??
    MODELS.find((m) => m.value === modelId)?.label ??
    modelId ??
    "Unknown";

  const timestamp = showVideo ? selectedVideoJob?.createdAt : image?.createdAt;
  const prompt = showVideo
    ? selectedVideoJob?.prompt ?? ""
    : image?.prompt ?? "";
  const negativePrompt = showVideo
    ? selectedVideoJob?.params?.negativePrompt
    : image?.negativePrompt;
  const aspectRatio = showVideo
    ? selectedVideoJob?.params?.aspectRatio
    : image?.aspectRatio;
  const provider = showVideo ? selectedVideoJob?.provider : image?.provider;

  // Reset zoom when image changes or viewer closes
  useEffect(() => {
    setZoomed(false);
    setIsZoomable(false);
  }, [image?.id, state.isImageViewerOpen]);

  // Check if image is zoomable (natural size exceeds displayed size)
  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setIsZoomable(
      img.naturalWidth > img.clientWidth ||
        img.naturalHeight > img.clientHeight
    );
  }, []);

  // Scroll to clicked point after zoom-in (fires before browser paint)
  useLayoutEffect(() => {
    if (!zoomed || !containerRef.current || !zoomPointRef.current) return;
    const container = containerRef.current;
    const { xPct, yPct } = zoomPointRef.current;
    container.scrollLeft =
      container.scrollWidth * xPct - container.clientWidth / 2;
    container.scrollTop =
      container.scrollHeight * yPct - container.clientHeight / 2;
    zoomPointRef.current = null;
  }, [zoomed]);

  // Keyboard: Escape zooms out first, second Escape closes viewer via Radix
  // Arrow keys navigate between images in history (wrap-around)
  useEffect(() => {
    if (!state.isImageViewerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && zoomed) {
        e.stopPropagation();
        e.preventDefault();
        setZoomed(false);
        return;
      }
      // When not zoomed, Escape propagates to Radix Dialog which closes it

      // Arrow key navigation — only for images, not videos
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && showImage && image) {
        const { history } = state;
        if (history.length < 2) return;

        const currentIndex = history.findIndex((img) => img.id === image.id);
        if (currentIndex === -1) return;

        const nextIndex =
          e.key === "ArrowLeft"
            ? (currentIndex - 1 + history.length) % history.length
            : (currentIndex + 1) % history.length;

        e.preventDefault();
        openImageViewer(history[nextIndex]);
      }
    };

    // Capture phase to intercept before Radix Dialog's handler
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [state.isImageViewerOpen, zoomed, showImage, image, state.history, openImageViewer]);

  // Preload adjacent images for smooth swipe navigation on mobile
  useEffect(() => {
    if (!isMobile || !showImage || !image || state.history.length < 2) return;

    const currentIndex = state.history.findIndex((img) => img.id === image.id);

    // Preload previous and next images
    const preloadIndices = [currentIndex - 1, currentIndex + 1].filter(
      (i) => i >= 0 && i < state.history.length
    );

    preloadIndices.forEach((index) => {
      const preloadImg = new Image();
      preloadImg.src = state.history[index].imageUrl;
    });
  }, [isMobile, showImage, image, state.history]);

  // Zoom toggle: click to zoom in (scroll to click point), click to zoom out
  const handleZoomToggle = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!isZoomable) return;

      if (!zoomed) {
        const rect = e.currentTarget.getBoundingClientRect();
        zoomPointRef.current = {
          xPct: (e.clientX - rect.left) / rect.width,
          yPct: (e.clientY - rect.top) / rect.height,
        };
        setZoomed(true);
      } else {
        setZoomed(false);
      }
    },
    [zoomed, isZoomable]
  );

  // Handlers
  const handleImageDownload = useCallback(() => {
    if (!image) return;
    const ext = getImageExtension(image.imageUrl);
    const link = document.createElement("a");
    link.href = image.imageUrl;
    link.download = `ideo-${image.id}${ext}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [image]);

  const handleVideoDownload = useCallback(() => {
    if (!selectedVideoJob?.resultUrl) return;
    const link = document.createElement("a");
    link.href = selectedVideoJob.resultUrl;
    link.download = `ideo-video-${selectedVideoJob.id}.mp4`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [selectedVideoJob]);

  const handleDownload = showVideo ? handleVideoDownload : handleImageDownload;

  const handleReusePrompt = useCallback(() => {
    if (!prompt) return;
    setPrompt(prompt);
    closeImageViewer();
    toast.success("Prompt copied to composer");
  }, [prompt, setPrompt, closeImageViewer]);

  // Click on backdrop/whitespace to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking directly on the backdrop, not on children
      if (e.target === e.currentTarget) {
        closeImageViewer();
      }
    },
    [closeImageViewer]
  );

  const hasContent = showVideo || showImage;

  // Screen reader announcement for image changes
  const [announcement, setAnnouncement] = useState("");

  // Update announcement when image changes
  useEffect(() => {
    if (!showImage || !image) {
      setAnnouncement("");
      return;
    }

    const index = state.history.findIndex((img) => img.id === image.id);
    if (index === -1) {
      setAnnouncement("");
      return;
    }

    setAnnouncement(`Image ${index + 1} of ${state.history.length}`);
  }, [showImage, image, state.history]);

  // Swipe navigation handlers for mobile
  const handleSwipeLeft = useCallback(() => {
    if (!image) return;
    const currentIndex = state.history.findIndex((img) => img.id === image.id);
    if (currentIndex < state.history.length - 1) {
      openImageViewer(state.history[currentIndex + 1]);
    }
  }, [image, state.history, openImageViewer]);

  const handleSwipeRight = useCallback(() => {
    if (!image) return;
    const currentIndex = state.history.findIndex((img) => img.id === image.id);
    if (currentIndex > 0) {
      openImageViewer(state.history[currentIndex - 1]);
    }
  }, [image, state.history, openImageViewer]);

  return (
    <Dialog
      open={state.isImageViewerOpen}
      onOpenChange={(open) => {
        if (!open) closeImageViewer();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex h-dvh max-h-dvh w-dvw max-w-dvw overflow-hidden",
          "border-none bg-background/98 p-0 backdrop-blur-sm",
          "sm:max-w-dvw",
          isMobile ? "flex-col" : "flex-row"
        )}
      >
        <DialogTitle className="sr-only">
          {showVideo ? "Video Viewer" : "Image Viewer"}
        </DialogTitle>

        {/* Left Panel - Info (Desktop only) */}
        {!isMobile && hasContent && (
          <InfoPanel
            prompt={prompt}
            negativePrompt={negativePrompt}
            modelLabel={modelLabel}
            aspectRatio={aspectRatio}
            timestamp={timestamp}
            isVideo={showVideo}
            provider={provider}
            onDownload={handleDownload}
            onUsePrompt={handleReusePrompt}
          />
        )}

        {/* Main Content - Media (click on whitespace to close) */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden p-1.5"
          onClick={handleBackdropClick}
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={closeImageViewer}
            className={cn(
              "absolute z-50",
              isMobile
                ? "right-3 bottom-3"
                : "right-3 top-3",
              "size-10 rounded-xl cursor-pointer",
              "bg-card/80 backdrop-blur-md",
              "border border-border/50",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-card shadow-sm",
              "transition-all duration-200",
              "active:scale-95"
            )}
          >
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>

          {/* Video Content */}
          {showVideo && selectedVideoJob && (
            <div className="relative overflow-hidden rounded-2xl border border-border/50 shadow-2xl shadow-black/20">
              <video
                src={selectedVideoJob.resultUrl}
                controls
                autoPlay
                muted
                loop
                playsInline
                style={mediaMaxStyles}
                className="object-contain"
              />
            </div>
          )}

          {/* Image Content */}
          {showImage && image && (
            isMobile ? (
              <TouchImage
                src={image.imageUrl}
                alt={image.prompt}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeDown={closeImageViewer}
              />
            ) : (
              <div
                ref={containerRef}
                className={cn(
                  "relative rounded-2xl border border-border/50 shadow-2xl shadow-black/20",
                  zoomed
                    ? "overflow-auto"
                    : "overflow-hidden"
                )}
                style={zoomed ? mediaMaxStyles : undefined}
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={image.imageUrl}
                  alt={image.prompt}
                  onLoad={handleImageLoad}
                  onClick={handleZoomToggle}
                  draggable={false}
                  className={cn(
                    "select-none",
                    zoomed
                      ? "cursor-zoom-out"
                      : cn(
                          "object-contain",
                          isZoomable && "cursor-zoom-in"
                        )
                  )}
                  style={zoomed ? undefined : mediaMaxStyles}
                />
              </div>
            )
          )}

          {/* Image Navigation Dots (Mobile only) */}
          {isMobile && showImage && state.history.length > 1 && image && (
            <ImageNavDots
              total={state.history.length}
              current={state.history.findIndex((img) => img.id === image.id)}
              className="absolute bottom-2 left-0 right-0"
            />
          )}

          {/* Screen reader announcement */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {announcement}
          </div>
        </div>

        {/* Mobile: bottom sheet (rendered after main content for z-index) */}
        {isMobile && hasContent && (
          <MobileInfoSheet
            prompt={prompt}
            negativePrompt={negativePrompt}
            modelLabel={modelLabel}
            aspectRatio={aspectRatio}
            timestamp={timestamp}
            isVideo={showVideo}
            provider={provider}
            onDownload={handleDownload}
            onUsePrompt={handleReusePrompt}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Re-export for convenience
export { PromptDisplay } from "./prompt-display";
export { MetadataBadges } from "./metadata-badges";
export { ViewerActions } from "./viewer-actions";
export { InfoPanel } from "./info-panel";
