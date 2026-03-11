"use client";

import { useRef, useState, useCallback, useEffect, startTransition } from "react";
import { useGesture } from "@use-gesture/react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff } from "lucide-react";

interface TouchImageProps {
  src: string;
  alt: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_VELOCITY_THRESHOLD = 0.5;
const SWIPE_DISTANCE_THRESHOLD = 50;
const DISMISS_DISTANCE_THRESHOLD = 100;

export function TouchImage({
  src,
  alt,
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
}: TouchImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const reducedMotion = useReducedMotion();

  // Motion values
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring config - instant for reduced motion
  const springConfig = reducedMotion
    ? { damping: 100, stiffness: 1000 }
    : { damping: 40, stiffness: 500 };

  // Ref to access reducedMotion in event handlers
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);

  const springScale = useSpring(scale, springConfig);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  // Calculate pan bounds based on current scale
  const getPanBounds = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return { x: 0, y: 0 };

    const currentScale = scale.get();
    const scaledWidth = img.offsetWidth * currentScale;
    const scaledHeight = img.offsetHeight * currentScale;

    const maxX = Math.max(0, (scaledWidth - container.offsetWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - container.offsetHeight) / 2);

    return { x: maxX, y: maxY };
  }, [scale]);

  // Reset to default state
  const resetTransform = useCallback((instant = false) => {
    scale.set(1);
    x.set(0);
    y.set(0);

    if (instant) {
      springScale.jump(1);
      springX.jump(0);
      springY.jump(0);
    }

    startTransition(() => setIsZoomed(false));
  }, [scale, x, y, springScale, springX, springY]);

  const bind = useGesture(
    {
      onPinch: ({ offset: [s] }) => {
        const clampedScale = Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);
        scale.set(clampedScale);
        setIsZoomed(clampedScale > 1.05);
      },

      onPinchEnd: () => {
        // Snap back if barely zoomed
        if (scale.get() < 1.1) {
          resetTransform();
        }
      },

      onDrag: ({ offset: [dx, dy], velocity: [vx, vy], direction: [dirX], last, memo }) => {
        if (isZoomed) {
          // Pan within zoomed image — bypass springs for 1:1 tracking
          const bounds = getPanBounds();
          const clampedX = Math.max(-bounds.x, Math.min(bounds.x, dx));
          const clampedY = Math.max(-bounds.y, Math.min(bounds.y, dy));
          springX.jump(clampedX);
          springY.jump(clampedY);
          x.set(clampedX);
          y.set(clampedY);
          return memo;
        }

        // Not zoomed: handle swipe gestures
        if (last) {
          // Check for horizontal swipe
          if (Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD && Math.abs(dx) > SWIPE_DISTANCE_THRESHOLD) {
            if (dirX < 0) {
              onSwipeLeft?.();
            } else {
              onSwipeRight?.();
            }
          }
          // Check for downward swipe (dismiss)
          else if (vy > SWIPE_VELOCITY_THRESHOLD && dy > DISMISS_DISTANCE_THRESHOLD) {
            onSwipeDown?.();
          }

          // Reset position
          x.set(0);
          y.set(0);
        } else {
          // Visual feedback during swipe
          // Horizontal: damped movement
          // Vertical: only allow downward for dismiss hint
          x.set(dx * 0.3);
          y.set(Math.max(0, dy * 0.5));
        }
        return memo;
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      pinch: {
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        rubberband: true,
      },
      drag: {
        from: () => [x.get(), y.get()],
        filterTaps: true,
        rubberband: true,
      },
    }
  );

  // Double-tap detection using pointerup events on the container
  // This works because pointerup fires after the gesture library processes events
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null);
  const DOUBLE_TAP_DELAY = 300;
  const DOUBLE_TAP_DISTANCE = 30; // Max distance between taps in pixels

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerUp = (e: PointerEvent) => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      const lastPos = lastTapPosRef.current;

      // Check if this is a double-tap (within time window and close position)
      if (
        timeSinceLastTap < DOUBLE_TAP_DELAY &&
        timeSinceLastTap > 0 &&
        lastPos
      ) {
        const distance = Math.hypot(e.clientX - lastPos.x, e.clientY - lastPos.y);
        if (distance < DOUBLE_TAP_DISTANCE) {
          // Double tap detected - toggle zoom
          e.preventDefault();
          if (scale.get() > 1.05) {
            // Zoomed - reset
            if (reducedMotionRef.current) {
              scale.set(1);
              x.set(0);
              y.set(0);
              springScale.jump(1);
              springX.jump(0);
              springY.jump(0);
              startTransition(() => setIsZoomed(false));
            } else {
              resetTransform();
            }
          } else {
            // Not zoomed - zoom in
            if (reducedMotionRef.current) {
              scale.set(2);
              x.set(0);
              y.set(0);
              springScale.jump(2);
              springX.jump(0);
              springY.jump(0);
              startTransition(() => setIsZoomed(true));
            } else {
              scale.set(2);
              x.set(0);
              y.set(0);
              startTransition(() => setIsZoomed(true));
            }
          }
          // Reset tracking to prevent triple-tap
          lastTapTimeRef.current = 0;
          lastTapPosRef.current = null;
          return;
        }
      }

      // Track this tap for potential double-tap
      lastTapTimeRef.current = now;
      lastTapPosRef.current = { x: e.clientX, y: e.clientY };
    };

    container.addEventListener("pointerup", handlePointerUp);
    return () => container.removeEventListener("pointerup", handlePointerUp);
  }, [resetTransform, scale, x, y, springScale, springX, springY]);

  useEffect(() => {
    resetTransform(true);
    setImageLoaded(false);
    setImageError(false);
  }, [src, resetTransform]);

  // Reset image state when src changes
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        "touch-none select-none", // Critical: prevent browser gestures
        "overscroll-none" // Prevent iOS rubber-banding
      )}
      style={{ 
        touchAction: "none",
        contain: "strict",
        overscrollBehavior: "none",
      }}
    >
      {/* Loading state */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {imageError && (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff className="size-12" />
          <p className="text-sm">Failed to load image</p>
        </div>
      )}

      <motion.img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{
          scale: springScale,
          x: springX,
          y: springY,
          willChange: "transform",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: imageLoaded ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
