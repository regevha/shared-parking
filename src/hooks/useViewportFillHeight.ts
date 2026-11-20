import { useCallback, useLayoutEffect, useState } from 'react';
import type React from 'react';

interface Options {
  /** Never return less than this (px). */
  min?: number;
  /** Space left free under the element (px). */
  gap?: number;
  enabled?: boolean;
}

/**
 * Height (px) that makes an element reach the bottom of the screen from where it sits in the page,
 * so a calendar fills a phone screen instead of using a fixed height. Re-measured on resize and
 * rotation. Returns `undefined` while disabled.
 */
export function useViewportFillHeight(
  ref: React.RefObject<HTMLElement | null>,
  { min = 420, gap = 12, enabled = true }: Options = {},
): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    setHeight(Math.max(min, Math.round(window.innerHeight - top - gap)));
  }, [ref, min, gap]);

  useLayoutEffect(() => {
    if (!enabled) { setHeight(undefined); return; }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [enabled, measure]);

  return enabled ? height : undefined;
}
