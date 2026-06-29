/** Guest "register to unlock" popup — dialog size + hit areas (% of frame). */

export const GUEST_LOGIN_REQUIRED_ART = { w: 1024, h: 1024 };

export const GUEST_LOGIN_REQUIRED_ITEM_DEFS = {
  message: { label: 'Message text', cssPrefix: 'message' },
  create: { label: 'Create a passport', cssPrefix: 'create' },
  login: { label: 'I already have a passport', cssPrefix: 'login' },
  cancel: { label: 'Not now / Continue as Guest', cssPrefix: 'cancel' },
  close: { label: 'Close (X)', cssPrefix: 'close' },
};

export const DEFAULT_GUEST_LOGIN_BUTTON_ART = {
  create: '/img/Create-Passport.png',
  login: '/img/IHaveAPassport.png',
  cancel: '/img/ContinueAsGuest.png',
};

export const DEFAULT_GUEST_LOGIN_REQUIRED_LAYOUT = {
  dialog: {
    artW: 1024,
    artH: 1024,
    baseSrc: '/img/GuestLoginRequired.png',
    displayPad: 32,
    maxDesignWidth: 390,
    widthScale: 0.92,
  },
  buttons: { ...DEFAULT_GUEST_LOGIN_BUTTON_ART },
  items: {
    message: { x: 11, y: 24, w: 78, h: 22, fontScale: 1, hidden: true },
    create: { x: 12, y: 58, w: 76, h: 11, hidden: false },
    login: { x: 12, y: 70, w: 76, h: 11, hidden: false },
    cancel: { x: 12, y: 82, w: 76, h: 10, hidden: false },
    close: { x: 90, y: 2, w: 7, h: 7, hidden: true },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:guest-login-required';
const LS_PENDING_KEY = 'tilezilla:layouts:guest-login-required:pending';

let layoutCache = null;

export function clearGuestLoginRequiredLayoutCache() {
  layoutCache = null;
}

export function stashGuestLoginRequiredLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearGuestLoginRequiredLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeGuestLoginRequiredLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_GUEST_LOGIN_REQUIRED_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.buttons && typeof raw.buttons === 'object') {
    base.buttons = { ...base.buttons, ...raw.buttons };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!GUEST_LOGIN_REQUIRED_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadGuestLoginRequiredLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/guest_login_required_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeGuestLoginRequiredLayout(raw);
  return layoutCache;
}

export async function reloadGuestLoginRequiredLayout() {
  clearGuestLoginRequiredLayoutCache();
  return loadGuestLoginRequiredLayout({ force: true });
}

export function getGuestLoginRequiredItemLayout(itemKey, layout) {
  const merged = mergeGuestLoginRequiredLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_GUEST_LOGIN_REQUIRED_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    fontScale: item.fontScale ?? def.fontScale ?? 1,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-guest-login-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-guest-login-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-guest-login-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-guest-login-${cssPrefix}-h`, `${box.h}%`);
  if (cssPrefix === 'message') {
    target.style.setProperty('--tz-guest-login-message-font-scale', String(box.fontScale ?? 1));
  }
}

function syncGuestLoginRequiredVisibility(layout) {
  const merged = mergeGuestLoginRequiredLayout(layout);
  const idByKey = {
    message: 'guestLoginRequiredMessage',
    create: 'guestLoginCreateBtn',
    login: 'guestLoginLoginBtn',
    cancel: 'guestLoginCancelBtn',
    close: 'guestLoginCloseBtn',
  };
  for (const [key, id] of Object.entries(idByKey)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.hidden = Boolean(getGuestLoginRequiredItemLayout(key, merged).hidden);
  }
}

export function applyGuestLoginRequiredLayout(layout, target = document.documentElement) {
  const merged = mergeGuestLoginRequiredLayout(layout);
  const d = merged.dialog || DEFAULT_GUEST_LOGIN_REQUIRED_LAYOUT.dialog;

  target.style.setProperty('--tz-guest-login-art-w', String(d.artW ?? GUEST_LOGIN_REQUIRED_ART.w));
  target.style.setProperty('--tz-guest-login-art-h', String(d.artH ?? GUEST_LOGIN_REQUIRED_ART.h));
  target.style.setProperty('--tz-guest-login-display-pad', `${d.displayPad ?? 32}px`);
  target.style.setProperty('--tz-guest-login-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-guest-login-width-scale', String(d.widthScale ?? 1));

  const bg = document.getElementById('guestLoginRequiredBg');
  if (bg && d.baseSrc) bg.src = d.baseSrc;

  const buttons = merged.buttons || DEFAULT_GUEST_LOGIN_BUTTON_ART;
  const createImg = document.querySelector('#guestLoginCreateBtn img');
  const loginImg = document.querySelector('#guestLoginLoginBtn img');
  const cancelImg = document.querySelector('#guestLoginCancelBtn img');
  if (createImg && buttons.create) createImg.src = buttons.create;
  if (loginImg && buttons.login) loginImg.src = buttons.login;
  if (cancelImg && buttons.cancel) cancelImg.src = buttons.cancel;

  for (const [key, meta] of Object.entries(GUEST_LOGIN_REQUIRED_ITEM_DEFS)) {
    setItemVars(target, meta.cssPrefix, getGuestLoginRequiredItemLayout(key, merged));
  }
  syncGuestLoginRequiredVisibility(merged);
}

export function buildGuestLoginRequiredLayoutReport(layout) {
  const merged = mergeGuestLoginRequiredLayout(layout);
  const d = merged.dialog || {};
  const lines = [
    'Guest login required popup (GuestLoginRequired.png)',
    `Base art: ${d.baseSrc ?? DEFAULT_GUEST_LOGIN_REQUIRED_LAYOUT.dialog.baseSrc}`,
    `Art ${d.artW ?? GUEST_LOGIN_REQUIRED_ART.w}×${d.artH ?? GUEST_LOGIN_REQUIRED_ART.h}`,
    `maxDesignWidth ${d.maxDesignWidth ?? 390}px · displayPad ${d.displayPad ?? 32}px · widthScale ${d.widthScale ?? 1}`,
    `Button art: create ${merged.buttons?.create ?? ''} · login ${merged.buttons?.login ?? ''} · cancel ${merged.buttons?.cancel ?? ''}`,
    'Hit areas are % of dialog frame (top-left origin)',
    '',
  ];
  for (const [key, def] of Object.entries(GUEST_LOGIN_REQUIRED_ITEM_DEFS)) {
    const box = getGuestLoginRequiredItemLayout(key, merged);
    const hiddenNote = box.hidden ? ' · hidden in game' : '';
    const extra = key === 'message' ? ` · fontScale ${box.fontScale ?? 1}` : '';
    lines.push(`${def.label}: x ${box.x}% · y ${box.y}% · w ${box.w}% · h ${box.h}%${extra}${hiddenNote}`);
  }
  return lines.join('\n');
}
