/**
 * Custom scrollbar — FancyScrollerBar track + FancyScrollerPin thumb.
 * Hides when content fits; supports wheel, drag, and touch.
 */

export function initFancyScroller({
  scrollEl,
  scrollerRoot,
  trackEl,
  pinEl,
} = {}) {
  if (!scrollEl || !scrollerRoot || !trackEl || !pinEl) return null;

  let dragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;
  let touchId = null;

  function trackHeight() {
    return trackEl.clientHeight || scrollerRoot.clientHeight || 0;
  }

  function pinHeight() {
    return pinEl.offsetHeight || 0;
  }

  function maxScrollTop() {
    return Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  }

  function maxPinTravel() {
    return Math.max(0, trackHeight() - pinHeight());
  }

  function syncPinFromScroll() {
    const maxScroll = maxScrollTop();
    const travel = maxPinTravel();
    if (maxScroll <= 0 || travel <= 0) {
      pinEl.style.top = '0px';
      return;
    }
    const ratio = scrollEl.scrollTop / maxScroll;
    pinEl.style.top = `${ratio * travel}px`;
  }

  function syncVisibility() {
    const overflow = scrollEl.scrollHeight > scrollEl.clientHeight + 1;
    scrollerRoot.classList.toggle('is-hidden', !overflow);
    scrollerRoot.setAttribute('aria-hidden', overflow ? 'false' : 'true');
    if (overflow) syncPinFromScroll();
  }

  function scrollFromPinTop(pinTop) {
    const maxScroll = maxScrollTop();
    const travel = maxPinTravel();
    if (maxScroll <= 0 || travel <= 0) return;
    const clamped = Math.max(0, Math.min(travel, pinTop));
    scrollEl.scrollTop = (clamped / travel) * maxScroll;
  }

  function onScroll() {
    syncPinFromScroll();
  }

  function onPinPointerDown(e) {
    if (scrollerRoot.classList.contains('is-hidden')) return;
    dragging = true;
    dragStartY = e.clientY;
    dragStartScroll = scrollEl.scrollTop;
    pinEl.setPointerCapture?.(e.pointerId);
    pinEl.classList.add('is-dragging');
  }

  function onPinPointerMove(e) {
    if (!dragging) return;
    const maxScroll = maxScrollTop();
    const travel = maxPinTravel();
    if (maxScroll <= 0 || travel <= 0) return;
    const deltaY = e.clientY - dragStartY;
    const scrollDelta = (deltaY / travel) * maxScroll;
    scrollEl.scrollTop = dragStartScroll + scrollDelta;
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    pinEl.classList.remove('is-dragging');
    if (e?.pointerId != null) {
      try { pinEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  }

  function onTrackPointerDown(e) {
    if (scrollerRoot.classList.contains('is-hidden')) return;
    if (e.target === pinEl || pinEl.contains(e.target)) return;
    const rect = scrollerRoot.getBoundingClientRect();
    const localY = e.clientY - rect.top - (pinHeight() / 2);
    scrollFromPinTop(localY);
  }

  function onTouchStart(e) {
    if (scrollerRoot.classList.contains('is-hidden')) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    if (!pinEl.contains(e.target)) return;
    touchId = t.identifier;
    dragging = true;
    dragStartY = t.clientY;
    dragStartScroll = scrollEl.scrollTop;
  }

  function onTouchMove(e) {
    if (!dragging || touchId == null) return;
    const t = [...e.changedTouches].find((x) => x.identifier === touchId)
      || [...e.touches].find((x) => x.identifier === touchId);
    if (!t) return;
    e.preventDefault();
    const maxScroll = maxScrollTop();
    const travel = maxPinTravel();
    if (maxScroll <= 0 || travel <= 0) return;
    const deltaY = t.clientY - dragStartY;
    scrollEl.scrollTop = dragStartScroll + (deltaY / travel) * maxScroll;
  }

  function onTouchEnd(e) {
    const ended = [...e.changedTouches].some((t) => t.identifier === touchId);
    if (!ended) return;
    dragging = false;
    touchId = null;
  }

  scrollEl.addEventListener('scroll', onScroll, { passive: true });
  pinEl.addEventListener('pointerdown', onPinPointerDown);
  pinEl.addEventListener('pointermove', onPinPointerMove);
  pinEl.addEventListener('pointerup', endDrag);
  pinEl.addEventListener('pointercancel', endDrag);
  scrollerRoot.addEventListener('pointerdown', onTrackPointerDown);
  pinEl.addEventListener('touchstart', onTouchStart, { passive: true });
  pinEl.addEventListener('touchmove', onTouchMove, { passive: false });
  pinEl.addEventListener('touchend', onTouchEnd);
  pinEl.addEventListener('touchcancel', onTouchEnd);

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => syncVisibility());
    ro.observe(scrollEl);
  }

  const imgs = scrollEl.querySelectorAll('img');
  imgs.forEach((img) => {
    if (img.complete) return;
    img.addEventListener('load', syncVisibility, { once: true });
  });

  syncVisibility();

  return {
    sync: syncVisibility,
    destroy() {
      scrollEl.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    },
  };
}
