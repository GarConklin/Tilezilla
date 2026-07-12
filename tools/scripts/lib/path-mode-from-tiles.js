'use strict';

/**
 * Level catalog field semantics:
 *   pathMode              — single vs multi (extra snakes), from tile bag
 *   pathCount             — snakes / disjoint paths on board (min SH,ET or 1)
 *   totalUniqueSolutions  — library size, from solve file (cached on level)
 */

function pathModeFromTiles(tiles, existingMode) {
  const sh = Number((tiles && tiles.SH) || 0);
  const et = Number((tiles && tiles.ET) || 0);
  if (sh > 1 || et > 1) {
    if (existingMode === 'multi-flex') return 'multi-flex';
    return 'multi';
  }
  return 'single';
}

function pathCountFromTiles(tiles) {
  const sh = Number((tiles && tiles.SH) || 0);
  const et = Number((tiles && tiles.ET) || 0);
  if (sh > 0 && et > 0) return Math.min(sh, et);
  return 1;
}

function solutionCountFromDoc(doc) {
  if (!doc || typeof doc !== 'object') return 0;
  if (typeof doc.totalUniqueSolutions === 'number') return doc.totalUniqueSolutions;
  const sols = doc.solutions;
  return Array.isArray(sols) ? sols.length : 0;
}

/** Apply correct pathMode, pathCount, totalUniqueSolutions for one catalog row. */
function catalogFieldsForLevel(level, solveDoc) {
  const tiles = level.tiles || {};
  return {
    pathMode: pathModeFromTiles(tiles, level.pathMode),
    pathCount: pathCountFromTiles(tiles),
    totalUniqueSolutions: solutionCountFromDoc(solveDoc),
  };
}

/** @deprecated use catalogFieldsForLevel */
function pathCatalogFieldsFromTilesAndSolve(tiles, solveDoc, existingMode) {
  const level = { tiles, pathMode: existingMode };
  return catalogFieldsForLevel(level, solveDoc);
}

module.exports = {
  pathModeFromTiles,
  pathCountFromTiles,
  solutionCountFromDoc,
  catalogFieldsForLevel,
  pathCatalogFieldsFromTilesAndSolve,
};
