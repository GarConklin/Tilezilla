/** Random puzzle popup — dialog size + hit areas (% of frame). */

export const RANDOM_POPUP_ART = { w: 1024, h: 811 };

export const RANDOM_POPUP_ITEM_DEFS = {
  remain: { label: 'Remain on the Path', cssPrefix: 'remain' },
  venture: { label: 'Venture Forth', cssPrefix: 'venture' },
  close: { label: 'Close (X)', cssPrefix: 'close' },
};

export const DEFAULT_RANDOM_POPUP_LAYOUT = {
  dialog: {
    artW: 1024,
    artH: 811,
    displayPad: 32,
    maxDesignWidth: 390,
    widthScale: 0.95,
  },
  items: {
    remain: { x: 5.2, y: 82.2, w: 42.5, h: 12.5, hidden: false },
    venture: { x: 51.8, y: 82.2, w: 42.5, h: 12.5, hidden: false },
    close: { x: 90.2, y: 1.6, w: 6.8, h: 7.2, hidden: true },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:random-popup';
const LS_PENDING_KEY = 'tilezilla:layouts:random-popup:pending';

let layoutCache = null;

export function clearRandomPopupLayoutCache() {
  layoutCache = null;
}

export function stashRandomPopupLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearRandomPopupLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeRandomPopupLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RANDOM_POPUP_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!RANDOM_POPUP_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadRandomPopupLayout({ force = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  let pendingDraft = false;
  try {
    pendingDraft = localStorage.getItem(LS_PENDING_KEY) === '1';
    if (pendingDraft) {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    }
  } catch {
    pendingDraft = false;
  }

  if (!pendingDraft) {
    try {
      const res = await fetch(`/data/random_popup_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  if (!raw && !pendingDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  layoutCache = mergeRandomPopupLayout(raw);
  return layoutCache;
}

export async function reloadRandomPopupLayout() {
  clearRandomPopupLayoutCache();
  return loadRandomPopupLayout({ force: true });
}

export function getRandomPopupItemLayout(itemKey, layout) {
  const merged = mergeRandomPopupLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_RANDOM_POPUP_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-random-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-random-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-random-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-random-${cssPrefix}-h`, `${box.h}%`);
}

function syncRandomPopupItemVisibility(layout) {
  const merged = mergeRandomPopupLayout(layout);
  const idByKey = {
    remain: 'randomRemainBtn',
    venture: 'randomVentureBtn',
    close: 'randomCloseBtn',
  };
  for (const [key, id] of Object.entries(idByKey)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.hidden = Boolean(getRandomPopupItemLayout(key, merged).hidden);
  }
}

export function applyRandomPopupLayout(layout, target = document.documentElement) {
  const merged = mergeRandomPopupLayout(layout);
  const d = merged.dialog || DEFAULT_RANDOM_POPUP_LAYOUT.dialog;

  target.style.setProperty('--tz-random-art-w', String(d.artW ?? RANDOM_POPUP_ART.w));
  target.style.setProperty('--tz-random-art-h', String(d.artH ?? RANDOM_POPUP_ART.h));
  target.style.setProperty('--tz-random-display-pad', `${d.displayPad ?? 32}px`);
  target.style.setProperty('--tz-random-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-random-width-scale', String(d.widthScale ?? 1));

  for (const [key, meta] of Object.entries(RANDOM_POPUP_ITEM_DEFS)) {
    setItemVars(target, meta.cssPrefix, getRandomPopupItemLayout(key, merged));
  }
  syncRandomPopupItemVisibility(merged);
}

export function buildRandomPopupLayoutReport(layout) {
  const merged = mergeRandomPopupLayout(layout);
  const d = merged.dialog || {};
  const lines = [
    'Random puzzle popup layout (RandomPuzzle-Base.png)',
    `Art ${d.artW ?? RANDOM_POPUP_ART.w}×${d.artH ?? RANDOM_POPUP_ART.h}`,
    `maxDesignWidth ${d.maxDesignWidth ?? 390}px · displayPad ${d.displayPad ?? 32}px · widthScale ${d.widthScale ?? 1}`,
    'Hit areas are % of dialog frame (top-left origin)',
    '',
  ];
  for (const [key, def] of Object.entries(RANDOM_POPUP_ITEM_DEFS)) {
    const box = getRandomPopupItemLayout(key, merged);
    const hiddenNote = box.hidden ? ' · hidden in game' : '';
    lines.push(`${def.label}: x ${box.x}% · y ${box.y}% · w ${box.w}% · h ${box.h}%${hiddenNote}`);
  }
  return lines.join('\n');
}
