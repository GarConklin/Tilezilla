/**

 * Adventure path — ranked steps (L1-1 … L9-10) + postgame puzzles.

 * Step boundaries from CH-lvl=T in adventure_solution_distribution.csv.

 *

 * Completion rules (derived at runtime from is_challenge + level catalog):

 *   normal puzzle  → 1 discovered solution

 *   challenge puzzle → all known solutions for that level_id

 */



const STEPS_PER_RANK = 10;



let pathCache = null;



function stepToRankSub(stepIndex) {

  const rankId = Math.floor(stepIndex / STEPS_PER_RANK) + 1;

  const subLevel = (stepIndex % STEPS_PER_RANK) + 1;

  return { rankId, subLevel };

}



/** @typedef {{ levels?: Array, solutionCountByLevelId?: Record<string, number> }} AdventureLevelContext */



export function adventureLevelContext(app) {

  return {

    levels: app?.state?.allLevels,

    solutionCountByLevelId: app?.state?.solutionCountByLevelId,

  };

}



function findLevel(levelContext, levelId) {

  const levels = levelContext?.levels;

  if (!levels?.length || !levelId) return null;

  return levels.find((l) => l.id === levelId) || null;

}



export function resolveLevelTotalKnown(level, solutionCountByLevelId = {}) {

  if (!level?.id) return 0;

  const cached = solutionCountByLevelId[level.id];

  if (Number.isFinite(cached) && cached >= 0) return cached;

  const lib = Number(level.totalUniqueSolutions);

  if (Number.isFinite(lib) && lib > 0) return lib;

  return 0;

}



/** How many discoveries are required before this adventure slot is complete. */

export function getAdventurePuzzleRequirement(puzzle, levelContext = {}) {

  if (!puzzle?.isChallenge) return 1;

  const level = findLevel(levelContext, puzzle.levelId);

  const totalKnown = resolveLevelTotalKnown(level, levelContext.solutionCountByLevelId);

  return Math.max(totalKnown, 1);

}



/** @param {string} csvText */

export function parseAdventureCsv(csvText) {

  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);

  if (!lines.length) return [];

  const header = lines[0].split(',');

  const advIdx = header.indexOf('Adv_ID');

  const chIdx = header.indexOf('CH-lvl');

  const levelIdx = header.indexOf('level_id');

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



  if (!challengeAdvIds.length) {

    console.warn('No adventure step markers (CH-lvl=T) in CSV');

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



/** Recorded solves that count toward adventure slot completion. */

export function adventureSolveCount(progress, levelId, { isChallenge = false } = {}) {

  const found = progress?.getFoundForLevel?.(levelId) || [];

  if (!found.length) return 0;

  if (!isChallenge) return found.length;

  return found.filter((f) => !f.bonus).length;

}



/** @deprecated use adventureSolveCount */

export function countCatalogSolutionsFound(progress, levelId) {

  return adventureSolveCount(progress, levelId, { isChallenge: false });

}



export function isPuzzleSatisfied(progress, puzzle, levelContext = {}) {

  if (!puzzle?.levelId) return false;

  const required = getAdventurePuzzleRequirement(puzzle, levelContext);

  const found = adventureSolveCount(progress, puzzle.levelId, { isChallenge: puzzle.isChallenge });

  return found >= required;

}



export function countCompletedInStep(progress, step, levelContext = {}) {

  if (!step?.puzzles?.length) return 0;

  return step.puzzles.filter((p) => isPuzzleSatisfied(progress, p, levelContext)).length;

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

 * First incomplete puzzle in path order (steps, then postgame).

 * @returns {{ puzzle, step, postgame, stepIndex, puzzleIndexInStep } | null}

 */

export function findNextUnsolved(progress, path, { afterLevelId = null, levelContext = {} } = {}) {

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

    if (!isPuzzleSatisfied(progress, puzzle, levelContext)) {

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

    if (!isPuzzleSatisfied(progress, puzzle, levelContext)) {

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

export function getRankPanelState(progress, path, levelContext = {}) {

  const fallback = {

    rankId: 1,

    subLevel: 1,

    stepProgress: 0,

    stepTotal: 1,

    stepIndex: 0,

  };

  if (!path?.steps?.length) return fallback;



  for (const step of path.steps) {

    const completed = countCompletedInStep(progress, step, levelContext);

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



export function getPuzzleRequirement(path, levelId, levelContext = {}) {

  const hit = findPuzzleInPath(path, levelId);

  if (!hit?.puzzle) return 1;

  return getAdventurePuzzleRequirement(hit.puzzle, levelContext);

}



export function isAdventurePuzzleComplete(progress, path, levelId, levelContext = {}) {

  const hit = findPuzzleInPath(path, levelId);

  if (!hit?.puzzle) return false;

  return isPuzzleSatisfied(progress, hit.puzzle, levelContext);

}



/** UI metadata for challenge panel + adventure chrome. */

export function buildAdventureMeta(path, location, progress, levelContext = {}) {

  const puzzle = location?.puzzle;

  const step = location?.step;

  const rankState = getRankPanelState(progress, path, levelContext);

  const stepTotal = step?.puzzles?.length ?? rankState.stepTotal;

  const stepProgress = step

    ? countCompletedInStep(progress, step, levelContext)

    : rankState.stepProgress;

  const level = findLevel(levelContext, puzzle?.levelId);

  const totalKnown = resolveLevelTotalKnown(level, levelContext.solutionCountByLevelId);

  const required = puzzle ? getAdventurePuzzleRequirement(puzzle, levelContext) : 1;



  return {

    screen: 'adventure',

    levelId: puzzle?.levelId,

    isChallenge: !!puzzle?.isChallenge,

    totalSolutions: totalKnown,

    requiredSolutionCount: required,

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



export function buildAdventureMetaForLevel(path, levelId, progress, levelContext = {}) {

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

      }, progress, levelContext);

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

    }, progress, levelContext);

  }

  return null;

}



export async function resolveAdventureResume(app) {

  const path = await loadAdventurePath();

  const progress = app?.progress || window.__app?.progress;

  const levelContext = adventureLevelContext(app);

  if (!path.flat.length) return { level: null, meta: null, location: null, path };



  const location = findNextUnsolved(progress, path, { levelContext });



  if (!location?.puzzle) return { level: null, meta: null, location: null, path };



  const level = app?.state?.allLevels?.find((l) => l.id === location.puzzle.levelId);

  const meta = buildAdventureMeta(path, location, progress, levelContext);

  return { level, meta, location, path };

}


