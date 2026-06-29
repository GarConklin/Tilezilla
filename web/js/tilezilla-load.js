import {
  consumeForceStartup,
  playAsGuest,
  TILEZILLA_GAME_URL,
  trackGuestEvent,
} from './tilezilla-guest.js';
import { applyServerSession, fetchServerSession, isDevAuthBypass } from './tilezilla-auth.js';
import { applyUiScale, wireUiScaleListeners } from './tilezilla-ui-scale.js';
import { applyLoadScreenLayout, loadLoadScreenLayout } from './load-screen-layout.js';
import { applyMainScreenV2Layout, loadMainScreenV2Layout } from './main-screen-v2-layout.js';

async function bootLoadScreen() {
  if (consumeForceStartup()) return;

  if (!isDevAuthBypass()) {
    const session = await fetchServerSession();
    if (session.ok) {
      applyServerSession(session.user);
      window.location.replace(TILEZILLA_GAME_URL);
      return;
    }
  }
}

void bootLoadScreen();

void Promise.all([loadLoadScreenLayout(), loadMainScreenV2Layout()]).then(([loadLayout, msv2]) => {
  applyMainScreenV2Layout(msv2);
  applyLoadScreenLayout(loadLayout);
});

applyUiScale();
wireUiScaleListeners();
window.addEventListener('resize', applyUiScale);

document.getElementById('playGuestBtn')?.addEventListener('click', () => {
  playAsGuest();
  trackGuestEvent('Daily Challenge Started', { source: 'load_screen' });
  window.location.href = TILEZILLA_GAME_URL;
});

document.getElementById('loginBtn')?.addEventListener('click', () => {
  trackGuestEvent('Login Clicked', { source: 'load_screen' });
  window.location.href = '/login-screen.html';
});
