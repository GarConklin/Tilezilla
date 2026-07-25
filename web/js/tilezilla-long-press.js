/**
 * Fire a handler only after holding ~1s (short taps do nothing).
 * Keyboard Enter/Space still activates immediately for accessibility.
 */

export function bindLongPress(el, handler, {
  ms = 1000,
  exclude,
} = {}) {
  if (!el || typeof handler !== 'function') return;

  let timer = null;
  let fired = false;

  const clear = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const shouldIgnore = (e) => {
    if (typeof exclude === 'function' && exclude(e)) return true;
    if (e.pointerType === 'mouse' && e.button !== 0) return true;
    return false;
  };

  el.addEventListener('pointerdown', (e) => {
    if (shouldIgnore(e)) return;
    fired = false;
    clear();
    timer = setTimeout(() => {
      timer = null;
      fired = true;
      handler(e);
    }, ms);
  });

  el.addEventListener('pointerup', clear);
  el.addEventListener('pointercancel', clear);
  el.addEventListener('pointerleave', clear);
  el.addEventListener('lostpointercapture', clear);

  // Swallow click so a short tap never triggers the action.
  el.addEventListener('click', (e) => {
    if (typeof exclude === 'function' && exclude(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (fired) {
      fired = false;
    }
  }, true);

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handler(e);
  });
}
