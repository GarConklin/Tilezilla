/** Apply saved auth-screen layout on login / create / profile pages. */
import { initAuthScreenChrome } from './auth-screen-chrome.js';
import { initAuthScreenLayout } from './auth-screen-layout.js';
import { initPasswordRevealToggles } from './auth-screen-pass-toggle.js';
import { refreshProfilePassportStats } from './profile-passport-data.js';
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

for (const [cls, key] of Object.entries(SCREEN_BY_CLASS)) {
  if (document.body.classList.contains(cls)) {
    document.body.classList.add('auth-screen-chrome');
    wireAuthScreenLayoutReload(key);
    void Promise.all([
      initAuthScreenChrome(),
      initAuthScreenLayout(key, { preferFile: true }),
    ]).then(async () => {
      initPasswordRevealToggles();
      if (key === 'create') {
        const { applySystemStatsToAuthScreen } = await import('./system-info.js');
        void applySystemStatsToAuthScreen();
      } else if (key === 'login') {
        void applyPassportJournalStats();
      } else if (key === 'profile') {
        void refreshProfileRankIcons();
        void refreshProfilePassportStats();
      }
    });
    break;
  }
}
