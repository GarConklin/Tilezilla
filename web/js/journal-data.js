/**
 * Puzzle Journal data — aggregates progress + level catalog for record/library views.
 */

import { loadAdventurePath, normalizeCatalogLevelId } from './adventure-path.js';

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
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return null;
  const a = Math.min(rows, cols);
  const b = Math.max(rows, cols);
  return `${a}x${b}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
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
let adventurePathCache = null;
let advIdByLevelIdCache = null;

function parseDailyCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const byLevel = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [challenge_date, level_id] = line.split(',');
    const levelId = normalizeCatalogLevelId(level_id);
    const date = challenge_date?.trim();
    if (!levelId || !date || byLevel.has(levelId)) continue;
    byLevel.set(levelId, date);
  }
  return byLevel;
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
    try {
      const csv = await fetch('/data/daily_challenges_import.csv').then((r) => r.text());
      dailyReleaseByLevelId = parseDailyCsv(csv);
    } catch {
      dailyReleaseByLevelId = new Map();
    }
  }
  if (!adventurePathCache) {
    adventurePathCache = await loadAdventurePath();
    advIdByLevelIdCache = buildAdvIdByLevelId(adventurePathCache);
  }
  return {
    dailyReleaseByLevelId,
    adventurePath: adventurePathCache,
    advIdByLevelId: advIdByLevelIdCache || new Map(),
  };
}

/** Adventure + random puzzles share the same path — show Adv_ID unless explicitly daily-challenge. */
function puzzleListDetailLabel(levelId, progress, advIdByLevelId, dailyByLevelId) {
  const meta = progress?.getLevelMeta?.(levelId);
  const src = meta?.journalSource || null;
  const key = normalizeCatalogLevelId(levelId);
  const advId = advIdByLevelId.get(key) ?? null;

  if (src === 'daily-challenge') {
    const dateRaw = meta?.challengeDate || dailyByLevelId?.get(key);
    const formatted = formatChallengeDate(dateRaw);
    return formatted ? `· ${formatted}` : null;
  }

  if (advId != null) {
    return `· Adv ${advId}`;
  }

  if (dailyByLevelId?.has(key)) {
    const dateRaw = meta?.challengeDate || dailyByLevelId.get(key);
    const formatted = formatChallengeDate(dateRaw);
    return formatted ? `· ${formatted}` : null;
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
  return !entry?.bonus && Number.isFinite(entry?.index);
}

/** Unique catalog solutions found — re-solves of the same index count once. */
function countUniqueFoundSolutions(found) {
  const indices = new Set();
  for (const entry of found || []) {
    if (!isCatalogFoundEntry(entry)) continue;
    indices.add(entry.index);
  }
  return indices.size;
}

/** Keep one journal row per solution index (most recent solve wins). */
function dedupeFoundByIndex(found) {
  const byIndex = new Map();
  for (const entry of found || []) {
    if (!isCatalogFoundEntry(entry)) continue;
    const prev = byIndex.get(entry.index);
    if (!prev || String(entry.foundAt || '') > String(prev.foundAt || '')) {
      byIndex.set(entry.index, entry);
    }
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

export async function getJournalRecord(app, levelId) {
  const progress = app?.progress;
  const state = app?.state;
  if (!levelId || !progress || !state) return null;

  const level = state.allLevels?.find((l) => l.id === levelId)
    || (state.currentLevel?.id === levelId ? state.currentLevel : null);
  if (!level) return null;

  const known = await app.loadKnownSolutionsForLevel?.(level) || [];
  const found = progress.getFoundForLevel(levelId) || [];
  const uniqueFound = dedupeFoundByIndex(found);
  const foundCount = uniqueFound.length;
  const total = known.length || app.totalKnownForLevel?.(level) || 0;
  const screen = document.querySelector('.tz-app')?.dataset?.screen || 'daily-challenge';

  const entries = uniqueFound
    .map((f) => {
      const placements = Array.isArray(f.placements) && f.placements.length
        ? f.placements
        : (known[f.index]?.placements || []);
      return {
        index: f.index,
        label: `Solution #${f.index + 1}`,
        placements,
        foundAt: f.foundAt || null,
        foundDate: formatDate(f.foundAt),
        solveTime: f.completionTimeSeconds > 0
          ? formatTime(f.completionTimeSeconds)
          : (f.elapsedMs > 0 ? formatTime(Math.floor(f.elapsedMs / 1000)) : '—'),
      };
    })
    .sort((a, b) => a.index - b.index);

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
    firstSolvedAt: progress.getFirstSolvedAt(levelId),
    firstSolvedDate: formatDate(progress.getFirstSolvedAt(levelId)),
    lastPlayedAt: progress.getLastPlayedAt(levelId),
    lastPlayedDate: formatDate(progress.getLastPlayedAt(levelId)),
    progressState,
    progressPct: pct,
    progressLabel: total > 0 ? `${foundCount} / ${total}` : String(foundCount),
    entries,
  };
}

function levelMatchesFilters(level, progress, filters) {
  const { boardSize, puzzleType } = filters || {};
  const levelId = level?.id;
  if (!levelId || !progress?.hasJournalEntry?.(levelId)) return false;

  if (boardSize) {
    if (boardSizeKey(level) !== boardSize) return false;
  }

  if (puzzleType) {
    const meta = progress.getLevelMeta(levelId);
    const src = meta?.journalSource;
    if (puzzleType === 'adventure' && src !== 'adventure') return false;
    if (puzzleType === 'daily-challenge' && src !== 'daily-challenge') return false;
    if (puzzleType === 'random' && src !== 'random') return false;
  }

  return true;
}

export async function getJournalLibraryIndex(app, filters = {}) {
  const progress = app?.progress;
  const levels = app?.state?.allLevels || [];
  const levelById = new Map(levels.map((level) => [level.id, level]));
  if (!progress) {
    return { sizeCounts: [], puzzles: [], filters };
  }

  const { dailyReleaseByLevelId: dailyByLevelId, advIdByLevelId } = await loadLibraryLookups();

  const sizeCountsMap = new Map();
  const puzzles = [];
  const seenLevelIds = new Set();

  for (const levelId of Object.keys(progress.data || {})) {
    if (!progress.hasJournalEntry(levelId) || seenLevelIds.has(levelId)) continue;
    seenLevelIds.add(levelId);

    const level = levelById.get(levelId);
    if (!level) continue;

    const key = boardSizeKey(level);
    if (key) sizeCountsMap.set(key, (sizeCountsMap.get(key) || 0) + 1);
    if (!levelMatchesFilters(level, progress, filters)) continue;

    const known = await app.loadKnownSolutionsForLevel?.(level) || [];
    const found = countUniqueFoundSolutions(progress.getFoundForLevel(levelId));
    const total = known.length || app.totalKnownForLevel?.(level) || 0;
    const progressState = getPuzzleProgressState(found, total);
    const pct = total > 0 ? Math.round((found / total) * 100) : 0;

    const meta = progress.getLevelMeta(levelId);
    puzzles.push({
      levelId: level.id,
      label: level.id || level.name,
      journalSource: meta?.journalSource || null,
      detailLabel: puzzleListDetailLabel(levelId, progress, advIdByLevelId, dailyByLevelId),
      boardSize: boardSizeLabel(level),
      boardSizeKey: key,
      found,
      total,
      progressState,
      progressPct: pct,
      progressLabel: total > 0 ? `${found} / ${total}` : `${found}`,
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
