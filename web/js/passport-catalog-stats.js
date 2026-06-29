/** Adventure catalog totals for passport display (puzzle count, routes, largest solution). */

import {
  adventureLevelContext,
  findLevel,
  loadAdventurePath,
  resolveLevelTotalKnown,
} from './adventure-path.js';

let catalogCache = null;

export function clearAdventureCatalogStatsCache() {
  catalogCache = null;
}

/**
 * @returns {Promise<{ totalAdventurePuzzles: number, totalKnownRoutes: number, largestSolution: number } | null>}
 */
export async function loadAdventureCatalogStats(app = window.__app, { force = false } = {}) {
  const levelsReady = (app?.state?.allLevels?.length ?? 0) > 0;
  if (catalogCache && !force) return catalogCache;
  try {
    const path = await loadAdventurePath();
    const levelContext = adventureLevelContext(app || {});
    const puzzles = [...(path?.flat || []), ...(path?.postgame || [])];
    let totalKnownRoutes = 0;
    let largestSolution = 0;
    for (const puzzle of puzzles) {
      const level = findLevel(levelContext, puzzle?.levelId);
      const known = resolveLevelTotalKnown(level, levelContext.solutionCountByLevelId);
      totalKnownRoutes += known;
      if (known > largestSolution) largestSolution = known;
    }
    const result = {
      totalAdventurePuzzles: puzzles.length,
      totalKnownRoutes,
      largestSolution,
    };
    // Avoid caching zeros before level catalog / solution counts are loaded.
    if (levelsReady && totalKnownRoutes > 0) {
      catalogCache = result;
    }
    return result;
  } catch {
    return null;
  }
}

export function formatCatalogStatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('en-US');
}
