import { useRef } from "react";

// Handlers de "mantener apretado" (pointer events, mouse y touch). Un arrastre de más de 10px
// (p.ej. scrollear) lo cancela.
export function useLongPress(onLongPress: (() => void) | undefined, delayMs = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  };

  if (!onLongPress) return {};

  return {
    onPointerDown: (e: React.PointerEvent) => {
      cancel();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        onLongPress();
      }, delayMs);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
