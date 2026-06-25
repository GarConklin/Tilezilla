/**
 * Dev-only: sign in and jump straight to the game (skips load/login screens).
 * Tries /auth/api/login.php first; falls back to local session if auth is unavailable.
 */

import {
  AUTH_MODE_KEY,
  ACTIVE_USER_KEY,
  getGuestCode,
  setRegisteredUser,
} from './tilezilla-guest.js';

const DEFAULT_USER = 'test';
const DEFAULT_PASS = 'test';
const DEFAULT_REDIRECT = '/tilezilla-v2.html';

export async function devAutoLogin(options = {}) {
  const username = options.username || DEFAULT_USER;
  const password = options.password || DEFAULT_PASS;
  const redirect = options.redirect || DEFAULT_REDIRECT;

  try {
    const res = await fetch('/auth/api/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        password,
        guest_code: getGuestCode() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.user?.username) {
      setRegisteredUser(data.user.username);
      window.location.replace(redirect);
      return { mode: 'server', username: data.user.username };
    }
  } catch {
    /* auth container down — use local dev session below */
  }

  setRegisteredUser(username);
  localStorage.setItem(ACTIVE_USER_KEY, username);
  localStorage.setItem(AUTH_MODE_KEY, 'registered');
  window.location.replace(redirect);
  return { mode: 'local', username };
}
