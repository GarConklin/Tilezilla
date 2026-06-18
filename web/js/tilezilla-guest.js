/**
 * Tilezilla guest identity, permissions, and session helpers.
 */

export const GUEST_CODE_KEY = 'guest_code';
export const AUTH_MODE_KEY = 'tilezilla_auth_mode';
export const ACTIVE_USER_KEY = 'snake_active_user_v1';
export const GUEST_ANALYTICS_KEY = 'tilezilla_guest_analytics_v1';
export const FORCE_STARTUP_KEY = 'tilezilla:force-startup';

export function clearAllAuthState() {
  localStorage.removeItem(GUEST_CODE_KEY);
  localStorage.removeItem(AUTH_MODE_KEY);
  localStorage.removeItem(ACTIVE_USER_KEY);
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

export function setRegisteredUser(userId) {
  const guestCode = getGuestCode();
  localStorage.setItem(AUTH_MODE_KEY, 'registered');
  localStorage.setItem(ACTIVE_USER_KEY, userId);
  if (guestCode) {
    trackGuestEvent('Account Created', { guest_code: guestCode, user_id: userId });
  }
}

export const LOGOUT_REDIRECT_URL = 'https://www.skiflakegames.com';

export async function logoutRegisteredUser() {
  try {
    await fetch('/auth/api/logout.php', { method: 'POST', credentials: 'include' });
  } catch {
    /* ignore — still clear local session */
  }
  clearAllAuthState();
  window.location.href = LOGOUT_REDIRECT_URL;
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
  if (isGuestUser()) return false;
  if (localStorage.getItem(GUEST_CODE_KEY) && getAuthMode() === 'guest') return false;
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
}

export function trackGuestGameplay(action, puzzleId) {
  trackGuestEvent(action, {
    guest_code: getGuestCode(),
    puzzle_id: puzzleId,
    challenge_date: window.__dailyChallengeMeta?.date || null,
  });
}

export function initGuestShell() {
  document.body.classList.toggle('tz-guest-mode', isGuestUser());
  document.body.classList.toggle('tz-registered-mode', isRegisteredUser());
}

export function wireLoginRequiredModal() {
  const root = document.getElementById('guestLoginRequired');
  if (!root) return;
  const close = () => { root.hidden = true; };
  root.querySelector('.tz-guest-login-required__backdrop')?.addEventListener('click', close);
  root.querySelector('[data-action="close"]')?.addEventListener('click', close);
  root.querySelector('[data-action="create-account"]')?.addEventListener('click', () => {
    trackGuestEvent('Create Account Clicked');
    window.location.href = '/create-passport.html';
  });
  root.querySelector('[data-action="login"]')?.addEventListener('click', () => {
    trackGuestEvent('Login Clicked');
    window.location.href = '/login-screen.html';
  });
}

export function showLoginRequired() {
  trackGuestEvent('Login Required Shown');
  const root = document.getElementById('guestLoginRequired');
  if (root) root.hidden = false;
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
