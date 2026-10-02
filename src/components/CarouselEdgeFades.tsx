"use client";

import { useEffect } from "react";
import { useCarousel } from "@/components/ui/carousel";

/**
 * Wires embla's scroll position to the parent `.row-shell`'s
 * `data-edge-left` / `data-edge-right` attributes, activating the
 * edge-fade gradients that already exist in globals.css. Render it
 * once inside any <Carousel> wrapped by a `.row-shell` (MovieCarousel,
 * Top10Row, ContinueWatching).
 */
export default function CarouselEdgeFades() {
  const { api, canScrollPrev, canScrollNext } = useCarousel();

  useEffect(() => {
    if (!api) return;
    const shell = api.rootNode().closest(".row-shell");
    if (!shell) return;

    shell.setAttribute("data-edge-left", canScrollPrev ? "true" : "false");
    shell.setAttribute("data-edge-right", canScrollNext ? "true" : "false");
  }, [api, canScrollPrev, canScrollNext]);

  return null;
}
