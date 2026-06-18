/** Login / register error plaque — message + OK + close (% of frame). */

export const AUTH_ERROR_ART = { w: 1267, h: 1022 };

export const AUTH_ERROR_PLAQUE_SRC = '/img/login-Erros-PlaqueBase.png';

export const AUTH_ERROR_ITEM_DEFS = {
  message: { label: 'Error message (red area)', cssClass: 'auth-error__message', baseClass: '' },
  ok: { label: 'OK button', cssClass: 'auth-error__hit--ok', baseClass: 'auth-screen__hit' },
  close: { label: 'Close (X)', cssClass: 'auth-error__hit--close', baseClass: 'auth-screen__hit' },
};

export const DEFAULT_AUTH_ERROR_LAYOUT = {
  dialog: {
    artW: 1267,
    artH: 1022,
    maxWidth: 390,
    widthScale: 0.92,
  },
  items: {
    message: { x: 14, y: 47.5, w: 72, h: 14, fontScale: 1 },
    ok: { x: 32, y: 76, w: 36, h: 9 },
    close: { x: 86, y: 2.5, w: 10, h: 8 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:auth-error';
const LS_PENDING_KEY = 'tilezilla:layouts:auth-error:pending';

let layoutCache = null;

export function authErrorTunerBoxClass(meta) {
  const base = meta?.baseClass ? `${meta.baseClass} ` : '';
  return `${base}${meta?.cssClass || ''} tuner-box`.trim();
}

export function clearAuthErrorLayoutCache() {
  layoutCache = null;
}

export function stashAuthErrorLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearAuthErrorLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeAuthErrorLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_AUTH_ERROR_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!AUTH_ERROR_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadAuthErrorLayout({ force = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  try {
    const pending = localStorage.getItem(LS_PENDING_KEY) === '1';
    if (pending) {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    }
  } catch {
    /* ignore */
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/auth_error_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergeAuthErrorLayout(raw);
  return layoutCache;
}

export async function reloadAuthErrorLayout() {
  clearAuthErrorLayoutCache();
  return loadAuthErrorLayout({ force: true });
}

export function getAuthErrorItemLayout(itemKey, layout) {
  const merged = mergeAuthErrorLayout(layout);
  const item = merged.items?.[itemKey] || {};
  const def = DEFAULT_AUTH_ERROR_LAYOUT.items?.[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    fontScale: item.fontScale ?? def.fontScale ?? 1,
  };
}

function cssVarName(itemKey, dim) {
  return `--auth-error-${itemKey}-${dim}`;
}

export function applyAuthErrorLayout(layout, target = document.documentElement) {
  const merged = mergeAuthErrorLayout(layout);
  const d = merged.dialog || DEFAULT_AUTH_ERROR_LAYOUT.dialog;
  target.style.setProperty('--auth-error-max-width', `${d.maxWidth ?? 390}px`);
  target.style.setProperty('--auth-error-width-scale', String(d.widthScale ?? 0.92));
  target.style.setProperty('--auth-error-art-w', String(d.artW ?? AUTH_ERROR_ART.w));
  target.style.setProperty('--auth-error-art-h', String(d.artH ?? AUTH_ERROR_ART.h));

  for (const key of Object.keys(AUTH_ERROR_ITEM_DEFS)) {
    const box = getAuthErrorItemLayout(key, merged);
    target.style.setProperty(cssVarName(key, 'x'), `${box.x}%`);
    target.style.setProperty(cssVarName(key, 'y'), `${box.y}%`);
    target.style.setProperty(cssVarName(key, 'w'), `${box.w}%`);
    target.style.setProperty(cssVarName(key, 'h'), `${box.h}%`);
    if (key === 'message') {
      target.style.setProperty(cssVarName(key, 'font-scale'), String(box.fontScale));
    }
  }
}

export async function initAuthErrorLayout() {
  const layout = await loadAuthErrorLayout();
  applyAuthErrorLayout(layout, document.documentElement);
  return layout;
}
