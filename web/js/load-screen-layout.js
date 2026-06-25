/** Load screen button hits (% of 390×844 stage). */

import { DEFAULT_PREVIEW_V2_ART, isBlockedGameImagePath } from './preview-v2-layout.js';

export const LOAD_SCREEN_ITEM_DEFS = {
  preview: { label: 'Preview frame overlay', cssPrefix: 'preview' },
  guest: { label: 'Play As Guest', cssPrefix: 'guest' },
  login: { label: 'Login', cssPrefix: 'login' },
};

export const DEFAULT_LOAD_SCREEN_LAYOUT = {
  art: {
    frame: DEFAULT_PREVIEW_V2_ART.frame,
  },
  items: {
    preview: { x: 11, y: 33, w: 78, h: 24 },
    guest: { x: 4.5, y: 58.5, w: 44, h: 11.5 },
    login: { x: 51, y: 58.5, w: 44, h: 11.5 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:load-screen';
const LS_PENDING_KEY = 'tilezilla:layouts:load-screen:pending';

let layoutCache = null;

function cssBgUrl(path) {
  const p = String(path || '').trim();
  if (!p) return 'none';
  if (p.startsWith('url(')) return p;
  const encoded = p
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
    .replace(/^%2F/, '/');
  return `url("${encoded}")`;
}

export function clearLoadScreenLayoutCache() {
  layoutCache = null;
}

export function stashLoadScreenLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearLoadScreenLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeLoadScreenLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_LOAD_SCREEN_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.art && typeof raw.art === 'object') {
    base.art = { ...base.art, ...raw.art };
    if (isBlockedGameImagePath(base.art.frame)) {
      base.art.frame = DEFAULT_PREVIEW_V2_ART.frame;
    }
    delete base.art.rendererStage;
    delete base.art.rendererStageWidthScale;
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!LOAD_SCREEN_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadLoadScreenLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/load_screen_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeLoadScreenLayout(raw);
  return layoutCache;
}

export async function reloadLoadScreenLayout() {
  clearLoadScreenLayoutCache();
  return loadLoadScreenLayout({ force: true });
}

export function getLoadScreenItemLayout(itemKey, layout) {
  const merged = mergeLoadScreenLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_LOAD_SCREEN_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-load-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-h`, `${box.h}%`);
}

export function applyLoadScreenArt(layout) {
  const merged = mergeLoadScreenLayout(layout);
  const art = merged.art || DEFAULT_LOAD_SCREEN_LAYOUT.art;
  const framePath = isBlockedGameImagePath(art.frame) ? DEFAULT_PREVIEW_V2_ART.frame : art.frame;
  document.documentElement.style.setProperty(
    '--tz-load-preview-frame-bg',
    cssBgUrl(framePath),
  );
}

export function applyLoadScreenLayout(layout, target = document.documentElement) {
  const merged = mergeLoadScreenLayout(layout);
  for (const [key, meta] of Object.entries(LOAD_SCREEN_ITEM_DEFS)) {
    setItemVars(target, meta.cssPrefix, getLoadScreenItemLayout(key, merged));
  }
  const preview = getLoadScreenItemLayout('preview', merged);
  document.querySelectorAll('.tz-load-screen__preview').forEach((el) => {
    el.hidden = Boolean(preview.hidden);
  });
  applyLoadScreenArt(merged);
}

export function buildLoadScreenLayoutReport(layout) {
  const merged = mergeLoadScreenLayout(layout);
  const art = merged.art || DEFAULT_LOAD_SCREEN_LAYOUT.art;
  const lines = [
    'Load screen — 390×844 mobile stage',
    `Preview frame: ${art.frame}`,
    '',
  ];
  for (const [key, meta] of Object.entries(LOAD_SCREEN_ITEM_DEFS)) {
    const box = getLoadScreenItemLayout(key, merged);
    const hiddenPart = box.hidden ? ' · hidden' : '';
    lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%${hiddenPart}`);
  }
  return lines.join('\n');
}
