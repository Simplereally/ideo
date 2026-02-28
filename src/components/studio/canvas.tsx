"use client";

import { useState } from "react";
import { Aperture, Maximize2, Download, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

export function StudioCanvas() {
  const { state, openImageViewer, resetStatus } = useStudio();
  const [imageHover, setImageHover] = useState(false);

  const { status, selectedImage, error } = state;

  function handleDownload() {
    if (!selectedImage) return;
    const link = document.createElement("a");
    link.href = selectedImage.imageUrl;
    link.download = `ideo-${selectedImage.id}.png`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="fixed inset-0 top-14 z-10 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {/* ---- Error State ---- */}
        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="flex flex-col items-center gap-4"
          >
            <AlertCircle className="size-12 text-destructive" strokeWidth={1.5} />
            <p className="max-w-sm text-center text-sm text-destructive">
              {error ?? "Something went wrong"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetStatus}
              className="text-muted-foreground hover:text-foreground"
            >
              Try again
            </Button>
          </motion.div>
        )}

        {/* ---- Generating State ---- */}
        {status === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="amber-pulse flex flex-col items-center gap-5 rounded-2xl px-8 py-6"
          >
            <div className="flex items-center gap-2">
              <span className="generating-dot size-2 rounded-full bg-amber" />
              <span className="generating-dot size-2 rounded-full bg-amber" />
              <span className="generating-dot size-2 rounded-full bg-amber" />
            </div>
            <p className="font-serif text-lg italic text-amber">
              Developing...
            </p>
            <div className="shimmer h-px w-24 rounded-full" />
          </motion.div>
        )}

        {/* ---- Complete State — Show selected image ---- */}
        {status !== "generating" &&
          status !== "error" &&
          selectedImage && (
            <motion.div
              key={selectedImage.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex items-center justify-center p-8"
              onMouseEnter={() => setImageHover(true)}
              onMouseLeave={() => setImageHover(false)}
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl transition-shadow duration-500",
                  "shadow-[0_0_60px_rgba(232,164,74,0.06)]"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="image-develop max-h-[calc(100dvh-10rem)] max-w-[calc(100vw-4rem)] object-contain"
                />

                {/* Hover overlay */}
                <AnimatePresence>
                  {imageHover && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-background/80 via-transparent to-transparent p-4"
                    >
                      {/* Actions */}
                      <div className="flex items-center gap-2 pb-8">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-full bg-background/60 text-foreground backdrop-blur-sm hover:bg-background/80"
                          onClick={() => openImageViewer(selectedImage)}
                        >
                          <Maximize2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-full bg-background/60 text-foreground backdrop-blur-sm hover:bg-background/80"
                          onClick={handleDownload}
                        >
                          <Download className="size-4" />
                        </Button>
                      </div>

                      {/* Prompt text */}
                      <p className="max-w-md text-center text-xs leading-relaxed text-foreground/70">
                        {selectedImage.prompt}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

        {/* ---- Empty/Idle State ---- */}
        {status !== "generating" && status !== "error" && !selectedImage && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <Aperture
              className="size-20 text-amber/[0.08]"
              strokeWidth={0.8}
            />
            <p className="float-up font-serif text-lg italic text-muted-foreground">
              Enter a prompt to begin
            </p>
            <p className="float-up float-up-3 text-sm text-muted-foreground/60">
              Your images will develop here
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
