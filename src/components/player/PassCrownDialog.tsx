"use client";

import { Crown, ArrowRightCircle } from "lucide-react";

interface PassCrownDialogProps {
  open: boolean;
  participants: { userId: string; displayName: string; avatarUrl?: string | null }[];
  currentHostId: string;
  onSelect: (userId: string) => void;
  onCancel: () => void;
}

export function PassCrownDialog({ open, participants, currentHostId, onSelect, onCancel }: PassCrownDialogProps) {
  if (!open) return null;

  const guests = participants.filter((p) => p.userId !== currentHostId);

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Pass the Crown">
      <div className="relative max-w-sm w-full rounded-2xl bg-zinc-950 border border-amber-500/20 shadow-2xl p-5 space-y-4 animate-slide-in-bottom">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-bold text-white leading-tight">Pass the Crown</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Delegate host authority. The new host will control playback, sync, and room settings.
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
          {guests.map((guest) => (
            <button
              key={guest.userId}
              onClick={() => onSelect(guest.userId)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/25 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0 ring-1 ring-white/10">
                <span className="text-[10px] font-extrabold text-white">{guest.displayName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="flex-1 text-sm text-gray-200 font-medium truncate">{guest.displayName}</span>
              <ArrowRightCircle className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
          {guests.length === 0 && (
            <p className="text-xs text-gray-600 px-1 py-2">No other guests to delegate to.</p>
          )}
        </div>
        <button
          onClick={onCancel}
          className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
