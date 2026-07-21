/**
 * Puzzle Journal data — aggregates progress + level catalog for record/library views.
 */

import { loadAdventurePath, normalizeCatalogLevelId } from './adventure-path.js';
import { countCatalogSolutionsFound } from './progress.js';
import { resolveDailyCompletionFallback } from './records-data.js';

const CHALLENGE_LABELS = {
  'daily-challenge': 'Daily Challenge',
  adventure: 'Adventure',
  random: 'Random',
};

function boardSizeLabel(level) {
  const rows = Number(level?.board?.rows);
  const cols = Number(level?.board?.cols);
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return '—';
  const a = Math.min(rows, cols);
  const b = Math.max(rows, cols);
  return `${a}x${b}`;
}

function boardSizeKey(level) {
  const rows = Number(level?.board?.rows);
  const cols = Number(level?.board?.cols);
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return boardSizeKeyFromLevelId(level?.id);
  const a = Math.min(rows, cols);
  const b = Math.max(rows, cols);
  return `${a}x${b}`;
}

function boardSizeKeyFromLevelId(levelId) {
  const m = /^(\d+)[x×](\d+)/i.exec(String(levelId || '').trim());
  if (!m) return null;
  const a = Math.min(Number(m[1]), Number(m[2]));
  const b = Math.max(Number(m[1]), Number(m[2]));
  return `${a}x${b}`;
}

function totalKnownForJournalLevel(app, level, levelId, dailyCsvRows) {
  if (level && app?.totalKnownForLevel) {
    const fromLevel = app.totalKnownForLevel(level);
    if (fromLevel > 0) return fromLevel;
  }
  const key = normalizeCatalogLevelId(levelId);
  let best = 0;
  for (const row of dailyCsvRows || []) {
    if (normalizeCatalogLevelId(row.levelId) !== key) continue;
    best = Math.max(best, Number(row.totalSolutions) || 0);
  }
  return best;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const raw = String(iso).trim();
    const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T12:00:00`)
      : new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

function parseDailyCsvDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function formatChallengeDate(raw) {
  if (!raw) return null;
  const iso = parseDailyCsvDate(raw) || raw;
  const formatted = formatDate(iso);
  return formatted === '—' ? null : formatted;
}

let dailyReleaseByLevelId = null;
let dailyDatesByLevelId = null;
let dailyCsvRowsCache = null;
let adventurePathCache = null;
let advIdByLevelIdCache = null;

function parseDailyCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const byLevel = new Map();
  const datesByLevel = new Map();
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [challenge_date, level_id, total_solutions] = line.split(',');
    const levelId = normalizeCatalogLevelId(level_id);
    const date = challenge_date?.trim();
    if (!levelId || !date) continue;
    const iso = parseDailyCsvDate(date) || date;
    if (!byLevel.has(levelId)) byLevel.set(levelId, date);
    if (!datesByLevel.has(levelId)) datesByLevel.set(levelId, []);
    datesByLevel.get(levelId).push(iso);
    rows.push({
      date,
      dateIso: iso,
      levelId,
      totalSolutions: Number(total_solutions) || 0,
    });
  }
  return { byLevel, datesByLevel, rows };
}

function buildAdvIdByLevelId(path) {
  const map = new Map();
  const add = (puzzle) => {
    if (!puzzle?.levelId || puzzle.advId == null) return;
    const key = normalizeCatalogLevelId(puzzle.levelId);
    if (key) map.set(key, puzzle.advId);
  };
  for (const puzzle of path?.flat || []) add(puzzle);
  for (const puzzle of path?.postgame || []) add(puzzle);
  return map;
}

async function loadLibraryLookups() {
  if (!dailyReleaseByLevelId) {
    dailyReleaseByLevelId = new Map();
    dailyDatesByLevelId = new Map();
    dailyCsvRowsCache = [];
    try {
      const csv = await fetch('/data/daily_challenges_import.csv').then((r) => r.text());
      const parsed = parseDailyCsv(csv);
      dailyReleaseByLevelId = parsed.byLevel;
      dailyDatesByLevelId = parsed.datesByLevel;
      dailyCsvRowsCache = parsed.rows;
    } catch {
      dailyReleaseByLevelId = new Map();
      dailyDatesByLevelId = new Map();
      dailyCsvRowsCache = [];
    }
  }
  if (!adventurePathCache) {
    adventurePathCache = await loadAdventurePath();
    advIdByLevelIdCache = buildAdvIdByLevelId(adventurePathCache);
  }
  return {
    dailyReleaseByLevelId,
    dailyDatesByLevelId,
    dailyCsvRows: dailyCsvRowsCache || [],
    adventurePath: adventurePathCache,
    advIdByLevelId: advIdByLevelIdCache || new Map(),
  };
}

/** Adventure + random puzzles share the same path — show Adv_ID unless explicitly daily-challenge. */
function puzzleListDetailLabel(levelId, progress, advIdByLevelId, dailyByLevelId, dailyDatesByLevel) {
  const meta = progress?.getLevelMeta?.(levelId);
  const src = meta?.journalSource || null;
  const key = normalizeCatalogLevelId(levelId);
  const advId = advIdByLevelId.get(key) ?? null;

  if (src === 'daily-challenge') {
    const dateRaw = bestDailyChallengeDate(levelId, progress, dailyByLevelId, dailyDatesByLevel)
      || meta?.challengeDate
      || dailyByLevelId?.get(key);
    const formatted = formatChallengeDate(dateRaw);
    return formatted ? `· ${formatted}` : null;
  }

  if (dailyByLevelId?.has(key) || dailyDatesByLevel?.has(key)) {
    const dateRaw = bestDailyChallengeDate(levelId, progress, dailyByLevelId, dailyDatesByLevel)
      || meta?.challengeDate
      || dailyByLevelId.get(key);
    const formatted = formatChallengeDate(dateRaw);
    if (formatted) return `· ${formatted}`;
  }

  if (advId != null) {
    return `· Adv ${advId}`;
  }

  return null;
}

function formatTime(sec) {
  const total = Math.max(0, Number(sec) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function puzzleTypeForLevel(level, progress, screen) {
  const meta = progress?.getLevelMeta?.(level?.id);
  if (meta?.journalSource && CHALLENGE_LABELS[meta.journalSource]) {
    return CHALLENGE_LABELS[meta.journalSource];
  }
  if (screen && CHALLENGE_LABELS[screen]) return CHALLENGE_LABELS[screen];
  return 'Puzzle';
}

export function getPuzzleProgressState(foundCount, totalKnown) {
  const found = Math.max(0, Number(foundCount) || 0);
  const total = Math.max(0, Number(totalKnown) || 0);
  if (found <= 0) return 'unstarted';
  if (total > 0 && found >= total) return 'complete';
  return 'inProgress';
}

function isCatalogFoundEntry(entry) {
  if (entry?.bonus) return false;
  return Number.isFinite(Number(entry?.index));
}

/** Unique catalog solutions found — re-solves of the same index count once. */
function countUniqueFoundSolutions(found) {
  return countCatalogSolutionsFound(found);
}

/** Keep one journal row per solution index (most recent solve wins). */
function dedupeFoundByIndex(found) {
  const byIndex = new Map();
  for (const entry of found || []) {
    if (!isCatalogFoundEntry(entry)) continue;
    const index = Number(entry.index);
    const prev = byIndex.get(index);
    if (!prev || String(entry.foundAt || '') > String(prev.foundAt || '')) {
      byIndex.set(index, { ...entry, index });
    }
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

function repairMalformedFoundEntries(progress, levelId, known, board = null) {
  if (!known?.length) return false;
  const found = progress.getFoundForLevel(levelId);
  let changed = false;
  for (const entry of found) {
    if (Number.isFinite(Number(entry?.index)) && !entry?.bonus) continue;
    const placements = entry?.placements;
    if (!Array.isArray(placements) || !placements.length) continue;
    const check = progress.checkSolution(levelId, placements, known, board);
    if (!Number.isFinite(check?.index) || check?.bonus) continue;
    entry.index = check.index;
    entry.bonus = false;
    changed = true;
  }
  if (changed) progress.save();
  return changed;
}

function collectCatalogFoundEntries(progress, levelId, known, found, board = null) {
  if (progress?.rematchFoundCatalogIndices) {
    progress.rematchFoundCatalogIndices(levelId, known, board);
  }
  repairMalformedFoundEntries(progress, levelId, known, board);
  const refreshed = progress.getFoundForLevel(levelId) || [];
  const uniqueFound = dedupeFoundByIndex(refreshed);
  if (uniqueFound.length) {
    // Still append rematched-or-pending layouts that lack a catalog index.
    const indexed = new Set(uniqueFound.map((f) => Number(f.index)));
    const extras = [];
    for (const entry of refreshed) {
      if (isCatalogFoundEntry(entry)) continue;
      if (!Array.isArray(entry?.placements) || !entry.placements.length) continue;
      const check = progress.checkSolution(levelId, entry.placements, known, board);
      if (Number.isFinite(check?.index) && !check?.bonus) {
        if (indexed.has(check.index)) continue;
        indexed.add(check.index);
        extras.push({ ...entry, index: check.index, bonus: false });
        continue;
      }
      extras.push({ ...entry, index: null, bonus: false, _unindexed: true });
    }
    return [...uniqueFound, ...extras].sort((a, b) => {
      const ai = Number.isFinite(Number(a.index)) ? Number(a.index) : 1e9;
      const bi = Number.isFinite(Number(b.index)) ? Number(b.index) : 1e9;
      return ai - bi;
    });
  }

  const recovered = [];
  for (const entry of refreshed) {
    if (Number.isFinite(Number(entry?.index)) && !entry?.bonus) {
      recovered.push(entry);
      continue;
    }
    const placements = entry?.placements;
    if (!Array.isArray(placements) || !placements.length) continue;
    const check = progress.checkSolution(levelId, placements, known, board);
    if (!Number.isFinite(check?.index) || check?.bonus) {
      recovered.push({ ...entry, index: null, bonus: false, _unindexed: true });
      continue;
    }
    recovered.push({
      ...entry,
      index: check.index,
      bonus: false,
    });
  }
  return dedupeFoundByIndex(recovered).length
    ? dedupeFoundByIndex(recovered)
    : recovered;
}

function backfillDailyFoundFromLeaderboard(progress, levelId, known, dailyFallback) {
  if (!progress || !dailyFallback || !Number.isFinite(dailyFallback.index)) return false;
  const index = dailyFallback.index;
  const found = progress.getFoundForLevel(levelId) || [];
  if (countCatalogSolutionsFound(found) > 0) return false;
  if (found.some((f) => Number(f.index) === index)) return false;
  const placements = known[index]?.placements;
  if (!Array.isArray(placements) || !placements.length) return false;
  progress.recordFound(
    levelId,
    index,
    placements,
    false,
    dailyFallback.completionTimeSeconds * 1000,
    {
      completionTimeSeconds: dailyFallback.completionTimeSeconds,
      leaderboardSubmitted: true,
    },
  );
  return true;
}

function buildFallbackJournalEntry(dailyFallback, known) {
  if (!dailyFallback || !Number.isFinite(dailyFallback.index)) return null;
  const index = dailyFallback.index;
  const placements = known[index]?.placements || [];
  if (!placements.length) return null;
  return {
    index,
    label: `Solution #${index + 1}`,
    placements,
    foundAt: dailyFallback.completedAt || null,
    foundDate: formatDate(dailyFallback.completedAt),
    solveTime: dailyFallback.completionTimeSeconds > 0
      ? formatTime(dailyFallback.completionTimeSeconds)
      : '—',
  };
}

export async function getJournalRecord(app, levelId, { challengeDate = null } = {}) {
  const progress = app?.progress;
  const state = app?.state;
  if (!levelId || !progress || !state) return null;

  let level = state.currentLevel?.id === levelId ? state.currentLevel : null;
  if (!level && app.ensureLevel) {
    level = await app.ensureLevel(levelId);
  }
  if (!level) {
    level = state.allLevels?.find((l) => l.id === levelId) || null;
  }
  if (!level) return null;

  const known = await app.loadKnownSolutionsForLevel?.(level) || [];
  let uniqueFound = collectCatalogFoundEntries(
    progress,
    levelId,
    known,
    progress.getFoundForLevel(levelId),
    level.board,
  );
  const allFound = progress.getFoundForLevel(levelId) || [];
  let progressFoundCount = Math.max(
    uniqueFound.filter((f) => Number.isFinite(Number(f.index))).length
      + uniqueFound.filter((f) => f._unindexed).length,
    countCatalogSolutionsFound(allFound),
  );
  let dailyFallback = null;
  if (!progressFoundCount) {
    dailyFallback = await resolveDailyCompletionFallback(app, levelId, challengeDate);
    if (backfillDailyFoundFromLeaderboard(progress, levelId, known, dailyFallback)) {
      uniqueFound = collectCatalogFoundEntries(
        progress,
        levelId,
        known,
        progress.getFoundForLevel(levelId),
        level.board,
      );
      progressFoundCount = Math.max(
        uniqueFound.length,
        countCatalogSolutionsFound(progress.getFoundForLevel(levelId) || []),
      );
      dailyFallback = progressFoundCount ? null : dailyFallback;
    }
  }
  let foundCount = progressFoundCount || dailyFallback?.foundCount || 0;
  const total = known.length || app.totalKnownForLevel?.(level) || 0;
  const screen = document.querySelector('.tz-app')?.dataset?.screen || 'daily-challenge';

  let entries = uniqueFound
    .map((f) => {
      const placements = Array.isArray(f.placements) && f.placements.length
        ? f.placements
        : (Number.isFinite(Number(f.index)) ? (known[f.index]?.placements || []) : []);
      const indexed = Number.isFinite(Number(f.index));
      return {
        index: indexed ? f.index : null,
        label: indexed ? `Solution #${f.index + 1}` : 'Found layout',
        placements,
        foundAt: f.foundAt || null,
        foundDate: formatDate(f.foundAt),
        solveTime: f.completionTimeSeconds > 0
          ? formatTime(f.completionTimeSeconds)
          : (f.elapsedMs > 0 ? formatTime(Math.floor(f.elapsedMs / 1000)) : '—'),
      };
    })
    .sort((a, b) => {
      const ai = Number.isFinite(Number(a.index)) ? Number(a.index) : 1e9;
      const bi = Number.isFinite(Number(b.index)) ? Number(b.index) : 1e9;
      return ai - bi;
    });

  if (!entries.length && dailyFallback) {
    const fallbackEntry = buildFallbackJournalEntry(dailyFallback, known);
    if (fallbackEntry) entries = [fallbackEntry];
  }

  const firstSolvedAt = progress.getFirstSolvedAt(levelId) || dailyFallback?.completedAt || null;

  const progressState = getPuzzleProgressState(foundCount, total);
  const pct = total > 0 ? Math.round((foundCount / total) * 100) : 0;

  return {
    level,
    levelId: level.id,
    puzzleId: level.id || level.name,
    puzzleType: puzzleTypeForLevel(level, progress, screen),
    boardSize: boardSizeLabel(level),
    totalKnown: total,
    solutionsFound: foundCount,
    firstSolvedAt,
    firstSolvedDate: formatDate(firstSolvedAt),
    lastPlayedAt: progress.getLastPlayedAt(levelId),
    lastPlayedDate: formatDate(progress.getLastPlayedAt(levelId)),
    progressState,
    progressPct: pct,
    progressLabel: total > 0 ? `${foundCount} / ${total}` : String(foundCount),
    entries,
  };
}

const DAILY_CHALLENGE_LOOKBACK_DAYS = 30;

function parseChallengeDateIso(raw) {
  if (!raw) return null;
  const iso = parseDailyCsvDate(raw) || String(raw).trim();
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : iso;
}

function isWithinDailyLookback(dateRaw, days = DAILY_CHALLENGE_LOOKBACK_DAYS) {
  const iso = parseChallengeDateIso(dateRaw);
  if (!iso) return false;
  const d = new Date(`${iso}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff && d <= today;
}

function bestDailyChallengeDate(levelId, progress, dailyByLevelId, dailyDatesByLevel) {
  const key = normalizeCatalogLevelId(levelId);
  const meta = progress?.getLevelMeta?.(levelId);
  const candidates = [];
  if (meta?.challengeDate) candidates.push(meta.challengeDate);
  const csvDate = dailyByLevelId?.get(key);
  if (csvDate) candidates.push(csvDate);
  for (const iso of dailyDatesByLevel?.get(key) || []) {
    candidates.push(iso);
  }
  let best = null;
  for (const raw of candidates) {
    const iso = parseChallengeDateIso(raw);
    if (!iso || !isWithinDailyLookback(iso)) continue;
    if (!best || iso > best) best = iso;
  }
  return best;
}

function isDailyChallengePuzzle(levelId, progress, dailyByLevelId, dailyDatesByLevel) {
  const key = normalizeCatalogLevelId(levelId);
  const meta = progress?.getLevelMeta?.(levelId);
  if (meta?.journalSource === 'daily-challenge') {
    const dateRaw = meta.challengeDate || dailyByLevelId?.get(key);
    if (!dateRaw) return true;
    return isWithinDailyLookback(dateRaw);
  }
  for (const iso of dailyDatesByLevel?.get(key) || []) {
    if (isWithinDailyLookback(iso)) return true;
  }
  return false;
}

function levelMatchesFilters(levelId, progress, filters, dailyByLevelId, dailyDatesByLevel) {
  const { boardSize, puzzleType } = filters || {};
  if (!levelId || !progress?.hasJournalEntry?.(levelId)) return false;

  if (boardSize) {
    if (boardSizeKeyFromLevelId(levelId) !== boardSize) return false;
  }

  if (puzzleType) {
    const meta = progress.getLevelMeta(levelId);
    const src = meta?.journalSource;
    if (puzzleType === 'adventure' && src !== 'adventure') return false;
    if (puzzleType === 'daily-challenge') {
      if (!isDailyChallengePuzzle(levelId, progress, dailyByLevelId, dailyDatesByLevel)) return false;
    }
    if (puzzleType === 'random' && src !== 'random') return false;
  }

  return true;
}

function buildDailyChallengeLibraryEntry(app, row, progress, dailyCsvRows) {
  const levelId = normalizeCatalogLevelId(row.levelId);
  if (!levelId) return null;

  const challengeDateIso = parseChallengeDateIso(row.dateIso || row.date);
  if (!challengeDateIso) return null;

  const found = countUniqueFoundSolutions(progress?.getFoundForLevel(levelId) || []);
  const total = Number(row.totalSolutions) || totalKnownForJournalLevel(app, null, levelId, dailyCsvRows);
  const progressState = getPuzzleProgressState(found, total);
  const pct = total > 0 ? Math.round((found / total) * 100) : 0;
  const formatted = formatChallengeDate(challengeDateIso);

  return {
    levelId,
    label: levelId,
    journalSource: 'daily-challenge',
    challengeDateIso,
    detailLabel: formatted ? `· ${formatted}` : null,
    boardSize: boardSizeKeyFromLevelId(levelId) || '—',
    boardSizeKey: boardSizeKeyFromLevelId(levelId),
    found,
    total,
    progressState,
    progressPct: pct,
    progressLabel: total > 0 ? `${found} / ${total}` : String(found),
    level: null,
    dailyRowKey: `${challengeDateIso}|${levelId}`,
  };
}

function getDailyChallengeLibrary(app, filters, dailyCsvRows, progress) {
  const puzzles = [];
  const seenDailyKeys = new Set();

  for (const row of dailyCsvRows) {
    const dateRaw = row.dateIso || row.date;
    if (!isWithinDailyLookback(dateRaw)) continue;

    const entry = buildDailyChallengeLibraryEntry(app, row, progress, dailyCsvRows);
    if (!entry) continue;
    if (filters?.boardSize && entry.boardSizeKey !== filters.boardSize) continue;
    if (seenDailyKeys.has(entry.dailyRowKey)) continue;
    seenDailyKeys.add(entry.dailyRowKey);
    puzzles.push(entry);
  }

  puzzles.sort((a, b) => {
    const da = a.challengeDateIso || '';
    const db = b.challengeDateIso || '';
    if (da !== db) return db.localeCompare(da);
    return a.label.localeCompare(b.label);
  });

  const sizeCountsMap = new Map();
  for (const puzzle of puzzles) {
    const key = puzzle.boardSizeKey;
    if (!key) continue;
    sizeCountsMap.set(key, (sizeCountsMap.get(key) || 0) + 1);
  }

  const sizeCounts = [...sizeCountsMap.entries()]
    .map(([key, count]) => {
      const [small, large] = key.split('x').map(Number);
      return { key, label: `${small}x${large}`, count };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return { sizeCounts, puzzles, filters };
}

export async function getJournalLibraryIndex(app, filters = {}) {
  const progress = app?.progress;
  if (!progress) {
    return { sizeCounts: [], puzzles: [], filters };
  }

  const {
    dailyReleaseByLevelId: dailyByLevelId,
    dailyDatesByLevelId,
    dailyCsvRows,
    advIdByLevelId,
  } = await loadLibraryLookups();

  if (filters?.puzzleType === 'daily-challenge') {
    return getDailyChallengeLibrary(app, filters, dailyCsvRows, progress);
  }

  const levelById = new Map((app?.state?.allLevels || []).map((level) => [level.id, level]));
  const sizeCountsMap = new Map();
  const puzzles = [];
  const seenLevelIds = new Set();

  for (const levelId of Object.keys(progress.data || {})) {
    if (!levelId || levelId.startsWith('_') || !progress.hasJournalEntry(levelId)) continue;
    const key = boardSizeKeyFromLevelId(levelId);
    if (key) sizeCountsMap.set(key, (sizeCountsMap.get(key) || 0) + 1);
  }

  for (const levelId of Object.keys(progress.data || {})) {
    if (!progress.hasJournalEntry(levelId) || seenLevelIds.has(levelId)) continue;
    seenLevelIds.add(levelId);

    const key = boardSizeKeyFromLevelId(levelId);
    if (!levelMatchesFilters(levelId, progress, filters, dailyByLevelId, dailyDatesByLevelId)) continue;

    const level = levelById.get(levelId) || null;
    const found = countUniqueFoundSolutions(progress.getFoundForLevel(levelId));
    const total = totalKnownForJournalLevel(app, level, levelId, dailyCsvRows);
    const progressState = getPuzzleProgressState(found, total);
    const pct = total > 0 ? Math.round((found / total) * 100) : 0;

    const meta = progress.getLevelMeta(levelId);
    const challengeDateIso = bestDailyChallengeDate(
      levelId,
      progress,
      dailyByLevelId,
      dailyDatesByLevelId,
    );
    puzzles.push({
      levelId,
      label: levelId,
      journalSource: meta?.journalSource || null,
      challengeDateIso,
      detailLabel: puzzleListDetailLabel(
        levelId,
        progress,
        advIdByLevelId,
        dailyByLevelId,
        dailyDatesByLevelId,
      ),
      boardSize: key || '—',
      boardSizeKey: key,
      found,
      total,
      progressState,
      progressPct: pct,
      progressLabel: total > 0 ? `${found} / ${total}` : String(found),
      level,
    });
  }

  puzzles.sort((a, b) => a.label.localeCompare(b.label));

  const sizeCounts = [...sizeCountsMap.entries()]
    .map(([key, count]) => {
      const [small, large] = key.split('x').map(Number);
      return {
        key,
        label: `${small}x${large}`,
        count,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return { sizeCounts, puzzles, filters };
}
