"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import {
  MODELS,
  getMaxImagesForModel,
  getDefaultModelForProvider,
  getModelConfig,
  type AspectRatio,
  type GenerationStatus,
  type GeneratedImage,
  type Provider,
  type VideoShotType,
} from "@/lib/types";

const HISTORY_STORAGE_KEY = "ideo-history";
const PREFERENCES_STORAGE_KEY = "ideo-studio-preferences";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface StudioState {
  // API config
  provider: Provider;
  // Generation config
  prompt: string;
  negativePrompt: string;
  aspectRatio: AspectRatio;
  model: string;
  numberOfImages: number;
  guidanceScale: number;
  // Provider-specific (fal)
  numInferenceSteps: number;
  seed: string; // empty string = random
  safetyTolerance: number;
  enableSafetyChecker: boolean;
  // Provider-specific (google/vertex imagen)
  enhancePrompt: boolean;
  personGeneration: string; // "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL"
  // Video-specific params
  duration: number;
  videoResolution: string;
  videoAspectRatio: string;
  generateAudio: boolean;
  videoImageUrl: string;
  videoImageUrl2: string;
  useSelectedImageForVideo: boolean;
  videoAudioUrl: string;
  useSelectedImageAsVideoReference: boolean;
  videoShotType: VideoShotType;
  // Status
  status: GenerationStatus;
  error: string | null;
  // Data
  history: GeneratedImage[];
  selectedImage: GeneratedImage | null;
  // UI toggles
  isHistoryOpen: boolean;
  isQueueOpen: boolean;
  isControlsOpen: boolean;
  isApiKeyDialogOpen: boolean;
  isImageViewerOpen: boolean;
}

export const initialState: StudioState = {
  provider: "aiml",
  prompt: "",
  negativePrompt: "",
  aspectRatio: "9:16",
  model: "aiml:x-ai/grok-2-image",
  numberOfImages: 1,
  guidanceScale: 3.5,
  numInferenceSteps: 28,
  seed: "",
  safetyTolerance: 2,
  enableSafetyChecker: true,
  enhancePrompt: false,
  personGeneration: "ALLOW_ADULT",
  // Video defaults
  duration: 5,
  videoResolution: "720p",
  videoAspectRatio: "16:9",
  generateAudio: false,
  videoImageUrl: "",
  videoImageUrl2: "",
  useSelectedImageForVideo: false,
  videoAudioUrl: "",
  useSelectedImageAsVideoReference: false,
  videoShotType: "single",
  // Status
  status: "idle",
  error: null,
  history: [],
  selectedImage: null,
  isHistoryOpen: false,
  isQueueOpen: false,
  isControlsOpen: false,
  isApiKeyDialogOpen: false,
  isImageViewerOpen: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type StudioAction =
  | { type: "SET_PROVIDER"; payload: Provider }
  | { type: "SET_PROMPT"; payload: string }
  | { type: "SET_NEGATIVE_PROMPT"; payload: string }
  | { type: "SET_ASPECT_RATIO"; payload: AspectRatio }
  | { type: "SET_NUM_INFERENCE_STEPS"; payload: number }
  | { type: "SET_SEED"; payload: string }
  | { type: "SET_SAFETY_TOLERANCE"; payload: number }
  | { type: "SET_ENABLE_SAFETY_CHECKER"; payload: boolean }
  | { type: "SET_ENHANCE_PROMPT"; payload: boolean }
  | { type: "SET_PERSON_GENERATION"; payload: string }
  | { type: "SET_MODEL"; payload: string }
  | { type: "SET_NUMBER_OF_IMAGES"; payload: number }
  | { type: "SET_GUIDANCE_SCALE"; payload: number }
  // Video-specific actions
  | { type: "SET_DURATION"; payload: number }
  | { type: "SET_VIDEO_RESOLUTION"; payload: string }
  | { type: "SET_VIDEO_ASPECT_RATIO"; payload: string }
  | { type: "SET_GENERATE_AUDIO"; payload: boolean }
  | { type: "SET_VIDEO_IMAGE_URL"; payload: string }
  | { type: "SET_VIDEO_IMAGE_URL_2"; payload: string }
  | { type: "SET_USE_SELECTED_IMAGE_FOR_VIDEO"; payload: boolean }
  | { type: "SET_VIDEO_AUDIO_URL"; payload: string }
  | { type: "SET_USE_SELECTED_IMAGE_AS_VIDEO_REFERENCE"; payload: boolean }
  | { type: "SET_VIDEO_SHOT_TYPE"; payload: VideoShotType }
  // Lifecycle
  | { type: "START_GENERATION" }
  | { type: "COMPLETE_GENERATION"; payload: GeneratedImage }
  | { type: "FAIL_GENERATION"; payload: string }
  | { type: "SELECT_IMAGE"; payload: GeneratedImage | null }
  | { type: "REMOVE_IMAGE"; payload: string }
  | { type: "CLEAR_HISTORY" }
  | { type: "TOGGLE_HISTORY" }
  | { type: "TOGGLE_QUEUE" }
  | { type: "TOGGLE_CONTROLS" }
  | { type: "SET_API_KEY_DIALOG"; payload: boolean }
  | { type: "SET_IMAGE_VIEWER"; payload: boolean }
  | { type: "RESET_STATUS" }
  | {
      type: "HYDRATE";
      payload: {
        history: GeneratedImage[];
        preferences?: Partial<
          Pick<
            StudioState,
            "provider" | "model" | "aspectRatio" | "videoAspectRatio" | "videoResolution"
          >
        >;
      };
    };

type PersistedStudioPreferences = Pick<
  StudioState,
  "provider" | "model" | "aspectRatio" | "videoAspectRatio" | "videoResolution"
>;

function isAspectRatioSupported(
  model: ReturnType<typeof getModelConfig>,
  ratio: AspectRatio,
): boolean {
  const aspectRatios = model?.capabilities.aspectRatios;
  return !aspectRatios?.length || aspectRatios.includes(ratio);
}

function resolvePersistedModel(
  provider: Provider | undefined,
  modelId: string | undefined,
): NonNullable<ReturnType<typeof getModelConfig>> {
  const storedModel = modelId ? getModelConfig(modelId) : undefined;
  if (storedModel) {
    return storedModel;
  }

  const providerDefault = provider ? getDefaultModelForProvider(provider) : undefined;
  return providerDefault ?? getModelConfig(initialState.model)!;
}

function sanitizePersistedPreferences(raw: unknown): Partial<PersistedStudioPreferences> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const parsed = raw as Partial<PersistedStudioPreferences>;
  const provider =
    typeof parsed.provider === "string" &&
    MODELS.some((model) => model.provider === parsed.provider)
      ? parsed.provider
      : undefined;
  const model = resolvePersistedModel(provider, parsed.model);

  const preferences: Partial<PersistedStudioPreferences> = {
    provider: model.provider,
    model: model.id,
  };

  if (
    typeof parsed.aspectRatio === "string" &&
    isAspectRatioSupported(model, parsed.aspectRatio as AspectRatio)
  ) {
    preferences.aspectRatio = parsed.aspectRatio as AspectRatio;
  }

  if (
    typeof parsed.videoAspectRatio === "string" &&
    (!model.capabilities.videoAspectRatios?.length ||
      model.capabilities.videoAspectRatios.includes(parsed.videoAspectRatio))
  ) {
    preferences.videoAspectRatio = parsed.videoAspectRatio;
  }

  if (
    typeof parsed.videoResolution === "string" &&
    (!model.capabilities.resolutionOptions?.length ||
      model.capabilities.resolutionOptions.includes(parsed.videoResolution))
  ) {
    preferences.videoResolution = parsed.videoResolution;
  }

  return preferences;
}

function getPersistedPreferences(state: StudioState): PersistedStudioPreferences {
  return {
    provider: state.provider,
    model: state.model,
    aspectRatio: state.aspectRatio,
    videoAspectRatio: state.videoAspectRatio,
    videoResolution: state.videoResolution,
  };
}

// ---------------------------------------------------------------------------
// Helpers — kind-specific defaults
// ---------------------------------------------------------------------------

/**
 * Compute the state overrides that should be applied whenever a model is
 * selected (whether via SET_MODEL or implicitly through SET_PROVIDER).
 *
 * For video models this resets video params to the model's first available
 * option and forces numberOfImages to 1 (videos are always single-output).
 * For image models this is a no-op — we intentionally preserve the user's
 * current image settings when switching between image models.
 */
export function applyModelDefaults(
  model: ReturnType<typeof getModelConfig>,
): Partial<StudioState> {
  if (!model) return {};

  const caps = model.capabilities;
  const overrides: Partial<StudioState> = {};

  // Reset numInferenceSteps to the new model's default (or the global
  // initial value when the model doesn't expose the slider at all).
  // This prevents a stale value from a different model being sent to
  // an API with a stricter range (e.g. Z Image Turbo accepts 1-8).
  if (caps?.numInferenceSteps) {
    overrides.numInferenceSteps = caps.numInferenceSteps.default;
  } else {
    overrides.numInferenceSteps = initialState.numInferenceSteps;
  }

  if (model.kind === "video") {
    overrides.duration = caps?.durationOptions?.[0] ?? initialState.duration;
    overrides.videoResolution = caps?.resolutionOptions?.[0] ?? initialState.videoResolution;
    overrides.videoAspectRatio = caps?.videoAspectRatios?.[0] ?? initialState.videoAspectRatio;
    overrides.generateAudio = false;
    overrides.videoImageUrl = "";
    overrides.videoImageUrl2 = "";
    overrides.useSelectedImageForVideo = false;
    overrides.videoAudioUrl = "";
    overrides.useSelectedImageAsVideoReference = false;
    overrides.videoShotType = "single";
    overrides.numberOfImages = 1;
  }

  return overrides;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "SET_PROVIDER": {
      const newProvider = action.payload;
      // If current model already belongs to new provider, nothing to change
      const currentModel = MODELS.find((m) => m.id === state.model);
      if (currentModel?.provider === newProvider) {
        return { ...state, provider: newProvider };
      }
      const defaultModel = getDefaultModelForProvider(newProvider);
      return {
        ...state,
        provider: newProvider,
        model: defaultModel?.id ?? state.model,
        numberOfImages: Math.min(
          state.numberOfImages,
          getMaxImagesForModel(defaultModel?.id ?? state.model),
        ),
        ...applyModelDefaults(defaultModel),
      };
    }
    case "SET_PROMPT":
      return { ...state, prompt: action.payload };
    case "SET_NEGATIVE_PROMPT":
      return { ...state, negativePrompt: action.payload };
    case "SET_ASPECT_RATIO":
      return { ...state, aspectRatio: action.payload };
    case "SET_NUM_INFERENCE_STEPS":
      return { ...state, numInferenceSteps: action.payload };
    case "SET_SEED":
      return { ...state, seed: action.payload };
    case "SET_SAFETY_TOLERANCE":
      return { ...state, safetyTolerance: action.payload };
    case "SET_ENABLE_SAFETY_CHECKER":
      return { ...state, enableSafetyChecker: action.payload };
    case "SET_ENHANCE_PROMPT":
      return { ...state, enhancePrompt: action.payload };
    case "SET_PERSON_GENERATION":
      return { ...state, personGeneration: action.payload };
    case "SET_MODEL": {
      const selectedModel = MODELS.find(m => m.id === action.payload);
      return { 
        ...state, 
        model: action.payload,
        provider: selectedModel ? selectedModel.provider : state.provider,
        numberOfImages: Math.min(
          state.numberOfImages,
          getMaxImagesForModel(action.payload),
        ),
        ...applyModelDefaults(selectedModel),
      };
    }
    case "SET_NUMBER_OF_IMAGES": {
      // Video models always produce a single output — enforce the invariant
      // regardless of what the caller requests.
      const currentModel = MODELS.find((m) => m.id === state.model);
      const effectiveMax =
        currentModel?.kind === "video" ? 1 : getMaxImagesForModel(state.model);
      return {
        ...state,
        numberOfImages: Math.min(Math.max(1, action.payload), effectiveMax),
      };
    }
    case "SET_GUIDANCE_SCALE":
      return { ...state, guidanceScale: action.payload };
    // Video-specific reducers
    case "SET_DURATION":
      return { ...state, duration: action.payload };
    case "SET_VIDEO_RESOLUTION":
      return { ...state, videoResolution: action.payload };
    case "SET_VIDEO_ASPECT_RATIO":
      return { ...state, videoAspectRatio: action.payload };
    case "SET_GENERATE_AUDIO":
      return { ...state, generateAudio: action.payload };
    case "SET_VIDEO_IMAGE_URL":
      return { ...state, videoImageUrl: action.payload };
    case "SET_VIDEO_IMAGE_URL_2":
      return { ...state, videoImageUrl2: action.payload };
    case "SET_USE_SELECTED_IMAGE_FOR_VIDEO":
      return { ...state, useSelectedImageForVideo: action.payload };
    case "SET_VIDEO_AUDIO_URL":
      return { ...state, videoAudioUrl: action.payload };
    case "SET_USE_SELECTED_IMAGE_AS_VIDEO_REFERENCE":
      return { ...state, useSelectedImageAsVideoReference: action.payload };
    case "SET_VIDEO_SHOT_TYPE":
      return { ...state, videoShotType: action.payload };
    case "START_GENERATION":
      return { ...state, status: "generating", error: null };
    case "COMPLETE_GENERATION":
      return {
        ...state,
        status: "complete",
        history: [action.payload, ...state.history],
        selectedImage: action.payload,
      };
    case "FAIL_GENERATION":
      return { ...state, status: "error", error: action.payload };
    case "SELECT_IMAGE":
      return {
        ...state,
        selectedImage: action.payload,
        useSelectedImageAsVideoReference:
          action.payload === null ? false : state.useSelectedImageAsVideoReference,
      };
    case "REMOVE_IMAGE":
      return {
        ...state,
        history: state.history.filter((img) => img.id !== action.payload),
        selectedImage:
          state.selectedImage?.id === action.payload ? null : state.selectedImage,
        useSelectedImageAsVideoReference:
          state.selectedImage?.id === action.payload
            ? false
            : state.useSelectedImageAsVideoReference,
      };
    case "CLEAR_HISTORY":
      return {
        ...state,
        history: [],
        selectedImage: null,
        useSelectedImageAsVideoReference: false,
      };
    case "TOGGLE_HISTORY":
      return { ...state, isHistoryOpen: !state.isHistoryOpen };
    case "TOGGLE_QUEUE":
      return { ...state, isQueueOpen: !state.isQueueOpen };
    case "TOGGLE_CONTROLS":
      return { ...state, isControlsOpen: !state.isControlsOpen };
    case "SET_API_KEY_DIALOG":
      return { ...state, isApiKeyDialogOpen: action.payload };
    case "SET_IMAGE_VIEWER":
      return { ...state, isImageViewerOpen: action.payload };
    case "RESET_STATUS":
      return { ...state, status: "idle", error: null };
    case "HYDRATE":
      return {
        ...state,
        ...action.payload.preferences,
        history: action.payload.history,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface StudioContextValue {
  state: StudioState;
  setProvider: (provider: Provider) => void;
  setPrompt: (prompt: string) => void;
  setNegativePrompt: (prompt: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setNumInferenceSteps: (steps: number) => void;
  setSeed: (seed: string) => void;
  setSafetyTolerance: (tolerance: number) => void;
  setEnableSafetyChecker: (enabled: boolean) => void;
  setEnhancePrompt: (enabled: boolean) => void;
  setPersonGeneration: (policy: string) => void;
  setModel: (model: string) => void;
  setNumberOfImages: (n: number) => void;
  setGuidanceScale: (scale: number) => void;
  // Video-specific setters
  setDuration: (d: number) => void;
  setVideoResolution: (r: string) => void;
  setVideoAspectRatio: (r: string) => void;
  setGenerateAudio: (enabled: boolean) => void;
  setVideoImageUrl: (url: string) => void;
  setVideoImageUrl2: (url: string) => void;
  setUseSelectedImageForVideo: (enabled: boolean) => void;
  setVideoAudioUrl: (url: string) => void;
  setUseSelectedImageAsVideoReference: (enabled: boolean) => void;
  setVideoShotType: (t: VideoShotType) => void;
  // Lifecycle
  startGeneration: () => void;
  completeGeneration: (image: GeneratedImage) => void;
  failGeneration: (error: string) => void;
  selectImage: (image: GeneratedImage | null) => void;
  removeImage: (id: string) => void;
  clearHistory: () => void;
  toggleHistory: () => void;
  toggleQueue: () => void;
  toggleControls: () => void;
  openApiKeyDialog: () => void;
  closeApiKeyDialog: () => void;
  openImageViewer: (image: GeneratedImage) => void;
  closeImageViewer: () => void;
  resetStatus: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount + purge legacy secrets
  useEffect(() => {
      try {
        // One-time cleanup: remove legacy key that stored client-side API secrets.
        localStorage.removeItem("ideo-settings");

        const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
        const storedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        dispatch({
          type: "HYDRATE",
          payload: {
            history: storedHistory ? (JSON.parse(storedHistory) as GeneratedImage[]) : [],
            preferences: sanitizePersistedPreferences(
              storedPreferences ? JSON.parse(storedPreferences) : undefined,
            ),
          },
        });
      } catch {
        // SSR or localStorage unavailable — ignore
      } finally {
        setIsHydrated(true);
      }
    }, []);

  // Persist history
  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history));
    } catch {
      // ignore
    }
  }, [isHydrated, state.history]);

  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(getPersistedPreferences(state)),
      );
    } catch {
      // ignore
    }
  }, [
    isHydrated,
    state.aspectRatio,
    state.model,
    state.provider,
    state.videoAspectRatio,
    state.videoResolution,
  ]);

  // ---- Action creators (stable refs via useCallback) ----

  const setProvider = useCallback(
    (provider: Provider) => dispatch({ type: "SET_PROVIDER", payload: provider }),
    [],
  );
  const setPrompt = useCallback(
    (prompt: string) => dispatch({ type: "SET_PROMPT", payload: prompt }),
    [],
  );
  const setNegativePrompt = useCallback(
    (prompt: string) => dispatch({ type: "SET_NEGATIVE_PROMPT", payload: prompt }),
    [],
  );
  const setAspectRatio = useCallback(
    (ratio: AspectRatio) => dispatch({ type: "SET_ASPECT_RATIO", payload: ratio }),
    [],
  );
  const setNumInferenceSteps = useCallback(
    (steps: number) => dispatch({ type: "SET_NUM_INFERENCE_STEPS", payload: steps }),
    [],
  );
  const setSeed = useCallback(
    (seed: string) => dispatch({ type: "SET_SEED", payload: seed }),
    [],
  );
  const setSafetyTolerance = useCallback(
    (tolerance: number) => dispatch({ type: "SET_SAFETY_TOLERANCE", payload: tolerance }),
    [],
  );
  const setEnableSafetyChecker = useCallback(
    (enabled: boolean) => dispatch({ type: "SET_ENABLE_SAFETY_CHECKER", payload: enabled }),
    [],
  );
  const setEnhancePrompt = useCallback(
    (enabled: boolean) => dispatch({ type: "SET_ENHANCE_PROMPT", payload: enabled }),
    [],
  );
  const setPersonGeneration = useCallback(
    (policy: string) => dispatch({ type: "SET_PERSON_GENERATION", payload: policy }),
    [],
  );
  const setModel = useCallback(
    (model: string) => dispatch({ type: "SET_MODEL", payload: model }),
    [],
  );
  const setNumberOfImages = useCallback(
    (n: number) => dispatch({ type: "SET_NUMBER_OF_IMAGES", payload: n }),
    [],
  );
  const setGuidanceScale = useCallback(
    (scale: number) => dispatch({ type: "SET_GUIDANCE_SCALE", payload: scale }),
    [],
  );
  // Video-specific action creators
  const setDuration = useCallback(
    (d: number) => dispatch({ type: "SET_DURATION", payload: d }),
    [],
  );
  const setVideoResolution = useCallback(
    (r: string) => dispatch({ type: "SET_VIDEO_RESOLUTION", payload: r }),
    [],
  );
  const setVideoAspectRatio = useCallback(
    (r: string) => dispatch({ type: "SET_VIDEO_ASPECT_RATIO", payload: r }),
    [],
  );
  const setGenerateAudio = useCallback(
    (enabled: boolean) => dispatch({ type: "SET_GENERATE_AUDIO", payload: enabled }),
    [],
  );
  const setVideoImageUrl = useCallback(
    (url: string) => dispatch({ type: "SET_VIDEO_IMAGE_URL", payload: url }),
    [],
  );
  const setVideoImageUrl2 = useCallback(
    (url: string) => dispatch({ type: "SET_VIDEO_IMAGE_URL_2", payload: url }),
    [],
  );
  const setUseSelectedImageForVideo = useCallback(
    (enabled: boolean) =>
      dispatch({ type: "SET_USE_SELECTED_IMAGE_FOR_VIDEO", payload: enabled }),
    [],
  );
  const setVideoAudioUrl = useCallback(
    (url: string) => dispatch({ type: "SET_VIDEO_AUDIO_URL", payload: url }),
    [],
  );
  const setUseSelectedImageAsVideoReference = useCallback(
    (enabled: boolean) =>
      dispatch({
        type: "SET_USE_SELECTED_IMAGE_AS_VIDEO_REFERENCE",
        payload: enabled,
      }),
    [],
  );
  const setVideoShotType = useCallback(
    (t: VideoShotType) => dispatch({ type: "SET_VIDEO_SHOT_TYPE", payload: t }),
    [],
  );
  const startGeneration = useCallback(
    () => dispatch({ type: "START_GENERATION" }),
    [],
  );
  const completeGeneration = useCallback(
    (image: GeneratedImage) => dispatch({ type: "COMPLETE_GENERATION", payload: image }),
    [],
  );
  const failGeneration = useCallback(
    (error: string) => dispatch({ type: "FAIL_GENERATION", payload: error }),
    [],
  );
  const selectImage = useCallback(
    (image: GeneratedImage | null) => dispatch({ type: "SELECT_IMAGE", payload: image }),
    [],
  );
  const removeImage = useCallback(
    (id: string) => dispatch({ type: "REMOVE_IMAGE", payload: id }),
    [],
  );
  const clearHistory = useCallback(
    () => dispatch({ type: "CLEAR_HISTORY" }),
    [],
  );
  const toggleHistory = useCallback(
    () => dispatch({ type: "TOGGLE_HISTORY" }),
    [],
  );
  const toggleQueue = useCallback(
    () => dispatch({ type: "TOGGLE_QUEUE" }),
    [],
  );
  const toggleControls = useCallback(
    () => dispatch({ type: "TOGGLE_CONTROLS" }),
    [],
  );
  const openApiKeyDialog = useCallback(
    () => dispatch({ type: "SET_API_KEY_DIALOG", payload: true }),
    [],
  );
  const closeApiKeyDialog = useCallback(
    () => dispatch({ type: "SET_API_KEY_DIALOG", payload: false }),
    [],
  );
  const openImageViewer = useCallback(
    (image: GeneratedImage) => {
      dispatch({ type: "SELECT_IMAGE", payload: image });
      dispatch({ type: "SET_IMAGE_VIEWER", payload: true });
    },
    [],
  );
  const closeImageViewer = useCallback(
    () => dispatch({ type: "SET_IMAGE_VIEWER", payload: false }),
    [],
  );
  const resetStatus = useCallback(
    () => dispatch({ type: "RESET_STATUS" }),
    [],
  );

  const value: StudioContextValue = {
    state,
    setProvider,
    setPrompt,
    setNegativePrompt,
    setAspectRatio,
    setNumInferenceSteps,
    setSeed,
    setSafetyTolerance,
    setEnableSafetyChecker,
    setEnhancePrompt,
    setPersonGeneration,
    setModel,
    setNumberOfImages,
    setGuidanceScale,
    setDuration,
    setVideoResolution,
    setVideoAspectRatio,
    setGenerateAudio,
    setVideoImageUrl,
    setVideoImageUrl2,
    setUseSelectedImageForVideo,
    setVideoAudioUrl,
    setUseSelectedImageAsVideoReference,
    setVideoShotType,
    startGeneration,
    completeGeneration,
    failGeneration,
    selectImage,
    removeImage,
    clearHistory,
    toggleHistory,
    toggleQueue,
    toggleControls,
    openApiKeyDialog,
    closeApiKeyDialog,
    openImageViewer,
    closeImageViewer,
    resetStatus,
  };

  return <StudioContext value={value}>{children}</StudioContext>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error("useStudio must be used within a <StudioProvider>");
  }
  return ctx;
}
