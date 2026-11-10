"use client";

import Link from "next/link";
import { useEffect } from "react";
import { WifiOff, Home, RefreshCw, Library } from "lucide-react";

export default function OfflinePage() {
  // Auto-recover without a manual refresh: the moment connectivity is back,
  // reload into the live app. The service worker's offline page is only a
  // holding pattern, not a destination.
  useEffect(() => {
    const reload = () => window.location.reload();
    const onOnline = () => reload();
    window.addEventListener("online", onOnline);

    // `navigator.onLine` can report false positives on captive portals, so
    // also probe the origin: if we can reach it, the app can render again.
    const probe = window.setInterval(() => {
      if (!navigator.onLine) return;
      fetch("/", { method: "HEAD", cache: "no-store" })
        .then((res) => {
          if (res.ok) reload();
        })
        .catch(() => {
          /* still offline — keep waiting */
        });
    }, 5000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(probe);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">You&apos;re offline</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Streaming needs internet. This page reconnects automatically — or open your Offline Library to browse cached watchlist titles and posters from your last session.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/offline-library"
            className="btn-primary px-6 py-3 gap-2 inline-flex items-center justify-center"
          >
            <Library className="w-4 h-4" />
            Offline library
          </Link>
          <Link href="/" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
            <Home className="w-4 h-4" />
            Go home
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
