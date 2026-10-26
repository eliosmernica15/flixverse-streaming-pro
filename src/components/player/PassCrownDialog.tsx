"use client";

import { useEffect, useRef } from "react";
import { Crown, ArrowRightCircle, Loader2 } from "lucide-react";
import Image from "next/image";

interface PassCrownDialogProps {
  open: boolean;
  participants: { userId: string; displayName: string; avatarUrl?: string | null }[];
  currentHostId: string;
  /** True while the transfer write is in flight â€” locks the choices. */
  busy?: boolean;
  onSelect: (userId: string) => void;
  onCancel: () => void;
}

/**
 * Pass the Crown â€” host picks a guest to inherit playback authority.
 * Escape / backdrop click cancel; choices lock while the write is in flight
 * so a double-tap cannot fire two transfers.
 */
export function PassCrownDialog({
  open,
  participants,
  currentHostId,
  busy = false,
  onSelect,
  onCancel,
}: PassCrownDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const guests = participants.filter((p) => p.userId !== currentHostId);

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pass-crown-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="relative max-w-sm w-full rounded-2xl bg-zinc-950 border border-amber-500/20 shadow-2xl p-5 space-y-4 animate-slide-in-bottom">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Crown className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <h3 id="pass-crown-title" className="text-base font-bold text-white leading-tight">
            Pass the Crown
          </h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Hand over host controls. The new host drives playback, sync and room settings; you stay in
          the party as a guest.
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
          {guests.map((guest) => (
            <button
              key={guest.userId}
              type="button"
              disabled={busy}
              onClick={() => onSelect(guest.userId)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/25 transition-all text-left group disabled:opacity-50 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0 ring-1 ring-white/10">
                {guest.avatarUrl ? (
                  <Image
                    src={guest.avatarUrl}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-[10px] font-extrabold text-white">
                    {guest.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="flex-1 text-sm text-gray-200 font-medium truncate">{guest.displayName}</span>
              <ArrowRightCircle
                className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shrink-0"
                aria-hidden="true"
              />
            </button>
          ))}
          {guests.length === 0 && (
            <p className="text-xs text-gray-600 px-1 py-2">No other guests to delegate to.</p>
          )}
        </div>
        <button
          ref={cancelRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors disabled:opacity-60"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
          {busy ? "Passing crownâ€¦" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
