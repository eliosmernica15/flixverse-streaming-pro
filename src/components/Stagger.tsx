"use client";

import { isValidElement, type ReactNode } from "react";
import Reveal from "@/components/Reveal";

const MAX_STAGGER_DELAY_MS = 400;
const STEP_MS = 40;

/**
 * Staggered reveal wrapper: fades/slides each child in sequence as the
 * group scrolls into view. Delay = index * 40ms, capped at 400ms so long
 * lists never feel sluggish. Wraps each child in a Reveal — no layout
 * changes, no new theme, purely motion.
 */
export default function Stagger({
  children,
  stepMs = STEP_MS,
  maxDelayMs = MAX_STAGGER_DELAY_MS,
}: {
  children: ReactNode;
  stepMs?: number;
  maxDelayMs?: number;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <>
      {items.map((child, index) => (
        <Reveal
          key={isValidElement(child) && child.key != null ? child.key : index}
          delay={Math.min(index * stepMs, maxDelayMs)}
        >
          {child}
        </Reveal>
      ))}
    </>
  );
}
