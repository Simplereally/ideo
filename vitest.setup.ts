import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Polyfill ResizeObserver for jsdom (required by Radix UI Popover / cmdk)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// Polyfill localStorage for jsdom + Node 25+.
// Node 22+ exposes a native `localStorage` behind --localstorage-file, but
// without a valid path it returns a broken proxy with no standard methods.
// This overrides it with a spec-compliant in-memory implementation.
if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage.setItem !== "function"
) {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", { value: storage, writable: true });
  }
}

// Polyfill Element.scrollIntoView for jsdom (required by cmdk)
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = function () {};
}

// Automatic cleanup after each test to guarantee isolation
afterEach(() => {
  cleanup();
});
