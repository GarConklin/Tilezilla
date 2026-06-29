/**
 * Tilezilla guest identity, permissions, and session helpers.
 */

import {
  applyGuestLoginRequiredLayout,
  loadGuestLoginRequiredLayout,
} from './guest-login-required-layout.js';
import { DEFAULT_LOGOUT_REDIRECT_URL, resolveLogoutRedirectUrl } from './system-info.js';

export const GUEST_CODE_KEY = 'guest_code';
export const AUTH_MODE_KEY = 'tilezilla_auth_mode';
export const ACTIVE_USER_KEY = 'snake_active_user_v1';
export const REGISTERED_USER_ID_KEY = 'tilezilla_user_id';
export const CONVERTED_GUEST_CODE_KEY = 'tilezilla_converted_guest_code';
export const GUEST_ANALYTICS_KEY = 'tilezilla_guest_analytics_v1';
export const FORCE_STARTUP_KEY = 'tilezilla:force-startup';

/** Primary playable shell (main screen v2). */
export const TILEZILLA_GAME_URL = '/tilezilla-v2.html';

/** @param {'daily-challenge'|'adventure'|'random'|string} [screen] */
export function tilezillaGameUrl(screen) {
  if (!screen) return TILEZILLA_GAME_URL;
  return `${TILEZILLA_GAME_URL}?screen=${encodeURIComponent(screen)}`;
}

export function clearAllAuthState() {
  localStorage.removeItem(GUEST_CODE_KEY);
  localStorage.removeItem(AUTH_MODE_KEY);
  localStorage.removeItem(ACTIVE_USER_KEY);
  localStorage.removeItem(REGISTERED_USER_ID_KEY);
  localStorage.removeItem(CONVERTED_GUEST_CODE_KEY);
}

export function clearRegisteredLocalState() {
  localStorage.removeItem(AUTH_MODE_KEY);
  localStorage.removeItem(ACTIVE_USER_KEY);
  localStorage.removeItem(REGISTERED_USER_ID_KEY);
  localStorage.removeItem(CONVERTED_GUEST_CODE_KEY);
}

export function getConvertedGuestCode() {
  return localStorage.getItem(CONVERTED_GUEST_CODE_KEY) || '';
}

export function setConvertedGuestCode(code) {
  const normalized = isGuestCode(code) ? code : '';
  if (normalized) {
    localStorage.setItem(CONVERTED_GUEST_CODE_KEY, normalized);
  } else {
    localStorage.removeItem(CONVERTED_GUEST_CODE_KEY);
  }
  return normalized;
}

/** Dev picker → always show index load screen, even if guest keys remain. */
export function beginStartupScreen() {
  clearAllAuthState();
  sessionStorage.setItem(FORCE_STARTUP_KEY, '1');
}

export function consumeForceStartup() {
  const force = sessionStorage.getItem(FORCE_STARTUP_KEY) === '1';
  sessionStorage.removeItem(FORCE_STARTUP_KEY);
  return force;
}

export function generateGuestCode() {
  const num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const letters =
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
    + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `Guest-TZ-A${num}-${letters}`;
}

export function isGuestCode(value) {
  return typeof value === 'string' && /^Guest-TZ-A\d{4}-[A-Z]{2}$/.test(value);
}

export function getAuthMode() {
  return localStorage.getItem(AUTH_MODE_KEY) || '';
}

export function isRegisteredUser() {
  return getAuthMode() === 'registered'
    && !!localStorage.getItem(REGISTERED_USER_ID_KEY)
    && !!localStorage.getItem(ACTIVE_USER_KEY)
    && !isGuestCode(localStorage.getItem(ACTIVE_USER_KEY));
}

export function isGuestUser() {
  if (getAuthMode() === 'guest') return true;
  const code = localStorage.getItem(GUEST_CODE_KEY);
  return !!code && isGuestCode(code) && !isRegisteredUser();
}

export function getGuestCode() {
  return localStorage.getItem(GUEST_CODE_KEY) || '';
}

export function getOrCreateGuestCode() {
  let code = localStorage.getItem(GUEST_CODE_KEY);
  if (!code || !isGuestCode(code)) {
    code = generateGuestCode();
    localStorage.setItem(GUEST_CODE_KEY, code);
    trackGuestEvent('Guest Created', { guest_code: code });
  }
  return code;
}

export function playAsGuest() {
  const guestCode = getOrCreateGuestCode();
  localStorage.setItem(AUTH_MODE_KEY, 'guest');
  localStorage.setItem(ACTIVE_USER_KEY, guestCode);
  trackGuestEvent('Guest Session Started', { guest_code: guestCode });
  return guestCode;
}

export function setRegisteredUser(userOrName) {
  localStorage.setItem(AUTH_MODE_KEY, 'registered');
  if (userOrName && typeof userOrName === 'object') {
    localStorage.setItem(ACTIVE_USER_KEY, userOrName.username || String(userOrName.id));
    if (userOrName.id != null) {
      localStorage.setItem(REGISTERED_USER_ID_KEY, String(userOrName.id));
    }
  } else {
    localStorage.setItem(ACTIVE_USER_KEY, userOrName);
  }
}

/** @deprecated use resolveLogoutRedirectUrl() — sync fallback only */
export const LOGOUT_REDIRECT_URL = DEFAULT_LOGOUT_REDIRECT_URL;

export async function logoutRegisteredUser() {
  try {
    await fetch('/auth/api/logout.php', { method: 'POST', credentials: 'include' });
  } catch {
    /* ignore — still clear local session */
  }
  clearAllAuthState();
  window.location.href = await resolveLogoutRedirectUrl();
}

export function clearGuestSession() {
  clearAllAuthState();
}

export function ensureGuestOnFirstVisit() {
  if (isRegisteredUser()) return null;
  if (localStorage.getItem(GUEST_CODE_KEY)) return getGuestCode();
  return null;
}

export function shouldUseLoadScreen() {
  if (isRegisteredUser()) return false;
  if (getAuthMode() === 'guest') return false;
  return true;
}

const RESTRICTED_NAV = new Set(['adventure', 'random', 'library', 'profile']);

export function isRestrictedNav(screen) {
  return isGuestUser() && RESTRICTED_NAV.has(screen);
}

export function isRestrictedFeature(feature) {
  if (!isGuestUser()) return false;
  const restricted = new Set([
    'adventure',
    'random',
    'library',
    'profile',
    'found-solutions',
    'stuck',
    'settings',
    'hints',
    'journal',
    'leaderboard',
    'statistics',
    'achievements',
  ]);
  return restricted.has(feature);
}

export function trackGuestEvent(action, meta = {}) {
  if (!isGuestUser() && action !== 'Guest Created' && action !== 'Account Created') {
    const code = meta.guest_code || getGuestCode();
    if (!code) return;
  }
  const guestCode = meta.guest_code || getGuestCode() || null;
  const entry = {
    guest_code: guestCode,
    action,
    timestamp: new Date().toISOString(),
    puzzle_id: meta.puzzle_id || null,
    ...meta,
  };
  try {
    const raw = localStorage.getItem(GUEST_ANALYTICS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(entry);
    localStorage.setItem(GUEST_ANALYTICS_KEY, JSON.stringify(list.slice(-500)));
  } catch {
    /* ignore quota errors */
  }
  void fetch('/api/guest/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});

  if (guestCode && (action === 'Guest Created' || action === 'Guest Session Started')) {
    void fetch('/auth/api/guest-touch.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ guest_code: guestCode }),
    }).catch(() => {});
  }
}

export function trackGuestGameplay(action, puzzleId) {
  trackGuestEvent(action, {
    guest_code: getGuestCode(),
    puzzle_id: puzzleId,
    challenge_date: window.__dailyChallengeMeta?.date || null,
  });
}

/** Shown on the in-game register popup — tune message placement in guest-login-required-tuner. */
export const GUEST_LOGIN_REQUIRED_COPY = {
  default: {
    title: 'Explorer Passport Required',
    body: 'Create a free Tilezilla account to access this feature.',
  },
  adventure: {
    title: 'Adventure Path',
    body: 'Register for a free Explorer Passport to follow the Adventure Path and save your discoveries.',
  },
  random: {
    title: 'Random Puzzles',
    body: 'Create an account to play random puzzles and track your progress.',
  },
  library: {
    title: 'Puzzle Library',
    body: 'Create an account to browse your puzzle library and saved solutions.',
  },
  profile: {
    title: 'Explorer Profile',
    body: 'Create an account to view your passport, stats, and achievements.',
  },
  'found-solutions': {
    title: 'Found Solutions',
    body: 'Create an account to save and review solutions you discover.',
  },
};

let pendingLoginReturnUrl = '';
let pendingLoginSource = '';

export function getGuestLoginRequiredCopy(source = '') {
  return GUEST_LOGIN_REQUIRED_COPY[source] || GUEST_LOGIN_REQUIRED_COPY.default;
}

function closeLoginRequiredModal() {
  const root = document.getElementById('guestLoginRequired');
  if (root) root.hidden = true;
  document.body.classList.remove('tz-modal-open');
  pendingLoginReturnUrl = '';
  pendingLoginSource = '';
}

export function initGuestShell() {
  document.body.classList.toggle('tz-guest-mode', isGuestUser());
  document.body.classList.toggle('tz-registered-mode', isRegisteredUser());
}

export function wireLoginRequiredModal() {
  const root = document.getElementById('guestLoginRequired');
  if (!root) return;

  root.querySelector('.tz-guest-login-root__backdrop')?.addEventListener('click', closeLoginRequiredModal);
  root.querySelector('[data-action="close"]')?.addEventListener('click', closeLoginRequiredModal);
  root.querySelector('[data-action="cancel"]')?.addEventListener('click', closeLoginRequiredModal);

  root.querySelector('[data-action="create-account"]')?.addEventListener('click', () => {
    trackGuestEvent('Create Account Clicked', { source: pendingLoginSource || 'login_required' });
    const returnTo = pendingLoginReturnUrl || '/tilezilla-v2.html';
    window.location.href = `/create-passport.html?return=${encodeURIComponent(returnTo)}`;
  });

  root.querySelector('[data-action="login"]')?.addEventListener('click', () => {
    trackGuestEvent('Login Clicked', { source: pendingLoginSource || 'login_required' });
    const returnTo = pendingLoginReturnUrl || '/tilezilla-v2.html';
    window.location.href = `/login-screen.html?return=${encodeURIComponent(returnTo)}`;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeLoginRequiredModal();
  });

  void loadGuestLoginRequiredLayout()
    .then((layout) => applyGuestLoginRequiredLayout(layout))
    .catch((err) => console.warn('Guest login required layout:', err));

  window.addEventListener('tilezilla:guest-login-required-layout-saved', () => {
    void loadGuestLoginRequiredLayout({ force: true })
      .then((layout) => applyGuestLoginRequiredLayout(layout))
      .catch((err) => console.warn('Guest login required layout reload:', err));
  });
}

export function loginRequiredReturnUrl(source = '') {
  switch (source) {
    case 'adventure':
      return '/tilezilla-v2.html?screen=adventure';
    case 'random':
      return '/tilezilla-v2.html?screen=random';
    case 'profile':
      return '/profile-screen.html';
    case 'library':
      return '/tilezilla-v2.html';
    default:
      return `${window.location.pathname}${window.location.search}`;
  }
}

export function showLoginRequired(options = {}) {
  const source = options.source || options.screen || '';
  trackGuestEvent('Login Required Shown', { source: source || null });
  const returnTo = options.returnTo || loginRequiredReturnUrl(source);
  pendingLoginReturnUrl = returnTo;
  pendingLoginSource = source;

  const root = document.getElementById('guestLoginRequired');
  if (!root) {
    window.location.href = `/login-screen.html?return=${encodeURIComponent(returnTo)}`;
    return;
  }

  const copy = getGuestLoginRequiredCopy(source);
  const titleEl = document.getElementById('guestLoginRequiredTitle');
  const bodyEl = document.getElementById('guestLoginRequiredMessage');
  if (titleEl) titleEl.textContent = copy.title;
  if (bodyEl) bodyEl.textContent = bodyEl.hidden ? '' : copy.body;

  root.hidden = false;
  document.body.classList.add('tz-modal-open');
}

export function wireGuestCompletionModal() {
  const root = document.getElementById('guestDailyComplete');
  if (!root) return;
  const close = () => { root.hidden = true; };
  root.querySelector('.tz-guest-complete__backdrop')?.addEventListener('click', close);
  root.querySelector('[data-action="continue-guest"]')?.addEventListener('click', close);
  root.querySelector('[data-action="create-account"]')?.addEventListener('click', () => {
    trackGuestEvent('Create Account Clicked', { source: 'daily_complete' });
    window.location.href = '/create-passport.html';
  });
}

export function showGuestDailyComplete(guestCode) {
  const root = document.getElementById('guestDailyComplete');
  const codeEl = document.getElementById('guestDailyCompleteCode');
  if (codeEl) codeEl.textContent = guestCode || getGuestCode() || 'Guest';
  if (root) root.hidden = false;
  trackGuestEvent('Daily Challenge Solved', {
    guest_code: guestCode || getGuestCode(),
    puzzle_id: window.__dailyChallengeMeta?.levelId || null,
  });
}

export function syncGuestBanner() {
  const banner = document.getElementById('guestBanner');
  if (!banner) return;
  const onDaily = document.querySelector('.tz-app')?.dataset?.screen === 'daily-challenge';
  banner.hidden = !(isGuestUser() && onDaily);
}
