"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Move, X, Minimize2, Maximize2 } from "lucide-react";

/**
 * PiPTile — a draggable, resizable floating picture-in-picture container
 * for webcam tiles inside a watch party.
 *
 * Design goals:
 *  - Pointer-driven (mouse + touch) so it works on desktop and mobile.
 *  - Snaps to the nearest screen corner on release for a tidy layout.
 *  - Remembers its last position/size via `storageKey` (localStorage) so
 *    the user's preference persists across sessions.
 *  - Stays within the viewport bounds at all times.
 *  - Accessible: keyboard arrows nudge, Esc collapses, Enter toggles size.
 *
 * Usage:
 *   <PiPTile storageKey="party:pip:main" defaultSize={{w:240,h:180}}>
 *     <CameraTile ... />
 *   </PiPTile>
 */

export interface PiPTileSize {
  w: number;
  h: number;
}

export interface PiPTileProps {
  children: React.ReactNode;
  /** localStorage key for persisting position/size. Omit to disable persistence. */
  storageKey?: string;
  /** Initial size in px. Defaults to 240x180. */
  defaultSize?: PiPTileSize;
  /** Minimum size in px. Defaults to 120x90. */
  minSize?: PiPTileSize;
  /** Maximum size in px. Defaults to 480x360. */
  maxSize?: PiPTileSize;
  /** Called when the tile is dismissed. If omitted, no close button is shown. */
  onClose?: () => void;
  /** Extra class names for the outer container. */
  className?: string;
  /** Aria label for the region. */
  ariaLabel?: string;
}

const DEFAULT_SIZE: PiPTileSize = { w: 240, h: 180 };
const MIN_SIZE: PiPTileSize = { w: 120, h: 90 };
const MAX_SIZE: PiPTileSize = { w: 480, h: 360 };
const SNAP_THRESHOLD = 48; // px from a corner to snap
const NUDGE = 8; // px per arrow key

interface PersistedState {
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function readPersisted(key?: string): PersistedState | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (typeof parsed?.x !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(key: string | undefined, state: PersistedState): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function PiPTile({
  children,
  storageKey,
  defaultSize = DEFAULT_SIZE,
  minSize = MIN_SIZE,
  maxSize = MAX_SIZE,
  onClose,
  className = "",
  ariaLabel = "Floating camera preview",
}: PiPTileProps) {
  const persisted = readPersisted(storageKey);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (persisted) return { x: persisted.x, y: persisted.y };
    // Default: bottom-right corner with a small margin.
    if (typeof window === "undefined") return { x: 16, y: 16 };
    return {
      x: Math.max(16, window.innerWidth - (defaultSize.w + 24)),
      y: Math.max(16, window.innerHeight - (defaultSize.h + 24)),
    };
  });
  const [size, setSize] = useState<PiPTileSize>(() => {
    if (persisted) return { w: persisted.w, h: persisted.h };
    return { ...defaultSize };
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => persisted?.collapsed ?? false);

  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist on change.
  useEffect(() => {
    writePersisted(storageKey, { x: pos.x, y: pos.y, w: size.w, h: size.h, collapsed });
  }, [storageKey, pos.x, pos.y, size.w, size.h, collapsed]);

  // Keep inside viewport on resize.
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: clamp(p.x, 8, Math.max(8, window.innerWidth - size.w - 8)),
        y: clamp(p.y, 8, Math.max(8, window.innerHeight - size.h - 8)),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size.w, size.h]);

  const snapToCorner = useCallback((x: number, y: number, w: number, h: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (x < SNAP_THRESHOLD) nx = 16;
    else if (x + w > vw - SNAP_THRESHOLD) nx = vw - w - 16;
    if (y < SNAP_THRESHOLD) ny = 16;
    else if (y + h > vh - SNAP_THRESHOLD) ny = vh - h - 16;
    return { x: nx, y: ny };
  }, []);

  // Drag handlers
  const onPointerDownDrag = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    draggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [pos.x, pos.y]);

  const onPointerMoveDrag = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const nx = clamp(e.clientX - dragOffsetRef.current.x, 8, window.innerWidth - size.w - 8);
    const ny = clamp(e.clientY - dragOffsetRef.current.y, 8, window.innerHeight - size.h - 8);
    setPos({ x: nx, y: ny });
  }, [size.w, size.h]);

  const onPointerUpDrag = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setPos((p) => snapToCorner(p.x, p.y, size.w, size.h));
  }, [size.w, size.h, snapToCorner]);

  // Resize handlers (bottom-right handle)
  const onPointerDownResize = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    resizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }, [size.w, size.h]);

  const onPointerMoveResize = useCallback((e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    const dx = e.clientX - resizeStartRef.current.x;
    const dy = e.clientY - resizeStartRef.current.y;
    const minW = Math.max(minSize.w, 80);
    const minH = Math.max(minSize.h, 60);
    const maxW = Math.min(maxSize.w, window.innerWidth - pos.x - 8);
    const maxH = Math.min(maxSize.h, window.innerHeight - pos.y - 8);
    setSize({
      w: clamp(resizeStartRef.current.w + dx, minW, maxW),
      h: clamp(resizeStartRef.current.h + dy, minH, maxH),
    });
  }, [minSize.w, minSize.h, maxSize.w, maxSize.h, pos.x, pos.y]);

  const onPointerUpResize = useCallback((e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  // Keyboard nudging
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setPos((p) => ({ ...p, x: clamp(p.x - NUDGE, 8, window.innerWidth - size.w - 8) })); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setPos((p) => ({ ...p, x: clamp(p.x + NUDGE, 8, window.innerWidth - size.w - 8) })); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setPos((p) => ({ ...p, y: clamp(p.y - NUDGE, 8, window.innerHeight - size.h - 8) })); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setPos((p) => ({ ...p, y: clamp(p.y + NUDGE, 8, window.innerHeight - size.h - 8) })); }
    else if (e.key === "Enter") { e.preventDefault(); setCollapsed((c) => !c); }
    else if (e.key === "Escape" && onClose) { e.preventDefault(); onClose(); }
  }, [size.w, size.h, onClose]);

  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <div
      ref={containerRef}
      className={`pip-tile ${collapsed ? "pip-tile--collapsed" : ""} ${className}`}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: collapsed ? 48 : size.w,
        height: collapsed ? 48 : size.h,
        zIndex: 9999,
        touchAction: "none",
      }}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Drag handle */}
      <div
        className="pip-tile-handle"
        onPointerDown={onPointerDownDrag}
        onPointerMove={onPointerMoveDrag}
        onPointerUp={onPointerUpDrag}
        onPointerCancel={onPointerUpDrag}
        aria-label="Drag to move"
      >
        <Move className="w-3.5 h-3.5" />
      </div>

      {/* Body */}
      <div className="pip-tile-body">{!collapsed && children}</div>

      {/* Controls */}
      <div className="pip-tile-controls">
        <button
          type="button"
          className="pip-tile-btn"
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expand" : "Collapse"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
        </button>
        {onClose && (
          <button
            type="button"
            className="pip-tile-btn pip-tile-btn--close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Resize handle (bottom-right) */}
      {!collapsed && (
        <div
          className="pip-tile-resize"
          onPointerDown={onPointerDownResize}
          onPointerMove={onPointerMoveResize}
          onPointerUp={onPointerUpResize}
          onPointerCancel={onPointerUpResize}
          aria-label="Resize"
        />
      )}
    </div>
  );
}

export default PiPTile;
