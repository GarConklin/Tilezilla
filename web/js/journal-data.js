/**
 * Puzzle Journal data — aggregates progress + level catalog for record/library views.
 */

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

export async function getJournalRecord(app, levelId) {
  const progress = app?.progress;
  const state = app?.state;
  if (!levelId || !progress || !state) return null;

  const level = state.allLevels?.find((l) => l.id === levelId)
    || (state.currentLevel?.id === levelId ? state.currentLevel : null);
  if (!level) return null;

  const known = await app.loadKnownSolutionsForLevel?.(level) || [];
  const found = progress.getFoundForLevel(levelId) || [];
  const foundCount = found.filter((f) => !f.bonus && Number.isFinite(f.index)).length;
  const total = known.length || app.totalKnownForLevel?.(level) || 0;
  const screen = document.querySelector('.tz-app')?.dataset?.screen || 'daily-challenge';

  const entries = found
    .filter((f) => !f.bonus && Number.isFinite(f.index))
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
  const { boardSize, puzzleType, status } = filters || {};
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

  const found = progress.getFoundForLevel(levelId).filter((f) => !f.bonus && Number.isFinite(f.index)).length;
  const total = Number(level.totalUniqueSolutions) || 0;

  if (status === 'started' && found <= 0) return false;
  if (status === 'solved' && found <= 0) return false;
  if (status === 'complete' && !(total > 0 && found >= total)) return false;

  return true;
}

export async function getJournalLibraryIndex(app, filters = {}) {
  const progress = app?.progress;
  const levels = app?.state?.allLevels || [];
  if (!progress) {
    return { sizeCounts: [], puzzles: [], filters };
  }

  const sizeCountsMap = new Map();
  const puzzles = [];

  for (const level of levels) {
    if (!progress.hasJournalEntry(level.id)) continue;
    const key = boardSizeKey(level);
    if (key) sizeCountsMap.set(key, (sizeCountsMap.get(key) || 0) + 1);
    if (!levelMatchesFilters(level, progress, filters)) continue;

    const known = await app.loadKnownSolutionsForLevel?.(level) || [];
    const found = progress.getFoundForLevel(level.id).filter((f) => !f.bonus && Number.isFinite(f.index)).length;
    const total = known.length || app.totalKnownForLevel?.(level) || 0;
    const progressState = getPuzzleProgressState(found, total);
    const pct = total > 0 ? Math.round((found / total) * 100) : 0;

    puzzles.push({
      levelId: level.id,
      label: level.name || level.id,
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
