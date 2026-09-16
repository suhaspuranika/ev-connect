import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Draggable bottom-sheet controller with snap points.
 *
 * Snap points are fractions of the viewport height that the *top* of the
 * sheet sits at:
 *   - collapsed: mostly off-screen (just the handle + title peeking)
 *   - half:      about half the screen
 *   - full:      near the top
 *
 * Returns the current translateY (px from top offset baseline) plus handlers
 * to wire onto the drag handle.
 */
export function useBottomSheet({
  snapPoints = [0.9, 0.45, 0.08], // as fraction of viewport height (top offset)
  initial = 1,
} = {}) {
  const [vh, setVh] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const [snapIndex, setSnapIndex] = useState(initial);
  const [dragY, setDragY] = useState(null); // live px during a drag
  const startRef = useRef({ y: 0, base: 0, dragging: false });

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const snapPx = snapPoints.map((f) => Math.round(f * vh));
  const restY = snapPx[snapIndex];
  const translateY = dragY != null ? dragY : restY;

  const onPointerDown = useCallback(
    (e) => {
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      startRef.current = { y, base: restY, dragging: true };
      setDragY(restY);
    },
    [restY]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!startRef.current.dragging) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = y - startRef.current.y;
      const min = snapPx[snapPx.length - 1];
      const max = snapPx[0];
      const next = Math.min(max, Math.max(min, startRef.current.base + delta));
      setDragY(next);
    },
    [snapPx]
  );

  const endDrag = useCallback(() => {
    if (!startRef.current.dragging) return;
    startRef.current.dragging = false;
    // Snap to the closest point.
    const current = dragY ?? restY;
    let best = 0;
    let bestDist = Infinity;
    snapPx.forEach((p, i) => {
      const d = Math.abs(p - current);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setSnapIndex(best);
    setDragY(null);
  }, [dragY, restY, snapPx]);

  return {
    translateY,
    snapIndex,
    setSnapIndex,
    dragging: startRef.current.dragging,
    handlers: {
      onMouseDown: onPointerDown,
      onMouseMove: onPointerMove,
      onMouseUp: endDrag,
      onMouseLeave: endDrag,
      onTouchStart: onPointerDown,
      onTouchMove: onPointerMove,
      onTouchEnd: endDrag,
    },
  };
}
