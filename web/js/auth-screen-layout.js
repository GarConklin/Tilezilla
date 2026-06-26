/** Login, create passport, and logged-in profile overlay layouts (% of art frame). */

export const AUTH_PASSPORT_ART = { w: 1418, h: 2200 };

export const PROFILE_HIT_ART = {
  back: '/img/BAck-gold-rnd-btn.png',
  closeX: '/img/X-gold-rnd-btn.png',
};

const profileStat = (label, slot) => ({
  label,
  kind: 'text',
  slot,
  cssClass: 'auth-screen__profile-stat',
  baseClass: '',
});

const profileIcon = (label, slot, mockSrc) => ({
  label,
  kind: 'icon',
  slot,
  mockSrc,
  cssClass: 'auth-screen__profile-icon',
  baseClass: '',
});

export const AUTH_SCREEN_DEFS = {
  login: {
    label: 'Logging in',
    art: '/img/Logging-in.png',
    items: {
      user: { label: 'Username / email', kind: 'input', cssClass: 'auth-screen__input--user', baseClass: 'auth-screen__input' },
      pass: { label: 'Password', kind: 'input', cssClass: 'auth-screen__input--pass', baseClass: 'auth-screen__input' },
      submit: { label: 'Open passport', kind: 'hit', cssClass: 'auth-screen__hit--submit', baseClass: 'auth-screen__hit' },
      secondary: { label: 'Issue new passport', kind: 'hit', cssClass: 'auth-screen__hit--secondary', baseClass: 'auth-screen__hit' },
      navDaily: { label: 'Daily Challenge (guest)', kind: 'hit', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Log out', kind: 'hit', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
    },
  },
  create: {
    label: 'Create passport',
    art: '/img/Create-Passport.png',
    items: {
      name: { label: 'Explorer name', kind: 'input', cssClass: 'auth-screen__input--name', baseClass: 'auth-screen__input' },
      email: { label: 'Email', kind: 'input', cssClass: 'auth-screen__input--email', baseClass: 'auth-screen__input' },
      pass: { label: 'Passphrase', kind: 'input', cssClass: 'auth-screen__input--pass', baseClass: 'auth-screen__input' },
      pass2: { label: 'Confirm passphrase', kind: 'input', cssClass: 'auth-screen__input--pass2', baseClass: 'auth-screen__input' },
      submit: { label: 'Issue passport', kind: 'hit', cssClass: 'auth-screen__hit--submit', baseClass: 'auth-screen__hit' },
      secondary: { label: 'Already have passport', kind: 'hit', cssClass: 'auth-screen__hit--secondary', baseClass: 'auth-screen__hit' },
      navDaily: { label: 'Daily Challenge (guest)', kind: 'hit', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Log out', kind: 'hit', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
    },
  },
  profile: {
    label: 'Logged in',
    art: '/img/Logged-in.png',
    items: {
      profileName: { label: 'Name', kind: 'text', cssClass: 'auth-screen__profile-name', baseClass: '' },
      rankBadge: profileIcon('Rank badge', 'rankBadge', '/img/ranks/Wanderer.png'),
      sublevelIcon: profileIcon('Sublevel icon', 'sublevelIcon', '/img/ranks/gld-12.png'),
      adventureProgress: profileStat('Adventure progress', 'adventureProgress'),
      routesDiscovered: profileStat('Routes discovered', 'routesDiscovered'),
      hintTokens: profileStat('Hint tokens', 'hintTokens'),
      memberSince: profileStat('Member since', 'memberSince'),
      passportId: profileStat('Passport ID', 'passportId'),
      explorersRegistered: profileStat('Explorers registered', 'explorersRegistered'),
      todaysChallenge: profileStat("Today's challenge ID", 'todaysChallenge'),
      recentPuzzleSolved: profileStat('Most recent puzzle solved', 'recentPuzzleSolved'),
      recentDailyCompleted: profileStat('Most recent daily completed', 'recentDailyCompleted'),
      mostSolvedPuzzle: profileStat('Most solved puzzle', 'mostSolvedPuzzle'),
      latestDiscovery: profileStat('Latest discovery', 'latestDiscovery'),
      totalPlayTime: profileStat('Total play time', 'totalPlayTime'),
      navDaily: { label: 'Nav — Daily', kind: 'hit', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navAdventure: { label: 'Nav — Adventure', kind: 'hit', cssClass: 'auth-screen__hit--nav-adventure', baseClass: 'auth-screen__hit' },
      navRandom: { label: 'Nav — Random', kind: 'hit', cssClass: 'auth-screen__hit--nav-random', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Nav — Log out', kind: 'hit', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
      back: { label: 'Back', kind: 'hit', cssClass: 'auth-screen__hit--back', baseClass: 'auth-screen__hit', art: PROFILE_HIT_ART.back },
      closeX: { label: 'Close X', kind: 'hit', cssClass: 'auth-screen__hit--close-x', baseClass: 'auth-screen__hit', art: PROFILE_HIT_ART.closeX },
    },
  },
};

/** Field-picker grouping for logged-in tuner. */
export const PROFILE_FIELD_SECTIONS = [
  {
    title: 'Passport (top)',
    keys: [
      'profileName',
      'rankBadge',
      'sublevelIcon',
      'adventureProgress',
      'routesDiscovered',
      'hintTokens',
      'memberSince',
      'passportId',
    ],
  },
  {
    title: 'Left journal',
    keys: ['explorersRegistered', 'todaysChallenge'],
  },
  {
    title: 'Right journal',
    keys: [
      'recentPuzzleSolved',
      'recentDailyCompleted',
      'mostSolvedPuzzle',
      'latestDiscovery',
      'totalPlayTime',
    ],
  },
  {
    title: 'Navigation',
    keys: ['back', 'closeX', 'navDaily', 'navAdventure', 'navRandom', 'navLogout'],
  },
];

export const PROFILE_ICON_MOCK = {
  rankBadge: '/img/ranks/Wanderer.png',
  sublevelIcon: '/img/ranks/gld-12.png',
};

export const PROFILE_LAYOUT_MOCK = {
  profileName: 'Explorer TileMaster',
  adventureProgress: '42%',
  routesDiscovered: '128',
  hintTokens: '7',
  memberSince: 'Jun 2026',
  passportId: 'TZ-4F2A9C',
  explorersRegistered: '1,204',
  todaysChallenge: '5x6-0B-BFA',
  recentPuzzleSolved: '5x6-0B-BNZ',
  recentDailyCompleted: '5x6-0B-AZZ',
  mostSolvedPuzzle: '5x6-0B-BJO',
  latestDiscovery: '5x6-0B-CPX',
  totalPlayTime: '18h 42m',
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
      profileName: { x: 15, y: 22.5, w: 70, h: 4, fontScale: 1 },
      rankBadge: { x: 14, y: 15.5, w: 26, h: 10 },
      sublevelIcon: { x: 42, y: 17.5, w: 14, h: 6 },
      adventureProgress: { x: 10, y: 32, w: 80, h: 2.5, fontScale: 1 },
      routesDiscovered: { x: 22, y: 39, w: 18, h: 4, fontScale: 1 },
      hintTokens: { x: 52, y: 39, w: 18, h: 4, fontScale: 1 },
      memberSince: { x: 22, y: 44, w: 18, h: 4, fontScale: 1 },
      passportId: { x: 52, y: 44, w: 35, h: 4, fontScale: 0.92 },
      explorersRegistered: { x: 10, y: 56, w: 35, h: 3.5, fontScale: 1 },
      todaysChallenge: { x: 10, y: 74, w: 35, h: 3.5, fontScale: 0.92 },
      recentPuzzleSolved: { x: 54, y: 56, w: 38, h: 3.5, fontScale: 0.92 },
      recentDailyCompleted: { x: 54, y: 62, w: 38, h: 3.5, fontScale: 0.92 },
      mostSolvedPuzzle: { x: 54, y: 68, w: 38, h: 3.5, fontScale: 0.92 },
      latestDiscovery: { x: 54, y: 74, w: 38, h: 3.5, fontScale: 0.92 },
      totalPlayTime: { x: 54, y: 80, w: 38, h: 3.5, fontScale: 1 },
      navDaily: { x: 3, y: 92, w: 22, h: 5.5 },
      navAdventure: { x: 27, y: 92, w: 22, h: 5.5 },
      navRandom: { x: 51, y: 92, w: 22, h: 5.5 },
      navLogout: { x: 75, y: 92, w: 22, h: 5.5 },
      back: { x: 2, y: 1.5, w: 10, h: 5 },
      closeX: { x: 86, y: 1.5, w: 10, h: 5 },
    },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:auth-screen';
const LS_PENDING_KEY = 'tilezilla:layouts:auth-screen:pending';
const LS_PENDING_PREFIX = 'tilezilla:layouts:auth-screen:pending:';

let layoutCache = null;

export function clearAuthScreenLayoutCache() {
  layoutCache = null;
}

function pendingKeyFor(screenKey) {
  return `${LS_PENDING_PREFIX}${screenKey}`;
}

export function hasAuthScreenLayoutDraft(screenKey) {
  try {
    if (screenKey) return localStorage.getItem(pendingKeyFor(screenKey)) === '1';
    if (localStorage.getItem(LS_PENDING_KEY) === '1') return true;
    return Object.keys(AUTH_SCREEN_DEFS).some(
      (key) => localStorage.getItem(pendingKeyFor(key)) === '1',
    );
  } catch {
    return false;
  }
}

export function stashAuthScreenLayoutDraft(layout, screenKey) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    if (screenKey) {
      localStorage.setItem(pendingKeyFor(screenKey), '1');
      localStorage.removeItem(LS_PENDING_KEY);
    } else {
      localStorage.setItem(LS_PENDING_KEY, '1');
    }
  } catch {
    /* ignore */
  }
}

export function clearAuthScreenLayoutDraft(screenKey) {
  try {
    if (screenKey) {
      localStorage.removeItem(pendingKeyFor(screenKey));
      return;
    }
    localStorage.removeItem(LS_PENDING_KEY);
    for (const key of Object.keys(AUTH_SCREEN_DEFS)) {
      localStorage.removeItem(pendingKeyFor(key));
    }
  } catch {
    /* ignore */
  }
}

export async function fetchAuthScreenLayoutRaw() {
  try {
    const res = await fetch(`/data/auth_screen_layout.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  return null;
}

/** Replace one screen section in a merged layout (login / create / profile). */
export function mergeAuthScreenSection(layout, screenKey, section) {
  const merged = mergeAuthScreenLayout(layout);
  if (!section || typeof section !== 'object') return merged;
  if (section.dialog && typeof section.dialog === 'object') {
    merged[screenKey].dialog = { ...merged[screenKey].dialog, ...section.dialog };
  }
  if (section.items && typeof section.items === 'object') {
    if (screenKey === 'profile') migrateProfileIconLayout(section.items);
    for (const [itemKey, val] of Object.entries(section.items)) {
      if (!AUTH_SCREEN_DEFS[screenKey].items[itemKey] || typeof val !== 'object') continue;
      merged[screenKey].items[itemKey] = { ...merged[screenKey].items[itemKey], ...val };
    }
  }
  return merged;
}

/** Build full file payload: latest on-disk layout with only screenKey overwritten. */
export async function buildAuthScreenLayoutSavePayload(screenKey, workingLayout) {
  const fileRaw = await fetchAuthScreenLayoutRaw();
  const merged = mergeAuthScreenLayout(fileRaw);
  const section = workingLayout?.[screenKey];
  if (section) {
    merged[screenKey] = JSON.parse(JSON.stringify(section));
  }
  return merged;
}

export function readAuthScreenLayoutDraftSection(screenKey) {
  try {
    const draft = localStorage.getItem(LS_LAYOUT_KEY);
    if (!draft) return null;
    const parsed = JSON.parse(draft);
    return parsed?.[screenKey] ?? null;
  } catch {
    return null;
  }
}

export function isAuthTextItem(screenKey, itemKey) {
  return AUTH_SCREEN_DEFS[screenKey]?.items?.[itemKey]?.kind === 'text';
}

export function isAuthIconItem(screenKey, itemKey) {
  return AUTH_SCREEN_DEFS[screenKey]?.items?.[itemKey]?.kind === 'icon';
}

function migrateProfileIconLayout(items) {
  if (!items || typeof items !== 'object') return;
  if (items.rank && !items.rankBadge) {
    const { fontScale: _fs, ...box } = items.rank;
    items.rankBadge = { ...box, h: Math.max(box.h || 3.5, 7) };
  }
  if (items.subLevel && !items.sublevelIcon) {
    const { fontScale: _fs, ...box } = items.subLevel;
    items.sublevelIcon = box;
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
      if (screenKey === 'profile') migrateProfileIconLayout(src.items);
      for (const [itemKey, val] of Object.entries(src.items)) {
        if (!AUTH_SCREEN_DEFS[screenKey].items[itemKey] || typeof val !== 'object') continue;
        base[screenKey].items[itemKey] = { ...base[screenKey].items[itemKey], ...val };
      }
    }
  }
  return base;
}

export async function loadAuthScreenLayout({
  force = false,
  preferFile = false,
  screenKey = null,
} = {}) {
  if (layoutCache && !force && !screenKey) return layoutCache;

  let fileRaw = null;
  try {
    fileRaw = await fetchAuthScreenLayoutRaw();
  } catch {
    /* fall through */
  }

  let merged = mergeAuthScreenLayout(fileRaw);

  if (!preferFile) {
    try {
      const draftText = localStorage.getItem(LS_LAYOUT_KEY);
      const draft = draftText ? JSON.parse(draftText) : null;
      if (draft && typeof draft === 'object') {
        if (screenKey && hasAuthScreenLayoutDraft(screenKey)) {
          merged = mergeAuthScreenSection(merged, screenKey, draft[screenKey]);
        } else if (!screenKey && (localStorage.getItem(LS_PENDING_KEY) === '1' || hasAuthScreenLayoutDraft())) {
          merged = mergeAuthScreenLayout(draft);
        }
      }
    } catch {
      /* ignore bad draft */
    }
  }

  if (!fileRaw && !preferFile) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) merged = mergeAuthScreenLayout(JSON.parse(draft));
    } catch {
      /* ignore */
    }
  }

  if (!screenKey) layoutCache = merged;
  return merged;
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
    if (isAuthTextItem(screenKey, itemKey)) {
      target.style.setProperty(cssVarName(screenKey, itemKey, 'font-scale'), String(box.fontScale));
    }
  }
}

export function applyAllAuthScreenLayouts(layout, target = document.documentElement) {
  for (const screenKey of Object.keys(AUTH_SCREEN_DEFS)) {
    applyAuthScreenLayout(layout, screenKey, target);
  }
}

function authScreenLayoutTarget(screenKey) {
  if (document.body?.classList?.contains(`auth-screen--${screenKey}`)) {
    return document.body.querySelector('.auth-screen__stage') || document.body;
  }
  return document.documentElement;
}

/** In-game profile overlay — vars on dialog so width + stat slots share the same frame. */
export function getProfileOverlayLayoutTarget(root = document) {
  return (
    root.querySelector('#profileOverlayRoot .tz-profile-dialog') ||
    root.querySelector('#profileOverlayRoot .tz-profile-dialog__stage') ||
    root.getElementById('profileOverlayRoot')
  );
}

export async function initAuthScreenLayout(screenKey, { preferFile = false } = {}) {
  const layout = await loadAuthScreenLayout({ force: preferFile, preferFile, screenKey });
  applyAuthScreenLayout(layout, screenKey, authScreenLayoutTarget(screenKey));
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
    const fs = isAuthTextItem(screenKey, key) ? ` fontScale=${box.fontScale}` : '';
    lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%${fs}`);
  }
  return lines.join('\n');
}
