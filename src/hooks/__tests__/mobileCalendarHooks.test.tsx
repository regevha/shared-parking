import React from 'react';
import { render, renderHook, act, fireEvent, screen } from '@testing-library/react';
import { useSwipeNavigation } from '../useSwipeNavigation';
import { useViewportFillHeight } from '../useViewportFillHeight';

const Swipeable: React.FC<{ onSwipe: jest.Mock; enabled?: boolean }> = ({ onSwipe, enabled }) => {
  const handlers = useSwipeNavigation(onSwipe, enabled);
  return (
    <div data-testid="area" {...handlers}>
      <div className="mobile-toolbar"><button data-testid="toolbar-btn">Today</button></div>
    </div>
  );
};

const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
const swipe = (el: Element, from: [number, number], to: [number, number]) => {
  fireEvent.touchStart(el, { touches: [touch(...from)] });
  fireEvent.touchMove(el, { touches: [touch(...to)] });
  fireEvent.touchEnd(el, { changedTouches: [touch(...to)] });
};

describe('useSwipeNavigation', () => {
  it('reports "next" for a left swipe and "prev" for a right swipe', () => {
    const onSwipe = jest.fn();
    render(<Swipeable onSwipe={onSwipe} />);
    swipe(screen.getByTestId('area'), [300, 400], [100, 410]);
    swipe(screen.getByTestId('area'), [100, 400], [300, 395]);
    expect(onSwipe.mock.calls).toEqual([['next'], ['prev']]);
  });

  it('ignores vertical scrolling, short drags and diagonal drags', () => {
    const onSwipe = jest.fn();
    render(<Swipeable onSwipe={onSwipe} />);
    swipe(screen.getByTestId('area'), [200, 500], [210, 200]);
    swipe(screen.getByTestId('area'), [200, 400], [170, 400]);
    swipe(screen.getByTestId('area'), [200, 400], [120, 340]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('ignores a drag that starts after a long press (reserved for drag-and-drop)', () => {
    jest.useFakeTimers();
    const onSwipe = jest.fn();
    render(<Swipeable onSwipe={onSwipe} />);
    const el = screen.getByTestId('area');
    fireEvent.touchStart(el, { touches: [touch(300, 400)] });
    jest.advanceTimersByTime(300);
    fireEvent.touchMove(el, { touches: [touch(100, 400)] });
    fireEvent.touchEnd(el, { changedTouches: [touch(100, 400)] });
    expect(onSwipe).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('ignores touches that start in the toolbar, multi-touch, and everything when disabled', () => {
    const onSwipe = jest.fn();
    const { rerender } = render(<Swipeable onSwipe={onSwipe} />);
    swipe(screen.getByTestId('toolbar-btn'), [300, 400], [100, 400]);
    fireEvent.touchStart(screen.getByTestId('area'), { touches: [touch(300, 400), touch(200, 400)] });
    fireEvent.touchEnd(screen.getByTestId('area'), { changedTouches: [touch(100, 400)] });
    rerender(<Swipeable onSwipe={onSwipe} enabled={false} />);
    swipe(screen.getByTestId('area'), [300, 400], [100, 400]);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe('useViewportFillHeight', () => {
  const refAt = (top: number) => ({ current: { getBoundingClientRect: () => ({ top }) } as unknown as HTMLElement });
  const setViewport = (h: number) => Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });

  it('fills from the element down to the bottom of the screen, minus the gap', () => {
    setViewport(844);
    const { result } = renderHook(() => useViewportFillHeight(refAt(60), { gap: 12 }));
    expect(result.current).toBe(772);
  });

  it('never goes below the minimum and follows resizes', () => {
    setViewport(400);
    const { result } = renderHook(() => useViewportFillHeight(refAt(60), { min: 420 }));
    expect(result.current).toBe(420);
    act(() => { setViewport(900); window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe(828);
  });

  it('returns undefined while disabled', () => {
    const { result } = renderHook(() => useViewportFillHeight(refAt(60), { enabled: false }));
    expect(result.current).toBeUndefined();
  });
});
