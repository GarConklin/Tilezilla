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

/** Create passport — “The journey ahead” (left page). */
export const CREATE_JOURNEY_STAT_SLOTS = [
  'totalAdventurePuzzles',
  'ranksToEarn',
  'challengeGates',
  'totalKnownRoutes',
];

/** Login / logged-in — bottom journal (expedition report + community discoveries). */
export const LOGIN_JOURNAL_LEFT_SLOTS = [
  'explorersRegistered',
  'totalAdventurePuzzles',
  'totalKnownRoutes',
  'largestSolution',
  'todaysChallenge',
];

export const LOGIN_JOURNAL_RIGHT_SLOTS = [
  'recentPuzzleSolved',
  'recentDailyCompleted',
  'mostSolvedPuzzle',
  'latestDiscovery',
  'totalPlayTime',
];

/** @deprecated use LOGIN_JOURNAL_LEFT_SLOTS + LOGIN_JOURNAL_RIGHT_SLOTS */
export const LOGIN_REPORT_STAT_SLOTS = [...LOGIN_JOURNAL_LEFT_SLOTS, ...LOGIN_JOURNAL_RIGHT_SLOTS];

const profileStat = (label, slot) => ({
  label,
  kind: 'text',
  slot,
  cssClass: 'auth-screen__profile-stat',
  baseClass: '',
});

const authPassportStat = (label, slot) => profileStat(label, slot);

const passRevealHit = (cssClass, label = 'Show passphrase') => ({
  label,
  kind: 'hit',
  cssClass,
  baseClass: 'auth-screen__hit',
});

const CREATE_JOURNEY_STAT_DEFS = {
  totalAdventurePuzzles: authPassportStat('Adventure puzzles', 'totalAdventurePuzzles'),
  ranksToEarn: authPassportStat('Ranks to earn', 'ranksToEarn'),
  challengeGates: authPassportStat('Challenge gates', 'challengeGates'),
  totalKnownRoutes: authPassportStat('Known routes', 'totalKnownRoutes'),
};

const LOGIN_JOURNEY_LEFT_DEFS = {
  explorersRegistered: authPassportStat('Explorers registered', 'explorersRegistered'),
  totalAdventurePuzzles: authPassportStat('Adventure puzzles', 'totalAdventurePuzzles'),
  totalKnownRoutes: authPassportStat('Known routes', 'totalKnownRoutes'),
  largestSolution: authPassportStat('Largest solution challenge', 'largestSolution'),
  todaysChallenge: authPassportStat("Today's challenge", 'todaysChallenge'),
};

const LOGIN_JOURNEY_RIGHT_DEFS = {
  recentPuzzleSolved: authPassportStat('Most recent puzzle solved', 'recentPuzzleSolved'),
  recentDailyCompleted: authPassportStat('Most recent daily completed', 'recentDailyCompleted'),
  mostSolvedPuzzle: authPassportStat('Most solved puzzle', 'mostSolvedPuzzle'),
  latestDiscovery: authPassportStat('Latest discovery', 'latestDiscovery'),
  totalPlayTime: authPassportStat('Total play time', 'totalPlayTime'),
};

const LOGIN_JOURNAL_STAT_DEFS = {
  ...LOGIN_JOURNEY_LEFT_DEFS,
  ...LOGIN_JOURNEY_RIGHT_DEFS,
};

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
      passReveal: passRevealHit('auth-screen__hit--pass-reveal'),
      submit: { label: 'Open passport', kind: 'hit', cssClass: 'auth-screen__hit--submit', baseClass: 'auth-screen__hit' },
      secondary: { label: 'Issue new passport', kind: 'hit', cssClass: 'auth-screen__hit--secondary', baseClass: 'auth-screen__hit' },
      navDaily: { label: 'Daily Challenge (guest)', kind: 'hit', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Log out', kind: 'hit', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
      ...LOGIN_JOURNAL_STAT_DEFS,
    },
  },
  create: {
    label: 'Create passport',
    art: '/img/Create-Passport.png',
    items: {
      name: { label: 'Explorer name', kind: 'input', cssClass: 'auth-screen__input--name', baseClass: 'auth-screen__input' },
      email: { label: 'Email', kind: 'input', cssClass: 'auth-screen__input--email', baseClass: 'auth-screen__input' },
      pass: { label: 'Passphrase', kind: 'input', cssClass: 'auth-screen__input--pass', baseClass: 'auth-screen__input' },
      passReveal: passRevealHit('auth-screen__hit--pass-reveal'),
      pass2: { label: 'Confirm passphrase', kind: 'input', cssClass: 'auth-screen__input--pass2', baseClass: 'auth-screen__input' },
      pass2Reveal: passRevealHit('auth-screen__hit--pass2-reveal', 'Show confirm passphrase'),
      submit: { label: 'Issue passport', kind: 'hit', cssClass: 'auth-screen__hit--submit', baseClass: 'auth-screen__hit' },
      secondary: { label: 'Already have passport', kind: 'hit', cssClass: 'auth-screen__hit--secondary', baseClass: 'auth-screen__hit' },
      navDaily: { label: 'Daily Challenge (guest)', kind: 'hit', cssClass: 'auth-screen__hit--nav-daily', baseClass: 'auth-screen__hit' },
      navLogout: { label: 'Log out', kind: 'hit', cssClass: 'auth-screen__hit--nav-logout', baseClass: 'auth-screen__hit' },
      ...CREATE_JOURNEY_STAT_DEFS,
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
      largestSolution: profileStat('Longest route (catalog)', 'largestSolution'),
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
    title: 'Left journal (expedition report)',
    keys: LOGIN_JOURNAL_LEFT_SLOTS,
  },
  {
    title: 'Right journal (community discoveries)',
    keys: LOGIN_JOURNAL_RIGHT_SLOTS,
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
  totalKnownRoutes: '32,430',
  largestSolution: '524\nROUTES',
  todaysChallenge: '5x6-0B-BFA',
  recentPuzzleSolved: '5x6-0B-BNZ',
  recentDailyCompleted: '5x6-0B-AZZ',
  mostSolvedPuzzle: '5x6-0B-BJO',
  latestDiscovery: '5x6-0B-CPX',
  totalPlayTime: '18h 42m',
};

export const DEFAULT_AUTH_SCREEN_LAYOUT = {
  login: {
    dialog: { artW: 1418, artH: 2200, maxWidth: 390 },
    items: {
      user: { x: 33.7, y: 19.1, w: 33.5, h: 3.2 },
      pass: { x: 34, y: 23.8, w: 29.8, h: 3.2 },
      passReveal: { x: 60.5, y: 23.8, w: 5.5, h: 3.2 },
      submit: { x: 29.1, y: 29.2, w: 43.3, h: 5.7 },
      secondary: { x: 28.9, y: 36.9, w: 43.5, h: 7.4 },
      navDaily: { x: 12.5, y: 94.4, w: 23.1, h: 5.8 },
      navLogout: { x: 66.2, y: 93.8, w: 22, h: 6.1 },
      explorersRegistered: { x: 30.8, y: 60.9, w: 14.8, h: 2.9, fontScale: 1 },
      totalAdventurePuzzles: { x: 30.8, y: 64.7, w: 14.8, h: 2.9, fontScale: 1 },
      totalKnownRoutes: { x: 30.8, y: 68.6, w: 14.8, h: 2.9, fontScale: 1 },
      largestSolution: { x: 30.8, y: 73.2, w: 18, h: 4.8, fontScale: 0.85 },
      todaysChallenge: { x: 30.8, y: 77.2, w: 18, h: 2.9, fontScale: 0.92 },
      recentPuzzleSolved: { x: 58.8, y: 62.8, w: 21, h: 3.3, fontScale: 0.92 },
      recentDailyCompleted: { x: 58.9, y: 67.7, w: 20.8, h: 3.1, fontScale: 0.92 },
      mostSolvedPuzzle: { x: 58.9, y: 72.4, w: 20.7, h: 2.7, fontScale: 0.92 },
      latestDiscovery: { x: 59.2, y: 76.2, w: 20.2, h: 3.3, fontScale: 0.92 },
      totalPlayTime: { x: 62.5, y: 79.7, w: 16.7, h: 3.5, fontScale: 1 },
    },
  },
  create: {
    dialog: { artW: 1418, artH: 2200, maxWidth: 390 },
    items: {
      name: { x: 18, y: 24.5, w: 64, h: 2.8 },
      email: { x: 18, y: 29.5, w: 64, h: 2.8 },
      pass: { x: 18, y: 34.5, w: 64, h: 2.8 },
      pass2: { x: 18, y: 39.5, w: 64, h: 2.8 },
      submit: { x: 22, y: 45, w: 56, h: 4 },
      secondary: { x: 22, y: 51, w: 56, h: 4 },
      navDaily: { x: 3, y: 92, w: 45, h: 5.5 },
      navLogout: { x: 52, y: 92, w: 45, h: 5.5 },
      passReveal: { x: 62.5, y: 29.1, w: 5.5, h: 3.4 },
      pass2Reveal: { x: 62.8, y: 34.7, w: 5.5, h: 3.4 },
      totalAdventurePuzzles: { x: 58, y: 58.5, w: 12, h: 2.8, fontScale: 1 },
      ranksToEarn: { x: 58, y: 62.5, w: 12, h: 2.8, fontScale: 1 },
      challengeGates: { x: 58, y: 66.5, w: 12, h: 2.8, fontScale: 1 },
      totalKnownRoutes: { x: 58, y: 70.5, w: 12, h: 2.8, fontScale: 1 },
    },
  },
  profile: {
    dialog: { artW: 1418, artH: 2200, maxWidth: 390 },
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
      explorersRegistered: { x: 30.8, y: 60.9, w: 14.8, h: 2.9, fontScale: 1 },
      totalAdventurePuzzles: { x: 30.8, y: 64.7, w: 14.8, h: 2.9, fontScale: 1 },
      totalKnownRoutes: { x: 30.8, y: 68.6, w: 14.8, h: 2.9, fontScale: 1 },
      largestSolution: { x: 30.8, y: 73.2, w: 18, h: 4.8, fontScale: 0.85 },
      todaysChallenge: { x: 30.8, y: 77.2, w: 18, h: 2.9, fontScale: 0.92 },
      recentPuzzleSolved: { x: 58.8, y: 62.8, w: 21, h: 3.3, fontScale: 0.92 },
      recentDailyCompleted: { x: 58.9, y: 67.7, w: 20.8, h: 3.1, fontScale: 0.92 },
      mostSolvedPuzzle: { x: 58.9, y: 72.4, w: 20.7, h: 2.7, fontScale: 0.92 },
      latestDiscovery: { x: 59.2, y: 76.2, w: 20.2, h: 3.3, fontScale: 0.92 },
      totalPlayTime: { x: 62.5, y: 79.7, w: 16.7, h: 3.5, fontScale: 1 },
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
  return pruneAuthScreenLayoutItems(merged);
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
  if (!raw || typeof raw !== 'object') return pruneAuthScreenLayoutItems(base);
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
  return pruneAuthScreenLayoutItems(base);
}

/** Drop layout item keys that are not defined for that screen (stale file / draft cleanup). */
export function pruneAuthScreenLayoutItems(layout) {
  for (const screenKey of Object.keys(AUTH_SCREEN_DEFS)) {
    const allowed = AUTH_SCREEN_DEFS[screenKey]?.items || {};
    const items = layout?.[screenKey]?.items;
    if (!items) continue;
    for (const key of Object.keys(items)) {
      if (!allowed[key]) delete items[key];
    }
  }
  return layout;
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
  target.style.setProperty(`--auth-${screenKey}-max-width`, `${d.maxWidth ?? 390}px`);

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
    }
    if (meta.slot) {
      root.querySelectorAll(`[data-profile-slot="${meta.slot}"]`).forEach((el) => {
        el.hidden = hidden;
      });
      continue;
    }
    if (screenKey === 'profile') {
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

/** In-game profile overlay dialog frame (width cap + drop shadow). */
export function getProfileOverlayDialog(root = document) {
  const doc = root?.ownerDocument || root;
  if (root?.id === 'profileOverlayRoot' || root?.classList?.contains('tz-profile-root')) {
    return root.querySelector('.tz-profile-dialog') || null;
  }
  return (
    root.querySelector?.('#profileOverlayRoot .tz-profile-dialog')
    || root.querySelector?.('.tz-profile-dialog')
    || doc.getElementById?.('mockDialog')
    || null
  );
}

/** Positioning root for overlay slots + chrome hits (% of this box). */
export function getProfileOverlayStage(root = document) {
  const dialog = getProfileOverlayDialog(root);
  return dialog?.querySelector('.tz-profile-dialog__stage') || null;
}

/** @deprecated use getProfileOverlayStage — kept for callers expecting dialog. */
export function getProfileOverlayLayoutTarget(root = document) {
  return getProfileOverlayStage(root) || getProfileOverlayDialog(root);
}

function getProfileOverlayVisibilityRoot(root = document) {
  const doc = root?.ownerDocument || root;
  return (
    doc.getElementById?.('profileOverlayRoot')
    || doc.getElementById?.('mockWrap')
    || root.querySelector?.('#profileOverlayRoot')
    || root.querySelector?.('#mockWrap')
    || root
  );
}

function applyProfileDialogFrameVars(layout, dialog, visibilityRoot = null) {
  const merged = mergeAuthScreenLayout(layout);
  const d = merged.profile?.dialog || DEFAULT_AUTH_SCREEN_LAYOUT.profile.dialog;
  const maxWidth = `${d.maxWidth ?? 390}px`;
  if (dialog) dialog.style.setProperty('--auth-profile-max-width', maxWidth);
  if (visibilityRoot?.style) visibilityRoot.style.setProperty('--auth-profile-max-width', maxWidth);
}

function profileHitStyle(box) {
  return {
    position: 'absolute',
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
    margin: '0',
    padding: '0',
    border: 'none',
    boxSizing: 'border-box',
  };
}

function authScreenPositionStyle(box) {
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

/** Push tuned login/create field boxes onto live DOM so layout cannot drift via CSS vars. */
export function applyAuthScreenItemPositions(layout, screenKey, root = document) {
  if (screenKey === 'profile') return;
  const merged = mergeAuthScreenLayout(layout);
  const items = AUTH_SCREEN_DEFS[screenKey]?.items || {};
  const stage =
    root.querySelector?.('.auth-screen__stage')
    || (root.classList?.contains('auth-screen__stage') ? root : null)
    || root;

  for (const [key, meta] of Object.entries(items)) {
    const box = getAuthScreenItemLayout(screenKey, key, merged);
    const style = authScreenPositionStyle(box);

    if (meta.slot) {
      for (const el of stage.querySelectorAll(`[data-profile-slot="${meta.slot}"]`)) {
        Object.assign(el.style, style);
        if (isAuthTextItem(screenKey, key)) {
          el.style.setProperty(cssVarName(screenKey, key, 'font-scale'), String(box.fontScale));
        }
      }
      continue;
    }

    if (meta.cssClass) {
      for (const el of stage.querySelectorAll(`.${meta.cssClass}`)) {
        Object.assign(el.style, style);
      }
    }
  }
}

/** Push tuned profile stat / rank slots onto live DOM so layout cannot drift via CSS vars. */
export function applyProfileSlotPositions(layout, root = document) {
  const merged = mergeAuthScreenLayout(layout);
  const doc = root?.ownerDocument || root;
  const scope = doc.getElementById?.('profileOverlayRoot')
    || doc.getElementById?.('mockFrame')
    || getProfileOverlayVisibilityRoot(root);

  const rankBox = getAuthScreenItemLayout('profile', 'rankBadge', merged);
  const rankStyle = authScreenPositionStyle(rankBox);
  for (const el of scope.querySelectorAll('.auth-screen__profile-rank-stack')) {
    Object.assign(el.style, rankStyle);
    el.hidden = Boolean(rankBox.hidden);
  }

  const items = AUTH_SCREEN_DEFS.profile?.items || {};
  for (const [key, meta] of Object.entries(items)) {
    if (key === 'rankBadge' || key === 'sublevelIcon' || meta.kind === 'hit') continue;
    const box = getAuthScreenItemLayout('profile', key, merged);
    const style = authScreenPositionStyle(box);
    if (meta.slot) {
      for (const el of scope.querySelectorAll(`[data-profile-slot="${meta.slot}"]`)) {
        Object.assign(el.style, style);
        if (isAuthTextItem('profile', key)) {
          el.style.setProperty(cssVarName('profile', key, 'font-scale'), String(box.fontScale));
        }
      }
    } else if (meta.cssClass) {
      for (const el of scope.querySelectorAll(`.${meta.cssClass}`)) {
        Object.assign(el.style, style);
      }
    }
  }
}

/** Push tuned profile hit boxes onto real buttons (tuner + live) so spacing cannot drift via CSS vars. */
export function applyProfileHitPositions(layout, root = document) {
  const merged = mergeAuthScreenLayout(layout);
  const items = AUTH_SCREEN_DEFS.profile?.items || {};
  const doc = root?.ownerDocument || root;
  const scope = doc.getElementById?.('profileOverlayRoot')
    || doc.getElementById?.('mockFrame')
    || getProfileOverlayVisibilityRoot(root);
  for (const [key, meta] of Object.entries(items)) {
    if (meta.kind !== 'hit') continue;
    const box = getAuthScreenItemLayout('profile', key, merged);
    const style = profileHitStyle(box);
    const overlayId = PROFILE_OVERLAY_BUTTON_IDS[key];
    const overlayBtn = overlayId ? doc.getElementById?.(overlayId) : null;
    if (overlayBtn) Object.assign(overlayBtn.style, style);
    const selector = profileHitSelectors(key, meta);
    if (!selector) continue;
    for (const el of scope.querySelectorAll(selector)) {
      if (overlayBtn && el === overlayBtn) continue;
      Object.assign(el.style, style);
    }
  }
}

/** Apply tuned passport layout to the in-game profile overlay (guest + registered). */
export function applyProfileOverlayLayout(layout, root = document) {
  const dialog = getProfileOverlayDialog(root);
  const stage = getProfileOverlayStage(root);
  const visibilityRoot = getProfileOverlayVisibilityRoot(root);
  if (!dialog || !stage) return;

  applyProfileDialogFrameVars(layout, dialog, visibilityRoot);
  applyAuthScreenLayout(layout, 'profile', stage, { syncVisibility: false });
  applyProfileSlotPositions(layout, root);
  applyProfileHitPositions(layout, root);
  syncAuthScreenItemVisibility(layout, 'profile', visibilityRoot);
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
  const stage = authScreenLayoutTarget(screenKey);
  applyAuthScreenLayout(layout, screenKey, document.documentElement);
  if (stage && stage !== document.documentElement) {
    applyAuthScreenLayout(layout, screenKey, stage, { syncVisibility: false });
  }
  syncAuthScreenItemVisibility(layout, screenKey, stage || document);
  if (screenKey === 'profile') {
    applyProfileSlotPositions(layout, document);
    applyProfileHitPositions(layout, document);
  } else {
    applyAuthScreenItemPositions(layout, screenKey, stage || document);
  }
  return layout;
}

export function buildAuthScreenLayoutReport(layout, screenKey) {
  const merged = mergeAuthScreenLayout(layout);
  const lines = [`Auth screen — ${AUTH_SCREEN_DEFS[screenKey]?.label || screenKey}`, ''];
  const d = merged[screenKey]?.dialog || {};
  lines.push(`maxWidth: ${d.maxWidth ?? 390}px`);
  lines.push('');
  for (const [key, meta] of Object.entries(AUTH_SCREEN_DEFS[screenKey]?.items || {})) {
    const box = getAuthScreenItemLayout(screenKey, key, merged);
    const fs = isAuthTextItem(screenKey, key) ? ` fontScale=${box.fontScale}` : '';
    const hiddenNote = box.hidden ? ' hidden' : '';
    lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%${fs}${hiddenNote}`);
  }
  return lines.join('\n');
}
