/** Reset with hint tiles confirm — RestWithUsedHints.png + hit areas (% of frame). */

export const RESET_HINT_TILES_ART = { w: 1315, h: 1087 };

export const RESET_HINT_TILES_ITEM_DEFS = {
  close: { label: 'Close (X)', cssClass: 'tz-reset-hint__hit--close' },
  remove: { label: 'Remove Hints', cssClass: 'tz-reset-hint__hit--remove' },
  keep: { label: 'Keep Hints', cssClass: 'tz-reset-hint__hit--keep' },
};

export const DEFAULT_RESET_HINT_TILES_BUTTON_ART = {
  close: '/img/X-gold-rnd-btn.png',
};

export const DEFAULT_RESET_HINT_TILES_LAYOUT = {
  dialog: {
    artW: 1315,
    artH: 1087,
    baseSrc: '/img/RestWithUsedHints.png',
    displayPad: 32,
    maxDesignWidth: 390,
    widthScale: 0.92,
  },
  buttons: { ...DEFAULT_RESET_HINT_TILES_BUTTON_ART },
  items: {
    close: { x: 87.5, y: 2.2, w: 9, h: 8, hidden: false },
    remove: { x: 10, y: 78.5, w: 38, h: 12, hidden: false },
    keep: { x: 52, y: 78.5, w: 38, h: 12, hidden: false },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:reset-hint-tiles';
const LS_PENDING_KEY = 'tilezilla:layouts:reset-hint-tiles:pending';

let layoutCache = null;

export function isResetHintTilesTunerPage() {
  return /reset-hint-tiles-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearResetHintTilesLayoutCache() {
  layoutCache = null;
}

export function stashResetHintTilesLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearResetHintTilesLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeResetHintTilesLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RESET_HINT_TILES_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.buttons && typeof raw.buttons === 'object') {
    base.buttons = { ...base.buttons, ...raw.buttons };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!RESET_HINT_TILES_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadResetHintTilesLayout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isResetHintTilesTunerPage();

  if (!fromDisk && onTuner) {
    try {
      if (localStorage.getItem(LS_PENDING_KEY) === '1') {
        const draft = localStorage.getItem(LS_LAYOUT_KEY);
        if (draft) raw = JSON.parse(draft);
      }
    } catch {
      /* ignore */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/reset_hint_tiles_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergeResetHintTilesLayout(raw);
  return layoutCache;
}

export async function reloadResetHintTilesLayout() {
  clearResetHintTilesLayoutCache();
  return loadResetHintTilesLayout({ force: true, fromDisk: true });
}

export function getResetHintTilesItemLayout(itemKey, layout) {
  const merged = mergeResetHintTilesLayout(layout);
  const item = merged.items?.[itemKey] || {};
  const def = DEFAULT_RESET_HINT_TILES_LAYOUT.items?.[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function cssVarName(itemKey, dim) {
  return `--tz-reset-hint-${itemKey}-${dim}`;
}

export function fitResetHintTilesDialog(dialog, layout, {
  maxViewportWidth = typeof window !== 'undefined' ? window.innerWidth : 720,
  maxViewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900,
} = {}) {
  if (!dialog) return;

  const merged = mergeResetHintTilesLayout(layout);
  const d = merged.dialog || DEFAULT_RESET_HINT_TILES_LAYOUT.dialog;
  const artW = d.artW ?? RESET_HINT_TILES_ART.w;
  const artH = d.artH ?? RESET_HINT_TILES_ART.h;
  const displayPad = d.displayPad ?? 32;
  const maxDesign = d.maxDesignWidth ?? 390;
  const widthScale = d.widthScale ?? 0.92;

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

export function applyResetHintTilesLayout(layout, target = document.documentElement) {
  const merged = mergeResetHintTilesLayout(layout);
  const d = merged.dialog || DEFAULT_RESET_HINT_TILES_LAYOUT.dialog;

  target.style.setProperty('--tz-reset-hint-art-w', String(d.artW ?? RESET_HINT_TILES_ART.w));
  target.style.setProperty('--tz-reset-hint-art-h', String(d.artH ?? RESET_HINT_TILES_ART.h));
  target.style.setProperty('--tz-reset-hint-display-pad', `${d.displayPad ?? 32}px`);
  target.style.setProperty('--tz-reset-hint-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-reset-hint-width-scale', String(d.widthScale ?? 0.92));

  for (const key of Object.keys(RESET_HINT_TILES_ITEM_DEFS)) {
    const box = getResetHintTilesItemLayout(key, merged);
    target.style.setProperty(cssVarName(key, 'x'), `${box.x}%`);
    target.style.setProperty(cssVarName(key, 'y'), `${box.y}%`);
    target.style.setProperty(cssVarName(key, 'w'), `${box.w}%`);
    target.style.setProperty(cssVarName(key, 'h'), `${box.h}%`);
  }

  const doc = target.ownerDocument || document;
  const bg = doc.getElementById('resetHintTilesBg') || doc.querySelector('.tz-reset-hint-dialog__bg');
  if (bg && d.baseSrc) bg.src = d.baseSrc;

  const buttons = merged.buttons || DEFAULT_RESET_HINT_TILES_BUTTON_ART;
  const closeImg = doc.querySelector('#resetHintTilesCloseBtn img, .tz-reset-hint__hit--close img');
  if (closeImg && buttons.close) closeImg.src = buttons.close;

  for (const dialog of doc.querySelectorAll('.tz-reset-hint-dialog')) {
    fitResetHintTilesDialog(dialog, merged);
  }

  for (const [key, def] of Object.entries(RESET_HINT_TILES_ITEM_DEFS)) {
    const box = getResetHintTilesItemLayout(key, merged);
    const selector = def.cssClass ? `.${def.cssClass.split(' ').join('.')}` : '';
    if (!selector) continue;
    for (const el of doc.querySelectorAll(selector)) {
      if (box.hidden) el.setAttribute('hidden', '');
      else el.removeAttribute('hidden');
    }
  }
}

export async function initResetHintTilesLayout() {
  const layout = await loadResetHintTilesLayout();
  applyResetHintTilesLayout(layout, document.documentElement);
  return layout;
}
