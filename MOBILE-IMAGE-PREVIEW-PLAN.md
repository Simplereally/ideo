# Mobile Image Preview Implementation Plan

---

## Review Notes (Architecture Review - 2026-03-09)

### Summary of Changes

This plan has been reviewed and updated to reflect the actual codebase state and improve implementation accuracy. Key changes:

### Critical Corrections

1. **`useIsMobile` hook already exists** - Located at `src/hooks/use-mobile.ts`, not `src/lib/hooks/use-mobile.ts`. The plan incorrectly proposed creating a new hook. **Use the existing one.**

2. **Drawer component already exists** - `src/components/ui/drawer.tsx` wraps vaul and provides `Drawer`, `DrawerContent`, `DrawerHeader`, etc. The plan proposed using vaul directly, but we should use the existing shadcn Drawer wrapper for consistency.

3. **`@use-gesture/react` is NOT installed** - The plan correctly identifies this needs to be added, but the claim that vaul is "already in dependencies" for gestures was misleading. Vaul is for drawers only. The gesture library is a new dependency.

4. **Line number references are incorrect** - The plan cites specific line numbers that don't match the actual code. Removed/corrected these references to prevent confusion.

5. **Constants file is minimal** - `src/lib/constants.ts` only contains `INFO_PANEL_WIDTH`. New constants should be added there as proposed.

### Simplifications Made

1. **Removed `MobileFab` component** - Over-engineered. The FAB pattern conflicts with the bottom sheet UX. Actions should remain in the sheet, with the sheet's peek state showing quick-access buttons. This avoids z-index battles and gesture conflicts.

2. **Simplified TouchImage gesture handling** - The original pan bounds calculation was overly complex. Simplified to use dynamic bounds based on actual scale and image dimensions.

3. **Removed haptic feedback suggestion** - `navigator.vibrate()` has poor browser support and is blocked in many contexts. Not worth the complexity for marginal benefit.

4. **Consolidated snap points** - Changed from 3 snap points (148px, 355px, 1) to 2 (peek at ~120px, expanded at 60vh). Three snap points create decision fatigue and feel janky.

### Missing Pieces Added

1. **Reduced motion support** - Added `useReducedMotion` hook and conditional animation disabling for accessibility.

2. **Touch event prevention** - Added `touch-action: none` and proper event handling to prevent browser defaults (pull-to-refresh, swipe-back navigation).

3. **Image preloading for swipe navigation** - Adjacent images should be preloaded to ensure smooth swipe transitions.

4. **Video handling in mobile view** - Original plan didn't address how `TouchImage` interacts with video content. Added clarification that videos use native controls, not touch gestures.

5. **Error boundary** - Touch gesture libraries can throw in edge cases. Wrap in error boundary.

### Risk Clarifications

1. **Vaul + Radix Dialog conflict** - This is a real concern. The solution is to NOT nest a Vaul Drawer inside a Radix Dialog. Instead, on mobile, we should replace the Dialog entirely with a custom fullscreen view + Drawer, not try to combine them.

2. **iOS rubber-banding** - iOS Safari's elastic scrolling can conflict with custom gestures. Added `overscroll-behavior: none` requirement.

---

## Executive Summary

### Current State
The Ideo image viewer (`src/components/studio/image-viewer/`) is currently optimized for desktop experiences with:
- A fixed 340px info panel sidebar on the left
- Click-to-zoom functionality using mouse events
- Keyboard navigation (arrow keys, Escape)
- Desktop-centric hover states and interactions

### Key Mobile Issues Identified

1. **Layout Problems**
   - The 340px fixed-width `InfoPanel` consumes excessive viewport space on mobile
   - `mediaMaxStyles` calculation (`calc(100vw - ${INFO_PANEL_WIDTH}px - 12px)`) leaves almost no space for the image on narrow screens
   - Horizontal side-by-side layout is inappropriate for portrait-oriented devices

2. **Touch Interaction Gaps**
   - No pinch-to-zoom support (only click-to-zoom via `handleZoomToggle`)
   - No touch panning when zoomed (relies on native overflow scrolling)
   - No swipe gestures to navigate between images (keyboard-only with `ArrowLeft`/`ArrowRight`)
   - No swipe-to-dismiss gesture (Escape key only)

3. **Missing Mobile UX Patterns**
   - No haptic feedback for interactions
   - Close button (top-right) may be hard to reach on large phones
   - Action buttons in InfoPanel are too small for touch (rely on precise taps)
   - No consideration for safe areas (notches, home indicators)

4. **Performance Concerns**
   - Large images may cause jank during zoom transitions on mobile
   - No lazy loading or progressive image enhancement
   - `useLayoutEffect` zoom scroll positioning may conflict with mobile browsers

### Goals
- **Native-app-like experience**: Fluid gestures, responsive layouts, instant feedback
- **Full-screen immersion**: Maximize image real estate on mobile
- **Intuitive touch controls**: Pinch-zoom, pan, swipe navigation, swipe-to-dismiss
- **Accessible on all devices**: Works on phones from 320px to tablets at 1024px
- **Performance optimized**: Smooth 60fps animations, no layout thrashing

---

## Detailed Component Analysis

### 1. `index.tsx` (Main ImageViewer Component)

**Current Implementation:**
```tsx
// Fixed max dimensions that break on mobile
const mediaMaxStyles: CSSProperties = {
  maxHeight: "calc(100vh - 12px)",
  maxWidth: `calc(100vw - ${INFO_PANEL_WIDTH}px - 12px)`, // 340px sidebar always subtracted
};

// Fixed horizontal layout
<DialogContent className="flex h-dvh w-dvw flex-row ...">
```

**Issues:**
- `flex-row` forces side-by-side layout regardless of screen size
- `INFO_PANEL_WIDTH` (340px) is always subtracted from image width
- Click-to-zoom handler (`handleZoomToggle`) only handles mouse clicks, not touch
- Zoom scroll positioning uses percentage-based scroll which may conflict with touch scrolling

**Required Changes:**
- Import existing `useIsMobile` hook from `@/hooks/use-mobile`
- Conditionally render layout: vertical stack on mobile, horizontal on desktop
- Replace fixed panel with collapsible bottom sheet on mobile (use existing `Drawer` component)
- Implement touch gesture handlers for zoom, pan, and navigation

### 2. `info-panel.tsx` (Sidebar Details Panel)

**Current Implementation:**
```tsx
// Fixed width that's too wide for mobile
className={`w-[${INFO_PANEL_WIDTH}px] shrink-0 ...`}
```

Note: The template literal in className won't work with Tailwind's JIT compiler. This is actually applied via the constant value directly, but the pattern is fragile.

**Issues:**
- 340px width consumes 85%+ of a 375px mobile viewport
- Vertical scroll area may conflict with gesture recognition
- No mobile-specific layout or typography scaling

**Required Changes:**
- Hide entirely on mobile (conditionally render based on `useIsMobile`)
- Create `MobileInfoSheet` variant using the existing `Drawer` component from `@/components/ui/drawer`
- Reduce content density: larger tap targets, more whitespace
- Support drag-to-expand/collapse gesture (handled by vaul)
- Add "peek" state showing minimal info (model, date) with expand affordance

### 3. `viewer-actions.tsx` (Download & Use Prompt Buttons)

**Current Implementation:**
```tsx
// Buttons with h-10 (40px) height
<Button size="sm" className="w-full justify-start gap-2.5 h-10 ...">
```

**Issues:**
- `h-10` (40px) meets minimum but could be larger on mobile for better touch ergonomics
- Buttons are inside ScrollArea which may cause scroll conflicts
- No active state visual feedback (press animation)

**Required Changes:**
- Add `variant` prop to support mobile sizing (`h-12` = 48px minimum)
- Add active state visual feedback (`active:scale-[0.98]` or similar)
- Consider horizontal layout for mobile peek state (side-by-side buttons)

### 4. `metadata-badges.tsx` (Model, Provider, Aspect Ratio, Date)

**Current Implementation:**
```tsx
// Lines 38-54: Icon + text layout
<div className="flex items-start gap-3">
  <div className="flex size-8 shrink-0 ..."> {/* Icon container */}
  <div className="min-w-0 flex-1"> {/* Text content */}
```

**Issues:**
- Small text sizes (`text-[10px]`, `text-[13px]`) may be hard to read on mobile
- Layout is efficient but could be more compact for mobile bottom sheet
- No truncation handling for long model names

**Required Changes:**
- Increase font sizes on mobile: `text-[11px]` → `text-xs`, `text-[13px]` → `text-sm`
- Add horizontal compact layout variant for mobile peek state
- Ensure proper truncation with ellipsis for long values

### 5. `prompt-display.tsx` (Prompt Text with Copy)

**Current Implementation:**
```tsx
const TRUNCATE_LENGTH = 300;

// Copy button at size-6 (24px)
<button className="flex size-6 items-center justify-center rounded-lg ...">
```

**Issues:**
- Copy button at `size-6` (24px) is too small for reliable touch (minimum 44px recommended)
- Truncation logic works but "Show more" tap target is small (just the text)
- No visual feedback on successful copy (relies on toast, which may be missed on mobile)

**Required Changes:**
- Add `variant` prop; increase copy button to `size-10` (40px) on mobile
- Make entire "Show more/less" row tappable with padding, not just text
- Add brief visual confirmation state on copy (checkmark icon swap for 1.5s)
- Reduce `TRUNCATE_LENGTH` on mobile to 200 characters to minimize scrolling

---

## Implementation Strategy

### Phase 1: Responsive Layout Foundation

#### 1.1 Mobile Detection (Use Existing Hook)

**File:** `src/hooks/use-mobile.ts` (ALREADY EXISTS - no changes needed)

The hook is already implemented and returns `boolean`. Import it where needed:

```tsx
import { useIsMobile } from "@/hooks/use-mobile";
```

#### 1.2 Add Reduced Motion Hook (New)

**File:** `src/hooks/use-reduced-motion.ts` (new file)

```tsx
"use client";

import { useState, useEffect } from "react";

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}
```

#### 1.3 Update Constants

**File:** `src/lib/constants.ts`

```tsx
/** Width (in pixels) of the image-viewer info panel sidebar. */
export const INFO_PANEL_WIDTH = 340;

/** Mobile breakpoint in pixels (matches Tailwind's md). */
export const MOBILE_BREAKPOINT = 768;

/** Height of the collapsed mobile info sheet (peek state). */
export const MOBILE_SHEET_PEEK_HEIGHT = 120;

/** Fraction of viewport height for expanded mobile sheet. */
export const MOBILE_SHEET_EXPANDED_RATIO = 0.6;
```

#### 1.4 Refactor DialogContent Layout

**File:** `src/components/studio/image-viewer/index.tsx`

Add conditional layout based on viewport:

```tsx
import { useIsMobile } from "@/hooks/use-mobile";

// Inside component:
const isMobile = useIsMobile();

// Update mediaMaxStyles to be responsive:
const mediaMaxStyles: CSSProperties = isMobile
  ? {
      maxHeight: "calc(100dvh - 140px)", // Leave room for sheet peek
      maxWidth: "calc(100vw - 16px)",
    }
  : {
      maxHeight: "calc(100vh - 12px)",
      maxWidth: `calc(100vw - ${INFO_PANEL_WIDTH}px - 12px)`,
    };

// In render:
<DialogContent
  className={cn(
    "flex h-dvh max-h-dvh w-dvw max-w-dvw",
    "border-none bg-background/98 p-0 backdrop-blur-sm",
    isMobile ? "flex-col" : "flex-row"
  )}
>
```

### Phase 2: Mobile Info Panel (Bottom Sheet)

#### 2.1 Create MobileInfoSheet Component

**File:** `src/components/studio/image-viewer/mobile-info-sheet.tsx` (new file)

Use the **existing** Drawer component from `@/components/ui/drawer`:

```tsx
"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { PromptDisplay } from "./prompt-display";
import { MetadataBadges } from "./metadata-badges";
import { ViewerActions } from "./viewer-actions";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";
import {
  MOBILE_SHEET_PEEK_HEIGHT,
  MOBILE_SHEET_EXPANDED_RATIO,
} from "@/lib/constants";

interface MobileInfoSheetProps {
  prompt: string;
  negativePrompt?: string;
  modelLabel: string;
  aspectRatio?: string;
  timestamp?: number;
  isVideo?: boolean;
  provider?: Provider;
  onDownload: () => void;
  onUsePrompt: () => void;
}

export function MobileInfoSheet({
  prompt,
  negativePrompt,
  modelLabel,
  aspectRatio,
  timestamp,
  isVideo = false,
  provider,
  onDownload,
  onUsePrompt,
}: MobileInfoSheetProps) {
  // Two snap points: peek and expanded
  const snapPoints = [
    MOBILE_SHEET_PEEK_HEIGHT,
    MOBILE_SHEET_EXPANDED_RATIO, // 0.6 = 60% of viewport
  ];
  const [snap, setSnap] = useState<number | string | null>(snapPoints[0]);

  const isExpanded = snap === snapPoints[1];

  return (
    <Drawer
      open={true}
      snapPoints={snapPoints}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
      dismissible={false}
      direction="bottom"
    >
      <DrawerContent
        className={cn(
          "mx-auto w-full max-w-lg rounded-t-2xl",
          "bg-card/95 backdrop-blur-xl",
          "pb-[env(safe-area-inset-bottom)]"
        )}
      >
        {/* Drag handle is built into DrawerContent */}

        <DrawerHeader className="pb-0">
          <DrawerTitle className="sr-only">Generation Details</DrawerTitle>

          {/* Peek state: compact metadata + action buttons */}
          <div className="flex items-center justify-between gap-4">
            <MetadataBadges
              modelLabel={modelLabel}
              timestamp={timestamp}
              isVideo={isVideo}
              variant="compact"
            />
            <ViewerActions
              onDownload={onDownload}
              onUsePrompt={onUsePrompt}
              variant="compact"
            />
          </div>
        </DrawerHeader>

        {/* Expanded content - only render when expanded to save memory */}
        {isExpanded && (
          <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
            <PromptDisplay prompt={prompt} variant="mobile" />

            {negativePrompt && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground/60 font-medium">
                  Negative Prompt
                </p>
                <p className="text-sm leading-relaxed text-foreground/70">
                  {negativePrompt}
                </p>
              </div>
            )}

            <div className="h-px bg-border/40" />

            <MetadataBadges
              modelLabel={modelLabel}
              aspectRatio={aspectRatio}
              timestamp={timestamp}
              isVideo={isVideo}
              provider={provider}
              variant="mobile"
            />

            <div className="h-px bg-border/40" />

            <ViewerActions
              onDownload={onDownload}
              onUsePrompt={onUsePrompt}
              variant="mobile"
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
```

#### 2.2 Integrate Sheet into ImageViewer

```tsx
// In index.tsx, update the conditional rendering:
import { MobileInfoSheet } from "./mobile-info-sheet";

// In render:
{/* Desktop: sidebar */}
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
```

**Important:** The Drawer must be rendered as a sibling to the main content, not inside the image container, to avoid z-index and touch event conflicts.

### Phase 3: Touch Gesture Implementation

#### 3.1 Install @use-gesture/react

```bash
bun add @use-gesture/react
```

This library provides unified handling of mouse and touch events with support for pinch, drag, and other gestures. It integrates well with framer-motion which is already installed.

#### 3.2 Create TouchImage Component

**File:** `src/components/studio/image-viewer/touch-image.tsx` (new file)

```tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

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
  const reducedMotion = useReducedMotion();

  // Motion values
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring config - instant for reduced motion
  const springConfig = reducedMotion
    ? { damping: 100, stiffness: 1000 }
    : { damping: 30, stiffness: 300 };

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
  const resetTransform = useCallback(() => {
    scale.set(1);
    x.set(0);
    y.set(0);
    setIsZoomed(false);
  }, [scale, x, y]);

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

      onDrag: ({ offset: [dx, dy], velocity: [vx, vy], direction: [dirX, dirY], last, memo }) => {
        if (isZoomed) {
          // Pan within zoomed image
          const bounds = getPanBounds();
          x.set(Math.max(-bounds.x, Math.min(bounds.x, dx)));
          y.set(Math.max(-bounds.y, Math.min(bounds.y, dy)));
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

      onDoubleClick: ({ event }) => {
        event.preventDefault();
        if (isZoomed) {
          resetTransform();
        } else {
          scale.set(2);
          setIsZoomed(true);
        }
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

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        "touch-none select-none", // Critical: prevent browser gestures
        "overscroll-none" // Prevent iOS rubber-banding
      )}
      style={{ touchAction: "none" }}
      {...bind()}
    >
      <motion.img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        style={{
          scale: springScale,
          x: springX,
          y: springY,
          willChange: "transform",
        }}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
```

#### 3.3 Integrate TouchImage in Mobile Mode

In `index.tsx`, update the image rendering section:

```tsx
import { TouchImage } from "./touch-image";

// Inside render, replace the image container for mobile:
{showImage && image && (
  isMobile ? (
    <TouchImage
      src={image.imageUrl}
      alt={image.prompt}
      onSwipeLeft={() => {
        const currentIndex = state.history.findIndex((img) => img.id === image.id);
        if (currentIndex < state.history.length - 1) {
          openImageViewer(state.history[currentIndex + 1]);
        }
      }}
      onSwipeRight={() => {
        const currentIndex = state.history.findIndex((img) => img.id === image.id);
        if (currentIndex > 0) {
          openImageViewer(state.history[currentIndex - 1]);
        }
      }}
      onSwipeDown={closeImageViewer}
    />
  ) : (
    // Existing desktop image code
    <div ref={containerRef} ...>
      <img ref={imgRef} ... />
    </div>
  )
)}
```

**Note:** For video content (`showVideo`), keep the native video element with controls. Touch gestures on video should be handled by the browser's native video controls, not custom gestures.

#### 3.4 Preload Adjacent Images

Add image preloading for smooth swipe transitions:

```tsx
// In index.tsx, add preloading effect:
useEffect(() => {
  if (!isMobile || !image || state.history.length < 2) return;

  const currentIndex = state.history.findIndex((img) => img.id === image.id);

  // Preload previous and next images
  const preloadIndices = [currentIndex - 1, currentIndex + 1].filter(
    (i) => i >= 0 && i < state.history.length
  );

  preloadIndices.forEach((index) => {
    const img = new Image();
    img.src = state.history[index].imageUrl;
  });
}, [isMobile, image, state.history]);
```

### Phase 4: Mobile UI Polish

#### 4.1 Mobile Close Button Position

Move close button to a thumb-reachable position on mobile with safe area support:

```tsx
// In index.tsx
<Button
  variant="ghost"
  size="icon"
  onClick={closeImageViewer}
  className={cn(
    "absolute z-10",
    isMobile
      ? "left-3 top-[max(0.75rem,env(safe-area-inset-top))]"
      : "right-3 top-3",
    "size-10 rounded-xl cursor-pointer", // Increased from size-9 on mobile
    "bg-card/80 backdrop-blur-md",
    "border border-border/50",
    "text-muted-foreground hover:text-foreground",
    "hover:bg-card shadow-sm",
    "transition-all duration-200",
    "active:scale-95" // Press feedback
  )}
>
  <X className="size-5" />
  <span className="sr-only">Close</span>
</Button>
```

#### 4.2 Image Navigation Indicators

Add visual indicators for swipe navigation on mobile:

**File:** `src/components/studio/image-viewer/image-nav-dots.tsx` (new file)

```tsx
"use client";

import { cn } from "@/lib/utils";

interface ImageNavDotsProps {
  total: number;
  current: number;
  className?: string;
}

export function ImageNavDots({ total, current, className }: ImageNavDotsProps) {
  if (total <= 1) return null;

  // Show max 7 dots, with ellipsis behavior for large sets
  const maxDots = 7;
  const showEllipsis = total > maxDots;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5",
        className
      )}
      role="tablist"
      aria-label={`Image ${current + 1} of ${total}`}
    >
      {Array.from({ length: Math.min(total, maxDots) }).map((_, idx) => {
        const isActive = idx === current || (showEllipsis && idx === maxDots - 1 && current >= maxDots - 1);

        return (
          <div
            key={idx}
            role="tab"
            aria-selected={idx === current}
            className={cn(
              "rounded-full transition-all duration-200",
              isActive
                ? "h-1.5 w-4 bg-foreground"
                : "size-1.5 bg-foreground/30"
            )}
          />
        );
      })}
    </div>
  );
}
```

Integrate into the viewer:

```tsx
// In index.tsx, add below the image container on mobile
{isMobile && state.history.length > 1 && image && (
  <ImageNavDots
    total={state.history.length}
    current={state.history.findIndex((img) => img.id === image.id)}
    className="absolute bottom-[140px] left-0 right-0"
  />
)}
```

### Phase 5: Component Variant Updates

Update existing components to support mobile variants via a `variant` prop.

#### 5.1 Update `prompt-display.tsx`

```tsx
interface PromptDisplayProps {
  prompt: string;
  variant?: "default" | "mobile";
  className?: string;
}

export function PromptDisplay({
  prompt,
  variant = "default",
  className,
}: PromptDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const TRUNCATE_LENGTH = variant === "mobile" ? 200 : 300;
  const shouldTruncate = prompt.length > TRUNCATE_LENGTH;

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy prompt");
    }
  }, [prompt]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "uppercase tracking-wider text-muted-foreground/60 font-medium",
            variant === "mobile" ? "text-xs" : "text-[10px]"
          )}
        >
          Prompt
        </h3>
        <button
          onClick={handleCopyPrompt}
          className={cn(
            "flex items-center justify-center rounded-lg",
            "bg-muted/50 hover:bg-muted active:scale-95",
            "text-muted-foreground hover:text-foreground",
            "transition-all duration-200",
            variant === "mobile" ? "size-10" : "size-6"
          )}
          title="Copy prompt"
        >
          {copied ? (
            <Check className="size-4 text-green-500" strokeWidth={2.5} />
          ) : (
            <Copy
              className={variant === "mobile" ? "size-4" : "size-3"}
              strokeWidth={2.5}
            />
          )}
        </button>
      </div>

      <p
        className={cn(
          "leading-relaxed text-foreground/90 font-light tracking-wide",
          variant === "mobile" ? "text-sm" : "text-[13px]"
        )}
      >
        {shouldTruncate && !isExpanded
          ? `${prompt.slice(0, TRUNCATE_LENGTH).trim()}...`
          : prompt}
      </p>

      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "inline-flex items-center gap-1 font-medium",
            "text-muted-foreground/70 hover:text-foreground",
            "transition-colors duration-200",
            // Larger tap target on mobile
            variant === "mobile" ? "text-sm py-1" : "text-[11px]"
          )}
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="size-3" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="size-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
```

#### 5.2 Update `metadata-badges.tsx`

Add `variant` prop with "compact" mode for peek state:

```tsx
interface MetadataBadgesProps {
  modelLabel: string;
  aspectRatio?: string;
  timestamp?: number;
  isVideo?: boolean;
  provider?: Provider;
  variant?: "default" | "mobile" | "compact";
  className?: string;
}

export function MetadataBadges({
  modelLabel,
  aspectRatio,
  timestamp,
  isVideo = false,
  provider,
  variant = "default",
  className,
}: MetadataBadgesProps) {
  // Compact variant for sheet peek state - single line
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        {isVideo ? (
          <Film className="size-4 text-muted-foreground" />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" />
        )}
        <span className="font-medium truncate max-w-[120px]">{modelLabel}</span>
        {timestamp && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground text-xs">
              {formatRelativeDate(timestamp)}
            </span>
          </>
        )}
      </div>
    );
  }

  const isMobileVariant = variant === "mobile";

  return (
    <div className={cn("space-y-3", className)}>
      {/* ... existing badge items with conditional sizing */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-muted/50",
            isMobileVariant ? "size-10" : "size-8"
          )}
        >
          {/* icon */}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "uppercase tracking-wider text-muted-foreground/60 font-medium",
              isMobileVariant ? "text-xs" : "text-[10px]"
            )}
          >
            Model
          </p>
          <p
            className={cn(
              "font-medium truncate",
              isMobileVariant ? "text-sm" : "text-[13px]"
            )}
          >
            {modelLabel}
          </p>
        </div>
      </div>
      {/* ... repeat pattern for other badges */}
    </div>
  );
}

// Helper for compact date display
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
```

#### 5.3 Update `viewer-actions.tsx`

Add variant prop for mobile and compact modes:

```tsx
interface ViewerActionsProps {
  onDownload: () => void;
  onUsePrompt: () => void;
  variant?: "default" | "mobile" | "compact";
  className?: string;
}

export function ViewerActions({
  onDownload,
  onUsePrompt,
  variant = "default",
  className,
}: ViewerActionsProps) {
  // Compact variant: icon-only buttons for peek state
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDownload}
          className="size-10 rounded-xl bg-muted/50 hover:bg-muted active:scale-95"
        >
          <Download className="size-4" />
          <span className="sr-only">Download</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUsePrompt}
          className="size-10 rounded-xl bg-muted/50 hover:bg-muted active:scale-95"
        >
          <Copy className="size-4" />
          <span className="sr-only">Use Prompt</span>
        </Button>
      </div>
    );
  }

  const isMobile = variant === "mobile";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant="secondary"
        size={isMobile ? "default" : "sm"}
        onClick={onDownload}
        className={cn(
          "w-full justify-start gap-2.5",
          isMobile ? "h-12" : "h-10",
          "bg-muted/50 hover:bg-muted border-0",
          "font-medium text-foreground/80 hover:text-foreground",
          "rounded-xl transition-all duration-200",
          "active:scale-[0.98]"
        )}
      >
        <Download className={isMobile ? "size-5" : "size-4"} />
        Download
      </Button>

      <Button
        variant="secondary"
        size={isMobile ? "default" : "sm"}
        onClick={onUsePrompt}
        className={cn(
          "w-full justify-start gap-2.5",
          isMobile ? "h-12" : "h-10",
          "bg-muted/50 hover:bg-muted border-0",
          "font-medium text-foreground/80 hover:text-foreground",
          "rounded-xl transition-all duration-200",
          "active:scale-[0.98]"
        )}
      >
        <Copy className={isMobile ? "size-5" : "size-4"} />
        Use Prompt
      </Button>
    </div>
  );
}
```

### Phase 6: Performance & Accessibility

#### 6.1 Image Loading States

Add loading placeholder for better perceived performance:

```tsx
// In TouchImage or the image container
const [imageLoaded, setImageLoaded] = useState(false);
const [imageError, setImageError] = useState(false);

<div className="relative flex h-full w-full items-center justify-center">
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
    src={src}
    alt={alt}
    onLoad={() => setImageLoaded(true)}
    onError={() => setImageError(true)}
    className={cn(
      "transition-opacity duration-200",
      imageLoaded ? "opacity-100" : "opacity-0"
    )}
    // ... rest of props
  />
</div>
```

#### 6.2 Reduced Motion Support

Wrap gesture-intensive components with reduced motion checks:

```tsx
// In TouchImage
const reducedMotion = useReducedMotion();

// Disable complex animations when reduced motion is preferred
const springConfig = reducedMotion
  ? { damping: 100, stiffness: 1000 } // Nearly instant
  : { damping: 30, stiffness: 300 };

// Skip swipe animations entirely if reduced motion
if (reducedMotion) {
  // Navigate immediately without animation
  onSwipeLeft?.();
  return;
}
```

#### 6.3 Focus Management

Ensure proper focus trapping and restoration:

```tsx
// The Dialog component from Radix already handles focus trapping.
// Ensure the close button is focusable and that the sheet doesn't
// interfere with Dialog's focus management.

// Add focus-visible styles to interactive elements:
<button
  className={cn(
    "...",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  )}
>
```

#### 6.4 Screen Reader Announcements

Add live region for navigation feedback:

```tsx
// In index.tsx, add a live region for announcing image changes
const [announcement, setAnnouncement] = useState("");

// When image changes:
useEffect(() => {
  if (!image) return;
  const index = state.history.findIndex((img) => img.id === image.id);
  setAnnouncement(`Image ${index + 1} of ${state.history.length}`);
}, [image, state.history]);

// In render:
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {announcement}
</div>
```

#### 6.5 CSS Containment for Performance

Apply CSS containment to prevent layout thrashing:

```tsx
// On the main image container
<div
  className="contain-strict"
  style={{
    contain: "strict",
    // Prevent iOS Safari's bounce scrolling from interfering
    overscrollBehavior: "none",
  }}
>
```

---

## Mobile Layout Specifications

### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile S | 320px - 374px | Full-screen image, minimal UI |
| Mobile M | 375px - 424px | Standard mobile layout |
| Mobile L | 425px - 767px | Mobile layout with larger tap targets |
| Tablet | 768px - 1023px | Transitional (could use either) |
| Desktop | 1024px+ | Side-by-side layout |

### Spacing Scale (Mobile)

| Element | Spacing |
|---------|---------|
| Safe area top | `max(0.75rem, env(safe-area-inset-top))` |
| Safe area bottom | `max(0.75rem, env(safe-area-inset-bottom))` |
| Container padding | `1rem` |
| Component gap | `0.75rem` |
| Button height | `3rem` (48px) minimum |
| Icon size in buttons | `1.25rem` (20px) |

### Typography Scale (Mobile)

| Element | Size |
|---------|------|
| Section headers | `text-xs` (12px) |
| Body text | `text-sm` (14px) |
| Metadata labels | `text-[11px]` |
| Metadata values | `text-sm` (14px) |
| Buttons | `text-sm` (14px) |

### Bottom Sheet Specifications

| State | Height | Content |
|-------|--------|---------|
| Peek | 120px | Handle + Compact metadata (model + time) + Icon buttons (download, copy) |
| Expanded | 60vh | Full prompt + all metadata + full-width action buttons |

Note: Changed from 3 snap points to 2. Three snap points create decision fatigue and the middle state (355px) didn't provide meaningful additional value.

---

## Animation Specifications

### Gesture Animations

| Animation | Duration | Easing | Spring Config |
|-----------|----------|--------|---------------|
| Pinch zoom | Instant | - | `damping: 30, stiffness: 300` |
| Pan | Instant | - | `damping: 30, stiffness: 300` |
| Swipe dismiss | 200ms | `ease-out` | - |
| Zoom reset | 300ms | - | `damping: 25, stiffness: 200` |
| Sheet snap | 300ms | `cubic-bezier(0.32, 0.72, 0, 1)` | - |

### Transition States

```tsx
// Swipe navigation transition
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

// Dismiss animation
const dismissVariants = {
  visible: { y: 0, opacity: 1 },
  dismissed: { y: "100%", opacity: 0 },
};
```

---

## Testing Checklist

### Device Testing Matrix

| Device | Screen | Priority | Notes |
|--------|--------|----------|-------|
| iPhone SE (3rd gen) | 375x667 | High | Smallest common iPhone |
| iPhone 14 | 390x844 | High | Standard iPhone |
| iPhone 14 Pro Max | 430x932 | High | Large iPhone with notch |
| iPhone 15 Pro (Dynamic Island) | 393x852 | High | Test safe areas |
| Pixel 7 | 412x915 | High | Standard Android |
| Samsung Galaxy S23 | 360x780 | Medium | Smaller Android |
| iPad Mini | 768x1024 | Medium | Tablet breakpoint edge |
| iPad Air | 820x1180 | Low | Tablet layout |

### Functional Tests

- [ ] **Pinch to zoom** works smoothly from 1x to 4x
- [ ] **Double-tap** toggles between 1x and 2x zoom
- [ ] **Pan** when zoomed keeps image bounded
- [ ] **Swipe left/right** navigates between images
- [ ] **Swipe down** dismisses viewer with opacity fade
- [ ] **Bottom sheet** snaps to peek, expanded, and full states
- [ ] **Sheet drag handle** is easily grippable
- [ ] **Download button** works and shows feedback
- [ ] **Use Prompt button** copies to composer and closes viewer
- [ ] **Close button** is reachable with thumb
- [ ] **Safe areas** are respected (notch, home indicator)
- [ ] **Orientation change** doesn't break layout
- [ ] **Keyboard** doesn't push layout (on Android)

### Performance Tests

- [ ] Zoom animation maintains 60fps
- [ ] Pan gesture maintains 60fps
- [ ] Image load doesn't block main thread
- [ ] Memory usage stays reasonable with large images
- [ ] No layout shift during image load
- [ ] Sheet animation is smooth (no jank)

### Accessibility Tests

- [ ] Screen reader announces image description
- [ ] Focus trapping works in modal
- [ ] Touch targets are minimum 44x44px
- [ ] Color contrast meets WCAG AA
- [ ] Reduced motion preference disables complex animations

---

## File-by-File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/use-reduced-motion.ts` | Reduced motion preference detection hook |
| `src/components/studio/image-viewer/touch-image.tsx` | Touch-enabled image component with pinch/pan/swipe gestures |
| `src/components/studio/image-viewer/mobile-info-sheet.tsx` | Bottom sheet info panel for mobile (uses existing Drawer) |
| `src/components/studio/image-viewer/image-nav-dots.tsx` | Pagination indicator for image navigation |

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/constants.ts` | Add `MOBILE_BREAKPOINT`, `MOBILE_SHEET_PEEK_HEIGHT`, `MOBILE_SHEET_EXPANDED_RATIO` |
| `src/components/studio/image-viewer/index.tsx` | Import `useIsMobile`, add conditional layout, integrate `TouchImage` and `MobileInfoSheet`, add image preloading, add screen reader announcements |
| `src/components/studio/image-viewer/viewer-actions.tsx` | Add `variant` prop for mobile/compact sizing and layout |
| `src/components/studio/image-viewer/metadata-badges.tsx` | Add `variant` prop with "compact" mode, add `formatRelativeDate` helper |
| `src/components/studio/image-viewer/prompt-display.tsx` | Add `variant` prop, add copy confirmation state, adjust truncation length |

### Existing Files to Use (No Changes Needed)

| File | Notes |
|------|-------|
| `src/hooks/use-mobile.ts` | Already exists with correct implementation |
| `src/components/ui/drawer.tsx` | Already wraps vaul, use for MobileInfoSheet |

### Package Additions

```bash
bun add @use-gesture/react
```

---

## Implementation Order

**Estimated effort: 3-5 days for an experienced developer**

1. **Day 1: Foundation & Layout**
   - Add constants to `src/lib/constants.ts`
   - Create `use-reduced-motion.ts` hook
   - Update `index.tsx` with conditional layout (import existing `useIsMobile`)
   - Test responsive breakpoint switching

2. **Day 2: Touch Gestures**
   - Install `@use-gesture/react`
   - Create `TouchImage` component
   - Implement pinch-to-zoom, pan, and double-tap
   - Implement swipe navigation and dismiss
   - Add image preloading

3. **Day 3: Mobile UI Components**
   - Create `MobileInfoSheet` using existing `Drawer` component
   - Create `ImageNavDots` component
   - Update `ViewerActions` with variant prop
   - Update `MetadataBadges` with variant and compact mode
   - Update `PromptDisplay` with variant and copy confirmation

4. **Day 4: Polish & Integration**
   - Integrate all mobile components into `index.tsx`
   - Update close button positioning
   - Add loading states and error handling
   - Add screen reader announcements
   - CSS containment and performance tuning

5. **Day 5: Testing & Bug Fixes**
   - Test on real devices (or BrowserStack)
   - Fix gesture conflicts with Drawer
   - Verify safe area handling
   - Accessibility audit
   - Final polish

---

## Risk Mitigation

### Potential Issues & Solutions

1. **Vaul Drawer + Radix Dialog nesting conflict**
   - **Risk:** Vaul's gesture handling may conflict with Radix Dialog's dismiss behavior and focus management.
   - **Solution:** The `MobileInfoSheet` uses `modal={false}` and `dismissible={false}` to prevent Vaul from controlling dismissal. The Dialog remains the top-level modal controller. Test thoroughly on iOS Safari.

2. **iOS Safari viewport issues**
   - **Risk:** Address bar show/hide causes layout shifts, `100vh` doesn't account for browser chrome.
   - **Solution:** Already using `dvh` units in the codebase. Ensure `MOBILE_SHEET_EXPANDED_RATIO` (0.6) accounts for potential address bar, and use `env(safe-area-inset-*)` for safe areas.

3. **iOS rubber-banding conflicts**
   - **Risk:** iOS Safari's elastic overscroll can trigger during pan gestures, causing janky interactions.
   - **Solution:** Apply `overscroll-behavior: none` and `touch-action: none` to the gesture container. Test on real iOS devices.

4. **Android back button**
   - **Risk:** Android's hardware/gesture back button may not close the viewer.
   - **Solution:** Radix Dialog handles this by default via its overlay click behavior. Verify behavior on Android Chrome and Samsung Browser.

5. **Large image memory pressure**
   - **Risk:** Users with many high-resolution images in history may cause memory issues when preloading.
   - **Solution:** Only preload immediately adjacent images (prev/next), not the entire history. Consider adding `loading="lazy"` to non-visible images.

6. **Gesture library bundle size**
   - **Risk:** `@use-gesture/react` adds to bundle size.
   - **Mitigation:** The library is ~7KB gzipped, acceptable for the functionality gained. It's tree-shakeable so we only import what we use.

7. **Reduced motion users losing functionality**
   - **Risk:** Disabling animations might break gesture feedback.
   - **Solution:** Keep gesture _recognition_ intact, only skip animated transitions. Swipe still navigates, just without the sliding animation.

---

## Success Metrics

- **Usability**: 90%+ of test users can zoom/pan/navigate without instruction
- **Performance**: All animations maintain 60fps on mid-range devices (e.g., Pixel 6a, iPhone 12)
- **Accessibility**: Passes automated (axe-core) and manual accessibility audit
- **Bundle impact**: Less than 10KB gzipped added to the bundle
- **Adoption**: No increase in viewer close rates or bounce after mobile optimization

---

## Testing Checklist Updates

### Quick Smoke Test (Do First)

Before deep testing, verify basic functionality:

- [ ] Mobile breakpoint triggers correctly (resize browser to <768px)
- [ ] Layout switches from horizontal to vertical
- [ ] InfoPanel hides on mobile
- [ ] MobileInfoSheet appears at bottom
- [ ] Close button moves to left side on mobile
- [ ] Swipe down dismisses viewer
- [ ] Double-tap toggles zoom

### Known Gotchas to Test

- [ ] Pinch gesture doesn't trigger browser zoom (should be prevented)
- [ ] Swipe right at first image doesn't break (should no-op)
- [ ] Swipe left at last image doesn't break (should no-op)
- [ ] Sheet drag doesn't interfere with image pan when zoomed
- [ ] Keyboard still works on desktop (Arrow keys, Escape)
- [ ] Videos still show native controls (not affected by TouchImage)
