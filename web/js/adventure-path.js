/**
 * Adventure path — 80 ranked steps (L1-1 … L8-10) + postgame puzzles.
 * Mirrors scripts/import-adventure-map.py step boundaries (CH-lvl=T).
 */

const RANK_COUNT = 8;
const STEPS_PER_RANK = 10;

let pathCache = null;

function stepToRankSub(stepIndex) {
  const rankId = Math.floor(stepIndex / STEPS_PER_RANK) + 1;
  const subLevel = (stepIndex % STEPS_PER_RANK) + 1;
  return { rankId, subLevel };
}

function requiredSolutionCount(entry) {
  if (entry.isChallenge) {
    const req = entry.totalUniqueSolutions || entry.solveCount || 1;
    return Math.max(req, 1);
  }
  return 1;
}

/** @param {string} csvText */
export function parseAdventureCsv(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',');
  const advIdx = header.indexOf('Adv_ID');
  const chIdx = header.indexOf('CH-lvl');
  const levelIdx = header.indexOf('level_id');
  const totalIdx = header.indexOf('total_unique_solutions');
  const solveIdx = header.indexOf('solve_count');
  const entries = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    const levelId = (cols[levelIdx] || '').trim();
    const advRaw = (cols[advIdx] || '').trim();
    if (!levelId || !advRaw) continue;
    entries.push({
      advId: Number(advRaw),
      line: i,
      levelId,
      isChallenge: (cols[chIdx] || '').trim().toUpperCase() === 'T',
      totalUniqueSolutions: Number(cols[totalIdx]) || 0,
      solveCount: Number(cols[solveIdx]) || 0,
    });
  }

  entries.sort((a, b) => a.advId - b.advId || a.line - b.line);
  return entries;
}

/** @param {ReturnType<typeof parseAdventureCsv>} entries */
export function buildAdventurePath(entries) {
  const challengeAdvIds = entries
    .filter((e) => e.isChallenge)
    .map((e) => e.advId)
    .sort((a, b) => a - b);

  if (challengeAdvIds.length !== 80) {
    console.warn(`Expected 80 adventure steps, got ${challengeAdvIds.length}`);
  }

  const steps = [];
  const flat = [];
  let prevAdv = 0;

  for (let stepIndex = 0; stepIndex < challengeAdvIds.length; stepIndex += 1) {
    const endAdv = challengeAdvIds[stepIndex];
    const { rankId, subLevel } = stepToRankSub(stepIndex);
    const stepEntries = entries
      .filter((e) => e.advId > prevAdv && e.advId <= endAdv)
      .sort((a, b) => a.advId - b.advId || a.line - b.line);

    const puzzles = stepEntries.map((entry, orderIdx) => {
      const puzzle = {
        advId: entry.advId,
        levelId: entry.levelId,
        puzzleOrder: orderIdx + 1,
        isChallenge: entry.isChallenge,
        totalUniqueSolutions: entry.totalUniqueSolutions,
        requiredSolutionCount: requiredSolutionCount(entry),
        stepIndex,
        rankId,
        subLevel,
        flatIndex: flat.length,
      };
      flat.push(puzzle);
      return puzzle;
    });

    steps.push({ stepIndex, rankId, subLevel, puzzles });
    prevAdv = endAdv;
  }

  const postgame = entries
    .filter((e) => e.advId > prevAdv)
    .sort((a, b) => a.advId - b.advId || a.line - b.line)
    .map((entry, orderIdx) => ({
      advId: entry.advId,
      levelId: entry.levelId,
      puzzleOrder: orderIdx + 1,
      isChallenge: entry.isChallenge,
      totalUniqueSolutions: entry.totalUniqueSolutions,
      requiredSolutionCount: requiredSolutionCount(entry),
      flatIndex: flat.length + orderIdx,
    }));

  return { steps, postgame, flat, stepCount: steps.length };
}

export async function loadAdventurePath() {
  if (pathCache) return pathCache;
  try {
    const csv = await fetch('/data/adventure_solution_distribution.csv').then((r) => r.text());
    const entries = parseAdventureCsv(csv);
    pathCache = buildAdventurePath(entries);
  } catch (e) {
    console.warn('Adventure path unavailable', e);
    pathCache = { steps: [], postgame: [], flat: [], stepCount: 0 };
  }
  return pathCache;
}

export function clearAdventurePathCache() {
  pathCache = null;
}

/** Recorded solves that count toward adventure step completion. */
export function adventureSolveCount(progress, levelId, requiredSolutionCount = 1) {
  const found = progress?.getFoundForLevel?.(levelId) || [];
  if (!found.length) return 0;
  if (requiredSolutionCount <= 1) return found.length;
  return found.filter((f) => !f.bonus).length;
}

/** @deprecated use adventureSolveCount */
export function countCatalogSolutionsFound(progress, levelId) {
  return adventureSolveCount(progress, levelId, 1);
}

export function isPuzzleSatisfied(progress, puzzle) {
  if (!puzzle?.levelId) return false;
  const required = puzzle.requiredSolutionCount || 1;
  return adventureSolveCount(progress, puzzle.levelId, required) >= required;
}

export function countCompletedInStep(progress, step) {
  if (!step?.puzzles?.length) return 0;
  return step.puzzles.filter((p) => isPuzzleSatisfied(progress, p)).length;
}

function findPuzzleInPath(path, levelId) {
  if (!levelId) return null;
  const inStep = path.flat.find((p) => p.levelId === levelId);
  if (inStep) return { puzzle: inStep, step: path.steps[inStep.stepIndex], postgame: false };
  const pg = path.postgame.find((p) => p.levelId === levelId);
  if (pg) return { puzzle: pg, step: null, postgame: true };
  return null;
}

/**
 * First incomplete puzzle in path order (steps 1–80, then postgame).
 * @returns {{ puzzle, step, postgame, stepIndex, puzzleIndexInStep } | null}
 */
export function findNextUnsolved(progress, path, { afterLevelId = null } = {}) {
  if (!path?.flat?.length) return null;

  let startFlat = 0;
  if (afterLevelId) {
    const current = path.flat.find((p) => p.levelId === afterLevelId);
    if (current) startFlat = current.flatIndex + 1;
    else {
      const pg = path.postgame.find((p) => p.levelId === afterLevelId);
      if (pg) startFlat = pg.flatIndex + 1;
    }
  }

  for (let i = startFlat; i < path.flat.length; i += 1) {
    const puzzle = path.flat[i];
    if (!isPuzzleSatisfied(progress, puzzle)) {
      return {
        puzzle,
        step: path.steps[puzzle.stepIndex],
        postgame: false,
        stepIndex: puzzle.stepIndex,
        puzzleIndexInStep: puzzle.puzzleOrder - 1,
      };
    }
  }

  for (const puzzle of path.postgame) {
    if (puzzle.flatIndex < startFlat) continue;
    if (!isPuzzleSatisfied(progress, puzzle)) {
      return {
        puzzle,
        step: null,
        postgame: true,
        stepIndex: path.stepCount - 1,
        puzzleIndexInStep: puzzle.puzzleOrder - 1,
      };
    }
  }

  if (path.postgame.length) {
    const last = path.postgame[path.postgame.length - 1];
    return {
      puzzle: last,
      step: path.steps[path.steps.length - 1] || null,
      postgame: true,
      stepIndex: path.stepCount - 1,
      puzzleIndexInStep: last.puzzleOrder - 1,
    };
  }

  const lastStep = path.steps[path.steps.length - 1];
  const lastPuzzle = lastStep?.puzzles?.[lastStep.puzzles.length - 1];
  if (!lastPuzzle) return null;
  return {
    puzzle: lastPuzzle,
    step: lastStep,
    postgame: false,
    stepIndex: lastStep.stepIndex,
    puzzleIndexInStep: lastPuzzle.puzzleOrder - 1,
  };
}

/** Current rank/sublevel and step-local progress for the rank panel. */
export function getRankPanelState(progress, path) {
  const fallback = {
    rankId: 1,
    subLevel: 1,
    stepProgress: 0,
    stepTotal: 1,
    stepIndex: 0,
  };
  if (!path?.steps?.length) return fallback;

  for (const step of path.steps) {
    const completed = countCompletedInStep(progress, step);
    const total = step.puzzles.length;
    if (completed < total) {
      return {
        rankId: step.rankId,
        subLevel: step.subLevel,
        stepProgress: completed,
        stepTotal: total,
        stepIndex: step.stepIndex,
      };
    }
  }

  const last = path.steps[path.steps.length - 1];
  return {
    rankId: last.rankId,
    subLevel: last.subLevel,
    stepProgress: last.puzzles.length,
    stepTotal: last.puzzles.length,
    stepIndex: last.stepIndex,
  };
}

export function getPuzzleRequirement(path, levelId) {
  const hit = findPuzzleInPath(path, levelId);
  return hit?.puzzle?.requiredSolutionCount ?? 1;
}

export function isAdventurePuzzleComplete(progress, path, levelId) {
  const hit = findPuzzleInPath(path, levelId);
  if (!hit?.puzzle) return false;
  return isPuzzleSatisfied(progress, hit.puzzle);
}

/** UI metadata for challenge panel + adventure chrome. */
export function buildAdventureMeta(path, location, progress) {
  const puzzle = location?.puzzle;
  const step = location?.step;
  const rankState = getRankPanelState(progress, path);
  const stepTotal = step?.puzzles?.length ?? rankState.stepTotal;
  const stepProgress = step
    ? countCompletedInStep(progress, step)
    : rankState.stepProgress;

  return {
    screen: 'adventure',
    levelId: puzzle?.levelId,
    isChallenge: !!puzzle?.isChallenge,
    totalSolutions: puzzle?.totalUniqueSolutions || puzzle?.requiredSolutionCount || 0,
    requiredSolutionCount: puzzle?.requiredSolutionCount || 1,
    rankId: step?.rankId ?? rankState.rankId,
    subLevel: step?.subLevel ?? rankState.subLevel,
    rankCode: `L${step?.rankId ?? rankState.rankId}`,
    stepIndex: location?.stepIndex ?? rankState.stepIndex,
    stepProgress,
    stepTotal,
    puzzleOrder: puzzle?.puzzleOrder ?? 1,
    postgame: !!location?.postgame,
    advStep: puzzle?.flatIndex != null ? puzzle.flatIndex + 1 : stepProgress + 1,
    advTotal: path.flat.length + path.postgame.length,
  };
}

export function buildAdventureMetaForLevel(path, levelId, progress) {
  if (!path?.flat?.length || !levelId) return null;
  for (const step of path.steps) {
    const puzzle = step.puzzles.find((p) => p.levelId === levelId);
    if (puzzle) {
      return buildAdventureMeta(path, {
        puzzle,
        step,
        postgame: false,
        stepIndex: step.stepIndex,
        puzzleIndexInStep: puzzle.puzzleOrder - 1,
      }, progress);
    }
  }
  const pg = path.postgame.find((p) => p.levelId === levelId);
  if (pg) {
    const lastStep = path.steps[path.steps.length - 1];
    return buildAdventureMeta(path, {
      puzzle: pg,
      step: lastStep,
      postgame: true,
      stepIndex: path.stepCount - 1,
      puzzleIndexInStep: pg.puzzleOrder - 1,
    }, progress);
  }
  return null;
}

export async function resolveAdventureResume(app) {
  const path = await loadAdventurePath();
  const progress = app?.progress || window.__app?.progress;
  if (!path.flat.length) return { level: null, meta: null, location: null, path };

  const location = findNextUnsolved(progress, path);

  if (!location?.puzzle) return { level: null, meta: null, location: null, path };

  const level = app?.state?.allLevels?.find((l) => l.id === location.puzzle.levelId);
  const meta = buildAdventureMeta(path, location, progress);
  return { level, meta, location, path };
}
