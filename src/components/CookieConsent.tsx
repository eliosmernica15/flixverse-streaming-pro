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
      // Show after a short delay
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
    <div className="fixed bottom-0 left-0 right-0 z-[9990] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-amber-500/15 rounded-xl shrink-0">
              <Cookie className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm mb-1">Cookie Preferences</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                We use cookies and similar technologies to improve your experience, analyze usage,
                and assist in our marketing efforts. You can accept all cookies or decline
                non-essential ones. Read our{" "}
                <a href="/privacy" className="text-red-400 hover:underline">Privacy Policy</a> for details.
              </p>
            </div>
            <button
              onClick={handleDecline}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4 ml-14">
            <button
              onClick={handleAccept}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={handleDecline}
              className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
