"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="glass-strong glow-hover press-effect fixed bottom-6 right-6 z-40 grid h-12 w-12 animate-fade-in-up place-items-center rounded-full border border-white/10 text-white shadow-xl shadow-black/40 transition-colors hover:bg-red-500/20 hover:border-red-500/30 focus-ring"
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
