/** Bottom nav on login / create — Daily Challenge (guest) + Log out. */

import {
  logoutRegisteredUser,
  playAsGuest,
  TILEZILLA_GAME_URL,
  trackGuestEvent,
} from './tilezilla-guest.js';

export function initAuthScreenNav({ source = 'auth_screen' } = {}) {
  document.getElementById('authNavDaily')?.addEventListener('click', (e) => {
    e.preventDefault();
    playAsGuest();
    trackGuestEvent('Daily Challenge Started', { source });
    window.location.href = TILEZILLA_GAME_URL;
  });

  document.getElementById('authNavLogout')?.addEventListener('click', () => {
    void logoutRegisteredUser();
  });
}
