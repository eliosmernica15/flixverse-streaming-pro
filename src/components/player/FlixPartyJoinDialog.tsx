"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  PartyPopper,
  ArrowRight,
  Sparkles,
  Users,
  Link2,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import { useToast } from "@/hooks/use-toast";

interface FlixPartyJoinDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FlixPartyJoinDialog({ isOpen, onClose }: FlixPartyJoinDialogProps) {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const { user } = useAuth();
  const { joinRoom } = useFlixParty({ roomId: null });
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) setCode("");
  }, [isOpen]);

  const handleJoin = useCallback(async () => {
    const normalized = code.replace(/\s/g, "").toUpperCase();
    if (normalized.length < 6) {
      toast({
        title: "Enter a 6-character code",
        description: "Ask your friend for the party code shown in their invite screen.",
        variant: "destructive",
      });
      return;
    }
    if (!user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/party/join?code=${normalized}`)}`);
      return;
    }

    setJoining(true);
    try {
      const roomId = await joinRoom(normalized);
      if (!roomId) {
        toast({
          title: "Party not found",
          description: "Double-check the code or ask for a new invite link.",
          variant: "destructive",
        });
        return;
      }
      onClose();
      toast({ title: "Joined party!", description: "Opening the watch room…" });
      router.push(`/?party=${roomId}`);
    } catch (err) {
      toast({
        title: "Could not join",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  }, [code, user, joinRoom, router, onClose, toast]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") void handleJoin();
    },
    [handleJoin]
  );

  if (!isOpen) return null;

  const chars = code.replace(/\s/g, "").toUpperCase().padEnd(6, " ").split("").slice(0, 6);

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-labelledby="join-party-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-[0_0_80px_rgba(239,68,68,0.15)] animate-scale-in"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
        <div className="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-red-500/20 blur-3xl" />

        <div className="relative p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-red-500 via-orange-500 to-pink-600 shadow-lg shadow-red-500/30">
                <PartyPopper className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 id="join-party-title" className="text-lg font-bold text-white">
                  Join Watch Party
                </h2>
                <p className="text-xs text-gray-400">Enter the 6-letter code from your friend</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative space-y-5 px-6 pb-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label htmlFor="party-code-input" className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Party code
            </label>
            <div className="mb-3 flex justify-center gap-2">
              {chars.map((ch, i) => (
                <div
                  key={i}
                  className={`grid h-12 w-10 place-items-center rounded-xl border text-lg font-black font-mono transition-all ${
                    ch.trim()
                      ? "border-red-500/40 bg-red-500/10 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                      : "border-white/10 bg-black/40 text-gray-600"
                  }`}
                >
                  {ch.trim() || "·"}
                </div>
              ))}
            </div>
            <input
              id="party-code-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Type code e.g. BHJ6G5"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-white placeholder:text-gray-600 placeholder:tracking-normal focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={joining || code.replace(/\s/g, "").length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:scale-[1.02] hover:shadow-red-500/40 disabled:opacity-50 disabled:hover:scale-100"
          >
            {joining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {joining ? "Joining…" : "Join party"}
          </button>

          <div className="space-y-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-gray-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              How to get a code
            </p>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" />
                Friend starts a party on any movie → taps <strong className="text-gray-400">Watch Together</strong>
              </li>
              <li className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                They share the code, QR scan, or invite link with you
              </li>
              <li className="flex items-start gap-2">
                <PartyPopper className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                Or accept the invite from your <strong className="text-gray-400">bell icon</strong> notifications
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
