/**
 * Cinematic environment synthesis.
 *
 * The app needs an immersive, title-aware backdrop — a lobby that takes on
 * the colour and mood of whatever is playing — without shipping a WebGL
 * engine, a GLTF asset bundle, or a runtime dependency on three.js.
 *
 * Everything here is therefore *generated*: a deterministic scene description
 * that a CSS 3D renderer consumes. Deterministic matters — the same title
 * always produces the same room, so moving between pages does not reshuffle
 * the architecture, and React can key nodes on stable ids.
 *
 * What the description contains:
 *
 *  - **Palette** — primary/accent/haze colours derived from the poster
 *    palette, converted to perceptual HSL so we can build tonal ramps
 *    (floors are darker, highlights are lighter) instead of just tinting.
 *  - **Mood** — a coarse classification (noir, fire, sea, neon, earth) that
 *    selects the light temperature, particle behaviour and vignette.
 *  - **Particles** — a seeded distribution of floating motes with per-mote
 *    depth, drift vector and phase. Depth drives both parallax and blur, so
 *    the field reads as volumetric rather than as a flat texture.
 *  - **Geometry** — the vanishing-point offset and wall angles for the
 *    pseudo-3D room, so the frame converges on the player.
 *
 * All of it is cheap: the renderer positions elements once with transforms
 * derived from these numbers and animates a handful of CSS keyframes. There
 * is no per-frame JavaScript in the background layer.
 */

import type { RGBColor } from "./extractDominantColors";

export type SceneMood = "noir" | "fire" | "sea" | "neon" | "earth" | "mono";

export interface HSL {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

export interface SceneParticle {
  /** Horizontal position, 0–100 % of the stage. */
  x: number;
  /** Vertical position, 0–100 % of the stage. */
  y: number;
  /** 0 = far (dim, blurred, slow), 1 = near (bright, crisp, fast). */
  depth: number;
  /** Pixel diameter at depth 1. */
  size: number;
  /** Seconds for one full drift cycle. */
  duration: number;
  /** Negative delay so the field starts pre-populated, not all at once. */
  delay: number;
  /** Drift amplitude in px. */
  driftX: number;
  driftY: number;
  /** Opacity multiplier 0–1. */
  opacity: number;
}

export interface CinemaEnvironment {
  mood: SceneMood;
  seed: number;
  primary: HSL;
  accent: HSL;
  /** Deepest background tone; walls and floor are built from this. */
  base: HSL;
  /** Brightest highlight used for rim light and motes. */
  glow: HSL;
  /** CSS colour strings, pre-rendered so the component does no string work. */
  colors: {
    primary: string;
    accent: string;
    base: string;
    glow: string;
    primarySoft: string;
    accentSoft: string;
    floor: string;
    ceiling: string;
  };
  /** Vanishing-point offset as a percentage of viewport width (−8…8). */
  vanishing: number;
  /** Rotation of the left/right wall planes, in degrees. */
  wallAngle: number;
  particles: SceneParticle[];
  /** 0–1: how strongly the scene should be vignetted (noir is heaviest). */
  vignette: number;
  /** 0–1: animation intensity, scaled down for reduced-motion users. */
  energy: number;
}

// ── Colour helpers ────────────────────────────────────────────────────

export function rgbToHsl({ r, g, b }: RGBColor): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta > 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / delta + 2) * 60;
        break;
      default:
        h = ((rn - gn) / delta + 4) * 60;
        break;
    }
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hsl({ h, s, l }: HSL): string {
  return `hsl(${h} ${s}% ${l}%)`;
}

function withLightness(color: HSL, l: number): HSL {
  return { h: color.h, s: color.s, l: Math.max(0, Math.min(100, l)) };
}

function rotateHue(color: HSL, degrees: number): HSL {
  return { ...color, h: (color.h + degrees + 360) % 360 };
}

/**
 * A tiny deterministic PRNG (mulberry32). Seeded from the title so the same
 * film always produces the same room.
 */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashToSeed(input: string | number): number {
  const text = String(input);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ── Mood classification ───────────────────────────────────────────────

/**
 * Classify a palette into one of six moods. Genre is a stronger signal than
 * colour for "what does this feel like", so it is checked first and colour is
 * the fallback (a poster can be any hue, but a horror film is horror).
 */
export function classifyMood(genreIds: number[] | undefined, primary: HSL): SceneMood {
  const genre = genreIds ?? [];
  if (genre.includes(27) || genre.includes(53) || genre.includes(80)) return "noir";
  if (genre.includes(28) || genre.includes(10752) || genre.includes(37)) return "fire";
  if (genre.includes(878) || genre.includes(12) || genre.includes(16)) return "sea";
  if (genre.includes(10749) || genre.includes(10402) || genre.includes(14)) return "neon";
  if (genre.includes(36) || genre.includes(99)) return "earth";

  // Colour fallback: hue bands roughly matching their perceptual temperature.
  const h = primary.h;
  if (primary.s < 12) return "mono";
  if (h >= 210 && h <= 265) return "sea";
  if (h >= 280 || h < 20) return "neon";
  if (h >= 20 && h < 60) return "earth";
  if (h >= 265 && h < 280) return "neon";
  if (h >= 60 && h < 160) return "earth";
  return "noir";
}

const MOOD_TUNING: Record<
  SceneMood,
  { accentShift: number; saturation: number; vignette: number; energy: number; particleCount: number }
> = {
  noir: { accentShift: 210, saturation: 0.45, vignette: 0.9, energy: 0.55, particleCount: 28 },
  fire: { accentShift: -28, saturation: 1.15, vignette: 0.7, energy: 1, particleCount: 42 },
  sea: { accentShift: 45, saturation: 0.95, vignette: 0.6, energy: 0.85, particleCount: 38 },
  neon: { accentShift: 120, saturation: 1.25, vignette: 0.55, energy: 1.15, particleCount: 46 },
  earth: { accentShift: -18, saturation: 0.7, vignette: 0.75, energy: 0.6, particleCount: 30 },
  mono: { accentShift: 0, saturation: 0.25, vignette: 0.85, energy: 0.5, particleCount: 22 },
};

// ── Scene synthesis ───────────────────────────────────────────────────

export interface BuildEnvironmentInput {
  /** Stable identity for the seed (title, tmdb id, …). */
  seedKey: string | number;
  palette: RGBColor[];
  genreIds?: number[];
  reducedMotion?: boolean;
  /** Viewport class — phones get fewer particles. */
  compact?: boolean;
}

export function buildCinemaEnvironment({
  seedKey,
  palette,
  genreIds,
  reducedMotion = false,
  compact = false,
}: BuildEnvironmentInput): CinemaEnvironment {
  const seed = hashToSeed(seedKey);
  const random = makeRandom(seed);

  const fallback: RGBColor = { r: 229, g: 9, b: 20 };
  const source = palette.length > 0 ? palette : [fallback];

  const primaryHsl = rgbToHsl(source[0] ?? fallback);
  const accentHsl = rgbToHsl(source[1] ?? source[0] ?? fallback);
  const mood = classifyMood(genreIds, primaryHsl);
  const tuning = MOOD_TUNING[mood];

  // Normalise the palette toward the mood so a colourful poster in a noir
  // film still reads as noir: saturation is pulled toward the mood's target
  // and the accent is pushed around the colour wheel by the mood's bias.
  const normalise = (color: HSL, bias: number): HSL => ({
    h: color.h,
    s: Math.round(Math.max(6, Math.min(100, color.s * tuning.saturation))),
    l: color.l + bias,
  });

  const primary = withLightness(normalise(primaryHsl, 0), Math.max(38, primaryHsl.l));
  const accent = withLightness(
    rotateHue(normalise(accentHsl, 6), tuning.accentShift),
    Math.max(45, accentHsl.l)
  );
  const base = {
    h: primary.h,
    s: Math.round(primary.s * 0.45),
    l: 6,
  };
  const glow = withLightness(primary, 72);

  // Particles. Depth is squared so most motes sit far back and a few come
  // close — a uniform distribution reads as "snow", which is not what we
  // want; the squared curve reads as dust suspended in projector light.
  const rawCount = compact ? Math.round(tuning.particleCount * 0.45) : tuning.particleCount;
  const particleCount = reducedMotion ? Math.min(10, rawCount) : rawCount;

  const particles: SceneParticle[] = [];
  for (let i = 0; i < particleCount; i += 1) {
    const r = random();
    const depth = r * r;
    particles.push({
      x: Number((random() * 100).toFixed(2)),
      y: Number((random() * 100).toFixed(2)),
      depth: Number(depth.toFixed(3)),
      size: Number((1.5 + depth * 5.5).toFixed(2)),
      duration: Number((14 + (1 - depth) * 26 + random() * 8).toFixed(1)),
      delay: Number((-random() * 30).toFixed(1)),
      driftX: Number(((random() - 0.5) * (14 + depth * 40)).toFixed(1)),
      driftY: Number((-(8 + depth * 46 + random() * 20)).toFixed(1)),
      opacity: Number((0.18 + depth * 0.62).toFixed(3)),
    });
  }

  return {
    mood,
    seed,
    primary,
    accent,
    base,
    glow,
    colors: {
      primary: hsl(primary),
      accent: hsl(accent),
      base: hsl(base),
      glow: hsl(glow),
      primarySoft: `hsl(${primary.h} ${Math.round(primary.s * 0.8)}% ${Math.round(primary.l * 0.55)}%)`,
      accentSoft: `hsl(${accent.h} ${Math.round(accent.s * 0.75)}% ${Math.round(accent.l * 0.45)}%)`,
      floor: `linear-gradient(180deg, hsl(${base.h} ${base.s}% 3%) 0%, hsl(${primary.h} ${Math.round(
        primary.s * 0.5
      )}% 7%) 100%)`,
      ceiling: `linear-gradient(180deg, hsl(${accent.h} ${Math.round(
        accent.s * 0.4
      )}% 9%) 0%, transparent 100%)`,
    },
    // Slight off-centre vanishing point makes the room feel photographed
    // rather than drawn. Bounded so the player stays the focal point.
    vanishing: Number(((random() - 0.5) * 12).toFixed(2)),
    wallAngle: Number((28 + random() * 8).toFixed(1)),
    particles,
    vignette: tuning.vignette,
    energy: reducedMotion ? 0.25 : tuning.energy,
  };
}
