/**
 * Seed viability check aligned with solves/solve-level.js:getSnakeTip after placing SH+ET.
 *
 *   node solves/is-viable-seed.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

function loadTilesJson() {
  const full = path.join(ROOT, 'data', 'tiles', 'tiles-live-edges.json');
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function rotName(deg) {
  const r = ((deg % 360) + 360) % 360;
  return r === 0 ? 'r0' : r === 90 ? 'r90' : r === 180 ? 'r180' : 'r270';
}

/** Domino occupancy; anchor (r,c) is tile A (see tiles-live-edges shape). */
function targetCells(r, c, deg) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function cellsOverlap(cellsA, cellsB) {
  const s = new Set(cellsA.map((x) => `${x[0]},${x[1]}`));
  for (let i = 0; i < cellsB.length; i++) if (s.has(`${cellsB[i][0]},${cellsB[i][1]}`)) return true;
  return false;
}

function dirFromTo(r1, c1, r2, c2) {
  const dr = r2 - r1;
  const dc = c2 - c1;
  if (dr === -1 && dc === 0) return 'N';
  if (dr === 1 && dc === 0) return 'S';
  if (dr === 0 && dc === 1) return 'E';
  if (dr === 0 && dc === -1) return 'W';
  return null;
}

function edgesFor(tilesJson, tn, deg, wh) {
  const rn = rotName(deg);
  const t = tilesJson[tn];
  if (!t || !t[rn]) return [];
  return t[rn][wh] || [];
}

function pathsFor(tilesJson, tn, deg) {
  const rn = rotName(deg);
  const p = tilesJson[tn]?.[rn]?.paths;
  return Array.isArray(p) && p.length ? p : null;
}

function pathExitOtherEnd(paths, which, entryEdge) {
  for (let pi = 0; pi < paths.length; pi++) {
    const ends = paths[pi].ends;
    if (!ends || ends.length !== 2) continue;
    const u = ends[0];
    const v = ends[1];
    if (u[0] === which && u[1] === entryEdge) return v;
    if (v[0] === which && v[1] === entryEdge) return u;
  }
  return null;
}

/** Same as solve-level.js makeSolver(...).getSnakeTip */
function getSnakeTip(tilesJson, board, placedTiles, config) {
  const sh = placedTiles.find((t) => t.tile.indexOf('SH') >= 0);
  if (!sh) return null;
  const shCells = targetCells(sh.r, sh.c, sh.deg);
  let startR = null;
  let startC = null;
  let startEdge = null;
  for (let i = 0; i < shCells.length; i++) {
    const rr = shCells[i][0];
    const cc = shCells[i][1];
    const wh = i === 0 ? 'A' : 'B';
    const edges = edgesFor(tilesJson, sh.tile, sh.deg, wh);
    for (let j = 0; j < edges.length; j++) {
      startR = rr;
      startC = cc;
      startEdge = edges[j];
    }
  }
  if (startR === null) return null;
  const vis = new Set();
  for (let k = 0; k < shCells.length; k++) vis.add(`${shCells[k][0]},${shCells[k][1]}`);
  let curR = startR;
  let curC = startC;
  let exitDir = startEdge;
  for (let iter = 0; iter < 100; iter++) {
    const nR = curR + (exitDir === 'N' ? -1 : exitDir === 'S' ? 1 : 0);
    const nC = curC + (exitDir === 'W' ? -1 : exitDir === 'E' ? 1 : 0);
    if (nR < 0 || nR >= config.rows || nC < 0 || nC >= config.cols) return null;
    const nc = board[nR][nC];
    if (!nc) return { needR: nR, needC: nC, neededEdge: OPP[exitDir] };
    const ne = edgesFor(tilesJson, nc.tile, nc.deg, nc.which);
    if (ne.indexOf(OPP[exitDir]) < 0) return null;
    const ck = `${nR},${nC}`;
    if (vis.has(ck)) return null;
    vis.add(ck);
    const tp = placedTiles.find((t) =>
      targetCells(t.r, t.c, t.deg).some((cell) => cell[0] === nR && cell[1] === nC)
    );
    if (!tp) return null;
    const tc = targetCells(tp.r, tp.c, tp.deg);
    const eci = tc.findIndex((cell) => cell[0] === nR && cell[1] === nC);
    const entryEdge = OPP[exitDir];
    const whIn = eci === 0 ? 'A' : 'B';
    const pathList = pathsFor(tilesJson, tp.tile, tp.deg);
    if (pathList) {
      const other = pathExitOtherEnd(pathList, whIn, entryEdge);
      if (!other || other.length < 2) return null;
      const outW = other[0];
      const outE = other[1];
      const oidx = outW === 'A' ? 0 : 1;
      const oc = tc[oidx];
      curR = oc[0];
      curC = oc[1];
      exitDir = outE;
      continue;
    }
    const oi = [eci];
    for (let ci = 0; ci < tc.length; ci++) if (ci !== eci) oi.push(ci);
    let fe = false;
    for (let oii = 0; oii < oi.length; oii++) {
      const cii = oi[oii];
      const cR = tc[cii][0];
      const cC = tc[cii][1];
      const wh = cii === 0 ? 'A' : 'B';
      const ce = edgesFor(tilesJson, tp.tile, tp.deg, wh);
      for (let ei = 0; ei < ce.length; ei++) {
        const e = ce[ei];
        if (cR === nR && cC === nC && e === OPP[exitDir]) continue;
        const eR = cR + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
        const eC = cC + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
        if (eR < 0 || eR >= config.rows || eC < 0 || eC >= config.cols) continue;
        curR = cR;
        curC = cC;
        exitDir = e;
        fe = true;
        break;
      }
      if (fe) break;
    }
    if (!fe) return null;
  }
  return null;
}

/**
 * Single live edge on B for SH / ET at this anchor rotation (tiles-live-edges.json).
 */
function liveEdgeOnB(tilesJson, tileName, deg) {
  const rn = rotName(deg);
  const edges = tilesJson[tileName]?.[rn]?.B;
  if (!Array.isArray(edges) || edges.length !== 1) {
    throw new Error(`${tileName} ${rn}: expected exactly one B live edge`);
  }
  return edges[0];
}

function placementCells(shOrEt) {
  return targetCells(shOrEt.r, shOrEt.c, shOrEt.deg);
}

function bCell(shOrEt) {
  const cells = placementCells(shOrEt);
  return cells[1];
}

/**
 * @param { { r:number, c:number, deg:number } } SH  anchor on A
 * @param { { r:number, c:number, deg:number } } ET  anchor on A
 * @param {number} H rows
 * @param {number} W cols
 * @param {object} [tilesJson_] optional tile defs (default loads tiles-live-edges.json)
 */
function isViableSeed(SH, ET, H, W, tilesJson_) {
  const tilesJson = tilesJson_ || loadTilesJson();

  const shCells = placementCells(SH);
  const etCells = placementCells(ET);
  if (shCells.some(([x, y]) => x < 0 || x >= H || y < 0 || y >= W)) return false;
  if (etCells.some(([x, y]) => x < 0 || x >= H || y < 0 || y >= W)) return false;

  if (cellsOverlap(shCells, etCells)) return false;

  const bSh = bCell(SH);
  const bEt = bCell(ET);
  const manh = Math.abs(bSh[0] - bEt[0]) + Math.abs(bSh[1] - bEt[1]);
  if (manh === 1) {
    const edgeSh = liveEdgeOnB(tilesJson, 'SH', SH.deg);
    const edgeEt = liveEdgeOnB(tilesJson, 'ET', ET.deg);
    const towardEt = dirFromTo(bSh[0], bSh[1], bEt[0], bEt[1]);
    const towardSh = dirFromTo(bEt[0], bEt[1], bSh[0], bSh[1]);
    if (towardEt && towardSh && edgeSh === towardEt && edgeEt === towardSh) return false;
  }

  const board = [];
  for (let r = 0; r < H; r++) {
    board.push([]);
    for (let c = 0; c < W; c++) board[r].push(null);
  }
  const placedTiles = [];
  function placeTile(tile, r, c, deg, tid) {
    const cells = targetCells(r, c, deg);
    placedTiles.push({ id: tid, tile, r, c, deg });
    for (let ci = 0; ci < cells.length; ci++) {
      board[cells[ci][0]][cells[ci][1]] = {
        tile,
        deg,
        which: ci === 0 ? 'A' : 'B',
        tileId: tid,
      };
    }
  }
  placeTile('SH', SH.r, SH.c, SH.deg, 't0');
  placeTile('ET', ET.r, ET.c, ET.deg, 't1');

  const tip = getSnakeTip(tilesJson, board, placedTiles, { rows: H, cols: W });
  return tip != null;
}

/** Brute-force every anchor × rotation domino that fits on the board (no formulas). */
function bruteForceViableCount(H, W, tilesJson) {
  const tj = tilesJson || loadTilesJson();
  const degs = [0, 90, 180, 270];
  const placements = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      for (let di = 0; di < degs.length; di++) {
        const deg = degs[di];
        const cells = targetCells(r, c, deg);
        if (cells.some(([x, y]) => x < 0 || x >= H || y < 0 || y >= W)) continue;
        placements.push({ r, c, deg });
      }
    }
  }

  let viable = 0;
  let orderedPairs = 0;
  for (let si = 0; si < placements.length; si++) {
    const SH = placements[si];
    for (let ei = 0; ei < placements.length; ei++) {
      const ET = placements[ei];
      orderedPairs++;
      if (isViableSeed(SH, ET, H, W, tj)) viable++;
    }
  }

  return { viable, orderedPairs, placementsLen: placements.length };
}

module.exports = {
  isViableSeed,
  bruteForceViableCount,
  targetCells,
  loadTilesJson,
};

if (require.main === module) {
  /** 5x6 catalog board: rows=6, cols=5 */
  const H = 6;
  const W = 5;
  const tj = loadTilesJson();
  const { viable, orderedPairs, placementsLen } = bruteForceViableCount(H, W, tj);
  console.error(`Brute-force grid rows=${H} cols=${W}: placements each=${placementsLen}, ordered pairs=${orderedPairs}`);
  console.log(String(viable));
}
