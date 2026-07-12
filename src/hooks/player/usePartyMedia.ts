import { useState, useCallback, useRef, useEffect } from "react";
import type { FlixPartyParticipant } from "@/hooks/player/useFlixParty";

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

function createAnalyser(stream: MediaStream): { ctx: AudioContext; analyser: AnalyserNode } | null {
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.65;
    source.connect(analyser);
    return { ctx, analyser };
  } catch {
    return null;
  }
}

function readLevel(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / (data.length * 255);
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
  const analyserRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const remoteAnalysersRef = useRef<Map<string, { ctx: AudioContext; analyser: AnalyserNode }>>(new Map());
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
    const ctx = analyserRef.current?.ctx;
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
      analyserRef.current?.ctx.close().catch(() => undefined);
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
        analyserRef.current?.ctx.close().catch(() => undefined);
        analyserRef.current = createAnalyser(stream);
        await resumeAnalyser();
      } else {
        analyserRef.current?.ctx.close().catch(() => undefined);
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
      }
      await setLocalStream(stream);
      if (!next && !cameraOn) {
        await buildLocalStream(false, false);
      }
      return;
    }

    await buildLocalStream(next, cameraOn);
  }, [micOn, cameraOn, buildLocalStream, hostMicForcedOff, resumeAnalyser, sendSpeakingState]);

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
  }, [micOn, cameraOn, buildLocalStream, hostCamForcedOff]);

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
    if (stream.getAudioTracks().length) {
      const existing = remoteAnalysersRef.current.get(peerId);
      existing?.ctx.close().catch(() => undefined);
      const a = createAnalyser(stream);
      if (a) remoteAnalysersRef.current.set(peerId, a);
    }
  }, []);

  const onRemoteStreamRemoved = useCallback((peerId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    setSpeakingPeers((prev) => {
      const next = new Set(prev);
      next.delete(peerId);
      return next;
    });
    const a = remoteAnalysersRef.current.get(peerId);
    a?.ctx.close().catch(() => undefined);
    remoteAnalysersRef.current.delete(peerId);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const tick = () => {
      const remoteSpeaking = new Set<string>();

      if (analyserRef.current && micOn && !hostMicForcedOff) {
        const level = readLevel(analyserRef.current.analyser);
        const speaking = wasSpeakingRef.current
          ? level > SPEAK_HYSTERESIS
          : level > SPEAK_THRESHOLD;
        if (speaking && localUserId) remoteSpeaking.add(localUserId);
        if (speaking !== wasSpeakingRef.current) {
          wasSpeakingRef.current = speaking;
          setLocalSpeaking(speaking);
          sendSpeakingState?.(speaking);
        }
      } else {
        wasSpeakingRef.current = false;
        setLocalSpeaking(false);
      }

      for (const [peerId, { analyser }] of remoteAnalysersRef.current) {
        if (readLevel(analyser) > SPEAK_THRESHOLD) remoteSpeaking.add(peerId);
      }

      setSpeakingPeers(remoteSpeaking);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [roomId, micOn, localUserId, sendSpeakingState, hostMicForcedOff]);

  useEffect(() => {
    if (!roomId) {
      setMicOn(false);
      setCameraOn(false);
      void buildLocalStream(false, false);
      setRemoteStreams(new Map());
      setSpeakingPeers(new Set());
    }
  }, [roomId, buildLocalStream]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      analyserRef.current?.ctx.close().catch(() => undefined);
      for (const a of remoteAnalysersRef.current.values()) {
        a.ctx.close().catch(() => undefined);
      }
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
