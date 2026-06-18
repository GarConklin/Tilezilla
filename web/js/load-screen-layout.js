/** Load screen (index.html) — plaque position + button hit areas (% of frame). */

export const LOAD_SCREEN_ART = { w: 1024, h: 1536 };

export const LOAD_SCREEN_ITEM_DEFS = {
  guest: { label: 'Play As Guest', cssPrefix: 'guest' },
  login: { label: 'Login', cssPrefix: 'login' },
};

export const DEFAULT_LOAD_SCREEN_LAYOUT = {
  dialog: {
    artW: 1024,
    artH: 1536,
    top: 54,
    widthScale: 1,
    topNudge: 0,
  },
  items: {
    guest: { x: 4.5, y: 58.5, w: 44, h: 11.5 },
    login: { x: 51, y: 58.5, w: 44, h: 11.5 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:load-screen';
const LS_PENDING_KEY = 'tilezilla:layouts:load-screen:pending';

let layoutCache = null;

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
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
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
  };
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-load-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-h`, `${box.h}%`);
}

export function applyLoadScreenLayout(layout, target = document.documentElement) {
  const merged = mergeLoadScreenLayout(layout);
  const d = merged.dialog || DEFAULT_LOAD_SCREEN_LAYOUT.dialog;

  target.style.setProperty('--tz-load-art-w', String(d.artW ?? LOAD_SCREEN_ART.w));
  target.style.setProperty('--tz-load-art-h', String(d.artH ?? LOAD_SCREEN_ART.h));
  target.style.setProperty('--tz-load-screen-top', `${d.top ?? 54}%`);
  target.style.setProperty('--tz-load-width-scale', String(d.widthScale ?? 1));
  target.style.setProperty('--tz-load-screen-top-nudge', `${d.topNudge ?? 0}px`);

  for (const [key, meta] of Object.entries(LOAD_SCREEN_ITEM_DEFS)) {
    setItemVars(target, meta.cssPrefix, getLoadScreenItemLayout(key, merged));
  }
}

export function buildLoadScreenLayoutReport(layout) {
  const merged = mergeLoadScreenLayout(layout);
  const lines = ['Load screen layout', ''];
  const d = merged.dialog;
  lines.push(`Plaque top: ${d.top ?? 54}%`);
  lines.push(`Plaque width scale: ${d.widthScale ?? 1}`);
  lines.push(`Top nudge: ${d.topNudge ?? 0}px`);
  lines.push('');
  for (const [key, meta] of Object.entries(LOAD_SCREEN_ITEM_DEFS)) {
    const box = getLoadScreenItemLayout(key, merged);
    lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%`);
  }
  return lines.join('\n');
}
