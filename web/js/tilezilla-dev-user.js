/** Dev / QA test accounts — unlock in-game dev menus (not for production players). */

export const DEV_USER_IDS = new Set(['dev', 'garadmin']);

export function isDevUser(userId) {
  const id = String(userId || '').toLowerCase();
  return DEV_USER_IDS.has(id);
}

export function readActiveUserId() {
  try {
    const raw = localStorage.getItem('snake_active_user_v1');
    return raw && typeof raw === 'string' ? raw : 'gar';
  } catch {
    return 'gar';
  }
}

/** Toggle dev-only UI (menu section, settings block, body class). */
export function syncDevUserUi(userId) {
  const on = isDevUser(userId);
  document.body.classList.toggle('tz-is-dev-user', on);
  document.querySelectorAll('[data-dev-only]').forEach((el) => {
    el.hidden = !on;
  });
}
