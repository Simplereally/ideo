/**
 * Shared aspect ratio display helpers.
 *
 * Used by both image and video ratio selectors in the settings sidebar
 * and the prompt composer to ensure consistent labeling and iconography.
 */

const RATIO_LABELS: Record<string, string> = {
  "1:1": "Square",
  "16:9": "Landscape",
  "9:16": "Portrait",
  "4:3": "Standard",
  "3:4": "Tall",
  "3:2": "Landscape",
  "2:3": "Portrait",
  landscape: "Landscape",
  portrait: "Portrait",
};

/**
 * Returns a human-friendly label for any aspect ratio string.
 * Falls back to the raw ratio if unrecognized.
 */
export function ratioLabel(ratio: string): string {
  return RATIO_LABELS[ratio] ?? ratio;
}

export type RatioOrientation = "wide" | "tall" | "square";

/**
 * Determines whether a ratio string represents a wide, tall, or square orientation.
 */
export function ratioOrientation(ratio: string): RatioOrientation {
  if (
    ratio === "16:9" ||
    ratio === "4:3" ||
    ratio === "3:2" ||
    ratio === "landscape"
  ) {
    return "wide";
  }
  if (
    ratio === "9:16" ||
    ratio === "3:4" ||
    ratio === "2:3" ||
    ratio === "portrait"
  ) {
    return "tall";
  }
  return "square";
}
