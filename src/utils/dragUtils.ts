/**
 * Deactivates and cancels any ongoing user drag interactions on knobs,
 * faders (range sliders), or interactive canvas nodes across the application.
 *
 * Especially crucial when an automatic scroll (such as passing a scenario)
 * triggers while the user's mouse/pointer is still held down, preventing
 * the viewport displacement from dragging controls to unexpected extremes (e.g. +10dB).
 */
export function deactivateAllActiveDrags(): void {
  if (typeof window === 'undefined') return;

  // 1. Dispatch custom cancel event for Knobs and Canvas handlers
  window.dispatchEvent(new CustomEvent('mixer:cancel-drag'));

  // 2. Dispatch simulated pointerup/mouseup events to release global drag listeners
  try {
    const mouseUpEvt = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
    const pointerUpEvt = new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window });
    const pointerCancelEvt = new PointerEvent('pointercancel', { bubbles: true, cancelable: true, view: window });

    window.dispatchEvent(mouseUpEvt);
    window.dispatchEvent(pointerUpEvt);
    window.dispatchEvent(pointerCancelEvt);
    document.dispatchEvent(mouseUpEvt);
    document.dispatchEvent(pointerUpEvt);
    document.dispatchEvent(pointerCancelEvt);
  } catch {
    // Fallback if PointerEvent constructor has environment restrictions
  }

  // 3. Remove focus from whatever control was actively being interacted with
  if (document.activeElement && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  // 4. Force HTML5 range sliders (faders) to immediately drop browser-native mouse capture.
  // Setting disabled = true and pointerEvents = 'none' breaks the native track capture instantly,
  // preventing the page scroll from dragging the fader handle to +10 dB.
  const faders = document.querySelectorAll<HTMLInputElement>('input[type="range"]');
  faders.forEach((fader) => {
    try {
      fader.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      fader.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
      fader.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, view: window }));
    } catch {
      // Ignore event dispatch errors
    }
    fader.blur();

    fader.disabled = true;
    fader.style.pointerEvents = 'none';
  });

  // Re-enable faders once the mouse is released or the smooth scroll finishes
  let reenabled = false;
  const reenable = () => {
    if (reenabled) return;
    reenabled = true;
    faders.forEach((fader) => {
      fader.disabled = false;
      fader.style.pointerEvents = '';
    });
    window.removeEventListener('mouseup', reenable);
    window.removeEventListener('pointerup', reenable);
    window.removeEventListener('touchend', reenable);
  };

  window.addEventListener('mouseup', reenable, { once: true });
  window.addEventListener('pointerup', reenable, { once: true });
  window.addEventListener('touchend', reenable, { once: true });
  setTimeout(reenable, 500);
}
