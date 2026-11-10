"use client";

import { Pause, Play } from "lucide-react";

export interface BufferingHudProps {
  visible: boolean;
  message?: string;
  onResume?: () => void;
}

export function BufferingHud({ visible, message, onResume }: BufferingHudProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl px-6 py-5 shadow-2xl shadow-black/40 max-w-sm text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/30">
          <Pause className="w-5 h-5 text-amber-300" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1">Pausing for sync</h3>
        <p className="text-xs text-gray-400 mb-4">{message || "Waiting for everyone to catch up..."}</p>
        {onResume && (
          <button
            onClick={onResume}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Resume Now
          </button>
        )}
      </div>
    </div>
  );
}
