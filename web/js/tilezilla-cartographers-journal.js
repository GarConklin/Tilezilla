/**
 * The Cartographer's Journal — scrollable about panel (Hint Rules pattern).
 * Version label is loaded from /api/system-info (MySQL cache).
 */

import { syncCartographersJournalWindowGeometry } from './cartographers-journal-layout.js';
import { initFancyScroller } from './fancy-scroller.js';
import { clearSystemInfoCache, fetchSystemInfo } from './system-info.js';

let menuApi = null;
let fancyScroller = null;

function $(id) {
  return document.getElementById(id);
}

async function refreshJournalVersionBadge() {
  const badge = $('cartographersJournalVersion');
  if (!badge) return;
  clearSystemInfoCache();
  const info = await fetchSystemInfo();
  const version = String(info?.version || '').trim();
  badge.textContent = version ? `v${version}` : '—';
}

function openCartographersJournalPopup() {
  const root = $('cartographersJournalRoot');
  if (!root) return;

  menuApi?.closeMenu?.();
  menuApi?.closePanel?.();

  root.hidden = false;
  document.body.classList.add('tz-modal-open');

  const scroll = $('cartographersJournalScroll');
  if (scroll) scroll.scrollTop = 0;

  void refreshJournalVersionBadge();

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

export function openCartographersJournal() {
  openCartographersJournalPopup();
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
    openCartographersJournal();
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
