import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImageModels, getVideoModels } from "@/lib/types";
import { BatchSizePopover } from "../batch-size-popover";

const imageModelWithBatchOptions = getImageModels().find((model) => {
  const hasMaxImages = model.capabilities.maxImages;
  return typeof hasMaxImages === "number" && hasMaxImages > 1;
});

const videoModel = getVideoModels()[0];

if (!imageModelWithBatchOptions || !videoModel) {
  throw new Error("Test prerequisites not met: expected image and video models");
}

let mockModel = imageModelWithBatchOptions.id;
let mockNumberOfImages = 1;
const setNumberOfImages = vi.fn((value: number) => {
  mockNumberOfImages = value;
});

vi.mock("@/lib/store", () => ({
  useStudio: () => ({
    state: {
      model: mockModel,
      numberOfImages: mockNumberOfImages,
    },
    setNumberOfImages,
  }),
}));

describe("BatchSizePopover", () => {
  beforeEach(() => {
    mockModel = imageModelWithBatchOptions.id;
    mockNumberOfImages = 1;
    setNumberOfImages.mockClear();
  });

  it("renders for image models with multiple batch options", () => {
    render(<BatchSizePopover />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("does not throw when rerendering from image model to video model", () => {
    const view = render(<BatchSizePopover />);

    mockModel = videoModel.id;

    expect(() => {
      view.rerender(<BatchSizePopover />);
    }).not.toThrow();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
