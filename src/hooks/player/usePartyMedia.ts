import { useState, useCallback, useRef, useEffect } from "react";

const SPEAK_THRESHOLD = 0.04;
const SPEAK_HYSTERESIS = 0.025;
const VOICE_VOLUME_KEY = "flixverse-party-voice-volume";

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

interface UsePartyMediaOptions {
  roomId: string | null;
  setLocalStream: (stream: MediaStream | null) => Promise<void>;
  sendSpeakingState?: (speaking: boolean) => void;
  participantNames?: Map<string, string>;
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

  const buildLocalStream = useCallback(async (wantMic: boolean, wantCam: boolean) => {
    const effectiveMic = wantMic && !hostMicForcedOff;
    const effectiveCam = wantCam && !hostCamForcedOff;

    if (!effectiveMic && !effectiveCam) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStreamState(null);
      analyserRef.current?.ctx.close().catch(() => undefined);
      analyserRef.current = null;
      await setLocalStream(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: effectiveMic
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
            }
          : false,
        video: effectiveCam
          ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: "user",
            }
          : false,
      });

      localStreamRef.current?.getTracks().forEach((t) => {
        if (!stream.getTracks().some((nt) => nt.kind === t.kind)) t.stop();
      });
      localStreamRef.current = stream;
      setLocalStreamState(stream);
      setMediaError(null);

      if (effectiveMic && stream.getAudioTracks().length) {
        analyserRef.current?.ctx.close().catch(() => undefined);
        analyserRef.current = createAnalyser(stream);
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
  }, [setLocalStream, hostMicForcedOff, hostCamForcedOff]);

  const toggleMic = useCallback(async () => {
    if (hostMicForcedOff) return;
    const next = !micOn;
    setMicOn(next);
    await buildLocalStream(next, cameraOn);
  }, [micOn, cameraOn, buildLocalStream, hostMicForcedOff]);

  const toggleCamera = useCallback(async () => {
    if (hostCamForcedOff) return;
    const next = !cameraOn;
    setCameraOn(next);
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

  if (localStream && localUserId && (micOn || cameraOn)) {
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
    const hasVideo = stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
    if (!hasVideo && !stream.getAudioTracks().length) continue;
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

  const cameraMode = (cameraOn && !hostCamForcedOff) || participants.some((p) => p.hasVideo);
  const anyoneSpeaking = speakingPeers.size > 0;

  return {
    micOn: micOn && !hostMicForcedOff,
    cameraOn: cameraOn && !hostCamForcedOff,
    cameraMode,
    voiceVolume,
    setVoiceVolume,
    toggleMic,
    toggleCamera,
    participants,
    anyoneSpeaking,
    localSpeaking,
    mediaError,
    hostMicForcedOff,
    hostCamForcedOff,
    onRemoteStream,
    onRemoteStreamRemoved,
  };
}
