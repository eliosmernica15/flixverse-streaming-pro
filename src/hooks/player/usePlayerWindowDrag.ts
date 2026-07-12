import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export function usePlayerWindowDrag(
  shellRef: RefObject<HTMLElement | null>,
  windowRef: RefObject<HTMLElement | null>
) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const sessionRef = useRef<DragSession | null>(null);

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const win = windowRef.current;
      const shell = shellRef.current;
      if (!win || !shell) return { x, y };

      const shellRect = shell.getBoundingClientRect();
      const winRect = win.getBoundingClientRect();
      const w = winRect.width;
      const h = winRect.height;
      const pad = 8;

      return {
        x: Math.max(shellRect.left + pad, Math.min(x, shellRect.right - w - pad)),
        y: Math.max(shellRect.top + pad, Math.min(y, shellRect.bottom - h - pad)),
      };
    },
    [shellRef, windowRef]
  );

  const beginDrag = useCallback(
    (clientX: number, clientY: number, pointerId: number) => {
      const win = windowRef.current;
      if (!win) return false;

      const rect = win.getBoundingClientRect();
      const origin = position ?? { x: rect.left, y: rect.top };

      if (!position) {
        setPosition(origin);
      }

      sessionRef.current = {
        pointerId,
        startX: clientX,
        startY: clientY,
        originX: origin.x,
        originY: origin.y,
      };
      setIsDragging(true);
      return true;
    },
    [position, windowRef]
  );

  const onDragZonePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if (!beginDrag(e.clientX, e.clientY, e.pointerId)) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [beginDrag]
  );

  const resetPosition = useCallback(() => {
    sessionRef.current = null;
    setIsDragging(false);
    setPosition(null);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const next = clampPosition(session.originX + dx, session.originY + dy);
      setPosition(next);
    };

    const end = (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      sessionRef.current = null;
      setIsDragging(false);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
  }, [isDragging, clampPosition]);

  const windowStyle: CSSProperties | undefined = position
    ? {
        position: "fixed",
        left: position.x,
        top: position.y,
        margin: 0,
        zIndex: 10001,
      }
    : undefined;

  return {
    isFloating: position !== null,
    isDragging,
    windowStyle,
    onDragZonePointerDown,
    resetPosition,
  };
}
