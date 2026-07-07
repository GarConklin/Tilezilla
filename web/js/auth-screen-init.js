/** Apply saved auth-screen layout on login / create / profile pages. */
import { initAuthScreenChrome } from './auth-screen-chrome.js';
import { initAuthScreenLayout } from './auth-screen-layout.js';
import { initPasswordRevealToggles } from './auth-screen-pass-toggle.js';
import { refreshProfilePassportStats, bindProfileHintBalanceListener, bindProfileProgressReadyListener } from './profile-passport-data.js';
import { refreshProfileRankIcons } from './profile-rank-icons.js';
import { applyPassportJournalStats } from './passport-journal-stats.js';

const SCREEN_BY_CLASS = {
  'auth-screen--login': 'login',
  'auth-screen--create': 'create',
  'auth-screen--profile': 'profile',
};

function wireAuthScreenLayoutReload(screenKey) {
  const reload = () => {
    void initAuthScreenLayout(screenKey, { preferFile: true });
  };
  window.addEventListener('tilezilla:auth-screen-layout-saved', reload);
  window.addEventListener('focus', reload);
  window.addEventListener('storage', (e) => {
    if (e.key === 'tilezilla:auth-screen-layout-version') reload();
  });
}

async function bootAuthScreen(screenKey) {
  document.body.classList.add('auth-screen-chrome', 'auth-screen--layout-pending');
  wireAuthScreenLayoutReload(screenKey);
  try {
    await initAuthScreenChrome();
    await initAuthScreenLayout(screenKey, { preferFile: true });
    initPasswordRevealToggles();
    if (screenKey === 'create') {
      const { applySystemStatsToAuthScreen } = await import('./system-info.js');
      void applySystemStatsToAuthScreen();
    } else if (screenKey === 'login') {
      void applyPassportJournalStats();
    } else if (screenKey === 'profile') {
      bindProfileHintBalanceListener();
      bindProfileProgressReadyListener();
    }
  } finally {
    document.body.classList.remove('auth-screen--layout-pending');
  }
}

for (const [cls, key] of Object.entries(SCREEN_BY_CLASS)) {
  if (document.body.classList.contains(cls)) {
    void bootAuthScreen(key);
    break;
  }
}
