'use strict';

/**
 * Layout equivalence keys for solution dedupe.
 * Uses per-cell tile+edge fingerprints so re-anchored encodings of the same
 * board (SS/SZ/etc.) collapse. Square boards: C4 (0/90/180/270). Rectangles: 180° only.
 */

const EDGE_ROT_90 = { N: 'E', E: 'S', S: 'W', W: 'N' };
const EDGE_ROT_180 = { N: 'S', S: 'N', E: 'W', W: 'E' };

function rotName(deg) {
  const d = ((deg % 360) + 360) % 360;
  return d === 0 ? 'r0' : d === 90 ? 'r90' : d === 180 ? 'r180' : 'r270';
}

function edgesFor(tilesJson, tileName, deg, which) {
  const rot = tilesJson?.[tileName]?.[rotName(deg)];
  if (!rot) return [];
  return Array.isArray(rot[which]) ? rot[which].slice().sort() : [];
}

function cellCount(tilesJson, tileName) {
  const def = tilesJson?.[tileName];
  if (!def || !Array.isArray(def.shape)) return 2;
  return def.shape.length;
}

function targetCells(r, c, deg) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function cellsForTile(tilesJson, tn, r, c, deg) {
  const shape = tilesJson?.[tn]?.shape;
  const rot = ((deg % 360) + 360) % 360;
  function rotOff(dr, dc, d) {
    if (d === 0) return [dr, dc];
    if (d === 90) return [dc, -dr];
    if (d === 180) return [-dr, -dc];
    return [-dc, dr];
  }
  if (Array.isArray(shape) && shape.length) {
    return shape.map((s) => {
      const [dr, dc] = rotOff(s.dr || 0, s.dc || 0, rot);
      return [r + dr, c + dc];
    });
  }
  return targetCells(r, c, deg);
}

function buildCellGrid(placements, rows, cols, tilesJson) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const p of placements || []) {
    const deg = ((p.deg % 360) + 360) % 360;
    const tn = p.tile;
    if (cellCount(tilesJson, tn) === 1) {
      if (p.r >= 0 && p.r < rows && p.c >= 0 && p.c < cols) {
        grid[p.r][p.c] = `${tn}:${edgesFor(tilesJson, tn, deg, 'A').join(',')}`;
      }
      continue;
    }
    const cells = cellsForTile(tilesJson, tn, p.r, p.c, deg);
    const labels = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < cells.length; i++) {
      const [cr, cc] = cells[i];
      if (cr >= 0 && cr < rows && cc >= 0 && cc < cols) {
        const wh = labels[i] || 'A';
        grid[cr][cc] = `${tn}:${edgesFor(tilesJson, tn, deg, wh).join(',')}`;
      }
    }
  }
  return grid;
}

function gridFingerprint(grid) {
  return grid.map((row) => row.map((c) => c || '.').join('|')).join('\n');
}

function rotateEdges90(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  if (parts.length < 2) return cellStr;
  const edges = parts[1]
    .split(',')
    .filter(Boolean)
    .map((e) => EDGE_ROT_90[e] || e)
    .sort()
    .join(',');
  return `${parts[0]}:${edges}`;
}

function rotateEdges180(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  if (parts.length < 2) return cellStr;
  const edges = parts[1]
    .split(',')
    .filter(Boolean)
    .map((e) => EDGE_ROT_180[e] || e)
    .sort()
    .join(',');
  return `${parts[0]}:${edges}`;
}

function rotateGrid180(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[rows - 1 - r][cols - 1 - c] = rotateEdges180(grid[r][c]);
    }
  }
  return out;
}

function rotateGrid90CW(grid) {
  const n = grid.length;
  const out = Array.from({ length: n }, () => Array(n).fill(null));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[c][n - 1 - r] = rotateEdges90(grid[r][c]);
    }
  }
  return out;
}

/**
 * @param {Array<{tile:string,r:number,c:number,deg:number}>} placements
 * @param {number} rows
 * @param {number} cols
 * @param {object} tilesJson
 * @returns {string}
 */
function uniqueLayoutKey(placements, rows, cols, tilesJson) {
  const grid = buildCellGrid(placements, rows, cols, tilesJson);
  const keys = [gridFingerprint(grid), gridFingerprint(rotateGrid180(grid))];
  if (rows === cols) {
    let cur = grid;
    for (let k = 0; k < 3; k++) {
      cur = rotateGrid90CW(cur);
      keys.push(gridFingerprint(cur));
    }
  }
  keys.sort();
  return keys[0];
}

module.exports = {
  uniqueLayoutKey,
  buildCellGrid,
  gridFingerprint,
  rotateGrid180,
  rotateGrid90CW,
};
