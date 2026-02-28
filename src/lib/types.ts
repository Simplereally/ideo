export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type GenerationStatus = "idle" | "generating" | "complete" | "error";

export type ImageStyle =
  | "none"
  | "photorealistic"
  | "digital-art"
  | "oil-painting"
  | "watercolor"
  | "sketch"
  | "anime"
  | "cinematic"
  | "3d-render";

export type Provider = "google" | "fal";

export interface GeneratedImage {
  id: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;
  aspectRatio: AspectRatio;
  style: ImageStyle;
  model: string;
  provider: Provider;
  createdAt: number;
  seed?: number;
}

export const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: "1:1", label: "Square", icon: "□" },
  { value: "16:9", label: "Landscape", icon: "▭" },
  { value: "9:16", label: "Portrait", icon: "▯" },
  { value: "4:3", label: "Standard", icon: "▭" },
  { value: "3:4", label: "Tall", icon: "▯" },
];

export const STYLE_PRESETS: { value: ImageStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "photorealistic", label: "Photo" },
  { value: "cinematic", label: "Cinematic" },
  { value: "digital-art", label: "Digital Art" },
  { value: "oil-painting", label: "Oil Painting" },
  { value: "watercolor", label: "Watercolor" },
  { value: "sketch", label: "Sketch" },
  { value: "anime", label: "Anime" },
  { value: "3d-render", label: "3D Render" },
];

export const MODELS: { value: string; label: string; description: string; provider: Provider }[] = [
  { value: "imagen-3.0-generate-002", label: "Imagen 3", description: "Google's highest quality", provider: "google" },
  { value: "imagen-3.0-fast-generate-001", label: "Imagen 3 Fast", description: "Google's fastest", provider: "google" },
  { value: "fal-ai/flux/dev", label: "FLUX.1 [dev]", description: "High quality open model", provider: "fal" },
  { value: "fal-ai/flux-pro", label: "FLUX.1 [pro]", description: "Best quality", provider: "fal" },
  { value: "fal-ai/flux-realism", label: "FLUX.1 Realism", description: "Photorealistic", provider: "fal" },
];
