/**
 * Forgot password popup — email submit to /auth/api/forgot-password.php
 */

import {
  applyForgotPasswordLayout,
  initForgotPasswordLayout,
  reloadForgotPasswordLayout,
} from './forgot-password-layout.js';

function $(id) {
  return document.getElementById(id);
}

export function closeForgotPasswordPopup() {
  const root = $('forgotPasswordRoot');
  if (root) root.hidden = true;
  document.body.classList.remove('forgot-password-open');
  const input = $('forgotPasswordEmail');
  if (input) input.value = '';
  const feedback = $('forgotPasswordFeedback');
  if (feedback) {
    feedback.textContent = '';
    feedback.hidden = true;
  }
  const sendBtn = $('forgotPasswordSendBtn');
  if (sendBtn) sendBtn.disabled = false;
}

export function openForgotPasswordPopup() {
  const root = $('forgotPasswordRoot');
  if (!root) return;
  const feedback = $('forgotPasswordFeedback');
  if (feedback) {
    feedback.textContent = '';
    feedback.hidden = true;
  }
  root.hidden = false;
  document.body.classList.add('forgot-password-open');
  $('forgotPasswordEmail')?.focus();
}

function setFeedback(message, { isError = false } = {}) {
  const el = $('forgotPasswordFeedback');
  if (!el) return;
  el.textContent = message || '';
  el.hidden = !message;
  el.dataset.tone = isError ? 'error' : 'success';
}

export function initForgotPasswordPopup({ showError } = {}) {
  const dismiss = () => closeForgotPasswordPopup();

  $('forgotPasswordBackdrop')?.addEventListener('click', dismiss);
  $('forgotPasswordCancelBtn')?.addEventListener('click', dismiss);

  $('forgotPasswordSendBtn')?.addEventListener('click', () => {
    void submitForgotPassword({ showError });
  });

  $('forgotPasswordEmail')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submitForgotPassword({ showError });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('forgotPasswordRoot')?.hidden) return;
    dismiss();
  });

  void initForgotPasswordLayout().catch((err) => console.warn('Forgot password layout:', err));

  window.addEventListener('tilezilla:forgot-password-layout-saved', () => {
    void reloadForgotPasswordLayout()
      .then((layout) => applyForgotPasswordLayout(layout))
      .catch((err) => console.warn('Forgot password layout reload:', err));
  });
}

async function submitForgotPassword({ showError } = {}) {
  const email = $('forgotPasswordEmail')?.value?.trim() || '';
  if (!email) {
    setFeedback('Enter your email address.', { isError: true });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFeedback('Enter a valid email address.', { isError: true });
    return;
  }

  const sendBtn = $('forgotPasswordSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch('/auth/api/forgot-password.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ identifier: email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      const msg = data?.error || 'Could not send reset link. Try again.';
      setFeedback(msg, { isError: true });
      if (showError) showError(msg);
      if (sendBtn) sendBtn.disabled = false;
      return;
    }
    const msg = data?.message || 'If an account exists, a reset link has been sent.';
    setFeedback(msg, { isError: false });
    if (sendBtn) sendBtn.disabled = true;
  } catch {
    const msg = 'Could not reach the passport office. Check your connection.';
    setFeedback(msg, { isError: true });
    if (showError) showError(msg);
    if (sendBtn) sendBtn.disabled = false;
  }
}
