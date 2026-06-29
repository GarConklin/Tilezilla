/**
 * Dev-only: sign in and jump straight to the game (skips load/login screens).
 * Requires a working auth service and verified test account.
 */

import { getGuestCode, TILEZILLA_GAME_URL } from './tilezilla-guest.js';
import { completeLoginFromServer } from './tilezilla-auth.js';

const DEFAULT_USER = 'test';
const DEFAULT_PASS = 'test';
const DEFAULT_REDIRECT = TILEZILLA_GAME_URL;

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
    if (res.ok && data?.success && data?.user?.id) {
      await completeLoginFromServer(data, { source: 'dev_auto_login' });
      window.location.replace(redirect);
      return { mode: 'server', username: data.user.username };
    }
  } catch {
    /* auth container down */
  }

  throw new Error('Dev auto-login failed — start the auth service or use a verified test account.');
}
