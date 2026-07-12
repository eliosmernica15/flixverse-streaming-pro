"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Copy, Share2, Check, QrCode, Link2, Users, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateQrDataUrl } from "@/lib/generateQrDataUrl";

interface FlixPartyInviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomUrl: string;
}

export function FlixPartyInviteDialog({
  isOpen,
  onClose,
  roomCode,
  roomUrl,
}: FlixPartyInviteDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  const displayCode = roomCode.replace(/\s/g, "").toUpperCase();
  const codeChars = displayCode.split("");

  useEffect(() => {
    if (!isOpen || !roomUrl) return;
    setQrDataUrl(null);
    setQrError(false);
    void generateQrDataUrl(roomUrl, 220)
      .then(setQrDataUrl)
      .catch(() => setQrError(true));
  }, [isOpen, roomUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Send it to friends so they can join instantly." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
    }
  }, [roomUrl, toast]);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopiedCode(true);
      toast({ title: "Code copied!", description: "Friends can enter this in the navbar → Join Party." });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [displayCode, toast]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my FlixParty!",
          text: `Watch together on FlixVerse! Party code: ${displayCode}`,
          url: roomUrl,
        });
      } catch {
        /* cancelled */
      }
    } else {
      void handleCopyLink();
    }
  }, [displayCode, roomUrl, handleCopyLink]);

  if (!isOpen) return null;

  return (
    <div className="party-invite-dialog" role="dialog" aria-modal="true" aria-label="Invite to party">
      <div className="party-invite-dialog-backdrop" onClick={onClose} aria-hidden />
      <div className="party-invite-dialog-panel">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent" />
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-red-500/15 blur-3xl" />

        <div className="relative border-b border-white/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/30">
                <QrCode className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Invite to Party</h2>
                <p className="text-xs text-gray-400">Share code, QR, or link</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative space-y-5 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                Party code
              </span>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                {copiedCode ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                {copiedCode ? "Copied" : "Copy code"}
              </button>
            </div>
            <div className="flex justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-4">
              {codeChars.map((ch, i) => (
                <span
                  key={i}
                  className="grid h-11 w-9 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 font-mono text-xl font-black text-white shadow-[0_0_16px_rgba(239,68,68,0.15)]"
                >
                  {ch}
                </span>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              Friends enter this in the navbar → <span className="text-gray-300">Join Party</span>
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative rounded-2xl border border-white/15 bg-white p-4 shadow-xl">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for party ${displayCode}`}
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              ) : qrError ? (
                <div className="grid h-[200px] w-[200px] place-items-center rounded-lg bg-gray-100 text-center text-xs text-gray-500">
                  QR unavailable — use code or link
                </div>
              ) : (
                <div className="grid h-[200px] w-[200px] place-items-center rounded-lg bg-gray-50">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                </div>
              )}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-red-500/20 via-transparent to-orange-500/20 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-500">Scan with your phone camera to open the join link</p>
          </div>

          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <Users className="h-3 w-3" /> Quick invite
            </p>
            <p className="truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-[10px] text-gray-400">
              {roomUrl}
            </p>
          </div>
        </div>

        <div className="relative flex gap-2 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02]"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        <div className="party-invite-dialog-footer">
          <p className="party-invite-dialog-note">
            <Sparkles className="h-3 w-3 text-amber-500/70" />
            Invited friends also get a bell notification
          </p>
        </div>
      </div>
    </div>
  );
}
