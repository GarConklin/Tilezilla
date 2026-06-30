import { AUTH_API, syncAuthFromServer } from './tilezilla-auth.js';
import { isServerAdmin } from './tilezilla-admin.js';

const ADMIN_API = `${AUTH_API}/admin`;

let selectedUserId = null;
let searchTimer = null;

const els = {
  status: document.getElementById('adminStatus'),
  main: document.getElementById('adminMain'),
  flash: document.getElementById('adminFlash'),
  search: document.getElementById('userSearch'),
  refresh: document.getElementById('refreshUsersBtn'),
  tableBody: document.getElementById('usersTableBody'),
  detailPanel: document.getElementById('userDetailPanel'),
  detailUserId: document.getElementById('detailUserId'),
  editForm: document.getElementById('editUserForm'),
  passwordForm: document.getElementById('resetPasswordForm'),
  hintsForm: document.getElementById('grantHintsForm'),
  userMeta: document.getElementById('userMeta'),
  closeDetail: document.getElementById('closeDetailBtn'),
  deleteBtn: document.getElementById('deleteUserBtn'),
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
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function renderUsers(users) {
  els.tableBody.innerHTML = '';
  for (const user of users) {
    const tr = document.createElement('tr');
    tr.dataset.userId = String(user.id);
    if (selectedUserId === user.id) tr.classList.add('is-selected');
    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.email || '')}</td>
      <td>${escapeHtml(user.status)}</td>
      <td>${user.hint_tokens}</td>
      <td>${user.is_admin ? 'yes' : ''}</td>
    `;
    tr.addEventListener('click', () => openUser(user.id));
    els.tableBody.appendChild(tr);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadUsers() {
  const q = els.search?.value?.trim() || '';
  const data = await adminFetch(`users.php${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  renderUsers(data.users || []);
}

function fillEditForm(user) {
  const form = els.editForm;
  form.username.value = user.username || '';
  form.player_name.value = user.player_name || '';
  form.email.value = user.email || '';
  form.status.value = user.status || 'active';
  form.active_until.value = user.active_until ? String(user.active_until).slice(0, 10) : '';
  form.paid.checked = !!user.paid;
  form.email_verified.checked = !!user.email_verified;
  form.is_admin.checked = !!user.is_admin;
  els.detailUserId.textContent = `#${user.id}`;
  els.userMeta.innerHTML = `
    <div>Hints (DB): <strong>${user.hint_tokens}</strong></div>
    <div>Created: ${escapeHtml(user.created_at || '—')}</div>
    <div>Last login: ${escapeHtml(user.last_login || '—')}</div>
    ${user.guest_code ? `<div>Guest code: ${escapeHtml(user.guest_code)}</div>` : ''}
  `;
}

async function openUser(userId) {
  selectedUserId = userId;
  const data = await adminFetch(`user.php?id=${userId}`);
  fillEditForm(data.user);
  els.detailPanel.hidden = false;
  document.querySelectorAll('#usersTableBody tr').forEach((tr) => {
    tr.classList.toggle('is-selected', Number(tr.dataset.userId) === userId);
  });
}

function closeDetail() {
  selectedUserId = null;
  els.detailPanel.hidden = true;
  document.querySelectorAll('#usersTableBody tr.is-selected').forEach((tr) => {
    tr.classList.remove('is-selected');
  });
}

async function saveUser(event) {
  event.preventDefault();
  const form = els.editForm;
  const payload = {
    id: selectedUserId,
    username: form.username.value.trim(),
    player_name: form.player_name.value.trim(),
    email: form.email.value.trim(),
    status: form.status.value,
    active_until: form.active_until.value || null,
    paid: form.paid.checked,
    email_verified: form.email_verified.checked,
    is_admin: form.is_admin.checked,
  };
  const data = await adminFetch('user.php', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  fillEditForm(data.user);
  flash('User saved.');
  await loadUsers();
}

async function resetPassword(event) {
  event.preventDefault();
  const password = els.passwordForm.password.value;
  await adminFetch('user-password.php', {
    method: 'POST',
    body: JSON.stringify({ user_id: selectedUserId, password }),
  });
  els.passwordForm.reset();
  flash('Password updated.');
}

async function grantHints(event) {
  event.preventDefault();
  const amount = Number(els.hintsForm.amount.value);
  const reason = els.hintsForm.reason.value.trim() || 'Admin Grant';
  const data = await adminFetch('user-hints.php', {
    method: 'POST',
    body: JSON.stringify({ user_id: selectedUserId, amount, reason }),
  });
  fillEditForm(data.user);
  els.hintsForm.reset();
  flash(`Hints updated. New balance: ${data.user.hint_tokens}`);
  await loadUsers();
}

async function deleteUser() {
  if (!selectedUserId) return;
  const user = els.editForm.username.value;
  if (!window.confirm(`Delete user "${user}" (#${selectedUserId})? This cannot be undone.`)) {
    return;
  }
  await adminFetch(`user.php?id=${selectedUserId}`, { method: 'DELETE' });
  flash('User deleted.');
  closeDetail();
  await loadUsers();
}

function wireEvents() {
  els.refresh?.addEventListener('click', () => loadUsers().catch((e) => flash(e.message, true)));
  els.search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadUsers().catch((e) => flash(e.message, true));
    }, 250);
  });
  els.editForm?.addEventListener('submit', (e) => saveUser(e).catch((err) => flash(err.message, true)));
  els.passwordForm?.addEventListener('submit', (e) => resetPassword(e).catch((err) => flash(err.message, true)));
  els.hintsForm?.addEventListener('submit', (e) => grantHints(e).catch((err) => flash(err.message, true)));
  els.closeDetail?.addEventListener('click', closeDetail);
  els.deleteBtn?.addEventListener('click', () => deleteUser().catch((err) => flash(err.message, true)));
}

async function init() {
  const auth = await syncAuthFromServer({ requireRegistered: true });
  if (!auth.user?.is_admin && !isServerAdmin()) {
    els.status.textContent = 'Admin access required.';
    flash('You do not have permission to view this page.', true);
    setTimeout(() => {
      window.location.replace('/tilezilla-v2.html');
    }, 1500);
    return;
  }

  els.status.textContent = `Signed in as ${auth.user.username}`;
  els.main.hidden = false;
  wireEvents();
  await loadUsers();
}

init().catch((err) => {
  els.status.textContent = 'Failed to load admin panel.';
  flash(err.message, true);
});
