import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudioHeader } from "../header";

const { configuredProvidersRef, openApiKeyDialog } = vi.hoisted(() => ({
  configuredProvidersRef: { current: [] as string[] },
  openApiKeyDialog: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-configured-providers", () => ({
  useConfiguredProviders: () => ({
    configuredProviders: configuredProvidersRef.current,
    status: {
      google: false,
      vertex: false,
      fal: false,
      aiml: false,
      airforce: false,
    },
    loading: false,
  }),
}));

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    openApiKeyDialog,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("StudioHeader", () => {
  beforeEach(() => {
    configuredProvidersRef.current = [];
    openApiKeyDialog.mockClear();
  });

  it("shows keys needed when no providers are configured", () => {
    render(<StudioHeader />);

    expect(screen.getByText("Keys Needed")).toBeInTheDocument();
  });

  it("shows providers ready when configured providers include local-only keys", () => {
    configuredProvidersRef.current = ["fal", "aiml", "airforce"];

    render(<StudioHeader />);

    expect(screen.getByText("Providers Ready")).toBeInTheDocument();
  });
});
