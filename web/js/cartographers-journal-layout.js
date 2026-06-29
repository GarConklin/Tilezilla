/** The Cartographer's Journal overlay — window, scroller, exit, version badge layout. */

export const JOURNAL_ART = { w: 844, h: 1798 };

export const CARTOGRAPHERS_JOURNAL_ITEM_DEFS = {
  window: { label: 'Window (panel)', kind: 'window' },
  scroller: { label: 'Fancy scroller (right edge)', kind: 'scroller' },
  exit: { label: 'Close button', kind: 'exit' },
  version: { label: 'Version badge (from DB)', kind: 'version' },
};

export const DEFAULT_JOURNAL_LAYOUT = {
  window: {
    topVh: 7.7,
    heightVh: 92.3,
    maxDesignWidth: 390,
    widthScale: 0.95,
    anchorMainScreenV2: true,
    nudgeX: 0,
    nudgeY: 0,
    scale: 1,
  },
  exit: {
    right: 6,
    bottom: 6,
    size: 48,
    nudgeX: 0,
    nudgeY: 0,
  },
  scroller: {
    right: 1.5,
    top: 4,
    height: 88,
    trackScale: 1,
    pinScale: 1,
    nudgeX: 0,
    nudgeY: 0,
  },
  version: {
    top: 16.8,
    nudgeX: 0,
    nudgeY: 0,
    fontScale: 1,
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:cartographers-journal';
const LS_PENDING_KEY = 'tilezilla:layouts:cartographers-journal:pending';

let layoutCache = null;

export function isCartographersJournalTunerPage() {
  return /cartographers-journal-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearCartographersJournalLayoutCache() {
  layoutCache = null;
}

export function mergeCartographersJournalLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_JOURNAL_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  for (const key of ['window', 'exit', 'scroller', 'version']) {
    if (raw[key] && typeof raw[key] === 'object') {
      base[key] = { ...base[key], ...raw[key] };
    }
  }
  return base;
}

export async function loadCartographersJournalLayout({ force = false } = {}) {
  if (layoutCache && !force) {
    return JSON.parse(JSON.stringify(layoutCache));
  }
  let raw = null;
  const tunerDraft = isCartographersJournalTunerPage()
    && localStorage.getItem(LS_PENDING_KEY) === '1';

  if (tunerDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* fall through to file */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/cartographers_journal_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }
  layoutCache = mergeCartographersJournalLayout(raw);
  return JSON.parse(JSON.stringify(layoutCache));
}

export async function reloadCartographersJournalLayout() {
  clearCartographersJournalLayoutCache();
  return loadCartographersJournalLayout({ force: true });
}

export function getCartographersJournalSectionLayout(sectionKey, layout) {
  const merged = mergeCartographersJournalLayout(layout);
  const fallback = DEFAULT_JOURNAL_LAYOUT[sectionKey] || {};
  const stored = merged[sectionKey];
  if (!stored || typeof stored !== 'object') return { ...fallback };
  return { ...fallback, ...stored };
}

export function applyCartographersJournalLayout(layout, target = document.documentElement) {
  const merged = mergeCartographersJournalLayout(layout);
  const w = merged.window || DEFAULT_JOURNAL_LAYOUT.window;
  const ex = merged.exit || DEFAULT_JOURNAL_LAYOUT.exit;
  const sc = merged.scroller || DEFAULT_JOURNAL_LAYOUT.scroller;
  const ver = merged.version || DEFAULT_JOURNAL_LAYOUT.version;

  target.style.setProperty('--tz-journal-top-vh', String(w.topVh ?? 7.7));
  target.style.setProperty('--tz-journal-height-vh', String(w.heightVh ?? 92.3));
  target.style.setProperty('--tz-journal-max-design-width', `${w.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-journal-width-scale', String(w.widthScale ?? 0.95));
  target.style.setProperty('--tz-journal-nudge-x', `${w.nudgeX ?? 0}px`);
  target.style.setProperty('--tz-journal-nudge-y', `${w.nudgeY ?? 0}px`);
  target.style.setProperty('--tz-journal-scale', String(w.scale ?? 1));

  requestAnimationFrame(() => syncCartographersJournalWindowGeometry(merged));

  target.style.setProperty('--tz-journal-exit-right', `${ex.right ?? 6}px`);
  target.style.setProperty('--tz-journal-exit-bottom', `${ex.bottom ?? 6}px`);
  target.style.setProperty('--tz-journal-exit-size', `${ex.size ?? 48}px`);
  target.style.setProperty('--tz-journal-exit-nudge-x', `${ex.nudgeX ?? 0}px`);
  target.style.setProperty('--tz-journal-exit-nudge-y', `${ex.nudgeY ?? 0}px`);

  target.style.setProperty('--tz-journal-scroller-right', String(sc.right ?? 1.5));
  target.style.setProperty('--tz-journal-scroller-top', String(sc.top ?? 4));
  target.style.setProperty('--tz-journal-scroller-height', String(sc.height ?? 88));
  target.style.setProperty('--tz-journal-scroller-track-scale', String(sc.trackScale ?? 1));
  target.style.setProperty('--tz-journal-scroller-pin-scale', String(sc.pinScale ?? 1));
  target.style.setProperty('--tz-journal-scroller-nudge-x', `${sc.nudgeX ?? 0}px`);
  target.style.setProperty('--tz-journal-scroller-nudge-y', `${sc.nudgeY ?? 0}px`);

  target.style.setProperty('--tz-journal-version-top', `${ver.top ?? 16.8}%`);
  target.style.setProperty('--tz-journal-version-nudge-x', `${ver.nudgeX ?? 0}px`);
  target.style.setProperty('--tz-journal-version-nudge-y', `${ver.nudgeY ?? 0}px`);
  target.style.setProperty('--tz-journal-version-font-scale', String(ver.fontScale ?? 1));
}

export function buildCartographersJournalLayoutReport(layout) {
  const merged = mergeCartographersJournalLayout(layout);
  const w = merged.window || {};
  const ex = merged.exit || {};
  const sc = merged.scroller || {};
  const ver = merged.version || {};
  const effectiveW = Math.round((w.maxDesignWidth ?? 390) * (w.widthScale ?? 0.95));
  return [
    "Cartographer's Journal layout report (390px game width preview)",
    '',
    `Window: top ${w.topVh ?? 7.7}vh · height ${w.heightVh ?? 92.3}vh · max ${w.maxDesignWidth ?? 390}px × widthScale ${w.widthScale ?? 0.95} (= ${effectiveW}px)`,
    `Window: nudgeX ${w.nudgeX ?? 0}px · nudgeY ${w.nudgeY ?? 0}px · scale ${w.scale ?? 1}`,
    `Window: anchorMainScreenV2 ${w.anchorMainScreenV2 !== false}`,
    '',
    `Scroller: right ${sc.right ?? 1.5}% · top ${sc.top ?? 4}% · height ${sc.height ?? 88}%`,
    `Scroller: trackScale ${sc.trackScale ?? 1} · pinScale ${sc.pinScale ?? 1}`,
    `Scroller: nudgeX ${sc.nudgeX ?? 0}px · nudgeY ${sc.nudgeY ?? 0}px`,
    '',
    `Close: right ${ex.right ?? 6}px · bottom ${ex.bottom ?? 6}px · size ${ex.size ?? 48}px`,
    `Close: nudgeX ${ex.nudgeX ?? 0}px · nudgeY ${ex.nudgeY ?? 0}px`,
    '',
    `Version: top ${ver.top ?? 16.8}% · nudgeX ${ver.nudgeX ?? 0}px · nudgeY ${ver.nudgeY ?? 0}px · fontScale ${ver.fontScale ?? 1}`,
  ].join('\n');
}

export function stashCartographersJournalLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore quota */
  }
}

export function clearCartographersJournalLayoutDraft() {
  try {
    localStorage.removeItem(LS_LAYOUT_KEY);
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function syncCartographersJournalWindowGeometry(layout) {
  const win = document.querySelector('.tz-cartographers-journal-window');
  if (!win) return;

  const merged = mergeCartographersJournalLayout(layout ?? layoutCache);
  const w = getCartographersJournalSectionLayout('window', merged);
  const useV2Anchor = w.anchorMainScreenV2 !== false
    && document.querySelector('.tz-main-v2-app');

  if (!useV2Anchor) {
    win.classList.remove('is-msv2-synced');
    win.style.removeProperty('--tz-journal-sync-top');
    win.style.removeProperty('--tz-journal-sync-width');
    win.style.removeProperty('--tz-journal-sync-height');
    return;
  }

  const board = document.querySelector('.tz-main-v2-app .tz-board-section');
  const tilebag = document.querySelector('.tz-main-v2-app .tz-tilebag-container');
  if (!board || !tilebag) {
    win.classList.remove('is-msv2-synced');
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const tilebagRect = tilebag.getBoundingClientRect();
  const uiScale = parseFloat(document.documentElement.dataset.uiScale) || 1;
  const widthScale = Number(w.widthScale ?? 0.95);
  const width = (Number(w.maxDesignWidth) || 390) * widthScale * uiScale;
  const top = boardRect.top + (Number(w.nudgeY) || 0);
  const height = Math.max(0, tilebagRect.bottom - top);

  win.classList.add('is-msv2-synced');
  win.style.setProperty('--tz-journal-sync-top', `${top}px`);
  win.style.setProperty('--tz-journal-sync-width', `${width}px`);
  win.style.setProperty('--tz-journal-sync-height', `${height}px`);
}
