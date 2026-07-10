/** Daily leaderboard rows for the Records screen. */

import { fetchChallengeLevelIdForDate, fetchTodaysChallengeLevelId } from './passport-journal-stats.js';
import { getActiveUsername } from './tilezilla-guest.js';

function normalizeLevelId(id) {
  return String(id || '').replace(/\.json$/i, '');
}

export function formatLeaderboardTime(totalSeconds) {
  const total = Math.max(0, Number(totalSeconds) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function hintBucket(row) {
  const raw = row?.hintsUsedCount ?? row?.hintsUsed;
  const n = typeof raw === 'boolean' ? (raw ? 1 : 0) : Math.max(0, Number(raw) || 0);
  if (n >= 2) return 2;
  if (n === 1) return 1;
  return 0;
}

export function formatDailyChallengeDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim());
  if (!m) return String(iso).trim() || '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return String(iso).trim();
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * All-time best daily solve across all users.
 * Prefers the server endpoint; falls back to the local fastest daily result.
 */
export async function resolveAllTimeBestDaily(app = null) {
  try {
    const res = await fetch('/api/daily-leaderboard/best', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.ok && json.best) {
        return {
          date: formatDailyChallengeDate(json.best.date),
          puzzleId: String(json.best.puzzleId || '').replace(/\.json$/i, '') || '—',
          time: formatLeaderboardTime(json.best.timeSeconds),
          user: json.best.user || '',
          source: 'server',
        };
      }
      if (json?.ok && json.best === null) {
        return localBestDaily(app);
      }
    }
  } catch {
    /* fall through to local */
  }
  return localBestDaily(app);
}

function localBestDaily(app) {
  const progress = app?.progress;
  const userId = app?.state?.userId || 'gar';
  const store = progress?.loadDailyResults?.() || {};
  let best = null;
  for (const row of Object.values(store)) {
    if (row?.userId && row.userId !== userId) continue;
    const sec = Math.max(0, Number(row?.completionTimeSeconds) || 0);
    if (sec <= 0 || !row?.levelId) continue;
    if (!best || sec < best.completionTimeSeconds) {
      best = { ...row, completionTimeSeconds: sec };
    }
  }
  if (!best) return null;
  return {
    date: formatDailyChallengeDate(best.challengeDate),
    puzzleId: String(best.levelId || '').replace(/\.json$/i, '') || '—',
    time: formatLeaderboardTime(best.completionTimeSeconds),
    user: best.userId || '',
    source: 'local',
  };
}

/** Current user's most recent daily-challenge completion (local). */
export function resolveLastDailyCompletion(app = null) {
  const progress = app?.progress;
  const userId = app?.state?.userId || 'gar';
  const store = progress?.loadDailyResults?.() || {};
  let last = null;

  for (const row of Object.values(store)) {
    if (row?.userId !== userId) continue;
    const sec = Math.max(0, Number(row?.completionTimeSeconds) || 0);
    if (sec <= 0 || !row?.levelId || !row?.challengeDate) continue;

    const dateKey = String(row.challengeDate).trim();
    const completedMs = row.completedAt ? Date.parse(row.completedAt) : 0;

    if (!last) {
      last = { ...row, completionTimeSeconds: sec };
      continue;
    }

    const lastDateKey = String(last.challengeDate).trim();
    const lastCompletedMs = last.completedAt ? Date.parse(last.completedAt) : 0;
    if (dateKey > lastDateKey || (dateKey === lastDateKey && completedMs > lastCompletedMs)) {
      last = { ...row, completionTimeSeconds: sec };
    }
  }

  if (!last) return null;
  return {
    date: formatDailyChallengeDate(last.challengeDate),
    puzzleId: String(last.levelId || '').replace(/\.json$/i, '') || '—',
    time: formatLeaderboardTime(last.completionTimeSeconds),
  };
}

/** Today's daily challenge identity for the leaderboard header (puzzle ID + date). */
export async function resolveDailyChallengeHeader({ challengeDate } = {}) {
  const dateIso = String(challengeDate || todayChallengeDateIso()).trim();
  const meta = window.__dailyChallengeMeta;
  if (meta?.levelId && (!challengeDate || String(meta.date || '').slice(0, 10) === dateIso)) {
    return {
      date: formatDailyChallengeDate(meta.date || dateIso),
      puzzleId: String(meta.levelId).replace(/\.json$/i, '') || '—',
    };
  }

  try {
    const res = await fetch(`/api/daily-leaderboard?date=${encodeURIComponent(dateIso)}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.ok) {
        const levelId = String(json.levelId || '').replace(/\.json$/i, '');
        if (levelId) {
          return {
            date: formatDailyChallengeDate(json.date || dateIso),
            puzzleId: levelId,
          };
        }
      }
    }
  } catch {
    /* offline — fall through to CSV */
  }

  const puzzleId = await fetchChallengeLevelIdForDate(dateIso)
    || (dateIso === todayChallengeDateIso() ? await fetchTodaysChallengeLevelId() : null);
  return {
    date: formatDailyChallengeDate(dateIso),
    puzzleId: puzzleId || '—',
  };
}

export function syncRecordsHeaderVisibility(root = document, { showTime = false } = {}) {
  const panel = root.getElementById?.('journalRecordsPanel') || root.querySelector?.('#journalRecordsPanel');
  if (!panel) return;
  panel.querySelectorAll('[data-records-item="fieldDailyTime"], .tz-records-field--daily-time').forEach((el) => {
    el.toggleAttribute('hidden', !showTime);
  });
}

export function setRecordsHeaderFields(root = document, { date, puzzleId, time, showTime = true } = {}) {
  const panel = root.getElementById?.('journalRecordsPanel') || root.querySelector?.('#journalRecordsPanel');
  if (!panel) return;
  panel.querySelectorAll('[data-records-slot="dailyPuzzleId"]').forEach((el) => {
    el.textContent = puzzleId ?? '—';
  });
  panel.querySelectorAll('[data-records-slot="dailyDate"]').forEach((el) => {
    el.textContent = date ?? '—';
  });
  syncRecordsHeaderVisibility(root, { showTime });
  if (showTime) {
    panel.querySelectorAll('[data-records-slot="dailyTime"]').forEach((el) => {
      el.textContent = time ?? '—';
    });
  }
}

export const MOCK_RECORDS_HEADER = {
  date: 'Jul 7, 2026',
  puzzleId: '5x6-0A-ALC',
};

export const MOCK_PERSONAL_HEADER = {
  date: 'Jul 3, 2026',
  puzzleId: '5x6-0C-AAK',
  time: '4:12',
};

export function todayChallengeDateIso() {
  if (window.__dailyChallengeMeta?.date) {
    return String(window.__dailyChallengeMeta.date).slice(0, 10);
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Best challenge date to use when looking up a daily completion for this level. */
export function challengeDateForLevel(progress, levelId) {
  const meta = progress?.getLevelMeta?.(levelId);
  if (meta?.challengeDate) return String(meta.challengeDate).slice(0, 10);
  const dailyMeta = window.__dailyChallengeMeta;
  if (
    dailyMeta?.date
    && dailyMeta?.levelId
    && normalizeLevelId(dailyMeta.levelId) === normalizeLevelId(levelId)
  ) {
    return String(dailyMeta.date).slice(0, 10);
  }
  return todayChallengeDateIso();
}

export function isLeaderboardRowForCurrentUser(row, userId, username) {
  const rowUserId = String(row?.userId ?? '').trim();
  const currentUserId = String(userId ?? '').trim();
  if (rowUserId && currentUserId && rowUserId === currentUserId) return true;
  const rowName = String(row?.username ?? '').trim().toLowerCase();
  const currentName = String(username ?? '').trim().toLowerCase();
  return !!rowName && !!currentName && rowName === currentName;
}

const leaderboardRowsCache = new Map();

function datesToTryForDailyFallback(progress, levelId, challengeDate) {
  const dates = [];
  const add = (raw) => {
    const key = String(raw || '').slice(0, 10);
    if (key && !dates.includes(key)) dates.push(key);
  };
  add(challengeDate);
  add(challengeDateForLevel(progress, levelId));
  add(todayChallengeDateIso());
  return dates;
}

function rowToDailyFallback(row) {
  if (!row) return null;
  const idx = Number(row.solutionIndex);
  const index = Number.isFinite(idx) ? idx : null;
  return {
    foundCount: 1,
    index: index != null && index >= 0 ? index : null,
    completedAt: row.completedAt || null,
    completionTimeSeconds: Math.max(0, Number(row.completionTimeSeconds) || 0),
  };
}

function resolveDailyCompletionFromLocal(progress, levelId, dateKey, userId, username) {
  const levelKey = normalizeLevelId(levelId);
  const store = progress.loadDailyResults?.() || {};
  let best = null;
  for (const row of Object.values(store)) {
    if (!isLeaderboardRowForCurrentUser(row, userId, username)) continue;
    if (normalizeLevelId(row.levelId) !== levelKey) continue;
    if (String(row.challengeDate || '').slice(0, 10) !== dateKey) continue;
    const sec = Math.max(0, Number(row.completionTimeSeconds) || 0);
    if (!best || sec < best.completionTimeSeconds) {
      const idx = Number(row.solutionIndex ?? row.solutionId);
      best = {
        userId: row.userId,
        username: row.username,
        levelId: row.levelId,
        challengeDate: dateKey,
        completionTimeSeconds: sec,
        solutionIndex: Number.isFinite(idx) ? idx : null,
        completedAt: row.completedAt || null,
      };
    }
  }
  return rowToDailyFallback(best);
}

async function fetchLeaderboardRowsCached(progress, dateKey) {
  if (!leaderboardRowsCache.has(dateKey)) {
    leaderboardRowsCache.set(
      dateKey,
      fetchLeaderboardRows(progress, dateKey).catch(() => []),
    );
  }
  return leaderboardRowsCache.get(dateKey);
}

async function resolveDailyCompletionFromApi(progress, levelId, dateKey, userId, username) {
  const levelKey = normalizeLevelId(levelId);
  let rows = [];
  try {
    rows = await fetchLeaderboardRowsCached(progress, dateKey);
  } catch {
    rows = progress.getLeaderboardResultsForDate?.(dateKey) || [];
  }
  const row = (rows || [])
    .filter((r) => normalizeLevelId(r.levelId) === levelKey)
    .filter((r) => isLeaderboardRowForCurrentUser(r, userId, username))
    .sort((a, b) => (Number(a?.completionTimeSeconds) || 0) - (Number(b?.completionTimeSeconds) || 0))[0];
  return rowToDailyFallback(row);
}

/**
 * When progress.found[] is empty but the player has a timed daily result,
 * recover count / index / completion time for Puzzle Info and Journal.
 */
export async function resolveDailyCompletionFallback(app, levelId, challengeDate = null) {
  const progress = app?.progress;
  if (!levelId || !progress) return null;

  const userId = app?.state?.userId;
  const username = getActiveUsername();
  const dates = datesToTryForDailyFallback(progress, levelId, challengeDate);

  for (const dateKey of dates) {
    const local = resolveDailyCompletionFromLocal(progress, levelId, dateKey, userId, username);
    if (local) return local;
  }

  for (const dateKey of dates) {
    const remote = await resolveDailyCompletionFromApi(progress, levelId, dateKey, userId, username);
    if (remote) return remote;
  }

  return null;
}

/** Guest daily solve — session-only preview (not saved to MySQL). */
export function getGuestLeaderboardPreview() {
  if (!window.__tilezillaGuest?.isGuestUser?.()) return null;
  const preview = window.__guestDailyLeaderboardPreview;
  if (!preview?.completionTimeSeconds) return null;
  return preview;
}

export function clearGuestLeaderboardPreview() {
  delete window.__guestDailyLeaderboardPreview;
}

export function mergeGuestPreviewIntoRows(rows, preview, challengeDate = todayChallengeDateIso()) {
  const dateKey = String(challengeDate || todayChallengeDateIso()).trim();
  if (!preview?.completionTimeSeconds) return rows;
  if (String(preview.challengeDate || dateKey).slice(0, 10) !== dateKey) return rows;
  if (rows.some((r) => r.isGuestPreview)) return rows;

  const guestRow = {
    userId: 'You',
    username: 'You',
    completionTimeSeconds: Math.max(0, Number(preview.completionTimeSeconds) || 0),
    hintsUsedCount: Math.max(0, Number(preview.hintsUsedCount) || 0),
    levelId: preview.levelId || '',
    challengeDate: dateKey,
    isGuestPreview: true,
  };
  return [...rows, guestRow].sort(
    (a, b) => (a.completionTimeSeconds || 0) - (b.completionTimeSeconds || 0),
  );
}

export function resolveGuestPlacementSummary(partitions, preview) {
  if (!preview?.completionTimeSeconds) return null;
  const bucket = hintBucket(preview);
  const list = bucket >= 2 ? partitions.two : bucket === 1 ? partitions.one : partitions.zero;
  const idx = list.findIndex((r) => r.isGuestPreview);
  if (idx < 0) return null;
  return {
    rank: idx + 1,
    time: formatLeaderboardTime(list[idx].completionTimeSeconds),
    hintBucket: bucket,
  };
}

export function setGuestPlacementBanner(root = document, summary = null) {
  const el = root.getElementById?.('recordsGuestPlacement') || root.querySelector?.('#recordsGuestPlacement');
  if (!el) return;
  if (!summary?.rank) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const text = `You would have placed #${summary.rank} at ${summary.time} (not saved — sign up to compete)`;
  const slot = el.querySelector('[data-records-slot="guestPlacement"]');
  if (slot) slot.textContent = text;
  else el.textContent = text;
}

/**
 * Local-only rows (browser storage) — fallback when MySQL is unavailable.
 * @param {object} progress
 * @param {string} [challengeDate]
 */
export function fetchLocalLeaderboardRows(progress, challengeDate = todayChallengeDateIso()) {
  if (!progress?.getLeaderboardResultsForDate) return [];
  return (progress.getLeaderboardResultsForDate(challengeDate) || []).map((row) => {
    const solutionIndex = Number(row.solutionIndex ?? row.solutionId);
    return {
      ...row,
      solutionIndex: Number.isFinite(solutionIndex) ? solutionIndex : null,
      username: row.username || '',
    };
  });
}

function mergeLeaderboardRowSets(serverRows, localRows) {
  const byUser = new Map();
  const remember = (row) => {
    const userKey = String(row?.userId ?? row?.username ?? '').trim();
    if (!userKey) return;
    const prev = byUser.get(userKey);
    const sec = Math.max(0, Number(row?.completionTimeSeconds) || 0);
    const prevSec = Math.max(0, Number(prev?.completionTimeSeconds) || 0);
    if (!prev || (sec > 0 && (prevSec <= 0 || sec < prevSec))) {
      byUser.set(userKey, {
        ...prev,
        ...row,
        userId: row.userId ?? prev?.userId ?? userKey,
        username: String(row.username || prev?.username || userKey).trim(),
        completionTimeSeconds: sec > 0 ? sec : prevSec,
        solutionIndex: Number.isFinite(Number(row?.solutionIndex))
          ? Number(row.solutionIndex)
          : (prev?.solutionIndex ?? null),
        solutionId: row?.solutionId ?? prev?.solutionId ?? null,
        hintsUsedCount: Math.max(
          0,
          Number(row?.hintsUsedCount ?? prev?.hintsUsedCount) || 0,
        ),
      });
    }
  };
  for (const row of serverRows || []) remember(row);
  for (const row of localRows || []) remember(row);
  return [...byUser.values()].sort(
    (a, b) => (a.completionTimeSeconds || 0) - (b.completionTimeSeconds || 0),
  );
}

/**
 * Today's cross-user leaderboard — prefers MySQL via /api/daily-leaderboard.
 * Falls back to localStorage for offline / guest dev.
 */
export async function fetchLeaderboardRows(progress, challengeDate = todayChallengeDateIso()) {
  const dateKey = String(challengeDate || todayChallengeDateIso()).trim();
  let rows = [];
  try {
    const res = await fetch(`/api/daily-leaderboard?date=${encodeURIComponent(dateKey)}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.ok && Array.isArray(json.rows)) {
        rows = json.rows.map((row) => ({
          userId: row.userId ?? row.user_id ?? '',
          username: String(row.username || '').trim(),
          completionTimeSeconds: Math.max(0, Number(row.completionTimeSeconds) || 0),
          solutionId: Number(row.solutionId) || null,
          solutionIndex: Number(row.solutionId) > 0 ? Number(row.solutionId) - 1 : null,
          hintsUsedCount: Math.max(0, Number(row.hintsUsedCount) || 0),
          levelId: row.levelId || json.levelId || '',
          challengeDate: row.challengeDate || json.date || dateKey,
          completedAt: row.completedAt || null,
        }));
      }
    }
  } catch {
    /* offline — use local rows */
  }
  const localRows = fetchLocalLeaderboardRows(progress, dateKey);
  rows = mergeLeaderboardRowSets(rows, localRows);
  const preview = getGuestLeaderboardPreview();
  if (preview) {
    rows = mergeGuestPreviewIntoRows(rows, preview, dateKey);
  }
  return rows;
}

export function partitionLeaderboardByHints(rows) {
  const zero = [];
  const one = [];
  const two = [];
  for (const row of rows) {
    const bucket = hintBucket(row);
    if (bucket >= 2) two.push(row);
    else if (bucket === 1) one.push(row);
    else zero.push(row);
  }
  const byTime = (a, b) => (a.completionTimeSeconds || 0) - (b.completionTimeSeconds || 0);
  zero.sort(byTime);
  one.sort(byTime);
  two.sort(byTime);
  return { zero, one, two };
}

/** Prefer display name over numeric user id for leaderboard rows. */
export function leaderboardDisplayName(row, { currentUserId, currentUsername } = {}) {
  if (row?.isGuestPreview) return 'You';

  const username = String(row?.username || '').trim();
  const userId = String(row?.userId ?? '').trim();
  const selfId = String(currentUserId ?? '').trim();
  const selfName = String(currentUsername ?? '').trim();

  if (username && !/^\d+$/.test(username)) return username;
  if (selfName && selfId && userId === selfId) return selfName;
  if (userId && !/^\d+$/.test(userId)) return userId;
  if (username) return username;
  return '—';
}

export function buildRankedEntries(rows, { currentUserId, currentUsername } = {}) {
  return rows.map((row, idx) => ({
    rank: idx + 1,
    user: leaderboardDisplayName(row, { currentUserId, currentUsername }),
    time: formatLeaderboardTime(row.completionTimeSeconds),
    levelId: row.levelId || '',
    hintsUsedCount: hintBucket(row),
    isGuestPreview: !!row.isGuestPreview,
  }));
}

export function boardSizeFromLevelId(levelId, levelLookup = null) {
  const key = String(levelId || '').trim().replace(/\.json$/i, '');
  if (!key) return null;

  const level = levelLookup instanceof Map
    ? levelLookup.get(key)
    : levelLookup?.[key];
  const rows = Number(level?.board?.rows);
  const cols = Number(level?.board?.cols);
  if (Number.isFinite(rows) && Number.isFinite(cols) && rows > 0 && cols > 0) {
    const a = Math.min(rows, cols);
    const b = Math.max(rows, cols);
    return `${a}x${b}`;
  }

  const m = /^(\d+)[x×](\d+)/i.exec(key);
  if (!m) return null;
  const a = Math.min(Number(m[1]), Number(m[2]));
  const b = Math.max(Number(m[1]), Number(m[2]));
  return `${a}x${b}`;
}

function boardSizeSortKey(size) {
  const m = /^(\d+)x(\d+)$/.exec(String(size || ''));
  if (!m) return [999, 999];
  return [Number(m[1]), Number(m[2])];
}

function buildLevelLookup(app) {
  const map = new Map();
  for (const level of app?.state?.allLevels || []) {
    if (level?.id) map.set(String(level.id).replace(/\.json$/i, ''), level);
  }
  const stats = app?.state?.levelStatsById;
  if (stats) {
    for (const [id, raw] of Object.entries(stats)) {
      if (map.has(id)) continue;
      map.set(id, {
        id,
        board: { rows: Number(raw.r) || 0, cols: Number(raw.c) || 0 },
      });
    }
  }
  return map;
}

/** All timed completions from progress + daily results (local). */
export function collectPersonalCompletionRows(app) {
  const progress = app?.progress;
  const userId = app?.state?.userId || 'gar';
  const rows = [];

  if (progress?.data && typeof progress.data === 'object') {
    for (const [levelId, record] of Object.entries(progress.data)) {
      if (!levelId || levelId.startsWith('_')) continue;
      for (const found of record?.found || []) {
        const sec = Math.max(0, Number(found?.completionTimeSeconds) || 0);
        if (sec <= 0) continue;
        rows.push({
          levelId,
          completionTimeSeconds: sec,
          hintsUsedCount: hintBucket(found),
        });
      }
    }
  }

  const daily = progress?.loadDailyResults?.() || {};
  for (const row of Object.values(daily)) {
    if (!row || row.userId !== userId) continue;
    const sec = Math.max(0, Number(row.completionTimeSeconds) || 0);
    if (sec <= 0 || !row.levelId) continue;
    rows.push({
      levelId: row.levelId,
      completionTimeSeconds: sec,
      hintsUsedCount: hintBucket(row),
    });
  }

  return rows;
}

/** Fastest solve per board size within a hint bucket. */
export function bestByBoardSize(rows, levelLookup) {
  const bySize = new Map();
  for (const row of rows) {
    const boardSize = boardSizeFromLevelId(row.levelId, levelLookup);
    if (!boardSize) continue;
    const prev = bySize.get(boardSize);
    if (!prev || row.completionTimeSeconds < prev.completionTimeSeconds) {
      bySize.set(boardSize, { ...row, boardSize });
    }
  }
  return Array.from(bySize.values()).sort((a, b) => {
    const ka = boardSizeSortKey(a.boardSize);
    const kb = boardSizeSortKey(b.boardSize);
    return ka[0] - kb[0] || ka[1] - kb[1] || a.completionTimeSeconds - b.completionTimeSeconds;
  });
}

export function buildPersonalBestEntries(rows) {
  return rows.map((row) => ({
    boardSize: row.boardSize || boardSizeFromLevelId(row.levelId) || '—',
    puzzleId: String(row.levelId || '').replace(/\.json$/i, '') || '—',
    time: formatLeaderboardTime(row.completionTimeSeconds),
    completionTimeSeconds: row.completionTimeSeconds,
  }));
}

/**
 * Personal bests: one row per board size (2x4, 3x3, …) in each hint panel.
 * @param {object} app
 */
export function fetchPersonalBestPartitions(app) {
  const levelLookup = buildLevelLookup(app);
  const rows = collectPersonalCompletionRows(app);
  const { zero, one, two } = partitionLeaderboardByHints(rows);
  return {
    zero: buildPersonalBestEntries(bestByBoardSize(zero, levelLookup)),
    one: buildPersonalBestEntries(bestByBoardSize(one, levelLookup)),
    two: buildPersonalBestEntries(bestByBoardSize(two, levelLookup)),
  };
}

export function renderRecordsList(container, entries, {
  mode = 'leaderboard',
  emptyText = 'No times yet.',
} = {}) {
  if (!container) return;
  container.replaceChildren();
  if (!entries?.length) {
    const empty = document.createElement('p');
    empty.className = 'tz-records-list__empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'tz-records-list__row';
    if (entry.isGuestPreview) {
      row.classList.add('tz-records-list__row--guest-you');
      row.dataset.guestYou = 'true';
    }
    if (mode === 'personal') {
      row.innerHTML = `
        <span class="tz-records-list__cell tz-records-list__cell--size">${escapeHtml(entry.boardSize)}</span>
        <span class="tz-records-list__cell tz-records-list__cell--puzzle">${escapeHtml(entry.puzzleId)}</span>
        <span class="tz-records-list__cell tz-records-list__cell--time">${entry.time}</span>
      `;
    } else {
      row.innerHTML = `
        <span class="tz-records-list__cell tz-records-list__cell--rank">${entry.rank}</span>
        <span class="tz-records-list__cell tz-records-list__cell--user">${escapeHtml(entry.user)}</span>
        <span class="tz-records-list__cell tz-records-list__cell--time">${entry.time}</span>
      `;
    }
    container.appendChild(row);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Mock rows for layout tuner preview. */
export const MOCK_LEADERBOARD_ROWS = {
  zero: [
    { rank: 1, user: 'TrailBlazer', time: '2:14' },
    { rank: 2, user: 'MapMaker', time: '2:47' },
    { rank: 3, user: 'RouteFinder', time: '3:05' },
    { rank: 4, user: 'PathWalker', time: '3:22' },
    { rank: 5, user: 'CompassKid', time: '3:58' },
    { rank: 6, user: 'TileScout', time: '4:11' },
  ],
  one: [
    { rank: 1, user: 'HintHelper', time: '3:01' },
    { rank: 2, user: 'NudgeNav', time: '3:44' },
  ],
  two: [
    { rank: 1, user: 'DoubleHint', time: '4:20' },
  ],
};

export const MOCK_PERSONAL_BEST_ROWS = {
  zero: [
    { boardSize: '2x4', puzzleId: '2x4-0A-ABC', time: '1:05' },
    { boardSize: '3x3', puzzleId: '3x3-0B-DEF', time: '1:22' },
    { boardSize: '4x5', puzzleId: '4x5-0C-GHI', time: '2:48' },
    { boardSize: '5x6', puzzleId: '5x6-0B-BYY', time: '3:14' },
  ],
  one: [
    { boardSize: '4x5', puzzleId: '4x5-1A-JKL', time: '3:01' },
    { boardSize: '5x6', puzzleId: '5x6-0C-AAK', time: '4:12' },
  ],
  two: [
    { boardSize: '5x6', puzzleId: '5x6-0D-MNO', time: '5:20' },
  ],
};

export function renderMockLeaderboardLists(root = document) {
  renderRecordsList(root.getElementById?.('recordsListTop') || root.querySelector?.('#recordsListTop'), MOCK_LEADERBOARD_ROWS.zero);
  renderRecordsList(root.getElementById?.('recordsListBl') || root.querySelector?.('#recordsListBl'), MOCK_LEADERBOARD_ROWS.one);
  renderRecordsList(root.getElementById?.('recordsListBr') || root.querySelector?.('#recordsListBr'), MOCK_LEADERBOARD_ROWS.two);
}

export function renderMockPersonalBestLists(root = document) {
  renderRecordsList(
    root.getElementById?.('recordsListTop') || root.querySelector?.('#recordsListTop'),
    MOCK_PERSONAL_BEST_ROWS.zero,
    { mode: 'personal', emptyText: 'No 0-hint bests yet.' },
  );
  renderRecordsList(
    root.getElementById?.('recordsListBl') || root.querySelector?.('#recordsListBl'),
    MOCK_PERSONAL_BEST_ROWS.one,
    { mode: 'personal', emptyText: 'No 1-hint bests yet.' },
  );
  renderRecordsList(
    root.getElementById?.('recordsListBr') || root.querySelector?.('#recordsListBr'),
    MOCK_PERSONAL_BEST_ROWS.two,
    { mode: 'personal', emptyText: 'No 2-hint bests yet.' },
  );
}
