import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface ResizeSession {
  pointerId: number;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  originW: number;
  originH: number;
  originLeft: number;
  originTop: number;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 160;
const BAR_HEIGHT = 44;

export const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function getMaxBounds(shellEl: HTMLElement | null) {
  const pad = 16;
  const shellRect = shellEl?.getBoundingClientRect();
  const vw = shellRect?.width ?? window.innerWidth;
  const vh = shellRect?.height ?? window.innerHeight;
  return {
    maxWidth: Math.max(MIN_WIDTH, vw - pad * 2),
    maxHeight: Math.max(MIN_HEIGHT, vh - pad * 2),
    shellLeft: shellRect?.left ?? 0,
    shellTop: shellRect?.top ?? 0,
    shellRight: shellRect?.right ?? window.innerWidth,
    shellBottom: shellRect?.bottom ?? window.innerHeight,
  };
}

export function usePlayerWindowResize(
  shellRef: RefObject<HTMLElement | null>,
  windowRef: RefObject<HTMLElement | null>,
  options?: {
    enabled?: boolean;
    isFloating?: boolean;
    position?: { x: number; y: number } | null;
    onPositionChange?: (pos: { x: number; y: number }) => void;
  }
) {
  const enabled = options?.enabled ?? true;
  const isFloating = options?.isFloating ?? false;
  const position = options?.position ?? null;
  const onPositionChange = options?.onPositionChange;

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const sessionRef = useRef<ResizeSession | null>(null);

  const resetSize = useCallback(() => {
    sessionRef.current = null;
    setIsResizing(false);
    setSize(null);
  }, []);

  const beginResize = useCallback(
    (handle: ResizeHandle, clientX: number, clientY: number, pointerId: number) => {
      if (!enabled) return false;
      const win = windowRef.current;
      if (!win) return false;

      const rect = win.getBoundingClientRect();
      sessionRef.current = {
        pointerId,
        handle,
        startX: clientX,
        startY: clientY,
        originW: size?.width ?? rect.width,
        originH: size?.height ?? rect.height,
        originLeft: position?.x ?? rect.left,
        originTop: position?.y ?? rect.top,
      };
      setIsResizing(true);

      if (!size) {
        setSize({ width: rect.width, height: rect.height });
      }
      return true;
    },
    [enabled, windowRef, size, position]
  );

  const onResizeHandlePointerDown = useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if (!isFloating && (handle.includes("w") || handle.includes("n"))) return;
      if (!beginResize(handle, e.clientX, e.clientY, e.pointerId)) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [beginResize, isFloating]
  );

  const visibleHandles = isFloating
    ? RESIZE_HANDLES
    : (["e", "s", "se"] as ResizeHandle[]);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const { maxWidth, maxHeight, shellLeft, shellTop, shellRight, shellBottom } = getMaxBounds(
        shellRef.current
      );
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const handle = session.handle;

      let nextW = session.originW;
      let nextH = session.originH;
      let nextLeft = session.originLeft;
      let nextTop = session.originTop;

      if (handle.includes("e")) nextW = session.originW + dx;
      if (handle.includes("w")) {
        nextW = session.originW - dx;
        nextLeft = session.originLeft + dx;
      }
      if (handle.includes("s")) nextH = session.originH + dy;
      if (handle.includes("n")) {
        nextH = session.originH - dy;
        nextTop = session.originTop + dy;
      }

      nextW = Math.max(MIN_WIDTH, Math.min(nextW, maxWidth));
      nextH = Math.max(MIN_HEIGHT, Math.min(nextH, maxHeight));

      if (handle.includes("w")) {
        nextLeft = session.originLeft + (session.originW - nextW);
      }
      if (handle.includes("n")) {
        nextTop = session.originTop + (session.originH - nextH);
      }

      const pad = 8;
      if (isFloating) {
        nextLeft = Math.max(shellLeft + pad, Math.min(nextLeft, shellRight - nextW - pad));
        nextTop = Math.max(shellTop + pad, Math.min(nextTop, shellBottom - nextH - pad));
        onPositionChange?.({ x: nextLeft, y: nextTop });
      }

      setSize({ width: nextW, height: nextH });
    };

    const end = (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      sessionRef.current = null;
      setIsResizing(false);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
  }, [isResizing, shellRef, isFloating, onPositionChange]);

  const sizeStyle: CSSProperties | undefined = size
    ? {
        width: size.width,
        height: size.height,
        maxWidth: size.width,
        maxHeight: size.height,
      }
    : undefined;

  const bodyHeight =
    size && size.height > BAR_HEIGHT ? size.height - BAR_HEIGHT : undefined;

  return {
    isResizing,
    isCustomSize: size !== null,
    sizeStyle,
    bodyHeight,
    onResizeHandlePointerDown,
    resetSize,
    visibleHandles,
  };
}

