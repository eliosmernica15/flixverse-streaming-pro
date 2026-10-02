"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 400);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden"
      style={{ boxShadow: "0 0 12px rgba(239,68,68,0.45)" }}
    >
      <div
        className="route-progress-bar h-full w-1/3"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--gold)) 50%, hsl(var(--primary)) 100%)",
          backgroundSize: "200% 100%",
          animation:
            "route-progress 0.4s ease-out forwards, gradient-shift 1.6s linear infinite",
        }}
      />
    </div>
  );
}
