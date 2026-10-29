"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";

/**
 * Pointer-driven 3D tilt with cursor-tracked specular sheen.
 *
 * Writes CSS custom properties instead of React state so moving the pointer
 * never triggers a re-render — the browser composites the transform on the
 * GPU. Values are smoothed with a damped spring in a single rAF loop that
 * stops as soon as the card settles, so an idle grid of 40 posters costs
 * exactly zero frames.
 *
 * Props written on the element:
 *   --tilt-x / --tilt-y       rotation in degrees (rx / ry)
 *   --tilt-sheen-x / -y       cursor position as 0–100 % for a radial highlight
 *   --tilt-lift               translateZ lift in px
 *   --tilt-active             1 while hovered (drives opacity of the sheen)
 *
 * Disabled entirely for reduced-motion users and for coarse pointers.
 */

export interface Use3DTiltOptions {
  /** Maximum rotation in degrees. */
  max?: number;
  /** Perspective in px. */
  perspective?: number;
  /** Hover lift in px (translateZ). */
  lift?: number;
  /** Scale applied on hover. */
  hoverScale?: number;
  /** Spring stiffness — higher settles faster. */
  stiffness?: number;
  /** Velocity damping — higher is less bouncy. */
  damping?: number;
  /** When false the hook is inert (e.g. card not interactive). */
  enabled?: boolean;
}

interface TiltTarget {
  rx: number;
  ry: number;
  lift: number;
  scale: number;
}

const IDLE: TiltTarget = { rx: 0, ry: 0, lift: 0, scale: 1 };

export function use3DTilt<T extends HTMLElement = HTMLDivElement>(
  options: Use3DTiltOptions = {}
) {
  const {
    max = 7,
    perspective = 900,
    lift = 14,
    hoverScale = 1.02,
    stiffness = 0.16,
    damping = 0.72,
    enabled = true,
  } = options;

  const ref = useRef<T | null>(null);
  const reducedMotion = useReducedMotion();
  const performanceMode = usePerformanceMode();

  // Animation state, kept out of React.
  const targetRef = useRef<TiltTarget>({ ...IDLE });
  const currentRef = useRef<TiltTarget>({ ...IDLE });
  const velocityRef = useRef<TiltTarget>({ rx: 0, ry: 0, lift: 0, scale: 0 });
  const frameRef = useRef(0);
  const activeRef = useRef(false);
  const sheenRef = useRef({ x: 50, y: 50 });

  const supportedRef = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    supportedRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  const writeVars = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const c = currentRef.current;
    node.style.setProperty("--tilt-x", `${c.rx.toFixed(2)}deg`);
    node.style.setProperty("--tilt-y", `${c.ry.toFixed(2)}deg`);
    node.style.setProperty("--tilt-lift", `${c.lift.toFixed(2)}px`);
    node.style.setProperty("--tilt-scale", c.scale.toFixed(4));
    node.style.setProperty("--tilt-sheen-x", `${sheenRef.current.x.toFixed(1)}%`);
    node.style.setProperty("--tilt-sheen-y", `${sheenRef.current.y.toFixed(1)}%`);
    node.style.setProperty("--tilt-perspective", `${perspective}px`);
  }, [perspective]);

  /**
   * Damped spring integration. Runs until the rendered value is within a
   * sub-pixel epsilon of the target, then parks the loop.
   */
  const animate = useCallback(() => {
    frameRef.current = 0;
    const target = targetRef.current;
    const current = currentRef.current;
    const velocity = velocityRef.current;

    let settled = true;

    const step = (key: keyof TiltTarget) => {
      const delta = target[key] - current[key];
      if (Math.abs(delta) < 0.01 && Math.abs(velocity[key]) < 0.01) {
        current[key] = target[key];
        velocity[key] = 0;
        return;
      }
      settled = false;
      velocity[key] = (velocity[key] + delta * stiffness) * damping;
      current[key] += velocity[key];
    };

    step("rx");
    step("ry");
    step("lift");
    step("scale");

    writeVars();

    if (!settled) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      const node = ref.current;
      if (node) {
        if (activeRef.current) {
          node.style.setProperty("--tilt-active", "1");
        } else {
          node.style.setProperty("--tilt-active", "0");
        }
      }
    }
  }, [damping, stiffness, writeVars]);

  const wake = useCallback(() => {
    if (frameRef.current) return;
    if (typeof window === "undefined") return;
    frameRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      if (!enabled || reducedMotion || performanceMode || !supportedRef.current) return;
      if (event.pointerType === "touch") return;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Normalised -1…1 from center.
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;

      targetRef.current = {
        rx: -ny * max,
        ry: nx * max,
        lift: activeRef.current ? lift : lift * 0.4,
        scale: hoverScale,
      };
      sheenRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      };
      activeRef.current = true;
      if (frameRef.current) return;
      // First movement of a hover: write variables immediately so the very
      // first paint has the sheen; the spring takes over after.
      node.style.setProperty("--tilt-active", "1");
      wake();
    },
    [enabled, hoverScale, lift, max, performanceMode, reducedMotion, wake]
  );

  const onPointerLeave = useCallback(() => {
    if (!enabled) return;
    activeRef.current = false;
    targetRef.current = { ...IDLE };
    // Clear the sheen only once it has faded — CSS transitions handle the
    // opacity, so flipping the flag now is correct and cheap.
    const node = ref.current;
    node?.style.setProperty("--tilt-active", "0");
    wake();
  }, [enabled, wake]);

  // Mouse-wheel / scroll can leave a card stuck mid-tilt if the pointer
  // leaves without a pointerleave (window blur, layout shift).
  useEffect(() => {
    if (!enabled) return;
    const reset = () => onPointerLeave();
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, [enabled, onPointerLeave]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return {
    ref,
    onPointerMove,
    onPointerLeave,
    /** True when the effect is actually running for this user/device. */
    enabled:     enabled && !reducedMotion && !performanceMode,
  };
}

export default use3DTilt;
