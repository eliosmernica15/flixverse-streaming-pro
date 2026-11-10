"use client";

import { AlertTriangle, X } from "lucide-react";

interface PlayerErrorFallbackProps {
  onClose: () => void;
}

export function PlayerErrorFallback({ onClose }: PlayerErrorFallbackProps) {
  return (
    <div
      role="alertdialog"
      aria-label="Player error"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
    >
      <div className="glass-panel max-w-md w-full rounded-2xl border border-red-500/30 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-400" aria-hidden />
        <h2 className="mb-1 text-lg font-semibold text-white">Player crashed</h2>
        <p className="mb-5 text-sm text-gray-400">
          Something went wrong while loading the video. You can close the player
          and try again.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-4 w-4" aria-hidden />
          Close player
        </button>
      </div>
    </div>
  );
}
