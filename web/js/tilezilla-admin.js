/** Server-backed admin flag (users.is_admin) — separate from dev test accounts. */

import { isDevUser } from './tilezilla-dev-user.js';

export const IS_ADMIN_KEY = 'tilezilla_is_admin';

export function setServerAdminFlag(isAdmin) {
  try {
    if (isAdmin) localStorage.setItem(IS_ADMIN_KEY, '1');
    else localStorage.removeItem(IS_ADMIN_KEY);
  } catch {
    /* ignore */
  }
}

export function isServerAdmin() {
  try {
    return localStorage.getItem(IS_ADMIN_KEY) === '1';
  } catch {
    return false;
  }
}

export function isAdminUser(userId) {
  return isDevUser(userId) || isServerAdmin();
}

export function syncAdminUi(userId) {
  const on = isAdminUser(userId);
  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.hidden = !on;
  });
  const approveReviewBtn = document.getElementById('approveReviewBtn');
  const boardToolsPanel = document.getElementById('boardToolsPanel');
  if (approveReviewBtn) {
    approveReviewBtn.style.display = on ? '' : 'none';
    approveReviewBtn.disabled = !on;
  }
  if (boardToolsPanel) {
    boardToolsPanel.style.display = on ? '' : 'none';
  }
}

export function applyAdminFromSessionUser(user) {
  setServerAdminFlag(!!user?.is_admin);
}
