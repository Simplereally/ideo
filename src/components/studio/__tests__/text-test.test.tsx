import { render, screen, within } from "@testing-library/react";
import { it, expect } from "vitest";

it("style tag approach - text in style is ignored by getByText", () => {
  render(
    <div>
      <div>Image Models</div>
      <div role="listbox">
        <div role="option">
          <style>{`.label::before { content: "Grok 2 Image" }`}</style>
          <span className="label">label here</span>
        </div>
      </div>
    </div>
  );
  const allImageMatches = screen.queryAllByText(/image/i);
  // Only the "Image Models" heading should match — style tag content is invisible to getByText.
  expect(allImageMatches).toHaveLength(1);
  expect(allImageMatches[0]).toHaveTextContent("Image Models");
});

it("what if the option element itself has direct text nodes forming the label?", () => {
  render(
    <div>
      <div>Image Models</div>
      <div role="listbox">
        <div role="option">Grok 2 Image</div>
      </div>
    </div>
  );
  const allImageMatches = screen.queryAllByText(/image/i);
  // Both "Image Models" div and "Grok 2 Image" div will match.
  expect(allImageMatches).toHaveLength(2);
});

it("can we use selector option to filter getByText results?", () => {
  render(
    <div>
      <div data-heading>Image Models</div>
      <div role="listbox">
        <div role="option">
          <span data-label>Grok 2 Image</span>
        </div>
      </div>
    </div>
  );
  const allImageMatches = screen.queryAllByText(/image/i);
  // Default selector is '*', so all elements with matching text match.
  expect(allImageMatches.length).toBeGreaterThanOrEqual(2);
});

it("what if model text uses non-breaking space or zero-width joiner?", () => {
  render(
    <div>
      <div>Image Models</div>
      <div role="listbox">
        <div role="option">
          <span>{`Grok 2 Im\u200Dage`}</span>
        </div>
      </div>
    </div>
  );
  const allImageMatches = screen.queryAllByText(/image/i);
  // The ZWJ breaks "Image" so /image/i won't match "Im\u200Dage" — only heading matches.
  expect(allImageMatches).toHaveLength(1);
  expect(allImageMatches[0]).toHaveTextContent("Image Models");

  // But we can still find the label with the exact modified text.
  const listbox = screen.getByRole("listbox");
  const found = within(listbox).queryByText(`Grok 2 Im\u200Dage`);
  expect(found).not.toBeNull();
  expect(found).toHaveTextContent(`Grok 2 Im\u200Dage`);
});

it("what about making option text a single node that includes both label+desc?", () => {
  render(
    <div>
      <div>Image Models</div>
      <div role="listbox">
        <div role="option">{"Grok 2 Image\nxAI's image generation model"}</div>
      </div>
    </div>
  );
  const allImageMatches = screen.queryAllByText(/image/i);
  // Both the "Image Models" heading and the combined-text option should match /image/i.
  expect(allImageMatches).toHaveLength(2);

  // Exact match for "Grok 2 Image" alone should fail because the element text is longer.
  const listbox = screen.getByRole("listbox");
  const found = within(listbox).queryByText("Grok 2 Image");
  expect(found).toBeNull();
});
