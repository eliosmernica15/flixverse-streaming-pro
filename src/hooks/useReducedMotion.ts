import { useEffect, useState, useCallback } from "react";

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

/**
 * Hook that provides reduced motion preference along with utility functions
 * for conditionally applying animations.
 */
export function useReducedMotionUtils() {
  const reducedMotion = useReducedMotion();

  const shouldAnimate = useCallback(
    (animation?: boolean) => {
      if (reducedMotion) return false;
      return animation ?? true;
    },
    [reducedMotion]
  );

  const getAnimationProps = useCallback(
    <T extends Record<string, unknown>>(props: T, animatedProps: T): T => {
      return reducedMotion ? props : { ...props, ...animatedProps };
    },
    [reducedMotion]
  );

  return { reducedMotion, shouldAnimate, getAnimationProps };
}

/**
 * CSS class name utility for conditionally applying animation classes
 */
export function useMotionClass() {
  const { reducedMotion } = useReducedMotionUtils();

  return useCallback(
    (base: string, animated: string) => `${base} ${reducedMotion ? "" : animated}`.trim(),
    [reducedMotion]
  );
}
