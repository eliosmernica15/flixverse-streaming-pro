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
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
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
  | "sync-go"
  // Collaborative controls (F9): a guest requests a playback action; the
  // host applies it and re-broadcasts so everyone converges.
  | "guest-control";

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
const HOUSEKEEP_INTERVAL_MS = 20_000;
const HOUSEKEEP_KEEP = 64;

/**
 * Heartbeats are the only high-frequency traffic on this channel and they do
 * not need durability: a guest that misses one is corrected by the next one
 * 1.5 s later, and a late joiner reads the room doc for its starting
 * position. Persisting them costs one Firestore write per participant per
 * second — enough to exhaust a free-tier quota inside a single film and make
 * every *other* write (chat, presence, signaling) start failing. So the host
 * keeps ONE document for heartbeats and overwrites it in place; only
 * meaningful transport events (play/pause/seek/…) are appended to the log.
 */
const HEARTBEAT_DOC_ID = "heartbeat";

/**
 * Fire-and-forget Sentry breadcrumb for transport anomalies. Loaded lazily
 * so the Sentry chunk is only fetched when something odd actually happens;
 * a no-op when Sentry has no DSN configured.
 */
function reportSyncAnomaly(message: string, data?: Record<string, unknown>) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.addBreadcrumb({ message, level: "warning", data });
    })
    .catch(() => {
      // Sentry unavailable — nothing to do.
    });
}

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

  // `processed` is display-only telemetry (it feeds a badge). Publishing a
  // state update for every heartbeat re-renders the entire player subtree at
  // the heartbeat cadence — the single biggest source of "the party is laggy"
  // reports. The authoritative count lives in a ref; state is refreshed at
  // most twice a second.
  const processedRef = useRef(0);
  const processedPublishAtRef = useRef(0);
  const bumpProcessed = useCallback(() => {
    processedRef.current += 1;
    const now = Date.now();
    if (now - processedPublishAtRef.current < 500) return;
    processedPublishAtRef.current = now;
    setProcessed(processedRef.current);
  }, []);

  const seqRef = useRef(0);
  // Flips true the first time a host send has attempted to seed its local
  // sequence from the persisted room-doc high-water mark.
  const seqSeededRef = useRef(false);
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
          bumpProcessed();
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
            //
            // `modified` matters as much as `added`: heartbeats overwrite a
            // single document, so they only ever arrive as modifications.
            const fresh = liveSnap
              .docChanges()
              .filter((change) => change.type === "added" || change.type === "modified")
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
              bumpProcessed();
              if (ev.type === "heartbeat") {
                onHeartbeatRef.current?.(ev);
              } else {
                onEventRef.current(ev);
              }
            }
          },
          (err) => {
            console.warn("[usePartyRealtime] snapshot error:", err);
            reportSyncAnomaly("party-realtime:snapshot-error", {
              roomId,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        );

        setIsReady(true);
      })
      .catch((err) => {
        console.warn("[usePartyRealtime] replay fetch failed:", err);
        reportSyncAnomaly("party-realtime:replay-failed", {
          roomId,
          message: err instanceof Error ? err.message : String(err),
        });
        setIsReady(true); // Still mark ready — we'll just miss the replay tail
      });

    return () => {
      unsubscribed = true;
      liveUnsub?.();
      setIsReady(false);
    };
  }, [roomId, userId, bumpProcessed]);

  // Host: keep the buffer trimmed so it doesn't grow forever. We delete
  // the oldest events beyond HOUSEKEEP_KEEP so the subcollection stays
  // bounded. This is cheap, idempotent, and safe.
  //
  // Two things matter here: the trim is driven by the *number of events the
  // host has sent* rather than a wall-clock interval (a 20 s timer deleting
  // 16 docs at a time never keeps up with a 1.5 s heartbeat cadence), and it
  // is skipped entirely when the host has sent nothing since the last pass.
  const sentSinceTrimRef = useRef(0);

  useEffect(() => {
    if (!roomId || !isHost) return;
    const db = requireFirebaseDb();
    const eventsRef = collection(db, "flix_parties", roomId, "events");
    const trim = async () => {
      // Nothing new to trim; avoid a read per tick.
      if (sentSinceTrimRef.current === 0) return;
      sentSinceTrimRef.current = 0;
      try {
        const snap = await getDocs(
          query(eventsRef, orderBy("seq", "desc"), limit(HOUSEKEEP_KEEP + 16))
        );
        if (snap.docs.length <= HOUSEKEEP_KEEP) return;
        const old = snap.docs.slice(HOUSEKEEP_KEEP, HOUSEKEEP_KEEP + 16);
        if (old.length === 0) return;
        const batch = writeBatch(db);
        old.forEach((o) => batch.delete(o.ref));
        await batch.commit();
      } catch {
        // best-effort
      }
    };
    const id = setInterval(trim, HOUSEKEEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [roomId, isHost]);

  // Re-seed whenever this client (re)gains the crown: after a Pass the Crown
  // the persisted high-water mark jumps ahead, and a previously-seeded local
  // counter would otherwise emit sequence numbers guests reject as stale.
  useEffect(() => {
    if (isHost) seqSeededRef.current = false;
  }, [isHost, roomId]);

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

      // One-time per session: seed the local sequence from the hostSeq the
      // previous host session persisted on the room doc. Without this, a
      // host reload restarts seq at 0 and relies on the wall-clock epoch
      // gap rule (EPOCH_GAP_MS) to distinguish new events — correct but
      // fragile; a persisted high-water mark makes the ordering strictly
      // monotonic across reloads. Reads/writes for this are one per
      // session plus one per non-heartbeat event (play/pause/seek are
      // rare; heartbeats skip the write on purpose).
      if (!seqSeededRef.current) {
        seqSeededRef.current = true;
        try {
          const roomSnap = await getDoc(doc(db, "flix_parties", roomId));
          const persisted = (
            roomSnap.data() as { hostSeq?: number } | undefined
          )?.hostSeq;
          if (typeof persisted === "number" && persisted > seqRef.current) {
            seqRef.current = persisted;
          }
        } catch {
          // Best effort — the epoch gap rule still covers us.
        }
      }

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

      // Heartbeats overwrite a single well-known document. A listener on the
      // subcollection still sees the change (it is an update, so delivery is
      // via `modified`, not `added`), which the live listener handles below.
      if (type === "heartbeat") {
        try {
          await setDoc(doc(eventsRef, HEARTBEAT_DOC_ID), {
            ...ev,
            _serverTs: serverTimestamp(),
          });
        } catch (err) {
          reportSyncAnomaly("party-realtime:heartbeat-failed", {
            roomId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      try {
        await setDoc(doc(eventsRef, `${seq.toString().padStart(20, "0")}_${type}`), {
          ...ev,
          _serverTs: serverTimestamp(),
        });
        sentSinceTrimRef.current += 1;
        // Persist the high-water mark on ordering-critical events only.
        try {
          await updateDoc(doc(db, "flix_parties", roomId), {
            hostSeq: seq,
            hostSeqAt: ev.ts,
          });
        } catch {
          // Best effort — epoch gap rule still covers us.
        }
      } catch (err) {
        console.warn("[usePartyRealtime] send failed:", err);
        reportSyncAnomaly("party-realtime:send-failed", {
          roomId,
          type,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [roomId, isHost, userId]
  );

  return useMemo(
    () => ({ isReady, nextSeq, send, processed }),
    [isReady, nextSeq, send, processed]
  );
}
