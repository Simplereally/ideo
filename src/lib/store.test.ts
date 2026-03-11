/**
 * studioReducer — Pure reducer unit tests
 *
 * Focus: SET_PROVIDER / SET_MODEL consistency for video-default application.
 *
 * The central invariant: whenever a model selection lands on a video model
 * (whether via SET_MODEL directly or via SET_PROVIDER picking a default),
 * the same video defaults must be applied. Conversely, switching between
 * image models (or image→image via provider change) must NOT reset
 * unrelated user state.
 */

import { describe, it, expect, vi } from "vitest";
import {
  studioReducer,
  initialState,
  applyModelDefaults,
  type StudioState,
} from "@/lib/store";
import {
  MODELS,
  getDefaultModelForProvider,
  getMaxImagesForModel,
  getModelsForProvider,
  type ModelConfig,
} from "@/lib/types";

// Allow per-test overrides of getDefaultModelForProvider so we can force the
// SET_PROVIDER reducer path through a video-default scenario.
vi.mock("@/lib/types", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getDefaultModelForProvider: vi.fn(
      actual.getDefaultModelForProvider as (...args: unknown[]) => unknown,
    ),
  };
});

const mockedGetDefault = getDefaultModelForProvider as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Find the first video model for a provider (if any). */
function firstVideoModelForProvider(provider: string): ModelConfig | undefined {
  return MODELS.find((m) => m.provider === provider && m.kind === "video");
}

/** Find the first image model for a provider (if any). */
function firstImageModelForProvider(provider: string): ModelConfig | undefined {
  return MODELS.find((m) => m.provider === provider && m.kind === "image");
}

/** A concrete video model from aiml for deterministic assertions. */
const AIML_VIDEO_MODEL = firstVideoModelForProvider("aiml")!;
/** A concrete image model from aiml. */
const AIML_IMAGE_MODEL = firstImageModelForProvider("aiml")!;
/** A concrete image model from google. */
const GOOGLE_IMAGE_MODEL = getDefaultModelForProvider("google")!;

// Preconditions — fail early if MODELS ordering changes in an unexpected way
describe("test fixtures (preconditions)", () => {
  it("aiml has at least one video model", () => {
    expect(AIML_VIDEO_MODEL).toBeDefined();
    expect(AIML_VIDEO_MODEL.kind).toBe("video");
  });

  it("aiml has at least one image model", () => {
    expect(AIML_IMAGE_MODEL).toBeDefined();
    expect(AIML_IMAGE_MODEL.kind).toBe("image");
  });

  it("google default model is an image model", () => {
    expect(GOOGLE_IMAGE_MODEL).toBeDefined();
    expect(GOOGLE_IMAGE_MODEL.kind).toBe("image");
  });
});

// ---------------------------------------------------------------------------
// applyModelDefaults — the shared helper
// ---------------------------------------------------------------------------

describe("applyModelDefaults", () => {
  it("returns empty object for undefined model", () => {
    expect(applyModelDefaults(undefined)).toEqual({});
  });

  it("resets numInferenceSteps for image models", () => {
    const googleDefaults = applyModelDefaults(GOOGLE_IMAGE_MODEL);
    // Image models still get numInferenceSteps reset to prevent stale values
    expect(googleDefaults).toHaveProperty("numInferenceSteps");

    const aimlDefaults = applyModelDefaults(AIML_IMAGE_MODEL);
    expect(aimlDefaults).toHaveProperty("numInferenceSteps");
  });

  it("returns video defaults for a video model", () => {
    const defaults = applyModelDefaults(AIML_VIDEO_MODEL);
    expect(defaults).toMatchObject({
      generateAudio: false,
      videoImageUrl: "",
      useSelectedImageForVideo: false,
      videoAudioUrl: "",
      videoShotType: "single",
      numberOfImages: 1,
    });
    // Duration / resolution / aspect ratio should come from the model's
    // capabilities (first option) or fall back to initialState.
    expect(defaults.duration).toBeDefined();
    expect(defaults.videoResolution).toBeDefined();
    expect(defaults.videoAspectRatio).toBeDefined();
  });

  it("picks the first capability option for duration/resolution/aspectRatio", () => {
    const caps = AIML_VIDEO_MODEL.capabilities;
    const defaults = applyModelDefaults(AIML_VIDEO_MODEL);

    if (caps.durationOptions?.length) {
      expect(defaults.duration).toBe(caps.durationOptions[0]);
    }
    if (caps.resolutionOptions?.length) {
      expect(defaults.videoResolution).toBe(caps.resolutionOptions[0]);
    }
    if (caps.videoAspectRatios?.length) {
      expect(defaults.videoAspectRatio).toBe(caps.videoAspectRatios[0]);
    }
  });
});

describe("doc-backed batch size limits", () => {
  it("matches the reviewed AIML model batch support matrix", () => {
    expect(getMaxImagesForModel("aiml:x-ai/grok-2-image")).toBe(10);
    expect(getMaxImagesForModel("aiml:blackforestlabs/flux-2-pro")).toBe(1);
    expect(getMaxImagesForModel("aiml:blackforestlabs/flux-2")).toBe(4);
    expect(getMaxImagesForModel("aiml:bytedance/seedream-v4-text-to-image")).toBe(4);
    expect(getMaxImagesForModel("aiml:bytedance/seedream-4-5")).toBe(1);
    expect(getMaxImagesForModel("aiml:alibaba/wan-2-6-image")).toBe(1);
    expect(getMaxImagesForModel("aiml:alibaba/z-image-turbo")).toBe(4);
  });

  it("matches the reviewed Airforce model batch support matrix", () => {
    expect(getMaxImagesForModel("airforce:grok-imagine")).toBe(10);
    expect(getMaxImagesForModel("airforce:flux-2-pro")).toBe(1);
    expect(getMaxImagesForModel("airforce:wan-2.6")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SET_MODEL — video defaults
// ---------------------------------------------------------------------------

describe("SET_MODEL", () => {
  it("applies video defaults when switching to a video model", () => {
    // Start from a state that has non-default video fields set
    const dirtyState: StudioState = {
      ...initialState,
      model: GOOGLE_IMAGE_MODEL.id,
      provider: "google",
      duration: 99,
      videoResolution: "4320p",
      videoAspectRatio: "21:9",
      generateAudio: true,
      videoImageUrl: "https://example.com/image.png",
      useSelectedImageForVideo: true,
      videoAudioUrl: "https://example.com/audio.mp3",
      videoShotType: "multi",
      numberOfImages: 4,
    };

    const next = studioReducer(dirtyState, {
      type: "SET_MODEL",
      payload: AIML_VIDEO_MODEL.id,
    });

    expect(next.model).toBe(AIML_VIDEO_MODEL.id);
    expect(next.provider).toBe("aiml");
    // Video defaults must be reset
    expect(next.generateAudio).toBe(false);
    expect(next.videoImageUrl).toBe("");
    expect(next.useSelectedImageForVideo).toBe(false);
    expect(next.videoAudioUrl).toBe("");
    expect(next.videoShotType).toBe("single");
    expect(next.numberOfImages).toBe(1);
  });

  it("does NOT reset video fields when switching between image models", () => {
    const dirtyState: StudioState = {
      ...initialState,
      model: GOOGLE_IMAGE_MODEL.id,
      provider: "google",
      duration: 42,
      videoResolution: "4320p",
      numberOfImages: 3,
    };

    const next = studioReducer(dirtyState, {
      type: "SET_MODEL",
      payload: AIML_IMAGE_MODEL.id,
    });

    // Image → image: video fields must be preserved (not reset)
    expect(next.duration).toBe(42);
    expect(next.videoResolution).toBe("4320p");
    expect(next.numberOfImages).toBe(3);
  });

  it("syncs the provider field to match the new model's provider", () => {
    const state: StudioState = {
      ...initialState,
      model: GOOGLE_IMAGE_MODEL.id,
      provider: "google",
    };

    const next = studioReducer(state, {
      type: "SET_MODEL",
      payload: AIML_IMAGE_MODEL.id,
    });

    expect(next.provider).toBe("aiml");
  });

  it("clamps numberOfImages when switching to a model without batch support", () => {
    const state: StudioState = {
      ...initialState,
      model: GOOGLE_IMAGE_MODEL.id,
      provider: "google",
      numberOfImages: 4,
    };

    const next = studioReducer(state, {
      type: "SET_MODEL",
      payload: "aiml:bytedance/seedream-4-5",
    });

    expect(next.numberOfImages).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SET_PROVIDER — the fixed behavior
// ---------------------------------------------------------------------------

describe("SET_PROVIDER", () => {
  it("keeps current model when it already belongs to the new provider", () => {
    const aimlModels = getModelsForProvider("aiml");
    const secondAimlModel = aimlModels[1]!;
    const state: StudioState = {
      ...initialState,
      provider: "aiml",
      model: secondAimlModel.id,
    };

    const next = studioReducer(state, {
      type: "SET_PROVIDER",
      payload: "aiml",
    });

    expect(next.model).toBe(secondAimlModel.id);
  });

  it("picks the default model for the new provider when current model doesn't belong", () => {
    const state: StudioState = {
      ...initialState,
      provider: "google",
      model: GOOGLE_IMAGE_MODEL.id,
    };

    const next = studioReducer(state, {
      type: "SET_PROVIDER",
      payload: "fal",
    });

    const falDefault = getDefaultModelForProvider("fal")!;
    expect(next.model).toBe(falDefault.id);
    expect(next.provider).toBe("fal");
  });

  it("does NOT apply video defaults when landing on an image model", () => {
    const state: StudioState = {
      ...initialState,
      provider: "aiml",
      model: AIML_IMAGE_MODEL.id,
      duration: 42,
      videoResolution: "4320p",
      numberOfImages: 3,
    };

    // google default is image — should not reset video fields
    const next = studioReducer(state, {
      type: "SET_PROVIDER",
      payload: "google",
    });

    expect(next.duration).toBe(42);
    expect(next.videoResolution).toBe("4320p");
    expect(next.numberOfImages).toBe(3);
  });

  /**
   * KEY TEST: This is the bug scenario — switching to a provider whose
   * default model is video MUST apply video defaults, exactly like SET_MODEL.
   *
   * Since the current MODELS array has aiml's first model as image, we
   * simulate this by directly invoking the reducer with a state where the
   * current model belongs to google, then switching to a hypothetical
   * provider scenario. We verify the invariant by asserting that the
   * result of SET_PROVIDER landing on a video model is identical to
   * SET_MODEL for that same model (modulo the action path).
   *
   * Concretely: we check that the applyModelDefaults helper is invoked
   * by SET_PROVIDER by using a video model as the default for a provider.
   * We do this by first selecting a video model via SET_MODEL, noting
   * the video defaults it produces, then verifying SET_PROVIDER yields
   * identical video-related state when it lands on the same model.
   */
  it("applies video defaults when the default model for the new provider is video (consistency with SET_MODEL)", () => {
    // Start with stale video state and a google image model selected
    const dirtyState: StudioState = {
      ...initialState,
      provider: "google",
      model: GOOGLE_IMAGE_MODEL.id,
      duration: 99,
      videoResolution: "4320p",
      videoAspectRatio: "21:9",
      generateAudio: true,
      videoImageUrl: "https://example.com/image.png",
      useSelectedImageForVideo: true,
      videoAudioUrl: "https://example.com/audio.mp3",
      videoShotType: "multi",
      numberOfImages: 4,
    };

    // Path A: SET_MODEL directly to the video model
    const viaSetModel = studioReducer(dirtyState, {
      type: "SET_MODEL",
      payload: AIML_VIDEO_MODEL.id,
    });

    // Path B: Force getDefaultModelForProvider to return the video model
    // for "aiml" so SET_PROVIDER actually exercises the video-default branch.
    mockedGetDefault.mockImplementation((provider: string) => {
      if (provider === "aiml") return AIML_VIDEO_MODEL;
      return MODELS.find((m) => m.provider === provider);
    });

    const viaSetProvider = studioReducer(dirtyState, {
      type: "SET_PROVIDER",
      payload: "aiml",
    });

    // Restore default implementation for subsequent tests
    mockedGetDefault.mockImplementation((provider: string) =>
      MODELS.find((m) => m.provider === provider),
    );

    // Both paths must produce identical video defaults
    const expectedDefaults = applyModelDefaults(AIML_VIDEO_MODEL);
    for (const [key, value] of Object.entries(expectedDefaults)) {
      expect(viaSetProvider[key as keyof StudioState]).toBe(value);
      expect(viaSetModel[key as keyof StudioState]).toBe(value);
    }

    // And verify the dirty state was actually cleaned:
    expect(viaSetModel.generateAudio).toBe(false);
    expect(viaSetModel.videoImageUrl).toBe("");
    expect(viaSetModel.useSelectedImageForVideo).toBe(false);
    expect(viaSetModel.videoAudioUrl).toBe("");
    expect(viaSetModel.numberOfImages).toBe(1);

    // SET_PROVIDER and SET_MODEL should agree on all video fields
    const videoFields = [
      "duration",
      "videoResolution",
      "videoAspectRatio",
      "generateAudio",
      "videoImageUrl",
      "useSelectedImageForVideo",
      "videoAudioUrl",
      "videoShotType",
      "numberOfImages",
    ] as const;

    for (const field of videoFields) {
      expect(viaSetProvider[field]).toBe(viaSetModel[field]);
    }
  });

  it("SET_PROVIDER and SET_MODEL produce identical video state for the same target video model", () => {
    // This is the definitive consistency test. We mock getDefaultModelForProvider
    // to return the video model for aiml, then dispatch both SET_PROVIDER and
    // SET_MODEL and compare the results.
    const dirtyState: StudioState = {
      ...initialState,
      provider: "google",
      model: GOOGLE_IMAGE_MODEL.id,
      duration: 77,
      videoResolution: "nonsense",
      videoAspectRatio: "99:1",
      generateAudio: true,
      videoImageUrl: "https://dirty.example.com/img.png",
      useSelectedImageForVideo: true,
      videoAudioUrl: "https://dirty.example.com/aud.mp3",
      videoShotType: "multi",
      numberOfImages: 4,
    };

    // Use SET_MODEL to switch to the video model
    const viaModel = studioReducer(dirtyState, {
      type: "SET_MODEL",
      payload: AIML_VIDEO_MODEL.id,
    });

    // Force getDefaultModelForProvider to return the video model for aiml
    // so SET_PROVIDER actually exercises the video-default reducer branch.
    mockedGetDefault.mockImplementation((provider: string) => {
      if (provider === "aiml") return AIML_VIDEO_MODEL;
      return MODELS.find((m) => m.provider === provider);
    });

    const viaProvider = studioReducer(dirtyState, {
      type: "SET_PROVIDER",
      payload: "aiml",
    });

    // Restore default implementation
    mockedGetDefault.mockImplementation((provider: string) =>
      MODELS.find((m) => m.provider === provider),
    );

    // All video-specific fields must match between SET_MODEL and SET_PROVIDER
    const videoFields = [
      "duration",
      "videoResolution",
      "videoAspectRatio",
      "generateAudio",
      "videoImageUrl",
      "useSelectedImageForVideo",
      "videoAudioUrl",
      "videoShotType",
      "numberOfImages",
    ] as const;

    for (const field of videoFields) {
      expect(viaProvider[field]).toBe(viaModel[field]);
    }
  });
});
