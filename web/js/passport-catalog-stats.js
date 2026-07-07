/** Adventure catalog totals for passport display (puzzle count, routes, largest solution). */

import {
  adventureLevelContext,
  findLevel,
  loadAdventurePath,
  resolveLevelTotalKnown,
} from './adventure-path.js';
import { isCatalogReady, loadLevelStatsIndex } from './level-catalog.js';

let catalogCache = null;

export function clearAdventureCatalogStatsCache() {
  catalogCache = null;
}

async function ensureLevelStatsOnApp(app) {
  if (app?.state?.levelStatsById) return app.state.levelStatsById;
  const stats = await loadLevelStatsIndex();
  const byId = stats?.byId || {};
  if (app?.state) app.state.levelStatsById = byId;
  return byId;
}

/**
 * @returns {Promise<{ totalAdventurePuzzles: number, totalKnownRoutes: number, largestSolution: number } | null>}
 */
export async function loadAdventureCatalogStats(app = window.__app, { force = false } = {}) {
  const statsReady = isCatalogReady();
  if (catalogCache && !force) return catalogCache;
  try {
    const [path, levelStatsById] = await Promise.all([
      loadAdventurePath(),
      ensureLevelStatsOnApp(app),
    ]);
    const levelContext = {
      ...adventureLevelContext(app || {}),
      levelStatsById,
    };
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
    if (statsReady && totalKnownRoutes > 0) {
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
