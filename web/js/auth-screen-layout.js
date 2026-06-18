/** Login, create passport, and logged-in profile overlay layouts (% of art frame). */

export const AUTH_PASSPORT_ART = { w: 1418, h: 2200 };

export const AUTH_SCREEN_DEFS = {
  login: {
    label: 'Logging in',
    art: '/img/Logging-in.png',
    items: {
      user: { label: 'Username / email', cssClass: 'auth-screen__input--user', baseClass: 'auth-screen__input' },
      pass: { label: 'Password', cssClass: 'auth-screen__input--pass', baseClass: 'auth-screen__input' },
      submit: { label: 'Open passport', cssClass: 'auth-screen__hit--submit', baseClass: 'auth-screen__hit' },
      secondary: { label: 'Issue new passport', cssClass: 'auth-screen__hit--secondary', baseClass: 'auth-screen__hit' },
      navDaily: { label: 'Daily Challenge (guest)', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Log out', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
    },
  },
  create: {
    label: 'Create passport',
    art: '/img/Create-Passport.png',
    items: {
      name: { label: 'Explorer name', cssClass: 'auth-screen__input--name', baseClass: 'auth-screen__input' },
      email: { label: 'Email', cssClass: 'auth-screen__input--email', baseClass: 'auth-screen__input' },
      pass: { label: 'Passphrase', cssClass: 'auth-screen__input--pass', baseClass: 'auth-screen__input' },
      pass2: { label: 'Confirm passphrase', cssClass: 'auth-screen__input--pass2', baseClass: 'auth-screen__input' },
      submit: { label: 'Issue passport', cssClass: 'auth-screen__hit--submit', baseClass: 'auth-screen__hit' },
      secondary: { label: 'Already have passport', cssClass: 'auth-screen__hit--secondary', baseClass: 'auth-screen__hit' },
      navDaily: { label: 'Daily Challenge (guest)', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Log out', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
    },
  },
  profile: {
    label: 'Logged in',
    art: '/img/Logged-in.png',
    items: {
      profileName: { label: 'Explorer name', cssClass: 'auth-screen__profile-name', baseClass: '' },
      navDaily: { label: 'Nav — Daily', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navAdventure: { label: 'Nav — Adventure', cssClass: 'auth-screen__hit--nav-adventure', baseClass: 'auth-screen__hit' },
      navRandom: { label: 'Nav — Random', cssClass: 'auth-screen__hit--nav-random', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Nav — Log out', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
      back: { label: 'Back', cssClass: 'auth-screen__hit--back', baseClass: 'auth-screen__hit' },
    },
  },
};

export const DEFAULT_AUTH_SCREEN_LAYOUT = {
  login: {
    dialog: { artW: 1418, artH: 2200, maxWidth: 420 },
    items: {
      user: { x: 18, y: 28.8, w: 64, h: 3.2 },
      pass: { x: 18, y: 34.8, w: 64, h: 3.2 },
      submit: { x: 22, y: 40.5, w: 56, h: 4.5 },
      secondary: { x: 22, y: 47.5, w: 56, h: 4 },
      navDaily: { x: 3, y: 92, w: 45, h: 5.5 },
      navLogout: { x: 52, y: 92, w: 45, h: 5.5 },
    },
  },
  create: {
    dialog: { artW: 1418, artH: 2200, maxWidth: 420 },
    items: {
      name: { x: 18, y: 24.5, w: 64, h: 2.8 },
      email: { x: 18, y: 29.5, w: 64, h: 2.8 },
      pass: { x: 18, y: 34.5, w: 64, h: 2.8 },
      pass2: { x: 18, y: 39.5, w: 64, h: 2.8 },
      submit: { x: 22, y: 45, w: 56, h: 4 },
      secondary: { x: 22, y: 51, w: 56, h: 4 },
      navDaily: { x: 3, y: 92, w: 45, h: 5.5 },
      navLogout: { x: 52, y: 92, w: 45, h: 5.5 },
    },
  },
  profile: {
    dialog: { artW: 1418, artH: 2200, maxWidth: 420 },
    items: {
      profileName: { x: 15, y: 22.5, w: 70, h: 4 },
      navDaily: { x: 3, y: 92, w: 22, h: 5.5 },
      navAdventure: { x: 27, y: 92, w: 22, h: 5.5 },
      navRandom: { x: 51, y: 92, w: 22, h: 5.5 },
      navLogout: { x: 75, y: 92, w: 22, h: 5.5 },
      back: { x: 2, y: 1.5, w: 12, h: 4 },
    },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:auth-screen';
const LS_PENDING_KEY = 'tilezilla:layouts:auth-screen:pending';

let layoutCache = null;

export function clearAuthScreenLayoutCache() {
  layoutCache = null;
}

export function stashAuthScreenLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearAuthScreenLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeAuthScreenLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_AUTH_SCREEN_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  for (const screenKey of Object.keys(AUTH_SCREEN_DEFS)) {
    const src = raw[screenKey];
    if (!src || typeof src !== 'object') continue;
    if (src.dialog && typeof src.dialog === 'object') {
      base[screenKey].dialog = { ...base[screenKey].dialog, ...src.dialog };
    }
    if (src.items && typeof src.items === 'object') {
      for (const [itemKey, val] of Object.entries(src.items)) {
        if (!AUTH_SCREEN_DEFS[screenKey].items[itemKey] || typeof val !== 'object') continue;
        base[screenKey].items[itemKey] = { ...base[screenKey].items[itemKey], ...val };
      }
    }
  }
  return base;
}

export async function loadAuthScreenLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/auth_screen_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeAuthScreenLayout(raw);
  return layoutCache;
}

export async function reloadAuthScreenLayout() {
  clearAuthScreenLayoutCache();
  return loadAuthScreenLayout({ force: true });
}

export function getAuthScreenItemLayout(screenKey, itemKey, layout) {
  const merged = mergeAuthScreenLayout(layout);
  const item = merged[screenKey]?.items?.[itemKey] || {};
  const def = DEFAULT_AUTH_SCREEN_LAYOUT[screenKey]?.items?.[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    fontScale: item.fontScale ?? def.fontScale ?? 1,
  };
}

export function authScreenTunerBoxClass(meta) {
  const base = meta?.baseClass ? `${meta.baseClass} ` : '';
  return `${base}${meta?.cssClass || ''} tuner-box`.trim();
}

function cssVarName(screenKey, itemKey, dim) {
  return `--auth-${screenKey}-${itemKey}-${dim}`;
}

export function applyAuthScreenLayout(layout, screenKey, target = document.documentElement) {
  const merged = mergeAuthScreenLayout(layout);
  const screen = merged[screenKey];
  if (!screen) return;

  const d = screen.dialog || DEFAULT_AUTH_SCREEN_LAYOUT[screenKey].dialog;
  target.style.setProperty(`--auth-${screenKey}-max-width`, `${d.maxWidth ?? 420}px`);

  const items = AUTH_SCREEN_DEFS[screenKey]?.items || {};
  for (const itemKey of Object.keys(items)) {
    const box = getAuthScreenItemLayout(screenKey, itemKey, merged);
    target.style.setProperty(cssVarName(screenKey, itemKey, 'x'), `${box.x}%`);
    target.style.setProperty(cssVarName(screenKey, itemKey, 'y'), `${box.y}%`);
    target.style.setProperty(cssVarName(screenKey, itemKey, 'w'), `${box.w}%`);
    target.style.setProperty(cssVarName(screenKey, itemKey, 'h'), `${box.h}%`);
    if (itemKey === 'profileName') {
      target.style.setProperty(cssVarName(screenKey, itemKey, 'font-scale'), String(box.fontScale));
    }
  }
}

export function applyAllAuthScreenLayouts(layout, target = document.documentElement) {
  for (const screenKey of Object.keys(AUTH_SCREEN_DEFS)) {
    applyAuthScreenLayout(layout, screenKey, target);
  }
}

export async function initAuthScreenLayout(screenKey) {
  const layout = await loadAuthScreenLayout();
  applyAuthScreenLayout(layout, screenKey, document.documentElement);
  return layout;
}

export function buildAuthScreenLayoutReport(layout, screenKey) {
  const merged = mergeAuthScreenLayout(layout);
  const lines = [`Auth screen — ${AUTH_SCREEN_DEFS[screenKey]?.label || screenKey}`, ''];
  const d = merged[screenKey]?.dialog || {};
  lines.push(`maxWidth: ${d.maxWidth ?? 420}px`);
  lines.push('');
  for (const [key, meta] of Object.entries(AUTH_SCREEN_DEFS[screenKey]?.items || {})) {
    const box = getAuthScreenItemLayout(screenKey, key, merged);
    lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%`);
  }
  return lines.join('\n');
}
