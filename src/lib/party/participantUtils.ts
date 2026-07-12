import type { FlixPartyParticipant } from "@/hooks/player/useFlixParty";

/** One row per user — role derived from room hostId (never trust stale role field). */
export function dedupeRoomParticipants(
  participants: FlixPartyParticipant[],
  hostId: string | null | undefined
): FlixPartyParticipant[] {
  if (!participants.length) return [];
  const byUser = new Map<string, FlixPartyParticipant>();

  for (const p of participants) {
    const role: FlixPartyParticipant["role"] = p.userId === hostId ? "host" : "guest";
    const normalized = { ...p, role };
    const prev = byUser.get(p.userId);
    if (!prev || (p.lastSeenAt ?? 0) >= (prev.lastSeenAt ?? 0)) {
      byUser.set(p.userId, normalized);
    }
  }

  return [...byUser.values()].sort((a, b) => (a.lastSeenAt ?? 0) - (b.lastSeenAt ?? 0));
}

export function isRoomHost(userId: string, hostId: string | null | undefined): boolean {
  return !!hostId && userId === hostId;
}
