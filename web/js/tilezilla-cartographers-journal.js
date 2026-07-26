/**
 * The Cartographer's Journal — scrollable about panel (Hint Rules pattern).
 * Version label is loaded from /api/system-info (MySQL cache).
 */

import { syncCartographersJournalWindowGeometry } from './cartographers-journal-layout.js';
import { initFancyScroller } from './fancy-scroller.js';
import { fetchSystemInfo } from './system-info.js';

let menuApi = null;
let fancyScroller = null;

function $(id) {
  return document.getElementById(id);
}

async function refreshJournalVersionBadge() {
  const badge = $('cartographersJournalVersion');
  const emailEl = $('cartographersJournalEmail');
  const info = await fetchSystemInfo();
  if (badge) {
    const version = String(info?.version || '').trim();
    badge.textContent = version || '—';
  }
  if (emailEl) {
    const email = String(info?.contactEmail || '').trim();
    if (email) {
      emailEl.textContent = email;
      emailEl.href = `mailto:${email}`;
      emailEl.hidden = false;
    } else {
      emailEl.hidden = true;
      emailEl.removeAttribute('href');
      emailEl.textContent = '';
    }
  }
}

async function openCartographersJournalPopup() {
  const root = $('cartographersJournalRoot');
  if (!root) return;

  try {
    await refreshJournalVersionBadge();
  } catch (err) {
    console.warn("Cartographer's journal system info:", err);
  }

  menuApi?.closeMenu?.();
  menuApi?.closePanel?.();

  const scroll = $('cartographersJournalScroll');
  if (scroll) scroll.scrollTop = 0;

  // Geometry before first paint so version/email do not jump from CSS window defaults.
  syncCartographersJournalWindowGeometry();
  fancyScroller?.sync?.();

  root.hidden = false;
  document.body.classList.add('tz-modal-open');

  requestAnimationFrame(() => {
    syncCartographersJournalWindowGeometry();
    fancyScroller?.sync?.();
  });
}

function closeCartographersJournalPopup() {
  const root = $('cartographersJournalRoot');
  if (!root) return;

  root.hidden = true;

  if (
    $('menuRoot')?.hidden !== false
    && $('menuPanelRoot')?.hidden !== false
    && $('settingsRoot')?.hidden !== false
    && $('puzzleInfoRoot')?.hidden !== false
    && $('stuckPopupRoot')?.hidden !== false
    && $('hintRulesRoot')?.hidden !== false
  ) {
    document.body.classList.remove('tz-modal-open');
  }
}

export async function openCartographersJournal() {
  await openCartographersJournalPopup();
}

export function initCartographersJournal({ menuApi: menu } = {}) {
  menuApi = menu || null;

  const root = $('cartographersJournalRoot');
  if (!root) return null;

  fancyScroller = initFancyScroller({
    scrollEl: $('cartographersJournalScroll'),
    scrollerRoot: $('cartographersJournalScroller'),
    trackEl: $('cartographersJournalScrollerTrack'),
    pinEl: $('cartographersJournalScrollerPin'),
  });

  $('menuCartographersJournalBtn')?.addEventListener('click', () => {
    void openCartographersJournal();
  });

  $('cartographersJournalExit')?.addEventListener('click', closeCartographersJournalPopup);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeCartographersJournalPopup();
  });

  window.addEventListener('resize', () => {
    if (root.hidden) return;
    syncCartographersJournalWindowGeometry();
  });

  window.addEventListener('tilezilla:main-screen-v2-layout-saved', () => {
    requestAnimationFrame(() => syncCartographersJournalWindowGeometry());
  });

  window.addEventListener('tilezilla:cartographers-journal-layout-saved', () => {
    if (root.hidden) return;
    requestAnimationFrame(() => {
      syncCartographersJournalWindowGeometry();
      fancyScroller?.sync?.();
    });
  });

  return { openCartographersJournal, closeCartographersJournalPopup };
}
