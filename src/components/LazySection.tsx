"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface LazySectionProps {
  children: ReactNode;
  /** Placeholder height while off-screen (reduces layout shift) */
  minHeight?: number;
  /** Load content this many px before entering viewport */
  rootMargin?: string;
  className?: string;
  /** Stagger delay index (0-based) for row entrance animation */
  staggerIndex?: number;
}

export default function LazySection({
  children,
  minHeight = 320,
  rootMargin = "280px",
  className,
  staggerIndex = 0,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  const staggerDelay = reducedMotion ? 0 : staggerIndex * 80;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        minHeight: visible ? undefined : minHeight,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: visible
          ? `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelay}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelay}ms`
          : "none",
      }}
    >
      {visible ? children : null}
    </div>
  );
}
