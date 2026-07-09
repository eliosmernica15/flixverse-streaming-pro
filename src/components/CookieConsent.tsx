"use client";

import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";
import { setConsent, getConsent } from "@/lib/analytics";

const CONSENT_DISMISSED_KEY = "flixverse-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyDismissed = localStorage.getItem(CONSENT_DISMISSED_KEY);
    if (!alreadyDismissed && !getConsent()) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setConsent(true);
    localStorage.setItem(CONSENT_DISMISSED_KEY, "true");
    setVisible(false);
  };

  const handleDecline = () => {
    setConsent(false);
    localStorage.setItem(CONSENT_DISMISSED_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9990] animate-fade-in-up p-4 sm:p-6">
      <div className="glass-strong mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500/15">
              <Cookie className="h-6 w-6 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-bold text-white">Cookie Preferences</h3>
              <p className="text-xs leading-relaxed text-gray-400">
                We use cookies and similar technologies to improve your experience, analyze usage,
                and assist in our marketing efforts. You can accept all cookies or decline
                non-essential ones. Read our{" "}
                <a href="/privacy" className="text-red-400 transition-colors hover:underline focus-ring rounded">
                  Privacy Policy
                </a>{" "}
                for details.
              </p>
            </div>
            <button
              onClick={handleDecline}
              className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/10 focus-ring"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="ml-14 mt-4 flex items-center gap-3">
            <button
              onClick={handleAccept}
              className="btn-primary min-h-[40px] rounded-xl px-5 py-2 text-sm font-semibold focus-ring"
            >
              Accept All
            </button>
            <button
              onClick={handleDecline}
              className="min-h-[40px] rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm text-gray-400 transition-colors hover:text-white focus-ring"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
