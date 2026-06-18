/**
 * Login / create passport error plaque popup.
 */

import {
  applyAuthErrorLayout,
  initAuthErrorLayout,
  loadAuthErrorLayout,
  reloadAuthErrorLayout,
} from './auth-error-layout.js';

function $(id) {
  return document.getElementById(id);
}

export function closeAuthErrorPopup() {
  const root = $('authErrorRoot');
  if (root) root.hidden = true;
  document.body.classList.remove('auth-error-open');
}

export function showAuthErrorPopup(message) {
  const root = $('authErrorRoot');
  const msgEl = $('authErrorMessage');
  if (!root || !msgEl) {
    window.alert(message);
    return;
  }
  msgEl.textContent = message || 'Something went wrong. Please try again.';
  root.hidden = false;
  document.body.classList.add('auth-error-open');
  $('authErrorOkBtn')?.focus();
}

export function initAuthErrorPopup() {
  const dismiss = () => closeAuthErrorPopup();
  $('authErrorBackdrop')?.addEventListener('click', dismiss);
  $('authErrorCloseBtn')?.addEventListener('click', dismiss);
  $('authErrorOkBtn')?.addEventListener('click', dismiss);

  void initAuthErrorLayout().catch((err) => console.warn('Auth error layout:', err));

  window.addEventListener('tilezilla:auth-error-layout-saved', () => {
    void reloadAuthErrorLayout()
      .then((layout) => applyAuthErrorLayout(layout))
      .catch((err) => console.warn('Auth error layout reload:', err));
  });

  window.__authErrorPopup = { show: showAuthErrorPopup, close: closeAuthErrorPopup };
}
