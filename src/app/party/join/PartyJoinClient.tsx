"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, PartyPopper } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { pythonFetch } from "@/lib/pythonApi/client";
import {
  decryptPayload,
  extractRoomKeyFromHash,
  type PartyPayload,
} from "@/lib/player/roomEncryption";

export default function PartyJoinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState("Preparing your party…");
  const [error, setError] = useState<string | null>(null);
  const { joinRoom, joinRoomById } = useFlixParty({ roomId: null });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace(
        `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`
      );
      return;
    }

    const code = searchParams.get("code");
    const roomId = searchParams.get("id");
    const roomKey = extractRoomKeyFromHash();

    async function join() {
      try {
        let payload: PartyPayload | null = null;
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

        if (roomKey) {
          setStatus("Decrypting party details…");
          let encryptedPayload: string | null = null;
          if (isPythonBackendEnabled()) {
            try {
              const meta = await pythonFetch<{ encryptedPayload: string }>(
                `/parties/${targetRoomId}/public-meta`
              );
              encryptedPayload = meta.encryptedPayload;
            } catch {
              encryptedPayload = null;
            }
          } else {
            const res = await fetch(`/api/party/room?id=${targetRoomId}`);
            if (res.ok) {
              const data = (await res.json()) as { encryptedPayload: string };
              encryptedPayload = data.encryptedPayload;
            }
          }
          if (encryptedPayload) {
            payload = await decryptPayload(encryptedPayload, roomKey);
          }
        }

        if (payload) {
          const qs = new URLSearchParams({ type: payload.mediaType, party: targetRoomId });
          if (payload.season) qs.set("season", String(payload.season));
          if (payload.episode) qs.set("episode", String(payload.episode));
          router.replace(`/movie/${payload.tmdbId}?${qs}`);
        } else {
          router.replace(`/?party=${targetRoomId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join party");
      }
    }

    void join();
  }, [authLoading, user, searchParams, joinRoom, joinRoomById, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
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
        </>
      )}
    </div>
  );
}
