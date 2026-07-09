export type CaptionSize = "small" | "medium" | "large";
export type CaptionStyle = "boxed" | "outline" | "minimal";
export type CaptionPosition = "bottom" | "top";

export const CAPTION_SIZE_STORAGE_KEY = "flixverse-caption-size";
export const CAPTION_STYLE_STORAGE_KEY = "flixverse-caption-style";
export const CAPTION_POSITION_STORAGE_KEY = "flixverse-caption-position";

export const CAPTION_SIZES: { value: CaptionSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: "boxed", label: "Boxed" },
  { value: "outline", label: "Outline" },
  { value: "minimal", label: "Minimal" },
];

export const CAPTION_POSITIONS: { value: CaptionPosition; label: string }[] = [
  { value: "bottom", label: "Bottom" },
  { value: "top", label: "Top" },
];

export function loadCaptionSize(): CaptionSize {
  if (typeof window === "undefined") return "medium";
  const saved = localStorage.getItem(CAPTION_SIZE_STORAGE_KEY);
  return CAPTION_SIZES.some((s) => s.value === saved) ? (saved as CaptionSize) : "medium";
}

export function loadCaptionStyle(): CaptionStyle {
  if (typeof window === "undefined") return "boxed";
  const saved = localStorage.getItem(CAPTION_STYLE_STORAGE_KEY);
  return CAPTION_STYLES.some((s) => s.value === saved) ? (saved as CaptionStyle) : "boxed";
}

export function loadCaptionPosition(): CaptionPosition {
  if (typeof window === "undefined") return "bottom";
  const saved = localStorage.getItem(CAPTION_POSITION_STORAGE_KEY);
  return CAPTION_POSITIONS.some((p) => p.value === saved) ? (saved as CaptionPosition) : "bottom";
}
