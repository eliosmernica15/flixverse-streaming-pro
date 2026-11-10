"use client";

import { useEffect, useState } from "react";
import { Volume2, Vibrate, Sparkles, Monitor } from "lucide-react";
import { getBloomIntensity, setBloomIntensity } from "./CinemaBloom";
import { isCinemaStageEnabled, setCinemaStageEnabled } from "./CinemaStage";
import { isCinema3DEnabled, setCinema3DEnabled } from "./CinemaScene3D";
import {
  getHapticsCapabilities,
  isHapticsEnabled,
  setHapticsEnabled,
} from "@/lib/player/haptics";
import { getMicroSoundsEnabled, setMicroSoundsEnabled } from "@/lib/player/microSounds";
import {
  isScreenCaptureBloomEnabled,
  setScreenCaptureBloomEnabled,
} from "@/hooks/player/useScreenCaptureBloom";

/**
 * Controls for the 4D sensory layer.
 *
 * Everything here is opt-in and honest about what the current device can
 * actually do: a capability row shows whether tilt/bloom/vibration/gamepad
 * are supported, so a user on iOS Safari is not offered a vibration toggle
 * that would silently do nothing.
 */

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  disabledReason,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  icon: React.ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors ${
        disabled ? "opacity-50" : "cursor-pointer hover:bg-white/[0.06]"
      }`}
    >
      <span className="mt-0.5 text-white/70" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-xs leading-snug text-gray-400">
          {disabled && disabledReason ? disabledReason : description}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked && !disabled ? "bg-red-500" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked && !disabled ? "translate-x-[1.15rem]" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

export function CinemaSenseSettings() {
  const [bloom, setBloom] = useState(1);
  const [stage, setStage] = useState(true);
  const [scene3d, setScene3d] = useState(false);
  const [haptics, setHaptics] = useState(false);
  const [microSounds, setMicroSoundsState] = useState(false);
  const [screenCapture, setScreenCaptureState] = useState(false);
  const [caps, setCaps] = useState(() => getHapticsCapabilities());

  useEffect(() => {
    setBloom(getBloomIntensity());
    setStage(isCinemaStageEnabled());
    setScene3d(isCinema3DEnabled());
    setHaptics(isHapticsEnabled());
    setMicroSoundsState(getMicroSoundsEnabled());
    setScreenCaptureState(isScreenCaptureBloomEnabled());
    setCaps(getHapticsCapabilities());

    // Gamepads connect/disconnect at runtime; re-read capabilities so the
    // toggle reflects reality without a reload.
    const refresh = () => setCaps(getHapticsCapabilities());
    window.addEventListener("gamepadconnected", refresh);
    window.addEventListener("gamepaddisconnected", refresh);
    return () => {
      window.removeEventListener("gamepadconnected", refresh);
      window.removeEventListener("gamepaddisconnected", refresh);
    };
  }, []);

  const canVibrate = caps.vibration || caps.gamepad;

  return (
    <div className="space-y-2.5">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-red-400" aria-hidden />
        <h3 className="text-sm font-bold text-white">Cinema senses</h3>
      </div>
      <p className="-mt-1 mb-2 text-xs leading-relaxed text-gray-400">
        Turn the screen into part of the film. All effects are opt-in and can be
        switched off at any time.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-white/70" aria-hidden />
          <span className="text-sm font-semibold text-white">Screen bloom</span>
          <span className="ml-auto text-xs tabular-nums text-gray-400">
            {Math.round(bloom * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(bloom * 100)}
          onChange={(e) => {
            const next = Number(e.target.value) / 100;
            setBloom(next);
            setBloomIntensity(next);
          }}
          className="w-full accent-red-500"
          aria-label="Screen bloom intensity"
        />
        <p className="mt-1 text-xs leading-snug text-gray-500">
          Projects the colours of the scene onto the space around the player.
        </p>
      </div>

      <Toggle
        icon={<Monitor className="h-4 w-4" />}
        label="Cinema hall"
        description="A generated 3D room around the player that takes its colour and mood from the title. Pure CSS — no GPU load while paused."
        checked={stage}
        onChange={(next) => {
          setStage(next);
          setCinemaStageEnabled(next);
        }}
      />

      <Toggle
        icon={<Sparkles className="h-4 w-4" />}
        label="WebGL 3D hall"
        description="Real-time 3D cinema hall with volumetric light and a starfield. Lazy-loaded, GPU-accelerated. Falls back to the CSS hall on low-end devices."
        checked={scene3d}
        onChange={(next) => {
          setScene3d(next);
          setCinema3DEnabled(next);
        }}
      />

      <Toggle
        icon={<Vibrate className="h-4 w-4" />}
        label="Haptic feedback"
        description="Tactile pulses on heavy audio moments (bass drops, impacts) and on play, pause and seek."
        disabled={!canVibrate}
        disabledReason="This device has no vibration motor and no controller with rumble."
        checked={haptics && canVibrate}
        onChange={(next) => {
          setHaptics(next);
          setHapticsEnabled(next);
        }}
      />

      <Toggle
        icon={<Volume2 className="h-4 w-4" />}
        label="Interface micro-sounds"
        description="Subtle synthesised clicks for scrubbing and reactions. Off by default so it never competes with the film."
        checked={microSounds}
        onChange={(next) => {
          setMicroSoundsState(next);
          setMicroSoundsEnabled(next);
        }}
      />

      <Toggle
        icon={<Monitor className="h-4 w-4" />}
        label="Screen-capture ambilight"
        description="Captures your screen (local only, never uploaded) so the bloom matches the actual picture — even for cross-origin streams. Browser shows a permission picker."
        checked={screenCapture}
        onChange={(next) => {
          setScreenCaptureState(next);
          setScreenCaptureBloomEnabled(next);
        }}
      />

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-500">
        <dt>Device vibration</dt>
        <dd className={caps.vibration ? "text-emerald-400" : "text-gray-600"}>
          {caps.vibration ? "Available" : "Not available"}
        </dd>
        <dt>Controller rumble</dt>
        <dd className={caps.gamepad ? "text-emerald-400" : "text-gray-600"}>
          {caps.gamepad ? "Controller connected" : "No controller"}
        </dd>
        <dt>Frame pulse</dt>
        <dd className="text-emerald-400">Always available</dd>
      </dl>
    </div>
  );
}

export default CinemaSenseSettings;
