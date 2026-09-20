import { AUTH_API, syncAuthFromServer } from './tilezilla-auth.js';
import { isServerAdmin } from './tilezilla-admin.js';

const ADMIN_API = `${AUTH_API}/admin`;

const els = {
  status: document.getElementById('adminStatus'),
  main: document.getElementById('adminMain'),
  flash: document.getElementById('adminFlash'),
  list: document.getElementById('messagesList'),
  refresh: document.getElementById('refreshMessagesBtn'),
  createForm: document.getElementById('createMessageForm'),
};

function flash(message, isError = false) {
  if (!els.flash) return;
  els.flash.textContent = message;
  els.flash.hidden = false;
  els.flash.classList.toggle('is-error', isError);
  clearTimeout(flash._t);
  flash._t = setTimeout(() => {
    els.flash.hidden = true;
  }, 4000);
}

async function adminFetch(path, options = {}) {
  const res = await fetch(`${ADMIN_API}/${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString();
  } catch {
    return iso;
  }
}

function renderMessages(messages) {
  if (!els.list) return;
  if (!messages?.length) {
    els.list.innerHTML = '<p class="admin-messages__empty">No messages yet.</p>';
    return;
  }

  els.list.innerHTML = messages
    .map((m) => {
      const inactive = m.active ? '' : ' is-inactive';
      const activeLabel = m.active ? 'Active' : 'Inactive';
      return `
        <article class="admin-messages__item${inactive}" data-id="${m.id}">
          <div class="admin-messages__item-head">
            <h3 class="admin-messages__item-title">${escapeHtml(m.title)}</h3>
            <span>${activeLabel} · ${m.read_count || 0} read</span>
          </div>
          <p class="admin-messages__meta">#${m.id} · updated ${escapeHtml(formatWhen(m.updated_at || m.created_at))}</p>
          <p class="admin-messages__item-body">${escapeHtml(m.body)}</p>
          <div class="admin-messages__item-actions">
            <button type="button" class="admin-users__btn" data-action="toggle">${m.active ? 'Deactivate' : 'Activate'}</button>
            <button type="button" class="admin-users__btn" data-action="edit">Edit</button>
            <button type="button" class="admin-users__btn admin-users__btn--danger" data-action="delete">Delete</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadMessages() {
  const data = await adminFetch('passport-messages.php');
  renderMessages(data.messages || []);
}

els.createForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.createForm);
  try {
    await adminFetch('passport-messages.php', {
      method: 'POST',
      body: JSON.stringify({
        title: String(fd.get('title') || '').trim(),
        body: String(fd.get('body') || '').trim(),
        active: fd.get('active') === 'on',
      }),
    });
    els.createForm.reset();
    els.createForm.active.checked = true;
    flash('Message published.');
    await loadMessages();
  } catch (err) {
    flash(err.message || 'Failed to publish', true);
  }
});

els.refresh?.addEventListener('click', () => {
  loadMessages().catch((err) => flash(err.message || 'Refresh failed', true));
});

els.list?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  const item = e.target.closest('[data-id]');
  if (!btn || !item) return;
  const id = Number(item.dataset.id);
  const action = btn.dataset.action;

  try {
    if (action === 'toggle') {
      const currentlyActive = !item.classList.contains('is-inactive');
      await adminFetch('passport-messages.php', {
        method: 'PATCH',
        body: JSON.stringify({ id, active: !currentlyActive }),
      });
      flash(currentlyActive ? 'Message deactivated.' : 'Message activated.');
      await loadMessages();
      return;
    }
    if (action === 'edit') {
      const title = prompt('Title', item.querySelector('.admin-messages__item-title')?.textContent || '');
      if (title == null) return;
      const body = prompt('Body', item.querySelector('.admin-messages__item-body')?.textContent || '');
      if (body == null) return;
      await adminFetch('passport-messages.php', {
        method: 'PATCH',
        body: JSON.stringify({ id, title: title.trim(), body: body.trim() }),
      });
      flash('Message updated.');
      await loadMessages();
      return;
    }
    if (action === 'delete') {
      if (!confirm(`Delete message #${id}? This cannot be undone.`)) return;
      await adminFetch(`passport-messages.php?id=${id}`, { method: 'DELETE' });
      flash('Message deleted.');
      await loadMessages();
    }
  } catch (err) {
    flash(err.message || 'Action failed', true);
  }
});

(async function init() {
  const auth = await syncAuthFromServer({ requireRegistered: true });
  if (!auth.user?.is_admin && !isServerAdmin()) {
    els.status.textContent = 'Admin access required.';
    flash('You do not have permission to view this page.', true);
    setTimeout(() => {
      window.location.replace('/tilezilla-v2.html');
    }, 1500);
    return;
  }
  els.status.textContent = `Signed in as ${auth.user?.username || 'admin'}.`;
  els.main.hidden = false;
  try {
    await loadMessages();
  } catch (err) {
    flash(err.message || 'Failed to load messages', true);
  }
})();
