/** Login, create passport, and logged-in profile overlay layouts (% of art frame). */

export const AUTH_PASSPORT_ART = { w: 1418, h: 2200 };

export const PROFILE_HIT_ART = {
  back: '/img/BAck-gold-rnd-btn.png',
  closeX: '/img/X-gold-rnd-btn.png',
};

/** In-game overlay nav/back hits — class suffix after `tz-profile-dialog__hit--`. */
export const PROFILE_OVERLAY_HIT_SUFFIX = {
  navDaily: 'nav-daily',
  navAdventure: 'nav-adventure',
  navRandom: 'nav-random',
  navLogout: 'nav-logout',
  back: 'back',
  closeX: 'close-x',
};

/** Live overlay button ids (tilezilla-v2.html). */
export const PROFILE_OVERLAY_BUTTON_IDS = {
  navDaily: 'profileOverlayNavDaily',
  navAdventure: 'profileOverlayNavAdventure',
  navRandom: 'profileOverlayNavRandom',
  navLogout: 'profileOverlayNavLogout',
  back: 'profileOverlayBack',
  closeX: 'profileOverlayClose',
};

function profileHitSelectors(itemKey, meta) {
  const selectors = [];
  if (meta?.cssClass) selectors.push(`.${meta.cssClass}`);
  const suffix = PROFILE_OVERLAY_HIT_SUFFIX[itemKey];
  if (suffix) selectors.push(`.tz-profile-dialog__hit--${suffix}`);
  return selectors.join(', ');
}

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
      profileName: { label: 'Name', kind: 'text', slot: 'profileName', cssClass: 'auth-screen__profile-name', baseClass: '' },
      guestNote: {
        label: 'Guest progress note',
        kind: 'text',
        slot: 'guestNote',
        cssClass: 'tz-profile-dialog__guest-note',
        baseClass: '',
      },
      rankBadge: profileIcon('Rank badge', 'rankBadge', '/img/ranks/Wanderer.png'),
      sublevelIcon: profileIcon('Sublevel icon', 'sublevelIcon', '/img/ranks/gld-12.png'),
      adventureProgress: profileStat('Adventure progress', 'adventureProgress'),
      routesDiscovered: profileStat('Routes discovered', 'routesDiscovered'),
      hintTokens: profileStat('Hint tokens', 'hintTokens'),
      memberSince: profileStat('Member since', 'memberSince'),
      passportId: profileStat('Passport ID', 'passportId'),
      explorersRegistered: profileStat('Explorers registered', 'explorersRegistered'),
      totalAdventurePuzzles: profileStat('Total adventure puzzles', 'totalAdventurePuzzles'),
      totalKnownRoutes: profileStat('Total known routes', 'totalKnownRoutes'),
      largestSolution: profileStat('Largest solution', 'largestSolution'),
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
      'guestNote',
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
    title: 'Catalog stats',
    keys: ['totalAdventurePuzzles', 'totalKnownRoutes', 'largestSolution'],
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
  guestNote: 'Playing as guest — progress is not saved.',
  adventureProgress: '42%',
  routesDiscovered: '128',
  hintTokens: '7',
  memberSince: 'Jun 2026',
  passportId: 'TZ-4F2A9C',
  explorersRegistered: '1,204',
  totalAdventurePuzzles: '7,077',
  totalKnownRoutes: '18,432',
  largestSolution: '48',
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
      guestNote: { x: 15, y: 27, w: 70, h: 2, fontScale: 0.85 },
      rankBadge: { x: 14, y: 15.5, w: 26, h: 10 },
      sublevelIcon: { x: 42, y: 17.5, w: 14, h: 6 },
      adventureProgress: { x: 10, y: 32, w: 80, h: 2.5, fontScale: 1 },
      routesDiscovered: { x: 22, y: 39, w: 18, h: 4, fontScale: 1 },
      hintTokens: { x: 52, y: 39, w: 18, h: 4, fontScale: 1 },
      memberSince: { x: 22, y: 44, w: 18, h: 4, fontScale: 1 },
      passportId: { x: 52, y: 44, w: 35, h: 4, fontScale: 0.92 },
      explorersRegistered: { x: 10, y: 56, w: 35, h: 3.5, fontScale: 1 },
      totalAdventurePuzzles: { x: 10, y: 50, w: 35, h: 3.5, fontScale: 1, hidden: true },
      totalKnownRoutes: { x: 10, y: 53.5, w: 35, h: 3.5, fontScale: 1, hidden: true },
      largestSolution: { x: 54, y: 50, w: 38, h: 3.5, fontScale: 1, hidden: true },
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
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

export function authScreenTunerBoxClass(meta) {
  const base = meta?.baseClass ? `${meta.baseClass} ` : '';
  return `${base}${meta?.cssClass || ''} tuner-box`.trim();
}

function cssVarName(screenKey, itemKey, dim) {
  return `--auth-${screenKey}-${itemKey}-${dim}`;
}

/** Apply layout vars and optionally sync `hidden` flags on live pages (not tuner previews). */
export function applyAuthScreenLayout(
  layout,
  screenKey,
  target = document.documentElement,
  { syncVisibility = false } = {},
) {
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

  if (syncVisibility) {
    const visibilityRoot =
      target === document.documentElement ? authScreenLayoutTarget(screenKey) || document : target;
    syncAuthScreenItemVisibility(merged, screenKey, visibilityRoot);
  }
}

/** Apply layout `hidden` flags to live auth / profile DOM (not tuner preview boxes). */
export function syncAuthScreenItemVisibility(layout, screenKey, root = document) {
  const merged = mergeAuthScreenLayout(layout);
  const items = AUTH_SCREEN_DEFS[screenKey]?.items || {};
  for (const [key, meta] of Object.entries(items)) {
    const hidden = getAuthScreenItemLayout(screenKey, key, merged).hidden;
    if (screenKey === 'profile') {
      if (key === 'rankBadge') {
        root.querySelectorAll('.auth-screen__profile-rank-stack').forEach((el) => {
          el.hidden = hidden;
        });
        continue;
      }
      if (key === 'sublevelIcon') continue;
      /* Guest note visibility is toggled by guest mode, not layout hidden. */
      if (key === 'guestNote') continue;
      if (meta.slot) {
        root.querySelectorAll(`[data-profile-slot="${meta.slot}"]`).forEach((el) => {
          el.hidden = hidden;
        });
        continue;
      }
      if (meta.kind === 'hit') {
        const selector = profileHitSelectors(key, meta);
        if (selector) {
          root.querySelectorAll(selector).forEach((el) => {
            el.hidden = hidden;
          });
        }
      }
      continue;
    }
    if (meta.cssClass) {
      root.querySelectorAll(`.${meta.cssClass}`).forEach((el) => {
        el.hidden = hidden;
      });
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
  const doc = root?.ownerDocument || root;
  if (root?.id === 'profileOverlayRoot' || root?.classList?.contains('tz-profile-root')) {
    return (
      root.querySelector('.tz-profile-dialog')
      || root.querySelector('.tz-profile-dialog__stage')
      || root
    );
  }
  return (
    root.querySelector?.('#profileOverlayRoot .tz-profile-dialog')
    || root.querySelector?.('.tz-profile-dialog')
    || doc.getElementById?.('mockDialog')
    || root.querySelector?.('#profileOverlayRoot .tz-profile-dialog__stage')
    || doc.getElementById?.('profileOverlayRoot')
  );
}

function getProfileOverlayVisibilityRoot(root = document) {
  return root.querySelector('#profileOverlayRoot') || root.getElementById?.('profileOverlayRoot') || root;
}

function profileHitStyle(box) {
  return {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
  };
}

/** Push tuned profile hit boxes onto real buttons (tuner + live) so spacing cannot drift via CSS vars. */
export function applyProfileHitPositions(layout, root = document) {
  const merged = mergeAuthScreenLayout(layout);
  const items = AUTH_SCREEN_DEFS.profile?.items || {};
  const doc = root?.ownerDocument || root;
  for (const [key, meta] of Object.entries(items)) {
    if (meta.kind !== 'hit') continue;
    const box = getAuthScreenItemLayout('profile', key, merged);
    const style = profileHitStyle(box);
    const overlayId = PROFILE_OVERLAY_BUTTON_IDS[key];
    const overlayBtn = overlayId ? doc.getElementById?.(overlayId) : null;
    if (overlayBtn) Object.assign(overlayBtn.style, style);
    const selector = profileHitSelectors(key, meta);
    if (!selector) continue;
    for (const el of root.querySelectorAll(selector)) {
      if (overlayBtn && el === overlayBtn) continue;
      Object.assign(el.style, style);
    }
  }
}

/** Apply tuned passport layout to the in-game profile overlay (guest + registered). */
export function applyProfileOverlayLayout(layout, root = document) {
  const target = getProfileOverlayLayoutTarget(root);
  if (!target) return;

  applyAuthScreenLayout(layout, 'profile', target, { syncVisibility: false });
  const stage = target.querySelector?.('.tz-profile-dialog__stage');
  if (stage && stage !== target) {
    applyAuthScreenLayout(layout, 'profile', stage, { syncVisibility: false });
  }
  applyProfileHitPositions(layout, root);
  syncAuthScreenItemVisibility(layout, 'profile', getProfileOverlayVisibilityRoot(root));
}

/** Reload profile overlay layout from disk and apply to live DOM. */
export async function refreshProfileOverlayLayoutFromDisk(root = document) {
  clearAuthScreenLayoutCache();
  const layout = await loadAuthScreenLayout({ force: true, preferFile: true, screenKey: 'profile' });
  applyProfileOverlayLayout(layout, root);
  return layout;
}

export async function initAuthScreenLayout(screenKey, { preferFile = false } = {}) {
  const layout = await loadAuthScreenLayout({ force: preferFile, preferFile, screenKey });
  applyAuthScreenLayout(layout, screenKey, authScreenLayoutTarget(screenKey), { syncVisibility: true });
  if (screenKey === 'profile') {
    applyProfileHitPositions(layout, document);
  }
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
    const hiddenNote = box.hidden ? ' hidden' : '';
    lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%${fs}${hiddenNote}`);
  }
  return lines.join('\n');
}
