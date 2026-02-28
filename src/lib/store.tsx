"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  MODELS,
  type AspectRatio,
  type GenerationStatus,
  type GeneratedImage,
  type Provider,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface StudioState {
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
  // Status
  status: GenerationStatus;
  error: string | null;
  // Data
  history: GeneratedImage[];
  selectedImage: GeneratedImage | null;
  // UI toggles
  isHistoryOpen: boolean;
  isControlsOpen: boolean;
  isApiKeyDialogOpen: boolean;
  isImageViewerOpen: boolean;
}

const initialState: StudioState = {
  provider: "google",
  prompt: "",
  negativePrompt: "",
  aspectRatio: "1:1",
  model: MODELS[0].value,
  numberOfImages: 1,
  guidanceScale: 3.5,
  numInferenceSteps: 28,
  seed: "",
  safetyTolerance: 2,
  enableSafetyChecker: true,
  status: "idle",
  error: null,
  history: [],
  selectedImage: null,
  isHistoryOpen: false,
  isControlsOpen: false,
  isApiKeyDialogOpen: false,
  isImageViewerOpen: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type StudioAction =
  | { type: "SET_PROMPT"; payload: string }
  | { type: "SET_NEGATIVE_PROMPT"; payload: string }
  | { type: "SET_ASPECT_RATIO"; payload: AspectRatio }
  | { type: "SET_NUM_INFERENCE_STEPS"; payload: number }
  | { type: "SET_SEED"; payload: string }
  | { type: "SET_SAFETY_TOLERANCE"; payload: number }
  | { type: "SET_ENABLE_SAFETY_CHECKER"; payload: boolean }
  | { type: "SET_MODEL"; payload: string }
  | { type: "SET_NUMBER_OF_IMAGES"; payload: number }
  | { type: "SET_GUIDANCE_SCALE"; payload: number }
  | { type: "START_GENERATION" }
  | { type: "COMPLETE_GENERATION"; payload: GeneratedImage }
  | { type: "FAIL_GENERATION"; payload: string }
  | { type: "SELECT_IMAGE"; payload: GeneratedImage | null }
  | { type: "REMOVE_IMAGE"; payload: string }
  | { type: "CLEAR_HISTORY" }
  | { type: "TOGGLE_HISTORY" }
  | { type: "TOGGLE_CONTROLS" }
  | { type: "SET_API_KEY_DIALOG"; payload: boolean }
  | { type: "SET_IMAGE_VIEWER"; payload: boolean }
  | { type: "RESET_STATUS" }
  | { type: "HYDRATE"; payload: { history: GeneratedImage[] } };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "SET_PROMPT":
      return { ...state, prompt: action.payload };
    case "SET_NEGATIVE_PROMPT":
      return { ...state, negativePrompt: action.payload };
    case "SET_ASPECT_RATIO":
      return { ...state, aspectRatio: action.payload };
    case "SET_STYLE":
      return { ...state, style: action.payload };
    case "SET_MODEL": {
      const selectedModel = MODELS.find(m => m.value === action.payload);
      return { 
        ...state, 
        model: action.payload,
        provider: selectedModel ? selectedModel.provider : state.provider
      };
    }
    case "SET_NUMBER_OF_IMAGES":
      return { ...state, numberOfImages: action.payload };
    case "SET_GUIDANCE_SCALE":
      return { ...state, guidanceScale: action.payload };
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
      return { ...state, selectedImage: action.payload };
    case "REMOVE_IMAGE":
      return {
        ...state,
        history: state.history.filter((img) => img.id !== action.payload),
        selectedImage:
          state.selectedImage?.id === action.payload ? null : state.selectedImage,
      };
    case "CLEAR_HISTORY":
      return { ...state, history: [], selectedImage: null };
    case "TOGGLE_HISTORY":
      return { ...state, isHistoryOpen: !state.isHistoryOpen };
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
  setPrompt: (prompt: string) => void;
  setNegativePrompt: (prompt: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setStyle: (style: ImageStyle) => void;
  setModel: (model: string) => void;
  setNumberOfImages: (n: number) => void;
  setGuidanceScale: (scale: number) => void;
  startGeneration: () => void;
  completeGeneration: (image: GeneratedImage) => void;
  failGeneration: (error: string) => void;
  selectImage: (image: GeneratedImage | null) => void;
  removeImage: (id: string) => void;
  clearHistory: () => void;
  toggleHistory: () => void;
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

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("ideo-history");
      dispatch({
        type: "HYDRATE",
        payload: {
          history: storedHistory ? (JSON.parse(storedHistory) as GeneratedImage[]) : [],
        },
      });
    } catch {
      // SSR or localStorage unavailable — ignore
    }
  }, []);

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem("ideo-history", JSON.stringify(state.history));
    } catch {
      // ignore
    }
  }, [state.history]);

  // ---- Action creators (stable refs via useCallback) ----

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
  const setStyle = useCallback(
    (style: ImageStyle) => dispatch({ type: "SET_STYLE", payload: style }),
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
    setPrompt,
    setNegativePrompt,
    setAspectRatio,
    setStyle,
    setModel,
    setNumberOfImages,
    setGuidanceScale,
    startGeneration,
    completeGeneration,
    failGeneration,
    selectImage,
    removeImage,
    clearHistory,
    toggleHistory,
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