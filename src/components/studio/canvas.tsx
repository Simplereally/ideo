"use client";

import { useState } from "react";
import { Aperture, Maximize2, Download, AlertCircle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pb-32">
      <AnimatePresence mode="wait">
        {/* ---- Error State ---- */}
        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
            className="flex flex-col items-center gap-4 bg-white/50 backdrop-blur-xl p-8 rounded-[2rem] border border-[#FF3B30]/20 shadow-2xl shadow-[#FF3B30]/5"
          >
            <AlertCircle className="size-10 text-[#FF3B30]" strokeWidth={1.5} />
            <p className="max-w-sm text-center text-sm font-medium text-neutral-800">
              {error ?? "Something went wrong"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={resetStatus}
              className="rounded-full text-neutral-600 hover:text-black mt-2"
            >
              Try again
            </Button>
          </motion.div>
        )}

        {/* ---- Generating State ---- */}
        {status === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative flex items-center justify-center size-20">
              <div className="absolute inset-0 border-[3px] border-black/5 rounded-full" />
              <div className="absolute inset-0 border-[3px] border-[#0071E3] rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="font-serif text-2xl text-black/40 animate-pulse">
              Synthesizing
            </p>
          </motion.div>
        )}

        {/* ---- Complete State — Show selected image ---- */}
        {status !== "generating" &&
          status !== "error" &&
          selectedImage && (
            <motion.div
              key={selectedImage.id}
              initial={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center p-8 w-full h-full"
              onMouseEnter={() => setImageHover(true)}
              onMouseLeave={() => setImageHover(false)}
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-[2rem] transition-shadow duration-500 group",
                  "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)] hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)]",
                  "border border-black/[0.04]"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="image-develop max-h-[calc(100dvh-14rem)] max-w-[calc(100vw-6rem)] object-contain bg-neutral-100"
                />

                {/* Hover overlay */}
                <AnimatePresence>
                  {imageHover && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/40 via-transparent to-transparent p-6"
                    >
                      {/* Actions */}
                      <div className="flex items-center gap-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-10 rounded-full bg-white/90 text-black backdrop-blur-md hover:bg-white shadow-lg hover:scale-105 transition-all"
                          onClick={() => openImageViewer(selectedImage)}
                        >
                          <Maximize2 className="size-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-10 rounded-full bg-white/90 text-black backdrop-blur-md hover:bg-white shadow-lg hover:scale-105 transition-all"
                          onClick={handleDownload}
                        >
                          <Download className="size-4" />
                        </Button>
                      </div>
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
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center opacity-40 pointer-events-none"
          >
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
