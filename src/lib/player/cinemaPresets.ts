/**
 * Cinema environment presets.
 *
 * Maps a film's TMDB genre ids to a mood preset that tunes the 4D cinema
 * layer: bloom intensity, particle density, color temperature, and audio
 * reverb. Auto-detected from the title's genres, with a manual override
 * stored in user preferences (see `CinemaSenseSettings`).
 *
 * Genre ids follow TMDB's canonical list:
 *   28 Action, 12 Adventure, 16 Animation, 35 Comedy, 80 Crime, 99 Documentary,
 *   18 Drama, 10751 Family, 14 Fantasy, 36 History, 27 Horror, 10402 Music,
 *   9648 Mystery, 10749 Romance, 878 Sci-Fi, 10770 TV Movie, 53 Thriller,
 *   10752 War, 37 Western.
 */

export type CinemaMood =
  | "action"
  | "drama"
  | "comedy"
  | "horror"
  | "scifi"
  | "romance"
  | "fantasy"
  | "documentary"
  | "neutral";

export interface CinemaPreset {
  mood: CinemaMood;
  /** Multiplier applied to the user's bloom intensity (0.6–1.4). */
  bloomMultiplier: number;
  /** Particle density multiplier for CinemaStage mote field (0.5–1.6). */
  particleMultiplier: number;
  /** Color temperature shift in K-ish units (-300 warm … +300 cool). */
  temperatureShift: number;
  /** Reverb wet amount for spatial audio (0–0.6). */
  reverbWet: number;
  /** CSS class suffix applied to the player shell for mood theming. */
  cssClass: string;
}

const PRESETS: Record<CinemaMood, CinemaPreset> = {
  action: { mood: "action", bloomMultiplier: 1.25, particleMultiplier: 1.4, temperatureShift: -150, reverbWet: 0.25, cssClass: "mood-action" },
  drama: { mood: "drama", bloomMultiplier: 0.95, particleMultiplier: 0.9, temperatureShift: -50, reverbWet: 0.35, cssClass: "mood-drama" },
  comedy: { mood: "comedy", bloomMultiplier: 1.05, particleMultiplier: 1.0, temperatureShift: 100, reverbWet: 0.15, cssClass: "mood-comedy" },
  horror: { mood: "horror", bloomMultiplier: 0.85, particleMultiplier: 1.6, temperatureShift: -250, reverbWet: 0.5, cssClass: "mood-horror" },
  scifi: { mood: "scifi", bloomMultiplier: 1.15, particleMultiplier: 1.3, temperatureShift: 200, reverbWet: 0.3, cssClass: "mood-scifi" },
  romance: { mood: "romance", bloomMultiplier: 1.0, particleMultiplier: 0.8, temperatureShift: 150, reverbWet: 0.2, cssClass: "mood-romance" },
  fantasy: { mood: "fantasy", bloomMultiplier: 1.2, particleMultiplier: 1.5, temperatureShift: 50, reverbWet: 0.4, cssClass: "mood-fantasy" },
  documentary: { mood: "documentary", bloomMultiplier: 0.9, particleMultiplier: 0.7, temperatureShift: 0, reverbWet: 0.1, cssClass: "mood-documentary" },
  neutral: { mood: "neutral", bloomMultiplier: 1.0, particleMultiplier: 1.0, temperatureShift: 0, reverbWet: 0.2, cssClass: "mood-neutral" },
};

// Priority order: more specific moods win over generic ones.
const GENRE_TO_MOOD: Record<number, CinemaMood> = {
  27: "horror",
  878: "scifi",
  14: "fantasy",
  10749: "romance",
  35: "comedy",
  99: "documentary",
  28: "action",
  53: "action",
  12: "action",
  16: "fantasy",
  18: "drama",
  80: "drama",
  9648: "scifi",
  10752: "action",
  37: "action",
};

// Thriller (53) is folded into the action mood (closest vibe).

export function moodFromGenres(genreIds: number[] | undefined | null): CinemaMood {
  if (!genreIds || genreIds.length === 0) return "neutral";
  // Pick the mood with the highest priority in the list.
  const priority: CinemaMood[] = ["horror", "scifi", "fantasy", "romance", "comedy", "documentary", "action", "drama"];
  const moods = genreIds.map((g) => GENRE_TO_MOOD[g]).filter(Boolean) as CinemaMood[];
  if (moods.length === 0) return "neutral";
  for (const m of priority) {
    if (moods.includes(m)) return m;
  }
  return moods[0];
}

export function presetForMood(mood: CinemaMood): CinemaPreset {
  return PRESETS[mood] ?? PRESETS.neutral;
}

export function presetFromGenres(genreIds: number[] | undefined | null): CinemaPreset {
  return presetForMood(moodFromGenres(genreIds));
}

export const ALL_MOODS: CinemaMood[] = Object.keys(PRESETS) as CinemaMood[];
export const ALL_PRESETS = PRESETS;