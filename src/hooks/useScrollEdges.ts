"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

interface ScrollEdges {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

/**
 * Tracks whether a horizontally scrollable container still has content
 * offscreen to the left / right. Pairs with the `.row-shell[data-edge-*]`
 * gradient CSS (globals.css). Rescopes on resize so short rows never show
 * dead fades. Listeners are passive; measurements are rAF-throttled.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = {
      canScrollLeft: el.scrollLeft > 1,
      canScrollRight: el.scrollLeft < max - 1,
    };
    setEdges((prev) =>
      prev.canScrollLeft === next.canScrollLeft && prev.canScrollRight === next.canScrollRight
        ? prev
        : next
    );
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, measure]);

  return edges;
}

export default useScrollEdges;
