/**
 * Server-backed hint balance for registered users (MySQL source of truth).
 */

import { isRegisteredUser, REGISTERED_USER_ID_KEY } from './tilezilla-guest.js';

// Inline path — do not import tilezilla-auth.js (circular: auth imports this module).
const HINTS_API = '/auth/api/hints.php';

export const HINT_REASON = {
  random: 'Random Solution Hint',
  start: 'Start Tile Hint',
  end: 'End Tile Hint',
  exampleRoute: 'Example Route Hint',
  puzzleCompletion: 'Puzzle Completion',
  timeBonus: 'Time Bonus',
  refund: 'Hint Refund',
};

export function usesServerHints() {
  return isRegisteredUser();
}

export function hintTokensStorageKey(userId) {
  const id = userId || localStorage.getItem(REGISTERED_USER_ID_KEY) || 'gar';
  return `snake_hint_tokens_v1_${id}`;
}

export function cacheHintBalance(userId, balance) {
  try {
    localStorage.setItem(hintTokensStorageKey(userId), String(Math.max(0, Number(balance) || 0)));
  } catch {
    /* ignore */
  }
}

export function readCachedHintBalance(userId) {
  try {
    const raw = localStorage.getItem(hintTokensStorageKey(userId));
    if (raw != null) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function dispatchHintBalance(detail = {}) {
  window.dispatchEvent(new CustomEvent('tilezilla:hint-balance', { detail }));
}

export async function fetchHintBalance() {
  const res = await fetch(HINTS_API, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to load hints (${res.status})`);
  }
  return Math.max(0, Number(data.hint_tokens) || 0);
}

export async function postHintTransaction(amount, reason, referenceId = null) {
  const body = { amount: Number(amount) || 0, reason: String(reason || '').trim() };
  if (referenceId) body.reference_id = String(referenceId);
  const res = await fetch(HINTS_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Hint transaction failed (${res.status})`);
  }
  return Math.max(0, Number(data.hint_tokens) || 0);
}

export function applyHintBalanceToApp(app, balance, userId) {
  const n = Math.max(0, Number(balance) || 0);
  if (app?.state) app.state.hintTokens = n;
  if (userId) cacheHintBalance(userId, n);
  dispatchHintBalance({ balance: n });
  return n;
}

export async function hydrateHintBalanceForApp(app) {
  if (!usesServerHints()) return null;
  const userId = app?.state?.userId
    || localStorage.getItem(REGISTERED_USER_ID_KEY)
    || null;
  const balance = await fetchHintBalance();
  return applyHintBalanceToApp(app, balance, userId);
}

export function applySessionHintBalance(user) {
  if (!user?.id || user.hint_tokens == null) return;
  const n = Math.max(0, Number(user.hint_tokens) || 0);
  cacheHintBalance(user.id, n);
  if (window.__app?.state) {
    window.__app.state.hintTokens = n;
  }
  dispatchHintBalance({ balance: n, source: 'session' });
}
