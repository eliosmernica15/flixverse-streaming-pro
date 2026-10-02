export interface CaptionLanguage {
  code: string;
  label: string;
}

/** Subtitle languages supported by the captions API. */
export const CAPTION_LANGUAGES: CaptionLanguage[] = [
  { code: "en", label: "English" },
  { code: "sq", label: "Albanian" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
];

export const CAPTION_LANG_STORAGE_KEY = "flixverse-caption-lang";

export function getCaptionLanguageLabel(code: string): string {
  return CAPTION_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
