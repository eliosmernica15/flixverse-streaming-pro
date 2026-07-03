"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("pwa-install-dismissed") === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setDismissed(true);
  };

  if (dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[90] animate-fade-in-up">
      <div className="glass-premium rounded-2xl p-4 border border-white/10 shadow-2xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">Install FlixVerse</p>
          <p className="text-xs text-gray-400 mt-0.5">Add to your home screen for offline browsing and faster launch.</p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={handleInstall} className="btn-primary text-xs px-4 py-2">
              Install app
            </button>
            <button type="button" onClick={handleDismiss} className="text-xs text-gray-400 hover:text-white px-2">
              Not now
            </button>
          </div>
        </div>
        <button type="button" onClick={handleDismiss} className="p-1 hover:bg-white/10 rounded-lg shrink-0" aria-label="Dismiss">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
