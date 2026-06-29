/** Populate logged-in passport stat slots (profile page + in-game overlay). */

import {
  adventureLevelContext,
  getRankPanelState,
  loadAdventurePath,
} from './adventure-path.js';
import {
  loadAuthScreenLayout,
  PROFILE_LAYOUT_MOCK,
  applyProfileOverlayLayout,
  syncAuthScreenItemVisibility,
} from './auth-screen-layout.js';
import { formatCatalogStatNumber, loadAdventureCatalogStats } from './passport-catalog-stats.js';
import {
  applyCommunityDiscoveryStats,
  applyExpeditionReportStats,
  fetchTodaysChallengeLevelId,
} from './passport-journal-stats.js';
import { fetchSystemStats, formatStatNumber } from './system-info.js';
import { ACTIVE_USER_KEY, getConvertedGuestCode, REGISTERED_USER_ID_KEY } from './tilezilla-guest.js';

function progressUserKey() {
  return window.__app?.state?.userId
    || localStorage.getItem(REGISTERED_USER_ID_KEY)
    || localStorage.getItem(ACTIVE_USER_KEY)
    || 'gar';
}

function hintTokenCount() {
  try {
    const userId = progressUserKey();
    const raw = localStorage.getItem(`snake_hint_tokens_v1_${userId}`)
      ?? localStorage.getItem(`tilezilla_hint_tokens:${userId}`)
      ?? localStorage.getItem(`hint_tokens_${userId}`);
    if (raw != null) return Math.max(0, Number(raw) || 0);
  } catch {
    /* ignore */
  }
  return null;
}

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

function syncGuestNoteSlot(root) {
  const converted = getConvertedGuestCode();
  root.querySelectorAll('[data-profile-slot="guestNote"]').forEach((el) => {
    if (converted) {
      el.hidden = false;
      el.textContent = `Former guest: ${converted}`;
    } else {
      el.hidden = true;
    }
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

function registeredUserId() {
  const fromStorage = localStorage.getItem(REGISTERED_USER_ID_KEY);
  if (fromStorage && /^\d+$/.test(fromStorage)) return fromStorage;
  const fromApp = window.__app?.state?.userId;
  if (fromApp != null && /^\d+$/.test(String(fromApp))) return String(fromApp);
  return '';
}

function passportIdForUser(userId) {
  if (!userId) return PROFILE_LAYOUT_MOCK.passportId;
  const id = String(userId).trim();
  if (/^\d+$/.test(id)) {
    return `TZ-${id.padStart(6, '0')}`;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
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
  const systemStats = await fetchSystemStats();

  setProfileSlot(root, 'adventureProgress', adventureProgress);
  setProfileSlot(root, 'profileName', localStorage.getItem(ACTIVE_USER_KEY) || 'Explorer');
  setProfileSlot(root, 'routesDiscovered', routes != null ? String(routes) : mock.routesDiscovered);
  setProfileSlot(root, 'hintTokens', hints != null ? String(hints) : mock.hintTokens);
  setProfileSlot(root, 'memberSince', formatMemberSince());
  setProfileSlot(root, 'passportId', passportIdForUser(registeredUserId() || progressUserKey()));
  setProfileSlot(
    root,
    'explorersRegistered',
    systemStats ? formatStatNumber(systemStats.registeredUsers) : mock.explorersRegistered,
  );

  if (systemStats) {
    applyExpeditionReportStats(root, systemStats, { largestTwoLine: true });
  } else {
    const catalog = await loadAdventureCatalogStats(window.__app);
    setProfileSlot(
      root,
      'totalAdventurePuzzles',
      catalog ? formatCatalogStatNumber(catalog.totalAdventurePuzzles) : mock.totalAdventurePuzzles,
    );
    setProfileSlot(
      root,
      'totalKnownRoutes',
      catalog ? formatCatalogStatNumber(catalog.totalKnownRoutes) : mock.totalKnownRoutes,
    );
    const largest = catalog?.largestSolution;
    setProfileSlot(
      root,
      'largestSolution',
      largest ? `${formatCatalogStatNumber(largest)}\nROUTES` : mock.largestSolution,
    );
  }

  try {
    const docRoot = root.ownerDocument || document;
    const layout = await loadAuthScreenLayout({ force: true, preferFile: true, screenKey: 'profile' });
    if (docRoot.querySelector('#profileOverlayRoot')) {
      applyProfileOverlayLayout(layout, docRoot);
    } else {
      syncAuthScreenItemVisibility(layout, 'profile', root);
    }
  } catch {
    /* optional */
  }

  setProfileSlot(
    root,
    'todaysChallenge',
    dailyMeta?.levelId || (await fetchTodaysChallengeLevelId()) || mock.todaysChallenge,
  );
  setProfileSlot(root, 'recentPuzzleSolved', recent || mock.recentPuzzleSolved);
  setProfileSlot(root, 'recentDailyCompleted', recent || mock.recentDailyCompleted);
  setProfileSlot(root, 'mostSolvedPuzzle', mostSolvedLevelId(progress) || mock.mostSolvedPuzzle);
  setProfileSlot(root, 'latestDiscovery', recent || mock.latestDiscovery);
  applyCommunityDiscoveryStats(root, {
    recentPuzzleSolved: recent || mock.recentPuzzleSolved,
    recentDailyCompleted: recent || mock.recentDailyCompleted,
    mostSolvedPuzzle: mostSolvedLevelId(progress) || mock.mostSolvedPuzzle,
    latestDiscovery: recent || mock.latestDiscovery,
    totalPlaySeconds: systemStats?.totalPlaySeconds,
  });
  syncGuestNoteSlot(root);
}
