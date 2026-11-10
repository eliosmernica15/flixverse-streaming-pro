/**
 * Real-time screen bloom ("4D ambilight") color source.
 *
 * The movie itself lives inside a cross-origin provider iframe, whose pixels
 * are unreadable by design. This module therefore runs a three-tier
 * strategy, in order of fidelity:
 *
 *   1. **Live sampling** — if a same-origin, CORS-clean `<video>` exists
 *      (self-hosted sources, trailers, the offline player), read frames
 *      through a tiny canvas and emit the actual average color. This is the
 *      real thing: the room genuinely changes color with the scene.
 *
 *   2. **Rhythm simulation** — when only the palette is available, drift the
 *      hue/brightness along a slow, seeded walk keyed to playback position.
 *      It is not "reading the film", but it produces the same perceptual
 *      effect — the bloom breathes with the runtime rather than sitting
 *      static — and it never lies to the user about what it is doing.
 *
 *   3. **Static palette** — paused, hidden tab, or reduced motion: hold the
 *      poster-derived palette at low intensity.
 *
 * All output is throttled to `SAMPLE_HZ` and delivered as a `BloomFrame`.
 * Sampling is synchronous-free: the canvas is 24×14 px, so `getImageData`
 * on it is cheap enough to run at ~8 Hz on a low-end laptop.
 */

export interface BloomColor {
  r: number;
  g: number;
  b: number;
}

export interface BloomFrame {
  /** Dominant color of the frame, already darkened toward cinema ambience. */
  primary: BloomColor;
  /** Secondary color, pulled toward the complement for a two-light setup. */
  secondary: BloomColor;
  /** 0–1 overall luminance of the source, used to drive bloom intensity. */
  luminance: number;
  /** Where the color came from — lets the UI label it honestly. */
  source: "live" | "simulated" | "palette";
}

const SAMPLE_W = 24;
const SAMPLE_H = 14;
const SAMPLE_HZ = 8;
const SAMPLE_INTERVAL_MS = 1000 / SAMPLE_HZ;

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function luminanceOf(c: BloomColor): number {
  // Rec. 709 relative luminance, normalised to 0–1.
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

function mix(a: BloomColor, b: BloomColor, t: number): BloomColor {
  return {
    r: clamp255(a.r + (b.r - a.r) * t),
    g: clamp255(a.g + (b.g - a.g) * t),
    b: clamp255(a.b + (b.b - a.b) * t),
  };
}

function complement(c: BloomColor): BloomColor {
  // Rotate hue by ~150° in RGB space without a full HSL round trip: swap the
  // channels and rebalance toward the original's luminance.
  const l = luminanceOf(c);
  return {
    r: clamp255(c.b * 0.9 + 30),
    g: clamp255(c.r * 0.9 + 30),
    b: clamp255(c.g * 0.9 + 30 + l * 10),
  };
}

/**
 * Tracks one `<video>` element and yields averaged frames.
 * Safe to construct when no video exists — `sample()` returns null.
 */
export class ScreenBloomSampler {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private lastSampleAt = 0;
  private lastFrame: BloomFrame | null = null;
  private failed = false;

  constructor(private readonly video: HTMLVideoElement | null) {}

  /** True when this sampler can actually read pixels. */
  get available(): boolean {
    if (!this.video || this.failed) return false;
    if (this.video.readyState < 2) return false;
    if (this.video.videoWidth === 0 || this.video.videoHeight === 0) return false;
    return true;
  }

  sample(nowMs: number): BloomFrame | null {
    if (!this.available || !this.video) return null;
    if (nowMs - this.lastSampleAt < SAMPLE_INTERVAL_MS) return this.lastFrame;
    this.lastSampleAt = nowMs;

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = SAMPLE_W;
      this.canvas.height = SAMPLE_H;
      // `willReadFrequently` keeps the canvas on a CPU-backed surface, which
      // is much faster for repeated getImageData on small canvases.
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    }
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return null;

    try {
      ctx.drawImage(this.video, 0, 0, SAMPLE_W, SAMPLE_H);
      const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
      this.lastFrame = averageFrame(data);
      return this.lastFrame;
    } catch {
      // Tainted canvas (cross-origin without CORS) — give up permanently so
      // we do not keep throwing every frame.
      this.failed = true;
      return null;
    }
  }
}

function averageFrame(data: Uint8ClampedArray): BloomFrame {
  // Weight the central band more heavily: bloom should read the subject, not
  // the letterbox bars at the top and bottom of a scope-ratio frame.
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;

  for (let y = 0; y < SAMPLE_H; y += 1) {
    const rowWeight = 1 - Math.abs(y / (SAMPLE_H - 1) - 0.5) * 1.2;
    if (rowWeight <= 0) continue;
    for (let x = 0; x < SAMPLE_W; x += 1) {
      const i = (y * SAMPLE_W + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 200) continue;
      // `w` emphasises saturated pixels slightly so a red explosion reads as
      // red rather than being averaged to grey by a bright background.
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const max = Math.max(pr, pg, pb);
      const min = Math.min(pr, pg, pb);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const w = rowWeight * (1 + saturation * 0.8);
      r += pr * w;
      g += pg * w;
      b += pb * w;
      weight += w;
    }
  }

  if (weight === 0) {
    return {
      primary: { r: 20, g: 20, b: 24 },
      secondary: { r: 40, g: 20, b: 30 },
      luminance: 0.08,
      source: "live",
    };
  }

  const primary: BloomColor = {
    r: clamp255(r / weight),
    g: clamp255(g / weight),
    b: clamp255(b / weight),
  };

  return {
    primary,
    secondary: complement(primary),
    luminance: luminanceOf(primary),
    source: "live",
  };
}

/**
 * Synchronous simulated frame for a given playback position and palette.
 * Deterministic: the same (time, palette) always yields the same colors, so
 * a seek does not produce a jarring jump.
 */
export function simulatedFrame(
  playbackSeconds: number,
  palette: BloomColor[]
): BloomFrame {
  const colors = palette.length ? palette : [{ r: 229, g: 9, b: 20 }];
  const t = Math.max(0, playbackSeconds);


  // Two incommensurate slow waves (0.05 Hz and 0.017 Hz) keep the drift from
  // repeating on an obvious cycle — roughly one hue excursion per 20s and a
  // broader brightness move per minute.
  const huePhase = Math.sin(t * 0.31) * 0.5 + 0.5;
  const brightPhase = Math.sin(t * 0.107 + 1.7) * 0.5 + 0.5;

  const idxA = Math.floor(huePhase * colors.length) % colors.length;
  const idxB = (idxA + 1) % colors.length;
  const blend = huePhase * colors.length - Math.floor(huePhase * colors.length);

  const primary = mix(colors[idxA], colors[idxB], blend);
  const secondary = mix(complement(colors[idxA]), colors[(idxA + 2) % colors.length], 0.5);

  // Cinematic night-scene floor: never fully black (the glow would vanish)
  // and never daylight-bright (it would wash out the picture).
  const luminance = 0.18 + brightPhase * 0.24;

  return { primary, secondary, luminance, source: "simulated" };
}
