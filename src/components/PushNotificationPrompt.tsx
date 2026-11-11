"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { registerWebPush } from "@/lib/notifications/webPush";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "flixverse-push-prompt-dismissed";

/**
 * One-time, dismissible offer to enable desktop notifications. The browser
 * permission prompt only fires from a user gesture, so this banner is the
 * gesture — it appears once per device until the user enables or dismisses.
 */
const PushNotificationPrompt = () => {
  const { isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!isAuthenticated) return;
    if (Notification.permission !== "default") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(t);
  }, [isAuthenticated]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!visible || !mounted) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable — don't persist, but don't nag this session either */
    }
  };

  const enable = async () => {
    setEnabling(true);
    try {
      // User gesture: browser shows the Allow/Block prompt; FCM token is
      // registered server-side when granted.
      await registerWebPush();
    } finally {
      dismiss();
    }
  };

  // Portal to <body>: keeps the fixed banner clear of the nav's
  // backdrop-filter containing block and any stacking contexts.
  return createPortal(
    <div
      role="dialog"
      aria-label="Enable notifications"
      className="fixed bottom-4 right-4 z-[60] w-[min(92vw,22rem)] rounded-2xl border border-white/10 bg-gray-950/95 p-4 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-red-600/20 p-2">
          <BellRing className="h-5 w-5 text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Get desktop alerts</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
            Watch party invites, new episodes and friend activity — even when this tab is closed.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={enable}
              disabled={enabling}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
            >
              {enabling ? "Enabling…" : "Enable"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default PushNotificationPrompt;
