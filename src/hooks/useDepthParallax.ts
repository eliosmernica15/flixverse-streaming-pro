"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";

/**
 * Pointer-driven depth parallax for layered scenes.
 *
 * Writes three CSS custom properties on the host element:
 *
 *   --depth-x   horizontal pointer offset, −1…1
 *   --depth-y   vertical pointer offset, −1…1
 *   --depth-mag pointer distance from centre, 0…1 (drives optional glow)
 *
 * Child layers then declare their own depth with `translate3d` scaled by
 * these values — near layers move further than far ones, which is what makes
 * a flat composite read as a space with depth.
 *
 * Design constraints, learned from the tilt hook:
 *  - Pointer movement never enters React state; the whole loop is rAF +
 *    style writes, so a 40-card grid or a full hero costs zero re-renders.
 *  - The loop parks as soon as the values settle, so an idle page burns no
 *    frames at all.
 *  - Disabled entirely for reduced-motion users, touch devices, and when the
 *    element is off-screen (an IntersectionObserver gates the listener, so a
 *    hero scrolled past does not keep computing).
 *
 * @param strength  Maximum displacement, in px, at full pointer deflection.
 */
export function useDepthParallax<T extends HTMLElement = HTMLDivElement>(
  strength = 18
) {
  const ref = useRef<T | null>(null);
  const reducedMotion = useReducedMotion();
  const performanceMode = usePerformanceMode();
  const frameRef = useRef(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const visibleRef = useRef(true);

  useEffect(() => {
    if (reducedMotion || performanceMode) return;
    const node = ref.current;
    if (!node) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const write = () => {
      node.style.setProperty("--depth-x", currentRef.current.x.toFixed(4));
      node.style.setProperty("--depth-y", currentRef.current.y.toFixed(4));
      node.style.setProperty(
        "--depth-mag",
        Math.min(1, Math.hypot(currentRef.current.x, currentRef.current.y)).toFixed(4)
      );
      node.style.setProperty("--depth-px", `${strength}px`);
    };

    const step = () => {
      frameRef.current = 0;
      const target = targetRef.current;
      const current = currentRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;

      if (Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) {
        current.x = target.x;
        current.y = target.y;
        write();
        return;
      }

      // Critically-damped-ish ease: fast enough to feel attached to the
      // cursor, slow enough to read as mass rather than a cursor follower.
      current.x += dx * 0.075;
      current.y += dy * 0.075;
      write();
      frameRef.current = requestAnimationFrame(step);
    };

    const wake = () => {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(step);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!visibleRef.current) return;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      targetRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
      wake();
    };

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
      wake();
    };

    node.addEventListener("pointermove", onPointerMove, { passive: true });
    node.addEventListener("pointerleave", onLeave);

    // Stop listening entirely while the scene is off-screen.
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              visibleRef.current = entries.some((entry) => entry.isIntersecting);
              if (!visibleRef.current) onLeave();
            },
            { rootMargin: "80px" }
          )
        : null;
    observer?.observe(node);

    write();

    return () => {
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onLeave);
      observer?.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [performanceMode, reducedMotion, strength]);

  return ref;
}

export default useDepthParallax;
