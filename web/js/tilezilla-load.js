import {
  consumeForceStartup,
  playAsGuest,
  TILEZILLA_GAME_URL,
  trackGuestEvent,
} from './tilezilla-guest.js';
import { applyServerSession, fetchServerSession, isDevAuthBypass } from './tilezilla-auth.js';
import { applyUiScale } from './tilezilla-ui-scale.js';
import { applyLoadScreenLayout, loadLoadScreenLayout, reloadLoadScreenLayout } from './load-screen-layout.js';
import { applyMainScreenV2Layout, loadMainScreenV2Layout } from './main-screen-v2-layout.js';
import { initLoadScreenCarousel } from './load-screen-carousel.js';

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

let activeLoadLayout = null;

function applyLoadScreenChrome(loadLayout) {
  activeLoadLayout = loadLayout;
  applyUiScale();
  applyLoadScreenLayout(loadLayout);
}

void Promise.all([
  loadLoadScreenLayout({ fromDisk: true }),
  loadMainScreenV2Layout(),
]).then(([loadLayout, msv2]) => {
  applyMainScreenV2Layout(msv2);
  applyLoadScreenChrome(loadLayout);
  initLoadScreenCarousel();
});

async function reloadLoadScreenFromDisk() {
  try {
    const loadLayout = await reloadLoadScreenLayout({ fromDisk: true });
    applyLoadScreenChrome(loadLayout);
  } catch (err) {
    console.warn('Load screen layout:', err);
  }
}

function reapplyLoadScreenPositions() {
  if (activeLoadLayout) applyLoadScreenLayout(activeLoadLayout);
}

window.addEventListener('tilezilla:load-screen-layout-saved', () => {
  void reloadLoadScreenFromDisk();
});

window.addEventListener('storage', (e) => {
  if (
    e.key === 'tilezilla:layouts:load-screen'
    || e.key === 'tilezilla:layouts:load-screen:pending'
    || e.key === 'tilezilla:load-screen-layout-version'
  ) {
    void reloadLoadScreenFromDisk();
  }
});

window.addEventListener('focus', () => {
  void reloadLoadScreenFromDisk();
});

function onViewportChange() {
  applyUiScale();
  reapplyLoadScreenPositions();
}

window.addEventListener('resize', onViewportChange);
window.visualViewport?.addEventListener('resize', onViewportChange);
window.visualViewport?.addEventListener('scroll', onViewportChange);
applyUiScale();

document.getElementById('playGuestBtn')?.addEventListener('click', () => {
  playAsGuest();
  trackGuestEvent('Daily Challenge Started', { source: 'load_screen' });
  window.location.href = TILEZILLA_GAME_URL;
});

document.getElementById('loginBtn')?.addEventListener('click', () => {
  trackGuestEvent('Login Clicked', { source: 'load_screen' });
  window.location.href = '/login-screen.html';
});
