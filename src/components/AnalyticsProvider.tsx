"use client";

import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/analytics";

/** Bootstraps analytics when consent was previously granted. */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getConsent()) {
      setConsent(true);
    }
    setReady(true);
  }, []);

  if (!ready) return <>{children}</>;
  return <>{children}</>;
}
