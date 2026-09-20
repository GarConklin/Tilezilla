/** Passport update news — DB for registered users, localStorage for guests. */

import { AUTH_API, fetchServerSession } from './tilezilla-auth.js';

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

async function loadStaticPassportNews() {
  const res = await fetch(`${NEWS_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load passport news');
  return res.json();
}

async function fetchUnreadServerMessages() {
  const session = await fetchServerSession();
  if (!session?.ok || !session.user?.id) return null;

  const res = await fetch(`${AUTH_API}/passport-messages.php`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to load passport messages');
  const data = await res.json();
  if (!data?.success || !Array.isArray(data.messages)) return [];
  return data.messages;
}

async function markServerMessageRead(messageId) {
  try {
    await fetch(`${AUTH_API}/passport-messages.php`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId }),
    });
  } catch {
    /* offline — local dismiss still applied */
  }
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

function showMessageModal(news, { onDismiss } = {}) {
  const root = ensureModal();
  const title = root.querySelector('#passportNewsTitle');
  const body = root.querySelector('#passportNewsBody');
  const btn = root.querySelector('#passportNewsGotIt');
  if (title) title.textContent = news.title || 'Update';
  if (body) body.textContent = news.body || '';

  const dismiss = () => {
    onDismiss?.();
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

/**
 * Show passport news if active and not yet dismissed for this user.
 * Registered users: DB unread queue. Guests: static JSON + localStorage.
 */
export async function maybeShowPassportNews({ userKey } = {}) {
  const who = userKey ?? currentUserKey();

  try {
    const serverMessages = await fetchUnreadServerMessages();
    if (Array.isArray(serverMessages)) {
      const next = serverMessages[0];
      if (!next?.id) return false;
      return showMessageModal(next, {
        onDismiss: () => {
          dismissPassportNews(String(next.id), who);
          void markServerMessageRead(next.id);
        },
      });
    }
  } catch (err) {
    console.warn('Passport news (server):', err);
  }

  let news;
  try {
    news = await loadStaticPassportNews();
  } catch (err) {
    console.warn('Passport news:', err);
    return false;
  }
  if (!news?.active || !news?.id) return false;
  if (isPassportNewsDismissed(news.id, who)) return false;

  return showMessageModal(news, {
    onDismiss: () => dismissPassportNews(news.id, who),
  });
}
