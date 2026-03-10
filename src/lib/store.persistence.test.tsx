import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudioProvider, useStudio } from "@/lib/store";
import type { GeneratedImage } from "@/lib/types";

function HistoryProbe() {
  const { state } = useStudio();

  return (
    <>
      <div data-testid="history-count">{state.history.length}</div>
      <div data-testid="history-prompt">{state.history[0]?.prompt ?? ""}</div>
      <div data-testid="provider">{state.provider}</div>
      <div data-testid="model">{state.model}</div>
      <div data-testid="aspect-ratio">{state.aspectRatio}</div>
      <div data-testid="video-aspect-ratio">{state.videoAspectRatio}</div>
      <div data-testid="video-resolution">{state.videoResolution}</div>
    </>
  );
}

describe("StudioProvider history persistence", () => {
  it("does not overwrite saved history before hydration completes", async () => {
    const persistedHistory: GeneratedImage[] = [
      {
        id: "saved-1",
        prompt: "Persisted Airforce image",
        imageUrl: "https://example.com/generated.png",
        aspectRatio: "1:1",
        model: "airforce:grok-imagine",
        provider: "airforce",
        createdAt: 1,
      },
    ];

    localStorage.setItem("ideo-history", JSON.stringify(persistedHistory));

    render(
      <StrictMode>
        <StudioProvider>
          <HistoryProbe />
        </StudioProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-count")).toHaveTextContent("1");
      expect(screen.getByTestId("history-prompt")).toHaveTextContent(
        "Persisted Airforce image",
      );
    });

    expect(localStorage.getItem("ideo-history")).toBe(
      JSON.stringify(persistedHistory),
    );
  });

  it("hydrates persisted provider, model, ratio, and quality preferences", async () => {
    const persistedPreferences = {
      provider: "airforce",
      model: "airforce:grok-imagine-video",
      aspectRatio: "3:4",
      videoAspectRatio: "3:2",
      videoResolution: "1080p",
    };

    localStorage.setItem("ideo-studio-preferences", JSON.stringify(persistedPreferences));

    render(
      <StrictMode>
        <StudioProvider>
          <HistoryProbe />
        </StudioProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("provider")).toHaveTextContent("airforce");
      expect(screen.getByTestId("model")).toHaveTextContent("airforce:grok-imagine-video");
      expect(screen.getByTestId("aspect-ratio")).toHaveTextContent("3:4");
      expect(screen.getByTestId("video-aspect-ratio")).toHaveTextContent("3:2");
      expect(screen.getByTestId("video-resolution")).toHaveTextContent("1080p");
    });

    expect(localStorage.getItem("ideo-studio-preferences")).toBe(
      JSON.stringify(persistedPreferences),
    );
  });
});
