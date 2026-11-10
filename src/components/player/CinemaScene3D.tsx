"use client";

import { useMemo } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const STORAGE_KEY = "flixverse-cinema-3d";

export function isCinema3DEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setCinema3DEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent("toggle-cinema-3d", { detail: { enabled: value } }));
}
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Environment } from "@react-three/drei";
import * as THREE from "three";

/**
 * CinemaScene3D — an optional WebGL cinema hall.
 *
 * Rendered only when the user opts in AND the device supports WebGL. Falls
 * back to the CSS 3D `CinemaStage` otherwise. The scene is intentionally
 * lightweight: a seat row, a screen plane, a volumetric light cone and a
 * mote field — no GLTF assets, so it ships without extra network requests.
 *
 * Lazy-loaded by callers (`next/dynamic` with `ssr: false`) so Three.js is
 * only downloaded when the user actually enables the 3D hall.
 */

interface CinemaScene3DProps {
  /** Seed for deterministic mote positions. */
  seedKey: string | number;
  /** Base palette color (hex) — tints the screen glow and motes. */
  accentColor?: string;
  /** Dim the scene while playing. */
  isPlaying?: boolean;
  /** Compact (mobile) layout. */
  compact?: boolean;
}

function SeededMotes({ seed, count = 60 }: { seed: string | number; count?: number }) {
  const positions = useMemo(() => {
    const arr: number[] = [];
    let s = (typeof seed === "number" ? seed : 0) || 1;
    const rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < count; i += 1) {
      arr.push((rng() - 0.5) * 12, (rng() - 0.5) * 6 + 1, (rng() - 0.5) * 8 - 2);
    }
    return new Float32Array(arr);
  }, [seed, count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#ffffff" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function Screen({ color }: { color: string }) {
  return (
    <mesh position={[0, 1.2, -4]}>
      <planeGeometry args={[6, 3.4]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
}

function LightCone({ color }: { color: string }) {
  return (
    <mesh position={[0, 1.2, -2]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[3.2, 4, 32, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SeatRow({ z, count = 9 }: { z: number; count?: number }) {
  const seats = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i += 1) {
      const x = (i - (count - 1) / 2) * 0.7;
      arr.push({ x, z });
    }
    return arr;
  }, [z, count]);
  return (
    <group>
      {seats.map((s, i) => (
        <mesh key={i} position={[s.x, 0.25, s.z]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function CinemaScene3D({ seedKey, accentColor = "#e50914", isPlaying = false, compact = false }: CinemaScene3DProps) {
  const reducedMotion = useReducedMotion();
  const fov = compact ? 55 : 45;

  if (reducedMotion) {
    return (
      <div className="cinema-scene-3d-reduced" aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: -10, pointerEvents: "none",
        background: `radial-gradient(circle at 50% 50%, ${accentColor} 0%, #0a0a12 70%)`,
      }} />
    );
  }

  return (
    <div className="cinema-scene-3d" aria-hidden="true">
      <Canvas camera={{ position: [0, 1.6, 6], fov }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.15} />
        <pointLight position={[0, 3, -2]} intensity={0.6} color={accentColor} />
        <Stars radius={40} depth={20} count={800} factor={2} saturation={0} fade speed={0.5} />
        <Screen color={accentColor} />
        <LightCone color={accentColor} />
        <SeatRow z={2} />
        <SeatRow z={3.2} />
        <SeededMotes seed={seedKey} count={isPlaying ? 80 : 40} />
        <Environment preset="night" />
        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2.1} minPolarAngle={Math.PI / 3} />
      </Canvas>
    </div>
  );
}

export default CinemaScene3D;