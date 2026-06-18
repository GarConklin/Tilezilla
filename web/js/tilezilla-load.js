import {
  consumeForceStartup,
  isGuestUser,
  isRegisteredUser,
  playAsGuest,
  trackGuestEvent,
} from './tilezilla-guest.js';
import { applyUiScale, wireUiScaleListeners } from './tilezilla-ui-scale.js';
import { applyLoadScreenLayout, loadLoadScreenLayout } from './load-screen-layout.js';

if (!consumeForceStartup() && (isRegisteredUser() || isGuestUser())) {
  window.location.replace('/tilezilla.html');
}

void loadLoadScreenLayout().then((layout) => {
  applyLoadScreenLayout(layout);
});

applyUiScale();
wireUiScaleListeners();
window.addEventListener('resize', applyUiScale);

document.getElementById('playGuestBtn')?.addEventListener('click', () => {
  playAsGuest();
  trackGuestEvent('Daily Challenge Started', { source: 'load_screen' });
  window.location.href = '/tilezilla.html';
});

document.getElementById('loginBtn')?.addEventListener('click', () => {
  trackGuestEvent('Login Clicked', { source: 'load_screen' });
  window.location.href = '/login-screen.html';
});
