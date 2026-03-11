"use client";

import { useEffect } from "react";

function safeStringifyConsoleArg(arg: unknown): string {
  if (typeof arg === "string") return arg;

  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }

  try {
    const json = JSON.stringify(arg);
    if (json) return json;
  } catch {
    // Fall through to String coercion.
  }

  try {
    return String(arg);
  } catch {
    return "[unstringifiable value]";
  }
}

/**
 * Suppresses console errors from browser extensions (MetaMask, Firefox Reader, etc.)
 * These errors are not actionable and clutter the console during development.
 */
export function ErrorSuppressor() {
  useEffect(() => {
    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      const message = args.map(safeStringifyConsoleArg).join(" ");

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
