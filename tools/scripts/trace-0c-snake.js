#!/usr/bin/env node
/**
 * Trace snake-tip walk on a canonical 0C solve; find matching SH/ET seed index.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const id = process.argv[2] || '5x6-0C-AAN';

const tilesJson = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/tiles/tiles-live-edges.json'), 'utf8')
);
const solveDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'solves', `${id}.json`), 'utf8'));
const canon = solveDoc.solutions[0].placements;
const rows = solveDoc.board?.rows ?? 6;
const cols = solveDoc.board?.cols ?? 5;

const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

function rotName(deg) {
  const r = ((deg % 360) + 360) % 360;
  return r === 0 ? 'r0' : r === 90 ? 'r90' : r === 180 ? 'r180' : 'r270';
}

function targetCells(r, c, deg) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function edgesFor(tn, deg, wh) {
  return tilesJson[tn]?.[rotName(deg)]?.[wh] || [];
}

function pathsFor(tn, deg) {
  const p = tilesJson[tn]?.[rotName(deg)]?.paths;
  return Array.isArray(p) && p.length ? p : null;
}

function pathExitOtherEnd(paths, which, entryEdge) {
  for (const pathObj of paths) {
    const ends = pathObj.ends;
    if (!ends || ends.length !== 2) continue;
    if (ends[0][0] === which && ends[0][1] === entryEdge) return ends[1];
    if (ends[1][0] === which && ends[1][1] === entryEdge) return ends[0];
  }
  return null;
}

function getSnakeTip(board, placedTiles, config) {
  let endpoint = placedTiles.find((t) => t.tile.indexOf('SH') >= 0);
  if (!endpoint) endpoint = placedTiles.find((t) => t.tile.indexOf('ET') >= 0);
  if (!endpoint) return null;
  const epCells = targetCells(endpoint.r, endpoint.c, endpoint.deg);
  let startR = null;
  let startC = null;
  let startEdge = null;
  for (let i = 0; i < epCells.length; i++) {
    const [rr, cc] = epCells[i];
    const wh = i === 0 ? 'A' : 'B';
    for (const e of edgesFor(endpoint.tile, endpoint.deg, wh)) {
      startR = rr;
      startC = cc;
      startEdge = e;
    }
  }
  if (startR === null) return null;
  const vis = new Set(epCells.map((c) => `${c[0]},${c[1]}`));
  const pathVis = new Set();
  let curR = startR;
  let curC = startC;
  let exitDir = startEdge;
  const trace = [];
  for (let iter = 0; iter < 200; iter++) {
    const nR = curR + (exitDir === 'N' ? -1 : exitDir === 'S' ? 1 : 0);
    const nC = curC + (exitDir === 'W' ? -1 : exitDir === 'E' ? 1 : 0);
    if (nR < 0 || nR >= config.rows || nC < 0 || nC >= config.cols) {
      trace.push(`iter ${iter}: off-board from (${curR},${curC}) ${exitDir}`);
      return { fail: trace };
    }
    const nc = board[nR][nC];
    if (!nc) {
      return { needR: nR, needC: nC, neededEdge: OPP[exitDir], steps: iter, trace };
    }
    const ne = edgesFor(nc.tile, nc.deg, nc.which);
    if (!ne.includes(OPP[exitDir])) {
      trace.push(`edge mismatch at (${nR},${nC}) need ${OPP[exitDir]} have ${ne.join('')}`);
      return { fail: trace };
    }
    const ck = `${nR},${nC}`;
    const tp = placedTiles.find((t) =>
      targetCells(t.r, t.c, t.deg).some((cell) => cell[0] === nR && cell[1] === nC)
    );
    if (!tp) return { fail: ['no placed tile'] };
    const tc = targetCells(tp.r, tp.c, tp.deg);
    const eci = tc.findIndex((cell) => cell[0] === nR && cell[1] === nC);
    const entryEdge = OPP[exitDir];
    const whIn = eci === 0 ? 'A' : 'B';
    const pathList = pathsFor(tp.tile, tp.deg);
    if (pathList) {
      const pvk = `${ck}:${entryEdge}`;
      if (pathVis.has(pvk)) {
        trace.push(`path re-entry ${pvk} on ${tp.tile}`);
        return { fail: trace };
      }
      pathVis.add(pvk);
      const other = pathExitOtherEnd(pathList, whIn, entryEdge);
      if (!other) {
        trace.push(`no path exit ${tp.tile} ${whIn} ${entryEdge}`);
        return { fail: trace };
      }
      const oidx = other[0] === 'A' ? 0 : 1;
      curR = tc[oidx][0];
      curC = tc[oidx][1];
      exitDir = other[1];
      trace.push(`via ${tp.tile}@${tp.r},${tp.c} -> (${curR},${curC}) ${exitDir}`);
      continue;
    }
    if (vis.has(ck)) {
      trace.push(`revisit (${nR},${nC})`);
      return { fail: trace };
    }
    vis.add(ck);
    const oi = [eci];
    for (let ci = 0; ci < tc.length; ci++) if (ci !== eci) oi.push(ci);
    let fe = false;
    for (const cii of oi) {
      const [cR, cC] = tc[cii];
      const wh = cii === 0 ? 'A' : 'B';
      for (const e of edgesFor(tp.tile, tp.deg, wh)) {
        if (cR === nR && cC === nC && e === OPP[exitDir]) continue;
        const eR = cR + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
        const eC = cC + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
        if (eR < 0 || eR >= config.rows || eC < 0 || eC >= config.cols) continue;
        const targetCell = board[eR][eC];
        if (targetCell && pathsFor(targetCell.tile, targetCell.deg)) {
          // ok
        } else if (vis.has(`${eR},${eC}`)) continue;
        curR = cR;
        curC = cC;
        exitDir = e;
        fe = true;
        break;
      }
      if (fe) break;
    }
    if (!fe) {
      trace.push(`dead end at (${nR},${nC}) tile ${tp.tile}`);
      return { fail: trace };
    }
  }
  return { fail: ['max iter'] };
}

function buildBoard(placements) {
  const board = Array.from({ length: rows }, () => Array(cols).fill(null));
  const placed = placements.map((p, i) => ({ id: `t${i}`, ...p }));
  for (const t of placed) {
    const cells = targetCells(t.r, t.c, t.deg);
    for (let i = 0; i < cells.length; i++) {
      const [rr, cc] = cells[i];
      board[rr][cc] = { tile: t.tile, deg: t.deg, which: i === 0 ? 'A' : 'B' };
    }
  }
  return { board, placed };
}

// Full board tip should be null for complete snake - actually walk until dead
const full = buildBoard(canon);
const tipFull = getSnakeTip(full.board, full.placed, { rows, cols });
console.log(`\n${id} full board (${canon.length} tiles):`);
console.log(tipFull.needR != null ? `OPEN TIP: (${tipFull.needR},${tipFull.needC}) need ${tipFull.neededEdge}` : `walk ended: ${JSON.stringify(tipFull.fail?.slice(-3))}`);

const sh = canon.find((p) => p.tile === 'SH');
const et = canon.find((p) => p.tile === 'ET');
console.log(`SH (${sh.r},${sh.c}) d${sh.deg}  ET (${et.r},${et.c}) d${et.deg}`);

// Seed index
function allSeeds() {
  const out = [];
  const names = Object.keys(tilesJson).filter((n) => !n.startsWith('_'));
  for (const shn of names.filter((n) => n.includes('SH'))) {
    for (const etn of names.filter((n) => n.includes('ET'))) {
      for (let sr = 0; sr < rows; sr++) {
        for (let sc = 0; sc < cols; sc++) {
          for (let sd = 0; sd < 4; sd++) {
            const shCells = targetCells(sr, sc, sd * 90);
            if (shCells.some(([r, c]) => r < 0 || r >= rows || c < 0 || c >= cols)) continue;
            for (let er = 0; er < rows; er++) {
              for (let ec = 0; ec < cols; ec++) {
                for (let ed = 0; ed < 4; ed++) {
                  const etCells = targetCells(er, ec, ed * 90);
                  if (etCells.some(([r, c]) => r < 0 || r >= rows || c < 0 || c >= cols)) continue;
                  const overlap = shCells.some(([r, c]) =>
                    etCells.some(([r2, c2]) => r === r2 && c === c2)
                  );
                  if (overlap) continue;
                  out.push([
                    { tile: shn, r: sr, c: sc, deg: sd * 90 },
                    { tile: etn, r: er, c: ec, deg: ed * 90 },
                  ]);
                }
              }
            }
          }
        }
      }
    }
  }
  return out;
}

const seeds = allSeeds();
const idx = seeds.findIndex(
  (pair) =>
    pair[0].r === sh.r &&
    pair[0].c === sh.c &&
    pair[0].deg === sh.deg &&
    pair[1].r === et.r &&
    pair[1].c === et.c &&
    pair[1].deg === et.deg
);
console.log(`canonical seed index: ${idx} / ${seeds.length}`);

// SH+ET only
const seedOnly = buildBoard([sh, et]);
const tipSeed = getSnakeTip(seedOnly.board, seedOnly.placed, { rows, cols });
console.log(
  `SH+ET only tip: (${tipSeed.needR},${tipSeed.needC}) need ${tipSeed.neededEdge} after ${tipSeed.steps} steps`
);
