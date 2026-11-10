"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useDominantColors } from "@/hooks/player/useDominantColors";
import {
  buildCinemaEnvironment,
  type CinemaEnvironment,
  type SceneParticle,
} from "@/lib/player/cinemaEnvironment";

/**
 * **The cinema hall.**
 *
 * A generated, palette-aware 3D environment that sits behind the player and
 * takes its colour and mood from the title being watched. Built entirely from
 * DOM + CSS 3D — no WebGL context, no model files, no runtime dependency.
 *
 * Why not three.js: a WebGL canvas behind the player would need its own
 * render loop competing with video decode for the GPU, would cost ~150 KB and
 * a second context (the app already runs Web Audio and WebRTC), and would be
 * impossible to render meaningfully on a low-end phone. CSS 3D transforms are
 * composited by the same engine that already draws the page, stop costing
 * anything when nothing animates, and degrade to a flat gradient under
 * `prefers-reduced-motion`.
 *
 * Structure, back to front:
 *
 *   1. **Void**      — a deep radial wash in the scene's base tone.
 *   2. **Ceiling**   — a soft gradient plane, tilted away from the viewer.
 *   3. **Walls**     — two planes rotated on the Y axis that converge on the
 *                      scene's vanishing point, giving real perspective.
 *   4. **Floor**     — a plane rotated on X with a faint reflective sheen that
 *                      picks up the title's accent.
 *   5. **Projector** — a cone of light from behind the camera toward the
 *                      player, brightest at the title's primary hue.
 *   6. **Motes**     — seeded particles at varying depth; each drifts on its
 *                      own timeline and is blurred by depth, so the field has
 *                      volume rather than reading as a flat starfield.
 *   7. **Vignette**  — mood-dependent darkening at the edges.
 *
 * The whole thing is pointer-reactive: the room leans very slightly toward
 * the cursor (parallax), which is what sells the depth. It writes CSS
 * variables from a rAF loop and never re-renders React for pointer movement.
 */

interface CinemaStageProps {
  /** Stable identity used to seed the generated room. */
  seedKey: string | number;
  posterPath: string | null;
  genreIds?: number[];
  /** Dim the environment while the player is active and playing. */
  isPlaying?: boolean;
  /** Fully hide (used when the user disables ambient effects). */
  enabled?: boolean;
  /** 0–1 master strength. */
  intensity?: number;
  /** Render a lighter scene (mobile / low-power). */
  compact?: boolean;
}

const STORAGE_KEY = "flixverse-cinema-stage";
const POINTER_EASE = 0.06;
const MAX_LEAN_DEG = 2.4;

function particleStyle(particle: SceneParticle): React.CSSProperties {
  // Depth drives the blur and the scale: near motes are larger, sharper and
  // travel further. This is the entire trick behind the volumetric look.
  const blur = (1 - particle.depth) * 2.6;
  return {
    left: `${particle.x}%`,
    top: `${particle.y}%`,
    width: `${particle.size}px`,
    height: `${particle.size}px`,
    opacity: particle.opacity,
    filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
    animationDuration: `${particle.duration}s`,
    animationDelay: `${particle.delay}s`,
    ["--mote-drift-x" as string]: `${particle.driftX}px`,
    ["--mote-drift-y" as string]: `${particle.driftY}px`,
  };
}

export function CinemaStage({
  seedKey,
  posterPath,
  genreIds,
  isPlaying = false,
  enabled = true,
  intensity = 1,
  compact = false,
}: CinemaStageProps) {
  const reducedMotion = useReducedMotion();
  const { colors } = useDominantColors(posterPath, genreIds);
  const [userEnabled, setUserEnabled] = useState(true);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // Persisted opt-out, shared with the rest of the ambient-effects family.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setUserEnabled(stored !== "false");
    } catch {
      // storage unavailable — keep the default
    }
    const onToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (detail && typeof detail.enabled === "boolean") setUserEnabled(detail.enabled);
    };
    window.addEventListener("toggle-cinema-stage", onToggle);
    return () => window.removeEventListener("toggle-cinema-stage", onToggle);
  }, []);

  const active = enabled && userEnabled;

  const environment: CinemaEnvironment = useMemo(
    () =>
      buildCinemaEnvironment({
        seedKey,
        palette: colors,
        genreIds,
        reducedMotion,
        compact,
      }),
    // `colors` is a stable array per poster (memoised by the hook's cache).
    [seedKey, colors, genreIds, reducedMotion, compact]
  );

  // Fade the room in after mount so the first paint is not a flash of flat
  // colour before the poster palette is extracted.
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setReady(true), 60);
    return () => window.clearTimeout(id);
  }, [active]);

  // Pointer parallax. One rAF loop for the whole stage, parked the moment the
  // scene settles — an idle environment costs zero frames.
  useEffect(() => {
    if (!active || reducedMotion) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const stage = stageRef.current;
    if (!stage) return;

    const step = () => {
      frameRef.current = 0;
      const target = targetRef.current;
      const current = currentRef.current;

      const dx = target.x - current.x;
      const dy = target.y - current.y;

      if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) {
        current.x = target.x;
        current.y = target.y;
      } else {
        current.x += dx * POINTER_EASE;
        current.y += dy * POINTER_EASE;
        frameRef.current = requestAnimationFrame(step);
      }

      const leanY = current.x * MAX_LEAN_DEG;
      const leanX = -current.y * MAX_LEAN_DEG;
      stage.style.setProperty("--stage-lean-x", `${leanX.toFixed(3)}deg`);
      stage.style.setProperty("--stage-lean-y", `${leanY.toFixed(3)}deg`);
      stage.style.setProperty("--stage-shift-x", `${(current.x * 26).toFixed(2)}px`);
      stage.style.setProperty("--stage-shift-y", `${(current.y * 18).toFixed(2)}px`);
    };

    const wake = () => {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(step);
    };

    const onPointerMove = (event: PointerEvent) => {
      targetRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      };
      wake();
    };

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
      wake();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [active, reducedMotion]);

  if (!active) return null;

  const strength = Math.max(0, Math.min(1, intensity));
  const dim = isPlaying ? 0.62 : 1;

  const stageStyle = {
    opacity: ready ? 1 : 0,
    ["--stage-primary" as string]: environment.colors.primary,
    ["--stage-accent" as string]: environment.colors.accent,
    ["--stage-base" as string]: environment.colors.base,
    ["--stage-glow" as string]: environment.colors.glow,
    ["--stage-primary-soft" as string]: environment.colors.primarySoft,
    ["--stage-accent-soft" as string]: environment.colors.accentSoft,
    ["--stage-floor" as string]: environment.colors.floor,
    ["--stage-ceiling" as string]: environment.colors.ceiling,
    ["--stage-vanish" as string]: `${environment.vanishing}%`,
    ["--stage-wall-angle" as string]: `${environment.wallAngle}deg`,
    ["--stage-strength" as string]: String(strength * dim),
    ["--stage-energy" as string]: String(environment.energy),
    ["--stage-vignette" as string]: String(environment.vignette),
  } as React.CSSProperties;

  return (
    <div
      ref={stageRef}
      className={`cinema-stage cinema-stage--${environment.mood} ${reducedMotion ? "cinema-stage--static" : ""}`}
      style={stageStyle}
      aria-hidden="true"
    >
      <div className="cinema-stage-void" />
      <div className="cinema-stage-room">
        <div className="cinema-stage-ceiling" />
        <div className="cinema-stage-wall cinema-stage-wall--left" />
        <div className="cinema-stage-wall cinema-stage-wall--right" />
        <div className="cinema-stage-floor">
          <div className="cinema-stage-floor-sheen" />
        </div>
      </div>
      <div className="cinema-stage-projector" />
      <div className="cinema-stage-motes">
        {environment.particles.map((particle, index) => (
          <span
            key={`${environment.seed}-${index}`}
            className="cinema-stage-mote"
            style={particleStyle(particle)}
          />
        ))}
      </div>
      <div className="cinema-stage-vignette" />
      <div className="cinema-stage-grain" />
    </div>
  );
}

/** Persist the stage opt-out and notify mounted instances. */
export function setCinemaStageEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
    window.dispatchEvent(
      new CustomEvent("toggle-cinema-stage", { detail: { enabled: value } })
    );
  } catch {
    // ignore
  }
}

export function isCinemaStageEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export default CinemaStage;
