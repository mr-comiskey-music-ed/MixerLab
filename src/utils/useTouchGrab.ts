import { useEffect, useRef, type RefObject } from 'react';

/**
 * Hold-to-grab touch handling for knobs and faders.
 *
 * The problem on a touch screen: a swipe that should scroll the page and a drag that should turn a
 * knob start out identically. This separates them by intent:
 *
 *   - Finger lands and moves right away (past `slopPx`)  -> it's a swipe. The browser scrolls the page
 *     and the control is left alone.
 *   - Finger lands and stays put for `holdMs`            -> it's a grab. The control "locks on" (a tiny
 *     buzz on phones that support it), page scrolling is blocked for the rest of that touch, and moving
 *     the finger turns the control.
 *   - Two quick taps                                      -> `onDoubleTap` (used to reset to default).
 *
 * The element should have `touch-action: manipulation` (Tailwind: `touch-manipulation`) so the browser
 * is free to scroll until a grab happens. Mouse input is not handled here.
 */
export interface TouchGrabOptions {
  /** A held touch just became a grab. `y` is the finger's current clientY. */
  onGrab: (y: number) => void;
  /** The finger moved while grabbed. */
  onMove: (y: number) => void;
  /** The grab ended (finger lifted or the touch was cancelled). */
  onRelease: () => void;
  /** Two quick taps with no hold in between. */
  onDoubleTap?: () => void;
  /** How long the finger must rest before it counts as a grab. */
  holdMs?: number;
  /** How far the finger may drift (px) during the hold before it counts as a scroll swipe. */
  slopPx?: number;
  /** Optional window event name that force-releases an active grab. */
  cancelEvent?: string;
}

export function useTouchGrab<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: TouchGrabOptions
): void {
  // Always call the latest callbacks without re-attaching listeners on every render.
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    type Phase = 'idle' | 'pending' | 'grabbed' | 'scrolling';
    let phase: Phase = 'idle';
    let timer: number | undefined;
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastTapAt = 0;

    const clearTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const release = () => {
      clearTimer();
      if (phase === 'grabbed') optsRef.current.onRelease();
      phase = 'idle';
    };

    const onTouchStart = (e: TouchEvent) => {
      // A second finger (pinch, etc.) is never a knob turn.
      if (e.touches.length !== 1) {
        release();
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      lastY = t.clientY;
      phase = 'pending';
      clearTimer();
      timer = window.setTimeout(() => {
        timer = undefined;
        if (phase !== 'pending') return;
        phase = 'grabbed';
        try {
          navigator.vibrate?.(8);
        } catch {
          /* vibration is optional */
        }
        optsRef.current.onGrab(lastY);
      }, optsRef.current.holdMs ?? 150);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      lastY = t.clientY;

      if (phase === 'pending') {
        const slop = optsRef.current.slopPx ?? 8;
        if (Math.hypot(t.clientX - startX, t.clientY - startY) > slop) {
          // Moved before the hold finished: this is a scroll swipe. Hands off.
          clearTimer();
          phase = 'scrolling';
        }
        return;
      }

      if (phase === 'grabbed') {
        // Keep the page still while the knob is being turned.
        if (e.cancelable) e.preventDefault();
        optsRef.current.onMove(t.clientY);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (phase === 'pending') {
        // Finger lifted before the hold finished and without swiping: a tap.
        clearTimer();
        const now = Date.now();
        if (now - lastTapAt < 350) {
          lastTapAt = 0;
          optsRef.current.onDoubleTap?.();
        } else {
          lastTapAt = now;
        }
        phase = 'idle';
        return;
      }
      if (phase === 'grabbed') {
        // Stops the browser from replaying the touch as a mouse click after a grab.
        if (e.cancelable) e.preventDefault();
        release();
        return;
      }
      phase = 'idle';
    };

    const onTouchCancel = () => release();

    // A long press can pop up a context menu on Android / Chromebook; not while using a control.
    const onContextMenu = (e: Event) => {
      if (phase === 'pending' || phase === 'grabbed') e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchCancel);
    el.addEventListener('contextmenu', onContextMenu);

    const cancelEvent = optsRef.current.cancelEvent;
    if (cancelEvent) window.addEventListener(cancelEvent, release);

    return () => {
      clearTimer();
      if (phase === 'grabbed') optsRef.current.onRelease();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      el.removeEventListener('contextmenu', onContextMenu);
      if (cancelEvent) window.removeEventListener(cancelEvent, release);
    };
  }, [ref]);
}
