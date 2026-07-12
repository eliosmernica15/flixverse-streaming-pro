"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, PartyPopper } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import {
  extractRoomKeyFromHash,
  resolvePartyPlayerUrl,
} from "@/lib/player/roomEncryption";
import { clearPartyLeftMark } from "@/lib/player/partyUrl";
import { persistGuestJoinSession } from "@/lib/party/guestJoinSession";

export default function PartyJoinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState("Preparing your party…");
  const [error, setError] = useState<string | null>(null);
  const { joinRoom, joinRoomById } = useFlixParty({ roomId: null });
  const joinStartedRef = useRef(false);
  const guestMode = searchParams.get("guest") === "1";

  useEffect(() => {
    if (authLoading || joinStartedRef.current) return;

    if (!user) {
      router.replace(
        `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`
      );
      return;
    }

    joinStartedRef.current = true;

    const code = searchParams.get("code");
    const roomId = searchParams.get("id");
    const roomKey = extractRoomKeyFromHash();

    async function join() {
      try {
        let targetRoomId = roomId;

        if (code) {
          setStatus("Joining party…");
          const joinedId = await joinRoom(code);
          if (!joinedId) {
            setError("Party not found. Check the code and try again.");
            return;
          }
          targetRoomId = joinedId;
        } else if (targetRoomId) {
          setStatus("Joining party…");
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
        setStatus("Loading watch room…");
        const playerUrl = await resolvePartyPlayerUrl(targetRoomId, roomKey);
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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
        <PartyPopper className="w-7 h-7 text-white" />
      </div>
      {error ? (
        <>
          <p className="text-red-400 text-sm text-center max-w-sm">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="btn-primary px-6 py-2 rounded-xl text-sm font-semibold"
          >
            Go home
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
          <p className="text-gray-400 text-sm">{status}</p>
          {guestMode && (
            <p className="text-gray-500 text-xs text-center max-w-xs">
              Syncing with the host before playback starts…
            </p>
          )}
        </>
      )}
    </div>
  );
}
