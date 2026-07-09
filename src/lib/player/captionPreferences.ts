export type CaptionSize = "small" | "medium" | "large";
export type CaptionStyle = "boxed" | "outline" | "minimal";

export const CAPTION_SIZE_STORAGE_KEY = "flixverse-caption-size";
export const CAPTION_STYLE_STORAGE_KEY = "flixverse-caption-style";

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
