/** Apply saved auth-screen layout on login / create / profile pages. */
import { initAuthScreenLayout } from './auth-screen-layout.js';

const SCREEN_BY_CLASS = {
  'auth-screen--login': 'login',
  'auth-screen--create': 'create',
  'auth-screen--profile': 'profile',
};

for (const [cls, key] of Object.entries(SCREEN_BY_CLASS)) {
  if (document.body.classList.contains(cls)) {
    void initAuthScreenLayout(key);
    break;
  }
}
