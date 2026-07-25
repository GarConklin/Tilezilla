/**
 * Fire a handler only after holding ~0.5s (short taps do nothing).
 * Keyboard Enter/Space still activates immediately for accessibility.
 *
 * iOS Safari often fires pointerleave / pointercancel during a hold
 * (scroll gesture detection). Capture the pointer, ignore leave, and
 * only cancel on a real lift or a clear drag.
 */

const MOVE_CANCEL_PX = 14;

export function bindLongPress(el, handler, {
  ms = 500,
  exclude,
} = {}) {
  if (!el || typeof handler !== 'function') return;

  let timer = null;
  let fired = false;
  let startX = 0;
  let startY = 0;
  let activePointerId = null;

  el.style.touchAction = el.style.touchAction || 'manipulation';
  el.style.webkitUserSelect = 'none';
  el.style.userSelect = 'none';

  const clearTimer = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const releasePointer = () => {
    if (activePointerId != null) {
      try {
        if (el.hasPointerCapture?.(activePointerId)) {
          el.releasePointerCapture(activePointerId);
        }
      } catch {
        /* ignore */
      }
      activePointerId = null;
    }
  };

  const cancelHold = () => {
    clearTimer();
    releasePointer();
  };

  const shouldIgnore = (e) => {
    if (typeof exclude === 'function' && exclude(e)) return true;
    if (e.pointerType === 'mouse' && e.button !== 0) return true;
    return false;
  };

  el.addEventListener('pointerdown', (e) => {
    if (shouldIgnore(e)) return;
    if (activePointerId != null) return;

    // Keep parent long-press bindings from starting a second timer.
    e.stopPropagation();

    fired = false;
    clearTimer();
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;

    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    timer = setTimeout(() => {
      timer = null;
      fired = true;
      releasePointer();
      handler(e);
    }, ms);
  });

  el.addEventListener('pointermove', (e) => {
    if (activePointerId == null || e.pointerId !== activePointerId) return;
    if (fired || timer == null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if ((dx * dx) + (dy * dy) > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      cancelHold();
    }
  });

  el.addEventListener('pointerup', (e) => {
    if (activePointerId == null || e.pointerId !== activePointerId) return;
    cancelHold();
  });

  el.addEventListener('pointercancel', (e) => {
    if (activePointerId == null || e.pointerId !== activePointerId) return;
    cancelHold();
  });

  // Do not listen for pointerleave — iOS fires it during a still hold.

  // Swallow click so a short tap never triggers the action.
  el.addEventListener('click', (e) => {
    if (typeof exclude === 'function' && exclude(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (fired) fired = false;
  }, true);

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handler(e);
  });
}
