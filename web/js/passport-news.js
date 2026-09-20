/** One-time dismissible passport update news (localStorage). */

const NEWS_URL = '/data/passport_news.json';
const STORAGE_PREFIX = 'tz-passport-news:';

function storageKey(announcementId, userKey) {
  const who = userKey ? String(userKey) : 'guest';
  return `${STORAGE_PREFIX}${announcementId}:${who}`;
}

function currentUserKey() {
  try {
    return localStorage.getItem('snake_active_user_v1') || 'guest';
  } catch {
    return 'guest';
  }
}

export function isPassportNewsDismissed(announcementId, userKey = currentUserKey()) {
  if (!announcementId) return true;
  try {
    return localStorage.getItem(storageKey(announcementId, userKey)) === '1';
  } catch {
    return false;
  }
}

export function dismissPassportNews(announcementId, userKey = currentUserKey()) {
  if (!announcementId) return;
  try {
    localStorage.setItem(storageKey(announcementId, userKey), '1');
  } catch {
    /* ignore quota */
  }
}

export async function loadPassportNews() {
  const res = await fetch(`${NEWS_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load passport news');
  return res.json();
}

function ensureModal() {
  let root = document.getElementById('passportNewsRoot');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'passportNewsRoot';
  root.className = 'tz-passport-news';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'passportNewsTitle');
  root.innerHTML = `
    <div class="tz-passport-news__backdrop" data-passport-news-dismiss></div>
    <div class="tz-passport-news__card">
      <h2 class="tz-passport-news__title" id="passportNewsTitle"></h2>
      <p class="tz-passport-news__body" id="passportNewsBody"></p>
      <button type="button" class="tz-passport-news__btn" id="passportNewsGotIt">Got it</button>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function hideModal(root) {
  if (!root) return;
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
}

/**
 * Show passport news if active and not yet dismissed for this user.
 * Call when the passport / profile overlay opens.
 */
export async function maybeShowPassportNews({ userKey } = {}) {
  let news;
  try {
    news = await loadPassportNews();
  } catch (err) {
    console.warn('Passport news:', err);
    return false;
  }
  if (!news?.active || !news?.id) return false;

  const who = userKey ?? currentUserKey();
  if (isPassportNewsDismissed(news.id, who)) return false;

  const root = ensureModal();
  const title = root.querySelector('#passportNewsTitle');
  const body = root.querySelector('#passportNewsBody');
  const btn = root.querySelector('#passportNewsGotIt');
  if (title) title.textContent = news.title || 'Update';
  if (body) body.textContent = news.body || '';

  const dismiss = () => {
    dismissPassportNews(news.id, who);
    hideModal(root);
  };

  root.querySelectorAll('[data-passport-news-dismiss]').forEach((el) => {
    el.onclick = dismiss;
  });
  if (btn) btn.onclick = dismiss;

  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
  btn?.focus?.();
  return true;
}
