/** Populate logged-in passport stat slots (profile page + in-game overlay). */

import {
  adventureLevelContext,
  getRankPanelState,
  loadAdventurePath,
} from './adventure-path.js';
import { PROFILE_LAYOUT_MOCK } from './auth-screen-layout.js';
import { ACTIVE_USER_KEY } from './tilezilla-guest.js';

function $(id) {
  return document.getElementById(id);
}

function setProfileSlot(root, slot, text) {
  const value = text == null || text === '' ? '—' : String(text);
  root.querySelectorAll(`[data-profile-slot="${slot}"]`).forEach((el) => {
    if (el.tagName === 'IMG') return;
    el.textContent = value;
  });
}

function formatPct(completed, total) {
  const t = Math.max(1, Number(total) || 1);
  const c = Math.max(0, Math.min(Number(completed) || 0, t));
  return `${Math.round((c / t) * 100)}%`;
}

function countDiscoveredRoutes(progress) {
  const data = progress?.data;
  if (!data || typeof data !== 'object') return null;
  let total = 0;
  for (const entry of Object.values(data)) {
    if (!entry || typeof entry !== 'object') continue;
    total += (entry.found || []).filter((f) => !f?.bonus).length;
  }
  return total;
}

function hintTokenCount() {
  try {
    const userId = localStorage.getItem(ACTIVE_USER_KEY) || 'gar';
    const raw = localStorage.getItem(`tilezilla_hint_tokens:${userId}`)
      ?? localStorage.getItem(`hint_tokens_${userId}`);
    if (raw != null) return Math.max(0, Number(raw) || 0);
  } catch {
    /* ignore */
  }
  return null;
}

function latestFoundLevelId(progress) {
  const data = progress?.data;
  if (!data) return null;
  let bestId = null;
  let bestAt = '';
  for (const [levelId, entry] of Object.entries(data)) {
    for (const found of entry?.found || []) {
      if (found?.bonus || !found?.foundAt) continue;
      if (!bestAt || found.foundAt > bestAt) {
        bestAt = found.foundAt;
        bestId = levelId;
      }
    }
  }
  return bestId;
}

function mostSolvedLevelId(progress) {
  const data = progress?.data;
  if (!data) return null;
  let bestId = null;
  let bestCount = 0;
  for (const [levelId, entry] of Object.entries(data)) {
    const count = (entry?.found || []).filter((f) => !f?.bonus).length;
    if (count > bestCount) {
      bestCount = count;
      bestId = levelId;
    }
  }
  return bestCount > 0 ? bestId : null;
}

function formatMemberSince() {
  try {
    const raw = localStorage.getItem('tilezilla_member_since');
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  const now = new Date();
  return now.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function passportIdForUser(userId) {
  if (!userId) return PROFILE_LAYOUT_MOCK.passportId;
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return `TZ-${hash.toString(16).toUpperCase().slice(0, 6).padEnd(6, '0')}`;
}

/**
 * @param {Document|HTMLElement} [root]
 */
export async function refreshProfilePassportStats({ root = document } = {}) {
  const userId = localStorage.getItem(ACTIVE_USER_KEY) || 'Explorer';
  const progress = window.__app?.progress ?? null;
  const mock = PROFILE_LAYOUT_MOCK;

  let rankState = null;
  try {
    const path = await loadAdventurePath();
    rankState = getRankPanelState(progress, path, adventureLevelContext(window.__app || {}));
  } catch {
    /* optional */
  }

  const adventureProgress = rankState
    ? formatPct(rankState.stepProgress, rankState.stepTotal)
    : mock.adventureProgress;

  const routes = countDiscoveredRoutes(progress);
  const hints = hintTokenCount();
  const dailyMeta = window.__dailyChallengeMeta;
  const recent = latestFoundLevelId(progress);

  setProfileSlot(root, 'adventureProgress', adventureProgress);
  setProfileSlot(root, 'routesDiscovered', routes != null ? String(routes) : mock.routesDiscovered);
  setProfileSlot(root, 'hintTokens', hints != null ? String(hints) : mock.hintTokens);
  setProfileSlot(root, 'memberSince', formatMemberSince());
  setProfileSlot(root, 'passportId', passportIdForUser(userId));
  setProfileSlot(root, 'explorersRegistered', mock.explorersRegistered);
  setProfileSlot(
    root,
    'todaysChallenge',
    dailyMeta?.levelId || $('puzzleCode')?.textContent?.trim() || mock.todaysChallenge,
  );
  setProfileSlot(root, 'recentPuzzleSolved', recent || mock.recentPuzzleSolved);
  setProfileSlot(root, 'recentDailyCompleted', recent || mock.recentDailyCompleted);
  setProfileSlot(root, 'mostSolvedPuzzle', mostSolvedLevelId(progress) || mock.mostSolvedPuzzle);
  setProfileSlot(root, 'latestDiscovery', recent || mock.latestDiscovery);
  setProfileSlot(root, 'totalPlayTime', mock.totalPlayTime);
}
