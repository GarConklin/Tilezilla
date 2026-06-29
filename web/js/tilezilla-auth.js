/**
 * Server-backed auth — PHP session is the source of truth for registered users.
 */

import {
  ACTIVE_USER_KEY,
  AUTH_MODE_KEY,
  clearRegisteredLocalState,
  getGuestCode,
  REGISTERED_USER_ID_KEY,
  setRegisteredUser,
  setConvertedGuestCode,
  trackGuestEvent,
} from './tilezilla-guest.js';
import { hydrateEncounteredTiles } from './tilezilla-encountered-tiles.js';

export const AUTH_API = '/auth/api';

export { clearRegisteredLocalState } from './tilezilla-guest.js';

export function isDevAuthBypass() {
  return new URLSearchParams(window.location.search).has('dev');
}

export async function fetchServerSession() {
  try {
    const res = await fetch(`${AUTH_API}/check-session.php`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.authenticated && data?.user?.id != null) {
      return { ok: true, user: data.user };
    }
    return { ok: false, user: null };
  } catch {
    return { ok: false, user: null, offline: true };
  }
}

export function applyServerSession(user) {
  if (!user?.id) return;
  setRegisteredUser({
    id: user.id,
    username: user.username || user.player_name || String(user.id),
  });
  if (user.guest_code) {
    setConvertedGuestCode(user.guest_code);
  }
}

export function applyRegisteredUserToApp(app, user) {
  if (!app?.state || user?.id == null) return;
  const userKey = String(user.id);
  app.state.userId = userKey;
  if (app.progress) {
    app.progress.storageKey = `snake_progress_v1_${userKey}`;
    app.progress.data = app.progress.load();
    hydrateEncounteredTiles(app.progress, userKey);
  }
  if (typeof app.loadGlobalHintTokens === 'function') {
    app.state.hintTokens = app.loadGlobalHintTokens();
  }
}

/**
 * Sync local registered flags from PHP session.
 * Clears stale registered localStorage when the server session is gone.
 */
export async function syncAuthFromServer(options = {}) {
  const { requireRegistered = false } = options;

  if (isDevAuthBypass()) {
    return { mode: 'dev', user: null };
  }

  const session = await fetchServerSession();
  if (session.ok) {
    applyServerSession(session.user);
    return { mode: 'registered', user: session.user };
  }

  const hadRegisteredLocal = localStorage.getItem(AUTH_MODE_KEY) === 'registered';
  if (hadRegisteredLocal) {
    clearRegisteredLocalState();
  }

  if (requireRegistered) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login-screen.html?return=${encodeURIComponent(returnTo)}`);
    return { mode: 'redirect', user: null };
  }

  return { mode: hadRegisteredLocal ? 'cleared' : 'anonymous', user: null };
}

export async function completeLoginFromServer(loginResponse, meta = {}) {
  const user = loginResponse?.user;
  if (!user?.id) {
    throw new Error('Login response missing user.');
  }
  applyServerSession(user);
  trackGuestEvent('Login Success', {
    user_id: user.username,
    words_user_id: user.id,
    converted_from: getGuestCode() || null,
    ...meta,
  });
  return user;
}

export function loginReturnUrl(fallback = '/profile-screen.html') {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('return');
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export function readPendingVerifyEmail() {
  try {
    return sessionStorage.getItem('tilezilla:pending_verify_email') || '';
  } catch {
    return '';
  }
}

export function storePendingVerifyEmail(email) {
  try {
    if (email) sessionStorage.setItem('tilezilla:pending_verify_email', email);
    else sessionStorage.removeItem('tilezilla:pending_verify_email');
  } catch {
    /* ignore */
  }
}

export { REGISTERED_USER_ID_KEY, ACTIVE_USER_KEY, AUTH_MODE_KEY };
