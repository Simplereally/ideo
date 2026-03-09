"use client";

import { useEffect } from "react";

/**
 * Suppresses console errors from browser extensions (MetaMask, Firefox Reader, etc.)
 * These errors are not actionable and clutter the console during development.
 */
export function ErrorSuppressor() {
  useEffect(() => {
    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      const message = args.join(" ");

      // Suppress browser extension errors
      if (
        message.includes("ethereum") ||
        message.includes("__firefox__")
      ) {
        return;
      }

      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}
