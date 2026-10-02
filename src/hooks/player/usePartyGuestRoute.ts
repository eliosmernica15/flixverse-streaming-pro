"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  extractRoomKeyFromHash,
  resolvePartyPlayerUrl,
} from "@/lib/player/roomEncryption";

/**
 * When landing on home (or any page) with ?party=roomId, redirect once to the
 * host's movie/episode player URL. Prevents navigation reload loops via a ref guard.
 */
export function usePartyGuestRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    const partyId = searchParams.get("party");
    if (!partyId || redirectAttempted.current) return;

    redirectAttempted.current = true;
    void (async () => {
      const url = await resolvePartyPlayerUrl(partyId, extractRoomKeyFromHash());
      if (url) {
        router.replace(url);
      }
    })();
  }, [searchParams, router]);
}
