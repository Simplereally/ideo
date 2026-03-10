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
});
