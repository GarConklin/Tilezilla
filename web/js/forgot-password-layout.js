/** Forgot password popup — forgotPassword.png + email / send / cancel (% of frame). */

export const FORGOT_PASSWORD_ART = { w: 1402, h: 1122 };

export const FORGOT_PASSWORD_PLAQUE_SRC = '/img/forgotPassword.png';

export const FORGOT_PASSWORD_ITEM_DEFS = {
  email: { label: 'Email input', cssClass: 'forgot-password__input', baseClass: '' },
  send: { label: 'Send reset link', cssClass: 'forgot-password__hit--send', baseClass: 'auth-screen__hit' },
  cancel: { label: 'Cancel', cssClass: 'forgot-password__hit--cancel', baseClass: 'auth-screen__hit' },
  feedback: { label: 'Status message (optional)', cssClass: 'forgot-password__feedback', baseClass: '' },
};

export const DEFAULT_FORGOT_PASSWORD_LAYOUT = {
  dialog: {
    artW: 1402,
    artH: 1122,
    maxWidth: 390,
    widthScale: 0.92,
  },
  items: {
    email: { x: 22, y: 41, w: 56, h: 6.5, fontScale: 1 },
    send: { x: 8, y: 72, w: 42, h: 10 },
    cancel: { x: 52, y: 72, w: 42, h: 10 },
    feedback: { x: 14, y: 58, w: 72, h: 8, fontScale: 1, hidden: false },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:forgot-password';
const LS_PENDING_KEY = 'tilezilla:layouts:forgot-password:pending';

let layoutCache = null;

export function forgotPasswordTunerBoxClass(meta) {
  const base = meta?.baseClass ? `${meta.baseClass} ` : '';
  return `${base}${meta?.cssClass || ''} tuner-box`.trim();
}

export function clearForgotPasswordLayoutCache() {
  layoutCache = null;
}

export function stashForgotPasswordLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearForgotPasswordLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeForgotPasswordLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_FORGOT_PASSWORD_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!FORGOT_PASSWORD_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadForgotPasswordLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/forgot_password_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergeForgotPasswordLayout(raw);
  return layoutCache;
}

export async function reloadForgotPasswordLayout() {
  clearForgotPasswordLayoutCache();
  return loadForgotPasswordLayout({ force: true });
}

export function getForgotPasswordItemLayout(itemKey, layout) {
  const merged = mergeForgotPasswordLayout(layout);
  const item = merged.items?.[itemKey] || {};
  const def = DEFAULT_FORGOT_PASSWORD_LAYOUT.items?.[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    fontScale: item.fontScale ?? def.fontScale ?? 1,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function cssVarName(itemKey, dim) {
  return `--forgot-password-${itemKey}-${dim}`;
}

export function applyForgotPasswordLayout(layout, target = document.documentElement) {
  const merged = mergeForgotPasswordLayout(layout);
  const d = merged.dialog || DEFAULT_FORGOT_PASSWORD_LAYOUT.dialog;
  target.style.setProperty('--forgot-password-max-width', `${d.maxWidth ?? 390}px`);
  target.style.setProperty('--forgot-password-width-scale', String(d.widthScale ?? 0.92));
  target.style.setProperty('--forgot-password-art-w', String(d.artW ?? FORGOT_PASSWORD_ART.w));
  target.style.setProperty('--forgot-password-art-h', String(d.artH ?? FORGOT_PASSWORD_ART.h));

  for (const key of Object.keys(FORGOT_PASSWORD_ITEM_DEFS)) {
    const box = getForgotPasswordItemLayout(key, merged);
    target.style.setProperty(cssVarName(key, 'x'), `${box.x}%`);
    target.style.setProperty(cssVarName(key, 'y'), `${box.y}%`);
    target.style.setProperty(cssVarName(key, 'w'), `${box.w}%`);
    target.style.setProperty(cssVarName(key, 'h'), `${box.h}%`);
    if (key === 'email' || key === 'feedback') {
      target.style.setProperty(cssVarName(key, 'font-scale'), String(box.fontScale));
    }
  }
}

export async function initForgotPasswordLayout() {
  const layout = await loadForgotPasswordLayout();
  applyForgotPasswordLayout(layout, document.documentElement);
  return layout;
}
