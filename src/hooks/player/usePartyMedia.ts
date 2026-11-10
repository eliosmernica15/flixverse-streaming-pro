import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { FlixPartyParticipant } from "@/hooks/player/useFlixParty";
import { audioContext } from "@/lib/player/audioSingleton";

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
const EMPTY_ROOM_PARTICIPANTS: FlixPartyParticipant[] = [];
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
  /** Gain node ID for detachment from audioSingleton. */
  gainNodeId: symbol | null;
  dispose: () => void;
}

function createAnalyser(stream: MediaStream): StreamAnalyserHandle | null {
  const ctx = audioContext.getContext();
  if (!ctx) return null;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.65;

  const source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);

  // Attach a gain node to keep the context alive while this analyser exists
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0; // Silent passthrough, just for ref counting
  const gainNodeId = audioContext.attachGainNode(gainNode);

  let disposed = false;
  return {
    analyser,
    source,
    levelBuffer: new Uint8Array(analyser.frequencyBinCount),
    gainNodeId,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // already detached
      }
      if (gainNodeId) {
        audioContext.detachGainNode(gainNodeId);
      }
      audioContext.closeContext();
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
  /** WebRTC broadcast mute-all: guests mute their mic, host stays unmuted */
  webRTCMuteAll?: boolean;
}

export function usePartyMedia({
  roomId,
  setLocalStream,
  sendSpeakingState,
  participantNames,
  roomParticipants = EMPTY_ROOM_PARTICIPANTS,
  localUserId,
  localDisplayName = "You",
  hostMicForcedOff = false,
  hostCamForcedOff = false,
  webRTCMuteAll = false,
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
    const ctx = audioContext.getContext();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const buildLocalStream = useCallback(async (wantMic: boolean, wantCam: boolean) => {
    const effectiveMic = wantMic && !hostMicForcedOff && !webRTCMuteAll;
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

    // Reuse existing MediaStream with replaceTrack/addTrack instead of creating new one
    if (existing) {
      // Handle audio track
      if (effectiveMic && !hasAudio) {
        // Need to add audio track
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true },
              channelCount: { ideal: 1 },
            },
            video: false,
          });
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            existing.addTrack(audioTrack);
            audioTrack.enabled = true;
          }
        } catch (err) {
          console.warn("Failed to add audio track:", err);
        }
      } else if (!effectiveMic && hasAudio) {
        // Remove audio tracks
        existing.getAudioTracks().forEach((t) => {
          existing.removeTrack(t);
          t.stop();
        });
      } else if (effectiveMic && hasAudio) {
        // Keep existing, just enable/disable
        existing.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      }

      // Handle video track
      if (effectiveCam && !hasVideo) {
        // Need to add video track
        const videoConstraints = mobile
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
            };
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoConstraints,
          });
          const videoTrack = videoStream.getVideoTracks()[0];
          if (videoTrack) {
            existing.addTrack(videoTrack);
            videoTrack.enabled = true;
          }
        } catch (err) {
          console.warn("Failed to add video track:", err);
        }
      } else if (!effectiveCam && hasVideo) {
        // Remove video tracks
        existing.getVideoTracks().forEach((t) => {
          existing.removeTrack(t);
          t.stop();
        });
      } else if (effectiveCam && hasVideo) {
        // Keep existing, just enable/disable
        existing.getVideoTracks().forEach((t) => {
          t.enabled = true;
        });
      }

      // Update analyser if audio track state changed
      if (effectiveMic && existing.getAudioTracks().length) {
        if (!analyserRef.current) {
          analyserRef.current = createAnalyser(existing);
        }
        await resumeAnalyser();
      } else {
        disposeAnalyser(analyserRef.current);
        analyserRef.current = null;
      }

      await setLocalStream(existing);
      setLocalStreamState(existing);
      setMediaError(null);
      return;
    }

    // No existing stream - create new one (first time)
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
    if (hostMicForcedOff || webRTCMuteAll) return;
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
  }, [micOn, cameraOn, buildLocalStream, hostMicForcedOff, webRTCMuteAll, resumeAnalyser, sendSpeakingState, setLocalStream]);

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
  // WebRTC mute-all (broadcast from host) — apply immediately for guests
  useEffect(() => {
    if ((hostMicForcedOff || webRTCMuteAll) && micOnRef.current) {
      setMicOn(false);
      void buildLocalStream(false, cameraOnRef.current);
    }
  }, [hostMicForcedOff, webRTCMuteAll, buildLocalStream]);

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
      // Null out refs to prevent stale references
      remoteAnalysersRef.current = new Map();
    }
  }, [roomId, buildLocalStream]);

  // Full hardware teardown. Capture the maps in local bindings — reading
  // `.current` inside a cleanup closure would see whatever the ref holds at
  // unmount time, which for a map that gets replaced is not the same set.
  useEffect(() => {
    const remoteAnalysers = remoteAnalysersRef.current;
    return () => {
      // Stop the animation frame loop first
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Clean up local stream tracks
      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore errors on already stopped tracks
        }
      });
      localStreamRef.current = null;
      setLocalStreamState(null);

      // Clean up local analyser (releases AudioContext reference)
      disposeAnalyser(analyserRef.current);
      analyserRef.current = null;

      // Clean up remote analysers
      for (const handle of remoteAnalysers.values()) {
        disposeAnalyser(handle);
      }
      remoteAnalysers.clear();
      remoteAnalysersRef.current = new Map();

      // Clear remote streams state
      setRemoteStreams(new Map());
      setSpeakingPeers(new Set());

      // Notify parent of stream removal
      void setLocalStream(null);

      // Reset speaking state
      wasSpeakingRef.current = false;
      setLocalSpeaking(false);
      sendSpeakingState?.(false);
    };
  }, [setLocalStream, sendSpeakingState]);

  const mergedParticipants = useMemo(() => {
    const participants: PartyMediaParticipant[] = [];
    const seen = new Set<string>();

    // Effective mute state for local participant (host forced OR webRTC mute-all)
    const effectiveMicMuted = hostMicForcedOff || webRTCMuteAll;

    if (localStream && localUserId && (micOn || cameraOn)) {
      seen.add(localUserId);
      participants.push({
        peerId: localUserId,
        displayName: localDisplayName,
        stream: localStream,
        hasVideo:
          cameraOn &&
          !hostCamForcedOff &&
          localStream.getVideoTracks().some((t) => t.enabled),
        hasAudio: micOn && !effectiveMicMuted,
        isSpeaking: localSpeaking,
        isLocal: true,
        micMutedByHost: effectiveMicMuted,
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

    for (const participant of roomParticipants) {
      if (seen.has(participant.userId) || participant.userId === localUserId) continue;
      participants.push({
        peerId: participant.userId,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl,
        stream: new MediaStream(),
        hasVideo: false,
        hasAudio: false,
        isSpeaking: false,
        isLocal: false,
        micMutedByHost: participant.micMutedByHost,
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
        micMutedByHost: hostMicForcedOff || webRTCMuteAll,
      });
    }

    return dedupeMediaParticipants(participants);
  }, [
    cameraOn,
    hostCamForcedOff,
    hostMicForcedOff,
    webRTCMuteAll,
    localDisplayName,
    localStream,
    localUserId,
    localSpeaking,
    micOn,
    participantNames,
    remoteStreams,
    roomParticipants,
    speakingPeers,
  ]);

  const cameraMode = !!roomId;
  const anyoneSpeaking = speakingPeers.size > 0;

  return useMemo(() => ({
    micOn: micOn && !hostMicForcedOff && !webRTCMuteAll,
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
    webRTCMuteAll,
    onRemoteStream,
    onRemoteStreamRemoved,
  }), [
    micOn,
    hostMicForcedOff,
    webRTCMuteAll,
    cameraOn,
    hostCamForcedOff,
    cameraMode,
    voiceVolume,
    setVoiceVolume,
    toggleMic,
    setMicLive,
    toggleCamera,
    mergedParticipants,
    anyoneSpeaking,
    localSpeaking,
    mediaError,
    onRemoteStream,
    onRemoteStreamRemoved,
  ]);
}