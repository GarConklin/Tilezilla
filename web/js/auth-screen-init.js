/** Apply saved auth-screen layout on login / create / profile pages. */
import { initAuthScreenChrome } from './auth-screen-chrome.js';
import { initAuthScreenLayout } from './auth-screen-layout.js';
import { refreshProfilePassportStats } from './profile-passport-data.js';
import { refreshProfileRankIcons } from './profile-rank-icons.js';

const SCREEN_BY_CLASS = {
  'auth-screen--login': 'login',
  'auth-screen--create': 'create',
  'auth-screen--profile': 'profile',
};

for (const [cls, key] of Object.entries(SCREEN_BY_CLASS)) {
  if (document.body.classList.contains(cls)) {
    document.body.classList.add('auth-screen-chrome');
    void Promise.all([
      initAuthScreenChrome(),
      initAuthScreenLayout(key, { preferFile: true }),
    ]).then(() => {
      if (key === 'profile') {
        void refreshProfileRankIcons();
        void refreshProfilePassportStats();
      }
    });
    break;
  }
}
