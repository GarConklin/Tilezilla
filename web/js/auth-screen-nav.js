/** Bottom nav on login / create — Daily Challenge (guest) + Log out. */

import {
  logoutRegisteredUser,
  playAsGuest,
  trackGuestEvent,
} from './tilezilla-guest.js';

export function initAuthScreenNav({ source = 'auth_screen' } = {}) {
  document.getElementById('authNavDaily')?.addEventListener('click', (e) => {
    e.preventDefault();
    playAsGuest();
    trackGuestEvent('Daily Challenge Started', { source });
    window.location.href = '/tilezilla.html';
  });

  document.getElementById('authNavLogout')?.addEventListener('click', () => {
    void logoutRegisteredUser();
  });
}
