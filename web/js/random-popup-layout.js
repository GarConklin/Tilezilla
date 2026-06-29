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

export function isRandomPopupTunerPage() {
  return /random-popup-tuner(?:\.html)?$/i.test(window.location.pathname);
}

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

export async function loadRandomPopupLayout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isRandomPopupTunerPage();

  // Only the tuner prefers an in-progress browser draft. The live page always reads JSON from disk.
  if (!fromDisk && onTuner) {
    try {
      if (localStorage.getItem(LS_PENDING_KEY) === '1') {
        const draft = localStorage.getItem(LS_LAYOUT_KEY);
        if (draft) raw = JSON.parse(draft);
      }
    } catch {
      /* fall through */
    }
  }

  if (!raw || fromDisk) {
    try {
      const res = await fetch(`/data/random_popup_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  if (!raw && onTuner) {
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

export async function reloadRandomPopupLayout({ fromDisk = false } = {}) {
  clearRandomPopupLayoutCache();
  return loadRandomPopupLayout({ force: true, fromDisk });
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

const RANDOM_POPUP_BTN_SELECTORS = {
  remain: '.tz-random-dialog__btn--remain',
  venture: '.tz-random-dialog__btn--venture',
  close: '.tz-random-dialog__btn--close',
};

function randomPopupBoxStyle(box) {
  return {
    position: 'absolute',
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
    margin: '0',
    boxSizing: 'border-box',
  };
}

/** Inline tuned hits on real DOM nodes (tuner + in-game) so layout cannot drift via CSS vars. */
export function applyRandomPopupItemPositions(layout, root = document) {
  const merged = mergeRandomPopupLayout(layout);
  const doc = root.ownerDocument || root;
  const frames = [...(doc.querySelectorAll?.('.tz-random-dialog__frame') || [])];
  if (!frames.length) return;

  for (const frame of frames) {
    for (const [key, selector] of Object.entries(RANDOM_POPUP_BTN_SELECTORS)) {
      const box = getRandomPopupItemLayout(key, merged);
      for (const el of frame.querySelectorAll(selector)) {
        Object.assign(el.style, randomPopupBoxStyle(box));
        el.hidden = Boolean(box.hidden);
      }
    }
  }
}

/** Size random dialog to match in-game fit (design width + viewport caps). */
export function fitRandomPopupDialog(dialog, layout, {
  maxViewportWidth = typeof window !== 'undefined' ? window.innerWidth : 720,
  maxViewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900,
} = {}) {
  if (!dialog) return;

  const merged = mergeRandomPopupLayout(layout);
  const d = merged.dialog || DEFAULT_RANDOM_POPUP_LAYOUT.dialog;
  const artW = d.artW ?? RANDOM_POPUP_ART.w;
  const artH = d.artH ?? RANDOM_POPUP_ART.h;
  const displayPad = d.displayPad ?? 32;
  const maxDesign = d.maxDesignWidth ?? 390;
  const widthScale = d.widthScale ?? 1;

  const vw = Math.max(280, maxViewportWidth - displayPad);
  const vh = Math.max(320, maxViewportHeight - displayPad);
  const baseW = Math.floor(maxDesign * widthScale);
  const wFromHeight = (vh * artW) / artH;
  const w = Math.floor(Math.min(baseW, vw, wFromHeight, artW));
  const h = Math.floor((w * artH) / artW);

  dialog.style.width = `${w}px`;
  dialog.style.height = `${h}px`;
  dialog.style.aspectRatio = 'auto';
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

  const doc = target.ownerDocument || document;
  for (const dialog of doc.querySelectorAll('.tz-random-dialog')) {
    fitRandomPopupDialog(dialog, merged);
  }
  applyRandomPopupItemPositions(merged, doc);
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
