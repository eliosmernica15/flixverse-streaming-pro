"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, PartyPopper, Sparkles, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import {
  extractRoomKeyFromHash,
  resolvePartyPlayerUrl,
} from "@/lib/player/roomEncryption";
import { clearPartyLeftMark } from "@/lib/player/partyUrl";
import { persistGuestJoinSession } from "@/lib/party/guestJoinSession";

const STAGES = [
  { label: "Verifying invite", detail: "Confirming the room key" },
  { label: "Joining party", detail: "Adding you to the guest list" },
  { label: "Resolving content", detail: "Decrypting the watch target" },
  { label: "Syncing playback", detail: "Matching the host's frame" },
] as const;

export default function PartyJoinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { joinRoom, joinRoomById } = useFlixParty({ roomId: null });
  const joinStartedRef = useRef(false);
  const guestMode = searchParams.get("guest") === "1";

  // Cycle through stages so the user always sees motion, not a frozen screen.
  useEffect(() => {
    if (error) return;
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 900);
    return () => clearInterval(id);
  }, [error]);

  useEffect(() => {
    if (authLoading || joinStartedRef.current) return;

    if (!user) {
      router.replace(
        `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`
      );
      return;
    }

    joinStartedRef.current = true;
    setStage(0);

    const code = searchParams.get("code");
    const roomId = searchParams.get("id");
    const roomKey = extractRoomKeyFromHash();

    async function join() {
      try {
        let targetRoomId = roomId;

        if (code) {
          setStage(1);
          const joinedId = await joinRoom(code);
          if (!joinedId) {
            setError("Party not found. Check the code and try again.");
            return;
          }
          targetRoomId = joinedId;
        } else if (targetRoomId) {
          setStage(1);
          const joined = await joinRoomById(targetRoomId);
          if (!joined) {
            setError("Party not found or has ended.");
            return;
          }
        }

        if (!targetRoomId) {
          setError("Invalid invite link. Missing party code or room ID.");
          return;
        }

        clearPartyLeftMark(targetRoomId);
        setStage(2);
        const playerUrl = await resolvePartyPlayerUrl(targetRoomId, roomKey);
        setStage(3);
        if (playerUrl) {
          const sep = playerUrl.includes("?") ? "&" : "?";
          const target = `${playerUrl}${sep}guest=1`;
          persistGuestJoinSession({
            roomId: targetRoomId,
            targetPath: target,
            startedAt: Date.now(),
          });
          window.location.replace(target);
        } else {
          window.location.replace(`/?party=${targetRoomId}&guest=1`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join party");
      }
    }

    void join();
  }, [authLoading, user, searchParams, joinRoom, joinRoomById, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center gap-8 p-6 relative overflow-hidden">
      {/* Ambient cinematic glow */}
      <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-2xl shadow-red-500/40 mb-6">
          <PartyPopper className="w-8 h-8 text-white" />
        </div>

        {error ? (
          <div className="space-y-4 animate-fade-in">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-red-500/15 mx-auto">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Couldn't join the party</h1>
            <p className="text-sm text-gray-400">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-white/85 focus-ring"
            >
              Go home
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black tracking-tight text-white mb-1">
              Joining the party…
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              {guestMode ? "Syncing with the host before playback starts" : "Setting up your watch room"}
            </p>

            <ol className="w-full space-y-2.5 text-left mb-8">
              {STAGES.map((s, i) => {
                const isDone = i < stage;
                const isCurrent = i === stage;
                return (
                  <li
                    key={s.label}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition-all duration-300 ${
                      isCurrent
                        ? "border-red-500/40 bg-red-500/8"
                        : isDone
                          ? "border-emerald-500/30 bg-emerald-500/8"
                          : "border-white/8 bg-white/3"
                    }`}
                  >
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full">
                      {isDone ? (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20">
                          <svg viewBox="0 0 16 16" className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8.5l3 3 7-7" />
                          </svg>
                        </span>
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 text-red-400 animate-spin" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-white/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isCurrent || isDone ? "text-white" : "text-gray-500"}`}>
                        {s.label}
                      </p>
                      <p className="text-[11px] text-gray-500">{s.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Self-hosted sync · no third-party required
            </div>
          </>
        )}
      </div>
    </div>
  );
}
