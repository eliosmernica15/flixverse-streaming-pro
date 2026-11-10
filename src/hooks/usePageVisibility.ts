"use client";

import { useEffect, useState } from "react";

export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update, { passive: true });
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}
