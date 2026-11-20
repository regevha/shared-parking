import { useMemo, useRef } from 'react';
import type React from 'react';

export type SwipeDirection = 'prev' | 'next';

const DECIDE_DISTANCE = 10;   // px of movement before the gesture is classified
const DECIDE_WITHIN_MS = 200; // a finger that rests first is a long-press (drag/drop), not a swipe
const MIN_DISTANCE = 50;      // px of horizontal travel
const MAX_DURATION_MS = 600;
const HORIZONTAL_RATIO = 1.5; // |dx| must beat |dy| by this factor, so vertical scrolling is untouched

interface Gesture { x: number; y: number; t: number; decided: boolean; cancelled: boolean }

/**
 * Horizontal swipe detection for touch screens. Swiping left means "next", right means "prev"
 * (the calendars are always laid out left-to-right). Touches starting inside an element matching
 * `ignoreSelector` are left alone.
 */
export function useSwipeNavigation(
  onSwipe: (direction: SwipeDirection) => void,
  enabled: boolean = true,
  ignoreSelector: string = '.mobile-toolbar',
) {
  const gesture = useRef<Gesture | null>(null);
  const callback = useRef(onSwipe);
  callback.current = onSwipe;

  return useMemo(() => ({
    onTouchStart: (e: React.TouchEvent) => {
      gesture.current = null;
      if (!enabled || e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (ignoreSelector && target?.closest?.(ignoreSelector)) return;
      const { clientX, clientY } = e.touches[0];
      gesture.current = { x: clientX, y: clientY, t: Date.now(), decided: false, cancelled: false };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const g = gesture.current;
      if (!g || g.decided) return;
      if (e.touches.length !== 1) { g.decided = true; g.cancelled = true; return; }
      const dx = e.touches[0].clientX - g.x;
      const dy = e.touches[0].clientY - g.y;
      if (Math.hypot(dx, dy) < DECIDE_DISTANCE) return;
      g.decided = true;
      g.cancelled = Date.now() - g.t > DECIDE_WITHIN_MS || Math.abs(dy) >= Math.abs(dx);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || !g.decided || g.cancelled || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - g.x;
      const dy = e.changedTouches[0].clientY - g.y;
      if (Date.now() - g.t > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < HORIZONTAL_RATIO * Math.abs(dy)) return;
      callback.current(dx < 0 ? 'next' : 'prev');
    },
    onTouchCancel: () => { gesture.current = null; },
  }), [enabled, ignoreSelector]);
}
