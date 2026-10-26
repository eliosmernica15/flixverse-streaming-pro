import { useState, useCallback, useRef, useEffect } from "react";
import type { FlixPartyParticipant } from "@/hooks/player/useFlixParty";
import {
  createStreamAnalyser,
  getGlobalAudioContext,
  releaseAudioContext,
  retainAudioContext,
} from "@/lib/player/audioSingleton";

export interface PartyMediaParticipant {
  peerId: string;
  displayName: string;
  avatarUrl?: string | null;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  micMutedByHost?: boolean;
}

function dedupeMediaParticipants(list: PartyMediaParticipant[]): PartyMediaParticipant[] {
  const byPeer = new Map<string, PartyMediaParticipant>();
  for (const p of list) {
    const prev = byPeer.get(p.peerId);
    if (!prev) {
      byPeer.set(p.peerId, p);
      continue;
    }
    if (p.isLocal) {
      byPeer.set(p.peerId, { ...prev, ...p, isLocal: true });
      continue;
    }
    if (prev.isLocal) continue;
    if (p.hasVideo || p.hasAudio) byPeer.set(p.peerId, p);
  }
  const locals = [...byPeer.values()].filter((p) => p.isLocal);
  const remotes = [...byPeer.values()].filter((p) => !p.isLocal);
  return [...locals, ...remotes];
}

const SPEAK_THRESHOLD = 0.04;
const SPEAK_HYSTERESIS = 0.025;
const VOICE_VOLUME_KEY = "flixverse-party-voice-volume";
const MOBILE_BREAKPOINT = 768;

function isMobileDevice(): boolean {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Analyser attached to a stream, on the app-wide shared AudioContext.
 *
 * Each instance owns only its `source` node; the context is global and is
 * never closed here. Disposing disconnects the source so the graph can be
 * collected when a stream ends — previously every analyser allocated a
 * whole `AudioContext` and leaked it on camera toggles, exhausting the
 * browser's 6-context budget and crashing the tab.
 */
interface StreamAnalyserHandle {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  /** Reusable gain buffer sized to the analyser. */
  levelBuffer: Uint8Array;
  dispose: () => void;
}

function createAnalyser(stream: MediaStream): StreamAnalyserHandle | null {
  const created = createStreamAnalyser(stream, 512, 0.65);
  if (!created) return null;
  retainAudioContext();
  const { analyser, source } = created;
  let disposed = false;
  return {
    analyser,
    source,
    levelBuffer: new Uint8Array(analyser.frequencyBinCount),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // already detached
      }
      releaseAudioContext();
    },
  };
}

function readLevel(handle: StreamAnalyserHandle): number {
  const data = handle.levelBuffer;
  handle.analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / (data.length * 255);
}

function disposeAnalyser(handle: StreamAnalyserHandle | undefined | null): void {
  handle?.dispose();
}

function loadVoiceVolume(): number {
  if (typeof window === "undefined") return 1;
  try {
    const v = parseFloat(localStorage.getItem(VOICE_VOLUME_KEY) || "1");
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  } catch {
    return 1;
  }
}

interface UsePartyMediaOptions {
  roomId: string | null;
  setLocalStream: (stream: MediaStream | null) => Promise<void>;
  sendSpeakingState?: (speaking: boolean) => void;
  participantNames?: Map<string, string>;
  roomParticipants?: FlixPartyParticipant[];
  localUserId?: string | null;
  localDisplayName?: string;
  hostMicForcedOff?: boolean;
  hostCamForcedOff?: boolean;
}

export function usePartyMedia({
  roomId,
  setLocalStream,
  sendSpeakingState,
  participantNames,
  roomParticipants = [],
  localUserId,
  localDisplayName = "You",
  hostMicForcedOff = false,
  hostCamForcedOff = false,
}: UsePartyMediaOptions) {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [voiceVolume, setVoiceVolumeState] = useState(loadVoiceVolume);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [localStream, setLocalStreamState] = useState<MediaStream | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<StreamAnalyserHandle | null>(null);
  const remoteAnalysersRef = useRef<Map<string, StreamAnalyserHandle>>(new Map());
  const rafRef = useRef<number | null>(null);
  const wasSpeakingRef = useRef(false);
  const micOnRef = useRef(micOn);
  const cameraOnRef = useRef(cameraOn);
  micOnRef.current = micOn;
  cameraOnRef.current = cameraOn;

  const setVoiceVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVoiceVolumeState(clamped);
    try {
      localStorage.setItem(VOICE_VOLUME_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const resumeAnalyser = useCallback(async () => {
    const ctx = getGlobalAudioContext();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const buildLocalStream = useCallback(async (wantMic: boolean, wantCam: boolean) => {
    const effectiveMic = wantMic && !hostMicForcedOff;
    const effectiveCam = wantCam && !hostCamForcedOff;
    const mobile = isMobileDevice();

    if (!effectiveMic && !effectiveCam) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStreamState(null);
      disposeAnalyser(analyserRef.current);
      analyserRef.current = null;
      await setLocalStream(null);
      return;
    }

    const existing = localStreamRef.current;
    const hasAudio = existing?.getAudioTracks().some((t) => t.readyState === "live");
    const hasVideo = existing?.getVideoTracks().some((t) => t.readyState === "live");

    if (existing && hasAudio === effectiveMic && hasVideo === effectiveCam) {
      existing.getAudioTracks().forEach((t) => {
        t.enabled = effectiveMic;
      });
      existing.getVideoTracks().forEach((t) => {
        t.enabled = effectiveCam;
      });
      if (effectiveMic) {
        if (!analyserRef.current) {
          analyserRef.current = createAnalyser(existing);
        }
        await resumeAnalyser();
      } else {
        disposeAnalyser(analyserRef.current);
        analyserRef.current = null;
      }
      await setLocalStream(existing);
      return;
    }

    const audioConstraints = effectiveMic
      ? {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
        }
      : false;

    const videoConstraints = effectiveCam
      ? mobile
        ? {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 },
            facingMode: { ideal: "user" },
          }
        : {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: { ideal: "user" },
          }
      : false;

    const requestMedia = async () =>
      navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

    try {
      let stream: MediaStream;
      try {
        stream = await requestMedia();
      } catch (firstErr) {
        if (!effectiveCam || !mobile) throw firstErr;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: { facingMode: "user" },
        });
      }

      localStreamRef.current?.getTracks().forEach((t) => {
        if (!stream.getTracks().some((nt) => nt.kind === t.kind)) t.stop();
      });
      localStreamRef.current = stream;
      setLocalStreamState(stream);
      setMediaError(null);

      stream.getAudioTracks().forEach((t) => {
        t.enabled = effectiveMic;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = effectiveCam;
      });

      if (effectiveMic && stream.getAudioTracks().length) {
        disposeAnalyser(analyserRef.current);
        analyserRef.current = createAnalyser(stream);
        await resumeAnalyser();
      } else {
        disposeAnalyser(analyserRef.current);
        analyserRef.current = null;
      }

      await setLocalStream(stream);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone/camera access denied";
      setMediaError(msg);
      setMicOn(false);
      setCameraOn(false);
    }
  }, [setLocalStream, hostMicForcedOff, hostCamForcedOff, resumeAnalyser]);

  /**
   * Push-to-talk helper: mute/unmute the mic track without flipping the
   * `micOn` preference. Used by hold-to-talk so the stream is not rebuilt
   * on every key press.
   */
  const setMicLive = useCallback(
    (live: boolean) => {
      if (hostMicForcedOff) return;
      const stream = localStreamRef.current;
      if (!stream?.getAudioTracks().length) return;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = live;
      });
      if (live) {
        if (!analyserRef.current) {
          analyserRef.current = createAnalyser(stream);
        }
        void resumeAnalyser();
      } else {
        wasSpeakingRef.current = false;
        setLocalSpeaking(false);
        sendSpeakingState?.(false);
        disposeAnalyser(analyserRef.current);
        analyserRef.current = null;
      }
      void setLocalStream(stream);
    },
    [hostMicForcedOff, resumeAnalyser, sendSpeakingState, setLocalStream]
  );

  const toggleMic = useCallback(async () => {
    if (hostMicForcedOff) return;
    const next = !micOn;
    setMicOn(next);

    const stream = localStreamRef.current;
    if (stream?.getAudioTracks().length) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
      if (next) {
        if (!analyserRef.current) {
          analyserRef.current = createAnalyser(stream);
        }
        await resumeAnalyser();
      } else {
        wasSpeakingRef.current = false;
        setLocalSpeaking(false);
        sendSpeakingState?.(false);
        // Release the analyser's source node on mute. Leaving it connected
        // kept a Web Audio graph alive per toggle for the whole session.
        disposeAnalyser(analyserRef.current);
        analyserRef.current = null;
      }
      await setLocalStream(stream);
      if (!next && !cameraOn) {
        await buildLocalStream(false, false);
      }
      return;
    }

    await buildLocalStream(next, cameraOn);
  }, [micOn, cameraOn, buildLocalStream, hostMicForcedOff, resumeAnalyser, sendSpeakingState, setLocalStream]);

  const toggleCamera = useCallback(async () => {
    if (hostCamForcedOff) return;
    const next = !cameraOn;
    setCameraOn(next);

    const stream = localStreamRef.current;
    if (stream?.getVideoTracks().length) {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = next;
      });
      await setLocalStream(stream);
      if (!next && !micOn) {
        await buildLocalStream(false, false);
      }
      return;
    }

    await buildLocalStream(micOn, next);
  }, [micOn, cameraOn, buildLocalStream, hostCamForcedOff, setLocalStream]);

  // Host forced mute/cam — apply immediately
  useEffect(() => {
    if (hostMicForcedOff && micOnRef.current) {
      setMicOn(false);
      void buildLocalStream(false, cameraOnRef.current);
    }
  }, [hostMicForcedOff, buildLocalStream]);

  useEffect(() => {
    if (hostCamForcedOff && cameraOnRef.current) {
      setCameraOn(false);
      void buildLocalStream(micOnRef.current, false);
    }
  }, [hostCamForcedOff, buildLocalStream]);

  const onRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
    // Re-register the analyser for every new stream: a peer that retoggles
    // their camera emits a fresh MediaStream and the old source node goes
    // dead. Always dispose the stale handle or sources pile up.
    disposeAnalyser(remoteAnalysersRef.current.get(peerId));
    remoteAnalysersRef.current.delete(peerId);
    if (stream.getAudioTracks().length) {
      const handle = createAnalyser(stream);
      if (handle) remoteAnalysersRef.current.set(peerId, handle);
    }
  }, []);

  const onRemoteStreamRemoved = useCallback((peerId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    setSpeakingPeers((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Set(prev);
      next.delete(peerId);
      return next;
    });
    disposeAnalyser(remoteAnalysersRef.current.get(peerId));
    remoteAnalysersRef.current.delete(peerId);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    // Speaking detection runs at ~15 Hz, not 60. The analyser's own smoothing
    // constant already damps the signal, a human voice cannot start and stop
    // faster than that, and at a 20-person party the per-frame cost was one
    // FFT read per participant on the main thread — the single largest
    // contributor to "the player stutters whenever cameras are on".
    const DETECT_INTERVAL_MS = 66;

    // Previous speaking set, serialized for cheap change detection. The tick
    // below allocates a fresh Set every pass — publishing it into state
    // unconditionally re-renders the whole player subtree even when nobody is
    // speaking. Only publish on actual change.
    let prevKey = "";
    let lastRun = 0;
    let raf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastRun < DETECT_INTERVAL_MS) return;
      lastRun = now;

      // Nothing to analyse: skip the whole pass. Previously this still
      // allocated a Set 60 times a second in every quiet party.
      const hasLocal = analyserRef.current && micOn && !hostMicForcedOff;
      if (!hasLocal && remoteAnalysersRef.current.size === 0) {
        if (wasSpeakingRef.current) {
          wasSpeakingRef.current = false;
          setLocalSpeaking(false);
        }
        return;
      }

      const remoteSpeaking = new Set<string>();

      if (hasLocal && analyserRef.current) {
        const level = readLevel(analyserRef.current);
        const speaking = wasSpeakingRef.current
          ? level > SPEAK_HYSTERESIS
          : level > SPEAK_THRESHOLD;
        if (speaking && localUserId) remoteSpeaking.add(localUserId);
        if (speaking !== wasSpeakingRef.current) {
          wasSpeakingRef.current = speaking;
          setLocalSpeaking(speaking);
          sendSpeakingState?.(speaking);
        }
      } else if (wasSpeakingRef.current) {
        wasSpeakingRef.current = false;
        setLocalSpeaking(false);
      }

      for (const [peerId, handle] of remoteAnalysersRef.current) {
        if (readLevel(handle) > SPEAK_THRESHOLD) remoteSpeaking.add(peerId);
      }

      const key =
        remoteSpeaking.size === 0 ? "" : [...remoteSpeaking].sort().join(",");
      if (key !== prevKey) {
        prevKey = key;
        setSpeakingPeers(remoteSpeaking);
      }
    };

    raf = requestAnimationFrame(tick);
    rafRef.current = raf;
    return () => {
      cancelAnimationFrame(raf);
      rafRef.current = null;
    };
  }, [roomId, micOn, localUserId, sendSpeakingState, hostMicForcedOff]);

  useEffect(() => {
    if (!roomId) {
      setMicOn(false);
      setCameraOn(false);
      void buildLocalStream(false, false);
      setRemoteStreams(new Map());
      setSpeakingPeers(new Set());
      // Remote analysers belong to streams from the room we just left. Left
      // running they keep reading dead `MediaStream` sources forever, which
      // is one of the ways a long session accumulated memory.
      for (const handle of remoteAnalysersRef.current.values()) disposeAnalyser(handle);
      remoteAnalysersRef.current.clear();
    }
  }, [roomId, buildLocalStream]);

  // Full hardware teardown. Capture the maps in local bindings — reading
  // `.current` inside a cleanup closure would see whatever the ref holds at
  // unmount time, which for a map that gets replaced is not the same set.
  useEffect(() => {
    const remoteAnalysers = remoteAnalysersRef.current;
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      disposeAnalyser(analyserRef.current);
      analyserRef.current = null;
      for (const handle of remoteAnalysers.values()) disposeAnalyser(handle);
      remoteAnalysers.clear();
    };
  }, []);

  const participants: PartyMediaParticipant[] = [];
  const seen = new Set<string>();

  if (localStream && localUserId && (micOn || cameraOn)) {
    seen.add(localUserId);
    participants.push({
      peerId: localUserId,
      displayName: localDisplayName,
      stream: localStream,
      hasVideo: cameraOn && !hostCamForcedOff && localStream.getVideoTracks().some((t) => t.enabled),
      hasAudio: micOn && !hostMicForcedOff,
      isSpeaking: localSpeaking,
      isLocal: true,
      micMutedByHost: hostMicForcedOff,
    });
  }

  for (const [peerId, stream] of remoteStreams) {
    if (peerId === localUserId) continue;
    seen.add(peerId);
    const hasVideo = stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
    participants.push({
      peerId,
      displayName: participantNames?.get(peerId) || "Friend",
      stream,
      hasVideo,
      hasAudio: stream.getAudioTracks().length > 0,
      isSpeaking: speakingPeers.has(peerId),
      isLocal: false,
    });
  }

  for (const rp of roomParticipants) {
    if (seen.has(rp.userId) || rp.userId === localUserId) continue;
    participants.push({
      peerId: rp.userId,
      displayName: rp.displayName,
      avatarUrl: rp.avatarUrl,
      stream: new MediaStream(),
      hasVideo: false,
      hasAudio: false,
      isSpeaking: false,
      isLocal: false,
      micMutedByHost: rp.micMutedByHost,
    });
  }

  if (localUserId && !seen.has(localUserId)) {
    participants.unshift({
      peerId: localUserId,
      displayName: localDisplayName,
      stream: localStream || new MediaStream(),
      hasVideo: false,
      hasAudio: false,
      isSpeaking: localSpeaking,
      isLocal: true,
      micMutedByHost: hostMicForcedOff,
    });
  }

  const mergedParticipants = dedupeMediaParticipants(participants);

  const cameraMode = !!roomId;
  const anyoneSpeaking = speakingPeers.size > 0;

  return {
    micOn: micOn && !hostMicForcedOff,
    cameraOn: cameraOn && !hostCamForcedOff,
    cameraMode,
    voiceVolume,
    setVoiceVolume,
    toggleMic,
    setMicLive,
    toggleCamera,
    participants: mergedParticipants,
    anyoneSpeaking,
    localSpeaking,
    mediaError,
    hostMicForcedOff,
    hostCamForcedOff,
    onRemoteStream,
    onRemoteStreamRemoved,
  };
}
