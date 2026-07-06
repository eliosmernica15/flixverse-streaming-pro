"use client";

import { useState, useCallback } from "react";
import { X, Copy, Share2, Check, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with friends to join your party." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
    }
  }, [roomUrl, toast]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my FlixParty!",
          text: `Watch together on FlixVerse! Join my party with code: ${roomCode}`,
          url: roomUrl,
        });
      } catch {
        // User cancelled share — ignore
      }
    } else {
      handleCopy();
    }
  }, [roomCode, roomUrl, handleCopy]);

  if (!isOpen) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(roomUrl)}`;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">Invite to Party</h2>
              <p className="text-xs text-gray-500">Share this code or scan QR</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Room code */}
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="w-full">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
              Party Code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center text-2xl font-mono font-black tracking-[0.3em] text-white bg-white/5 rounded-xl py-3 border border-white/10">
                {roomCode}
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-xl p-3">
            <img
              src={qrUrl}
              alt={`QR code for party ${roomCode}`}
              width={160}
              height={160}
              className="rounded-lg"
            />
          </div>

          <p className="text-xs text-gray-500 text-center">
            Scan with phone camera to join instantly
          </p>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
