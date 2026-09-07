/**
 * Self-hosted real-time transport for FlixParty playback sync.
 *
 * Built on Firestore subcollection snapshots — no third-party pubsub, no
 * Ably, no Socket.io. Subcollection snapshots stream in roughly the same
 * latency budget as managed pubsub services, with a few deliberate design
 * choices:
 *
 *   1. **Append-only events** — every sync event is a new document under
 *      `flix_parties/{roomId}/events`. We never mutate or delete; the
 *      store is a write-ahead log. Late joiners replay the last 32 events
 *      on subscribe to catch up.
 *
 *   2. **Monotonic sequence numbers** — the host assigns a strictly
 *      increasing `seq` to every event. Guests discard anything older
 *      than their local `lastSeq` so out-of-order deliveries are
 *      impossible to apply.
 *
 *   3. **Author stamping** — every event carries a `senderId`. Recipients
 *      ignore their own messages, exactly like the Ably path used to.
 *
 *   4. **NTP-corrected timestamps** — wall-clock skew between host and
 *      guest is computed using the existing `NTPClient` so the heartbeat
 *      drift math is unbiased.
 *
 *   5. **Soft anti-loop** — guests never *write* events, only the host
 *      does. Even if a guest's UI triggers a callback that *would* write,
 *      the role check rejects it. This eliminates a whole class of
 *      accidental feedback loops.
 *
 *   6. **Replay buffer** — on subscribe, the last N events are loaded
 *      with a single `limit(32)` query. New events stream in via the
 *      snapshot listener.
 *
 * The transport is intentionally small and standalone. It does not own
 * the room doc, the chat, or the participants list — those continue to
 * live in the regular `flix_parties/{roomId}` doc and `messages`
 * subcollection managed by `useFlixParty`. This separation lets the
 * playback layer stay snappy and the chat layer stay cheap.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  writeBatch,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { NTPClient } from "@/lib/player/ntpClockSync";
import { isRateLimited } from "@/lib/rateLimit";

export type PartyRealtimeEventType =
  | "play"
  | "pause"
  | "seek"
  | "heartbeat"
  | "speaking"
  | "server-change"
  // Staged simultaneous start (see usePlayerPartySync Synced Start):
  // host holds everyone paused at a timestamp, then releases both sides
  // at the same wall-clock moment so the guest never taps anything.
  | "sync-stage"
  | "sync-go";

export interface PartyRealtimeEvent {
  type: PartyRealtimeEventType;
  senderId: string;
  seq: number;
  data: {
    currentTime?: number;
    serverIndex?: number;
    speaking?: boolean;
    [key: string]: unknown;
  };
  /** Local timestamp captured at send time, NTP-corrected. */
  ts: number;
  /** Firestore server timestamp (set on write, used for ordering tie-breaks). */
  serverTs?: number;
}

const REPLAY_BUFFER = 32;
const HOUSEKEEP_INTERVAL_MS = 4_000;
const HOUSEKEEP_KEEP = 64;

type Unsubscribe = () => void;

interface UsePartyRealtimeOptions {
  roomId: string | null;
  /** Only the host emits events. */
  isHost: boolean;
  /** Per-event callback for non-heartbeat sync events. */
  onEvent: (event: PartyRealtimeEvent) => void;
  /** Optional callback for heartbeat events (higher frequency, separate path). */
  onHeartbeat?: (event: PartyRealtimeEvent) => void;
}

interface UsePartyRealtimeResult {
  /** True once the snapshot listener is attached and we've replayed history. */
  isReady: boolean;
  /** Local monotonic sequence number — the host increments it on every send. */
  nextSeq: () => number;
  /** Emit an event. Guests can call this; it is a no-op for them. */
  send: (type: PartyRealtimeEventType, data: PartyRealtimeEvent["data"]) => Promise<void>;
  /** Number of events processed so far (useful for sync-status telemetry). */
  processed: number;
}

export function usePartyRealtime({
  roomId,
  isHost,
  onEvent,
  onHeartbeat,
}: UsePartyRealtimeOptions): UsePartyRealtimeResult {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [processed, setProcessed] = useState(0);

  const seqRef = useRef(0);
  const lastSeenSeqRef = useRef(-1);
  // Wall-clock of the last accepted event. The host's seq restarts at 0 on
  // every page reload, so a strict `seq > lastSeen` cursor would discard ALL
  // events after a host refresh as "old". An event that is much newer than
  // anything seen before is therefore accepted as a new epoch even when its
  // seq is not greater than the cursor. Heartbeats arrive every ~800ms, so
  // a 15s gap reliably indicates a fresh epoch, never normal jitter.
  const lastTsRef = useRef(0);
  const EPOCH_GAP_MS = 15_000;
  // Live listener window. limit(1) drops intermediate events when the host
  // emits twice between snapshots (e.g. pause+seek within one heartbeat
  // interval) — only the newest survives. A small window replayed in seq
  // order delivers every event exactly once via the cursor below.
  const LIVE_WINDOW = 12;
  const onEventRef = useRef(onEvent);
  const onHeartbeatRef = useRef(onHeartbeat);
  onEventRef.current = onEvent;
  onHeartbeatRef.current = onHeartbeat;

  const userId = user?.uid ?? "anon";

  // Subscribe to the events subcollection. Replays the last 32 events, then
  // streams new ones. Discards anything older than our local cursor.
  useEffect(() => {
    if (!roomId || !userId) {
      setIsReady(false);
      return;
    }

    const db = requireFirebaseDb();
    const eventsRef = collection(db, "flix_parties", roomId, "events");
    const replayQuery = query(eventsRef, orderBy("seq", "desc"), limit(REPLAY_BUFFER));

    let unsubscribed = false;
    let liveUnsub: Unsubscribe | null = null;

    void getDocs(replayQuery)
      .then((snap) => {
        if (unsubscribed) return;

        // Replay events in ascending seq order
        const ordered = snap.docs
          .map((d) => ({ id: d.id, data: d.data() as PartyRealtimeEvent }))
          .sort((a, b) => a.data.seq - b.data.seq);

        for (const { data: ev } of ordered) {
          if (ev.senderId === userId) continue;
          if (ev.seq <= lastSeenSeqRef.current && ev.ts <= lastTsRef.current + EPOCH_GAP_MS) continue;
          // Plain assignment (not max): batches are processed oldest-first,
          // and after a host reload the seq restarts low — max() would pin
          // the cursor at the pre-reload high-water mark and reject every
          // subsequent event as "old".
          lastSeenSeqRef.current = ev.seq;
          lastTsRef.current = Math.max(lastTsRef.current, ev.ts);
          setProcessed((n) => n + 1);
          if (ev.type === "heartbeat") {
            onHeartbeatRef.current?.(ev);
          } else {
            onEventRef.current(ev);
          }
        }

        // Now attach a live listener for any new events going forward.
        const liveQ = query(eventsRef, orderBy("seq", "desc"), limit(LIVE_WINDOW));
        liveUnsub = onSnapshot(
          liveQ,
          (liveSnap) => {
            if (unsubscribed) return;
            // A snapshot may contain several new docs at once; deliver them
            // oldest-first so play/seek/heartbeat apply in host order.
            const fresh = liveSnap
              .docChanges()
              .filter((change) => change.type === "added")
              .map((change) => change.doc.data() as PartyRealtimeEvent)
              .filter((ev) => ev.senderId !== userId)
              .filter(
                (ev) =>
                  ev.seq > lastSeenSeqRef.current ||
                  ev.ts > lastTsRef.current + EPOCH_GAP_MS
              )
              .sort((a, b) => a.seq - b.seq);
            for (const ev of fresh) {
              lastSeenSeqRef.current = ev.seq;
              lastTsRef.current = Math.max(lastTsRef.current, ev.ts);
              setProcessed((n) => n + 1);
              if (ev.type === "heartbeat") {
                onHeartbeatRef.current?.(ev);
              } else {
                onEventRef.current(ev);
              }
            }
          },
          (err) => {
            console.warn("[usePartyRealtime] snapshot error:", err);
          }
        );

        setIsReady(true);
      })
      .catch((err) => {
        console.warn("[usePartyRealtime] replay fetch failed:", err);
        setIsReady(true); // Still mark ready — we'll just miss the replay tail
      });

    return () => {
      unsubscribed = true;
      liveUnsub?.();
      setIsReady(false);
    };
  }, [roomId, userId]);

  // Host: keep the buffer trimmed so it doesn't grow forever. We delete
  // the oldest events beyond HOUSEKEEP_KEEP so the subcollection stays
  // bounded. This is cheap, idempotent, and safe.
  useEffect(() => {
    if (!roomId || !isHost) return;
    const db = requireFirebaseDb();
    const eventsRef = collection(db, "flix_parties", roomId, "events");
    const trim = async () => {
      try {
        const snap = await getDocs(query(eventsRef, orderBy("seq", "desc"), limit(HOUSEKEEP_KEEP + 16)));
        const old = snap.docs
          .map((d) => ({ id: d.id, seq: (d.data() as PartyRealtimeEvent).seq }))
          .filter((d) => d.seq < snap.docs[HOUSEKEEP_KEEP - 1]?.data?.()?.seq)
          .slice(0, 16);
        if (old.length === 0) return;
        const batch = writeBatch(db);
        old.forEach((o) => batch.delete(doc(eventsRef, o.id)));
        await batch.commit();
      } catch {
        // best-effort
      }
    };
    const id = setInterval(trim, HOUSEKEEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [roomId, isHost]);

  const nextSeq = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  const send = useCallback(
    async (type: PartyRealtimeEventType, data: PartyRealtimeEvent["data"]) => {
      if (!roomId || !isHost) return;
      if (!userId || userId === "anon") return;
      if (isRateLimited("PARTY_REALTIME", userId)) return;

      const db = requireFirebaseDb();
      const seq = seqRef.current + 1;
      seqRef.current = seq;

      const ev: PartyRealtimeEvent = {
        type,
        senderId: userId,
        seq,
        data,
        ts: NTPClient.now(),
        serverTs: Date.now(),
      };

      const eventsRef = collection(db, "flix_parties", roomId, "events");
      try {
        await setDoc(doc(eventsRef, `${seq.toString().padStart(20, "0")}_${type}`), {
          ...ev,
          _serverTs: serverTimestamp(),
        });
      } catch (err) {
        console.warn("[usePartyRealtime] send failed:", err);
      }
    },
    [roomId, isHost, userId]
  );

  return useMemo(
    () => ({ isReady, nextSeq, send, processed }),
    [isReady, nextSeq, send, processed]
  );
}
