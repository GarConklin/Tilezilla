#!/usr/bin/env node
/**
 * Exhaustive enumerator for single-snake levels using data/tiles/tiles-live-edges.json only.
 * Catalog blockers: single-cell B1 only (fixed cells from level.blockers; no rotation; no live edges).
 * (standard live-edge tile defs — not wtiles / wide tileset).
 *
 * Tile bag is taken only from the level entry. CR/CT/CQ use explicit path wiring from JSON.
 * pathMode multi / second-snake is not implemented — one SH, one ET.
 * Square boards: solutions deduped up to 90° rotation (C4). Non-square: half-turn only (180°).
 *
 * Usage (repo root). Prefer Docker so runs match CI / queue scripts:
 *   docker compose run --rm web node solves/solve-level.js 5x6-0A-AAA
 *   docker compose run --rm web node solves/solve-level.js 5x6-0A-AAA --compare solves/5x6-0A-AAA.json
 * Host Node (optional):
 *   node solves/solve-level.js 5x6-0A-AAA
 *   node solves/solve-level.js 5x6-0A-AAA --compare solves/5x6-0A-AAA.json
 *   With --compare: read-only vs the canonical solve file (never combined with --write-solves on that file).
 *   Exits 1 if canonical has MISSING layouts vs enumerator, enumerator finds EXTRA layouts, or hit --max-sol.
 *   Optional: --audit-report data/solver-runs/audit-....json — full enumerator output + compare stats for later review.
 *   node solves/solve-level.js --spec solves/spec-5x6-0A-AAA-OB.json --equate OB=UT --compare solves/5x6-0A-AAA.json
 *
 * Docker (from directory with docker-compose.yml; . is mounted at /app):
 *   docker compose run --rm web node solves/solve-level.js 5x6-0A-AAA --json-summary --stream-solves-dir data/solver-runs/my-run
 *
 * Full sweep (no seed cap): omit --max-seeds (defaults to all SH/ET pairs).
 * Skip seeds where SH/ET fail overlap/kiss/viability (see solves/is-viable-seed.js):
 *   node solves/solve-level.js 5x6-0A-BEF --viable-seeds-only --only-viable-seed-index 42 --json-summary
 * Write full solve document (when totalUniqueSolutions > 0) to solves/<solvesFile> or a path:
 *   node solves/solve-level.js 5x6-0A-BEF --viable-seeds-only --write-solves
 *   … --write-solves data/solver-runs/my-run.json
 * Batch every 4x4 level in tiers 0A+0B (single-snake only):
 *   node solves/solve-level.js --batch-4x4
 * Summary counts only (omit placements): --batch-4x4 --batch-summary-only
 * Machine-readable summary only (small stdout JSON, no placements): --json-summary
 *
 * Persist each newly found unique layout immediately:
 *   --stream-solves-out path.ndjson     append one JSON line per layout (+ fsync)
 *   --stream-solves-dir path/to/base    one subfolder per level id, one file per layout:
 *       path/to/base/5x6-0A-AAA/solve-00000001.json …
 * (Use with or without --json-summary.) Disable fsync: --stream-solves-no-fsync
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { uniqueLayoutKey: fingerprintLayoutKey } = require(path.join(ROOT, 'tools/scripts/lib/layout-equivalence-key.js'));
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const { isViableSeed } = require('./is-viable-seed.js');
const { validateCompleteLayout } = require('../tools/scripts/validate-complete-layout.js');

function loadJson(relativePath) {
  const full = path.join(ROOT, relativePath.split('/').join(path.sep));
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

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

function makeSolver(tilesJson) {
  function edgesFor(tn, deg, wh) {
    const rn = rotName(deg);
    const t = tilesJson[tn];
    if (!t || !t[rn]) return [];
    return t[rn][wh] || [];
  }

  function pathsFor(tn, deg) {
    const rn = rotName(deg);
    const p = tilesJson[tn]?.[rn]?.paths;
    return Array.isArray(p) && p.length ? p : null;
  }

  /** Given entry on half-cell (which, entryEdge), return the other path end [whichOut, edgeOut]. */
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

  function getSnakeTip(board, placedTiles, config) {
    let endpoint = placedTiles.find((t) => t.tile.indexOf('SH') >= 0);
    if (!endpoint) endpoint = placedTiles.find((t) => t.tile.indexOf('ET') >= 0);
    if (!endpoint) return null;
    const epCells = targetCells(endpoint.r, endpoint.c, endpoint.deg);
    let startR = null;
    let startC = null;
    let startEdge = null;
    for (let i = 0; i < epCells.length; i++) {
      const rr = epCells[i][0];
      const cc = epCells[i][1];
      const wh = i === 0 ? 'A' : 'B';
      const edges = edgesFor(endpoint.tile, endpoint.deg, wh);
      for (let j = 0; j < edges.length; j++) {
        startR = rr;
        startC = cc;
        startEdge = edges[j];
      }
    }
    if (startR === null) return null;
    const vis = new Set();
    for (let k = 0; k < epCells.length; k++) vis.add(`${epCells[k][0]},${epCells[k][1]}`);
    const pathVis = new Set();
    let curR = startR;
    let curC = startC;
    let exitDir = startEdge;
    for (let iter = 0; iter < 200; iter++) {
      const nR = curR + (exitDir === 'N' ? -1 : exitDir === 'S' ? 1 : 0);
      const nC = curC + (exitDir === 'W' ? -1 : exitDir === 'E' ? 1 : 0);
      if (nR < 0 || nR >= config.rows || nC < 0 || nC >= config.cols) return null;
      const nc = board[nR][nC];
      if (!nc) return { needR: nR, needC: nC, neededEdge: OPP[exitDir] };
      const ne = edgesFor(nc.tile, nc.deg, nc.which);
      if (ne.indexOf(OPP[exitDir]) < 0) return null;
      const ck = `${nR},${nC}`;
      const tp = placedTiles.find((t) =>
        targetCells(t.r, t.c, t.deg).some((cell) => cell[0] === nR && cell[1] === nC)
      );
      if (!tp) return null;
      const tc = targetCells(tp.r, tp.c, tp.deg);
      const eci = tc.findIndex((cell) => cell[0] === nR && cell[1] === nC);
      const entryEdge = OPP[exitDir];
      const whIn = eci === 0 ? 'A' : 'B';
      const pathList = pathsFor(tp.tile, tp.deg);
      if (pathList) {
        const pvk = `${ck}:${entryEdge}`;
        if (pathVis.has(pvk)) return null;
        pathVis.add(pvk);
        const other = pathExitOtherEnd(pathList, whIn, entryEdge);
        if (!other || other.length < 2) return null;
        const oidx = other[0] === 'A' ? 0 : 1;
        curR = tc[oidx][0];
        curC = tc[oidx][1];
        exitDir = other[1];
        continue;
      }
      if (vis.has(ck)) return null;
      vis.add(ck);
      const oi = [eci];
      for (let ci = 0; ci < tc.length; ci++) if (ci !== eci) oi.push(ci);
      let fe = false;
      for (let oii = 0; oii < oi.length; oii++) {
        const cii = oi[oii];
        const cR = tc[cii][0];
        const cC = tc[cii][1];
        const wh = cii === 0 ? 'A' : 'B';
        const ce = edgesFor(tp.tile, tp.deg, wh);
        for (let ei = 0; ei < ce.length; ei++) {
          const e = ce[ei];
          if (cR === nR && cC === nC && e === OPP[exitDir]) continue;
          const eR = cR + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const eC = cC + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (eR < 0 || eR >= config.rows || eC < 0 || eC >= config.cols) continue;
          const targetCell = board[eR][eC];
          if (targetCell && pathsFor(targetCell.tile, targetCell.deg)) {
            // path tile — re-entry handled via pathVis
          } else if (vis.has(`${eR},${eC}`)) {
            continue;
          }
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

  function solve(config, initial, levelTiles, maxSol, flags, maxIters, blockerCells, opts) {
    opts = opts || {};
    const onUniqueSolution =
      typeof opts.onUniqueSolution === 'function' ? opts.onUniqueSolution : null;
    let stopSearch = false;
    const board = [];
    for (let r = 0; r < config.rows; r++) {
      board.push([]);
      for (let c = 0; c < config.cols; c++) board[r].push(null);
    }
    const blockers = blockerCells || [];
    for (let bi = 0; bi < blockers.length; bi++) {
      const b = blockers[bi];
      board[b.r][b.c] = {
        tile: b.tile,
        deg: 0,
        which: 'A',
        tileId: `__blk_${bi}`,
      };
    }
    const remaining = {};
    for (const n of Object.keys(tilesJson)) {
      if (n.startsWith('_')) continue;
      remaining[n] = 0;
    }
    for (const tk of Object.keys(levelTiles)) {
      if (remaining[tk] !== undefined) remaining[tk] = levelTiles[tk];
    }
    const placedTiles = [];
    for (let pi = 0; pi < initial.length; pi++) {
      const p = initial[pi];
      const cells = targetCells(p.r, p.c, p.deg);
      const tid = `t${placedTiles.length}`;
      placedTiles.push({ id: tid, tile: p.tile, r: p.r, c: p.c, deg: p.deg });
      remaining[p.tile]--;
      for (let ci = 0; ci < cells.length; ci++) {
        board[cells[ci][0]][cells[ci][1]] = {
          tile: p.tile,
          deg: p.deg,
          which: ci === 0 ? 'A' : 'B',
          tileId: tid,
        };
      }
    }
    const solutions = [];
    const hashes = new Set();
    let iters = 0;

    function inBounds(r, c) {
      return r >= 0 && r < config.rows && c >= 0 && c < config.cols;
    }

    function canPlaceSimple(tn, r, c, deg) {
      if (!remaining[tn] || remaining[tn] <= 0) return false;
      const cells = targetCells(r, c, deg);
      for (let i = 0; i < cells.length; i++) {
        const rr = cells[i][0];
        const cc = cells[i][1];
        if (!inBounds(rr, cc)) return false;
        if (board[rr][cc] !== null) return false;
        const wh = i === 0 ? 'A' : 'B';
        const edges = edgesFor(tn, deg, wh);
        for (let j = 0; j < edges.length; j++) {
          const e = edges[j];
          const nr = rr + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const nc = cc + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (!inBounds(nr, nc)) return false;
        }
      }
      let hasLive = placedTiles.length === 0;
      const footprint = new Set(cells.map((x) => `${x[0]},${x[1]}`));
      for (let i = 0; i < cells.length; i++) {
        const rr = cells[i][0];
        const cc = cells[i][1];
        const wh = i === 0 ? 'A' : 'B';
        const our = edgesFor(tn, deg, wh);
        const dirs = [
          ['N', -1, 0],
          ['S', 1, 0],
          ['E', 0, 1],
          ['W', 0, -1],
        ];
        for (let di = 0; di < dirs.length; di++) {
          const d = dirs[di][0];
          const dr = dirs[di][1];
          const dc = dirs[di][2];
          const nr = rr + dr;
          const nc = cc + dc;
          if (!inBounds(nr, nc)) continue;
          const nb = board[nr][nc];
          if (!nb) continue;
          const ne = edgesFor(nb.tile, nb.deg, nb.which);
          const we = our.indexOf(d) >= 0;
          const nh = ne.indexOf(OPP[d]) >= 0;
          if (we !== nh) return false;
          if (we && nh) hasLive = true;
        }
      }
      if (!hasLive) return false;
      if (flags.isolatedCheck) {
        for (let i = 0; i < cells.length; i++) {
          const rr = cells[i][0];
          const cc = cells[i][1];
          const dirs2 = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ];
          for (let di = 0; di < dirs2.length; di++) {
            const nr = rr + dirs2[di][0];
            const nc = cc + dirs2[di][1];
            if (!inBounds(nr, nc)) continue;
            if (footprint.has(`${nr},${nc}`)) continue;
            if (board[nr][nc] !== null) continue;
            let hasEN = false;
            for (let di2 = 0; di2 < dirs2.length; di2++) {
              const nnr = nr + dirs2[di2][0];
              const nnc = nc + dirs2[di2][1];
              if (!inBounds(nnr, nnc)) continue;
              if (footprint.has(`${nnr},${nnc}`)) continue;
              if (board[nnr][nnc] === null) {
                hasEN = true;
                break;
              }
            }
            if (!hasEN) return false;
          }
        }
      }
      return true;
    }

    function place(tn, r, c, deg) {
      const cells = targetCells(r, c, deg);
      const tid = `t${placedTiles.length}`;
      placedTiles.push({ id: tid, tile: tn, r, c, deg });
      remaining[tn]--;
      for (let i = 0; i < cells.length; i++) {
        board[cells[i][0]][cells[i][1]] = {
          tile: tn,
          deg,
          which: i === 0 ? 'A' : 'B',
          tileId: tid,
        };
      }
    }

    function unplace() {
      const last = placedTiles.pop();
      remaining[last.tile]++;
      const cells = targetCells(last.r, last.c, last.deg);
      for (let i = 0; i < cells.length; i++) board[cells[i][0]][cells[i][1]] = null;
    }

    function wouldCreateHole(tn, r, c, deg) {
      if (!canPlaceSimple(tn, r, c, deg)) return true;
      place(tn, r, c, deg);
      const empties = [];
      for (let rr = 0; rr < config.rows; rr++)
        for (let cc = 0; cc < config.cols; cc++) if (board[rr][cc] === null) empties.push([rr, cc]);
      const key = (r, c) => `${r},${c}`;
      const emptySet = new Set(empties.map((e) => key(e[0], e[1])));

      if (flags.holeIsolated) {
        for (let ei = 0; ei < empties.length; ei++) {
          const rr = empties[ei][0];
          const cc = empties[ei][1];
          let has = false;
          const dirs = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ];
          for (let di = 0; di < dirs.length; di++) {
            if (emptySet.has(key(rr + dirs[di][0], cc + dirs[di][1]))) {
              has = true;
              break;
            }
          }
          if (!has) {
            unplace();
            return true;
          }
        }
      }

      if (flags.holeEven) {
        const vis = new Set();
        for (let ei = 0; ei < empties.length; ei++) {
          const sR = empties[ei][0];
          const sC = empties[ei][1];
          if (vis.has(key(sR, sC))) continue;
          const reg = [];
          const q = [[sR, sC]];
          vis.add(key(sR, sC));
          while (q.length > 0) {
            const cur = q.shift();
            reg.push(cur);
            const dirs = [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ];
            for (let di = 0; di < dirs.length; di++) {
              const nk = key(cur[0] + dirs[di][0], cur[1] + dirs[di][1]);
              if (emptySet.has(nk) && !vis.has(nk)) {
                vis.add(nk);
                q.push([cur[0] + dirs[di][0], cur[1] + dirs[di][1]]);
              }
            }
          }
          if (reg.length % 2 !== 0) {
            unplace();
            return true;
          }
        }
      }

      if (flags.holeConnectivity) {
        const tip = getSnakeTip(board, placedTiles, config);
        if (tip) {
          const etP = placedTiles.find((t) => t.tile.indexOf('ET') >= 0);
          if (etP) {
            const etCells = targetCells(etP.r, etP.c, etP.deg);
            let etEntry = null;
            for (let i = 0; i < etCells.length; i++) {
              const rr = etCells[i][0];
              const cc = etCells[i][1];
              const wh = i === 0 ? 'A' : 'B';
              const edges = edgesFor(etP.tile, etP.deg, wh);
              for (let j = 0; j < edges.length; j++) {
                const e = edges[j];
                const nr = rr + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
                const nc = cc + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
                if (inBounds(nr, nc)) {
                  etEntry = { r: nr, c: nc };
                  break;
                }
              }
              if (etEntry) break;
            }
            if (etEntry) {
              const entryOcc = board[etEntry.r][etEntry.c];
              if (!entryOcc) {
                const bVis = new Set([key(tip.needR, tip.needC)]);
                const bQ = [[tip.needR, tip.needC]];
                let reached = false;
                while (bQ.length > 0) {
                  const cur = bQ.shift();
                  if (cur[0] === etEntry.r && cur[1] === etEntry.c) {
                    reached = true;
                    break;
                  }
                  const dirs = [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                  ];
                  for (let di = 0; di < dirs.length; di++) {
                    const nr = cur[0] + dirs[di][0];
                    const nc = cur[1] + dirs[di][1];
                    if (!inBounds(nr, nc)) continue;
                    const nk = key(nr, nc);
                    if (bVis.has(nk)) continue;
                    if (board[nr][nc] === null) {
                      bVis.add(nk);
                      bQ.push([nr, nc]);
                    } else if (board[nr][nc].tile === 'DB') {
                      bVis.add(nk);
                      const dbP = placedTiles.find((t) => t.id === board[nr][nc].tileId);
                      if (dbP) {
                        const dbC = targetCells(dbP.r, dbP.c, dbP.deg);
                        for (let dci = 0; dci < dbC.length; dci++) {
                          const ok = key(dbC[dci][0], dbC[dci][1]);
                          if (ok !== nk && !bVis.has(ok)) {
                            bVis.add(ok);
                            const dirs2 = [
                              [-1, 0],
                              [1, 0],
                              [0, -1],
                              [0, 1],
                            ];
                            for (let di2 = 0; di2 < dirs2.length; di2++) {
                              const er = dbC[dci][0] + dirs2[di2][0];
                              const ec = dbC[dci][1] + dirs2[di2][1];
                              if (!inBounds(er, ec)) continue;
                              const ek = key(er, ec);
                              if (bVis.has(ek)) continue;
                              if (er === etEntry.r && ec === etEntry.c) {
                                reached = true;
                                break;
                              }
                              if (board[er][ec] === null) {
                                bVis.add(ek);
                                bQ.push([er, ec]);
                              }
                            }
                            if (reached) break;
                          }
                        }
                      }
                    }
                  }
                }
                if (!reached) {
                  unplace();
                  return true;
                }
              }
            }
          }
        }
      }
      unplace();
      return false;
    }

    function getOptions(tipR, tipC, neededEdge) {
      const opts = [];
      let tileNames = Object.keys(remaining).filter((n) => !n.startsWith('_') && remaining[n] > 0);
      let tilesLeft = 0;
      for (const k of Object.keys(remaining)) if (!k.startsWith('_')) tilesLeft += remaining[k];
      const etLeft = remaining.ET || 0;
      if (tilesLeft - etLeft > 0) tileNames = tileNames.filter((n) => n !== 'ET');
      for (let ti = 0; ti < tileNames.length; ti++) {
        const tn = tileNames[ti];
        for (let di = 0; di < 4; di++) {
          const deg = di * 90;
          const aE = edgesFor(tn, deg, 'A');
          if (aE.indexOf(neededEdge) >= 0 && canPlaceSimple(tn, tipR, tipC, deg)) {
            if (!flags.useHole || !wouldCreateHole(tn, tipR, tipC, deg))
              opts.push({ tile: tn, r: tipR, c: tipC, deg });
          }
          const bE = edgesFor(tn, deg, 'B');
          if (bE.indexOf(neededEdge) >= 0) {
            const rot = ((deg % 360) + 360) % 360;
            const aR = tipR + (rot === 90 ? -1 : rot === 270 ? 1 : 0);
            const aC = tipC + (rot === 0 ? -1 : rot === 180 ? 1 : 0);
            if (inBounds(aR, aC) && canPlaceSimple(tn, aR, aC, deg)) {
              if (!flags.useHole || !wouldCreateHole(tn, aR, aC, deg))
                opts.push({ tile: tn, r: aR, c: aC, deg });
            }
          }
        }
      }
      const seen = new Set();
      return opts.filter((o) => {
        const k = `${o.tile}|${o.r}|${o.c}|${o.deg}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    /** Dedup: position + tile kind + sorted live edges (tile kind avoids collisions between types). */
    function hashBoard() {
      const p = [];
      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          const cl = board[r][c];
          if (cl) {
            const e = edgesFor(cl.tile, cl.deg, cl.which).slice().sort().join('');
            p.push(`${r},${c}:${cl.tile}:${e}`);
          }
        }
      }
      return p.sort().join('|');
    }

    function dfs() {
      iters++;
      if (stopSearch || iters > maxIters || (!onUniqueSolution && solutions.length >= maxSol)) return;
      let tl = 0;
      for (const k of Object.keys(remaining)) if (!k.startsWith('_')) tl += remaining[k];
      if (tl === 0) {
        const pl = placedTiles.map((t) => ({ tile: t.tile, r: t.r, c: t.c, deg: t.deg }));
        const layoutOk = validateCompleteLayout({
          rows: config.rows,
          cols: config.cols,
          placements: pl,
          tilesJson,
        });
        if (!layoutOk.ok) return;
        const h = hashBoard();
        if (!hashes.has(h)) {
          hashes.add(h);
          if (onUniqueSolution) {
            if (onUniqueSolution(pl)) stopSearch = true;
          } else {
            solutions.push(pl);
          }
        }
        return;
      }
      const tip = getSnakeTip(board, placedTiles, config);
      if (!tip) return;
      const placeOpts = getOptions(tip.needR, tip.needC, tip.neededEdge);
      for (let oi = 0; oi < placeOpts.length; oi++) {
        const o = placeOpts[oi];
        place(o.tile, o.r, o.c, o.deg);
        dfs();
        unplace();
        if (stopSearch || solutions.length >= maxSol || iters > maxIters) return;
      }
    }

    const t0 = Date.now();
    dfs();
    const sec = ((Date.now() - t0) / 1000).toFixed(2);
    return { solutions, iters, sec };
  }

  return { solve, edgesFor, targetCells, getSnakeTip };
}

function cellsOverlap(cellsA, cellsB) {
  const s = new Set(cellsA.map((x) => `${x[0]},${x[1]}`));
  for (let i = 0; i < cellsB.length; i++) if (s.has(`${cellsB[i][0]},${cellsB[i][1]}`)) return true;
  return false;
}

function cellsHitBlockedSet(cells, blockedSet) {
  if (!blockedSet || !blockedSet.size) return false;
  for (let i = 0; i < cells.length; i++) {
    if (blockedSet.has(`${cells[i][0]},${cells[i][1]}`)) return true;
  }
  return false;
}

/** Fixed catalog blockers: only single-cell B1 (optional third element "B1"; two ints alone = B1). */
function parseCatalogBlockers(blockers, rows, cols) {
  if (!blockers || !Array.isArray(blockers) || blockers.length === 0) {
    return { ok: true, cells: [] };
  }
  const cells = [];
  const seen = new Set();
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    if (!Array.isArray(b) || b.length < 2) {
      return { ok: false, reason: `invalid blocker entry: ${JSON.stringify(b)}` };
    }
    const r = b[0];
    const c = b[1];
    if (!Number.isInteger(r) || !Number.isInteger(c)) {
      return { ok: false, reason: `invalid blocker coordinates: ${JSON.stringify(b)}` };
    }
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      return { ok: false, reason: `blocker out of bounds (${r},${c}) for ${rows}x${cols}` };
    }
    const kind = b.length >= 3 ? String(b[2]) : 'B1';
    if (kind !== 'B1') {
      return { ok: false, reason: `blocker kind "${kind}" not supported (only B1 single-cell)` };
    }
    const key = `${r},${c}`;
    if (seen.has(key)) return { ok: false, reason: `duplicate blocker cell (${r},${c})` };
    seen.add(key);
    cells.push({ r, c, tile: 'B1' });
  }
  return { ok: true, cells };
}

function allSeeds(rows, cols, targetCellsFn, inBoundsFn, blockedSet) {
  const seeds = [];
  const degs = [0, 90, 180, 270];
  for (let sr = 0; sr < rows; sr++) {
    for (let sc = 0; sc < cols; sc++) {
      for (const sd of degs) {
        const shCells = targetCellsFn(sr, sc, sd);
        if (!shCells.every((cell) => inBoundsFn(cell[0], cell[1]))) continue;
        if (cellsHitBlockedSet(shCells, blockedSet)) continue;
        for (let er = 0; er < rows; er++) {
          for (let ec = 0; ec < cols; ec++) {
            for (const ed of degs) {
              const etCells = targetCellsFn(er, ec, ed);
              if (!etCells.every((cell) => inBoundsFn(cell[0], cell[1]))) continue;
              if (cellsOverlap(shCells, etCells)) continue;
              if (cellsHitBlockedSet(etCells, blockedSet)) continue;
              seeds.push([
                { tile: 'SH', r: sr, c: sc, deg: sd },
                { tile: 'ET', r: er, c: ec, deg: ed },
              ]);
            }
          }
        }
      }
    }
  }
  return seeds;
}

function canonicalSig(placements) {
  const norm = placements.map((p) => ({
    tile: p.tile,
    r: p.r,
    c: p.c,
    deg: ((p.deg % 360) + 360) % 360,
  }));
  norm.sort((a, b) =>
    a.r !== b.r ? a.r - b.r : a.c !== b.c ? a.c - b.c : a.tile !== b.tile ? a.tile.localeCompare(b.tile) : a.deg - b.deg
  );
  return JSON.stringify(norm);
}

/** Full-board 180° rotation (same convention as scripts/server.py progress helpers). */
function mirrorPlacements180(placements, rows, cols) {
  return placements.map((p) => ({
    tile: p.tile,
    r: rows - 1 - p.r,
    c: cols - 1 - p.c,
    deg: (((p.deg + 180) % 360) + 360) % 360,
  }));
}

/** Full-board 90° clockwise (square n×n only). Two applications equal half-turn. */
function rotatePlacements90CW(placements, n) {
  return placements.map((p) => ({
    tile: p.tile,
    r: p.c,
    c: n - 1 - p.r,
    deg: (((p.deg + 90) % 360) + 360) % 360,
  }));
}

/** One lexicographically smallest canonical signature among 0°/90°/180°/270° whole-board rotations (same layout). */
function rotationOrbitKey(placements, n) {
  let cur = placements;
  let best = canonicalSig(cur);
  for (let k = 0; k < 3; k++) {
    cur = rotatePlacements90CW(cur, n);
    const s = canonicalSig(cur);
    if (s < best) best = s;
  }
  return best;
}

/** Half-turn pair only (rectangles where only 180° maps the board to itself). */
function mirrorClassKey(placements, rows, cols) {
  const a = canonicalSig(placements);
  const b = canonicalSig(mirrorPlacements180(placements, rows, cols));
  return a < b ? a : b;
}

/** Unique layout: cell-edge fingerprints; C4 on squares, 180° on rectangles. */
function uniqueLayoutKey(placements, rows, cols, tilesJson) {
  return fingerprintLayoutKey(placements, rows, cols, tilesJson);
}

/** Rename tile ids before signing (e.g. OB→UT when comparing to canonical AAA file). */
function applyTileEquate(placements, equate) {
  if (!equate || !Object.keys(equate).length) return placements;
  return placements.map((p) => ({
    tile: equate[p.tile] !== undefined ? equate[p.tile] : p.tile,
    r: p.r,
    c: p.c,
    deg: p.deg,
  }));
}

function mirrorClassKeyEquated(placements, rows, cols, equate, tilesJson) {
  return uniqueLayoutKey(applyTileEquate(placements, equate), rows, cols, tilesJson);
}

function loadLevel(levelId) {
  const m = levelId.match(/^((?:\d+)x(?:\d+))-(\d+[A-Z])-/);
  if (!m) throw new Error(`Bad level id: ${levelId}`);
  const bucketPath = `data/levels/${m[1]}-${m[2]}.json`;
  const bucket = loadJson(bucketPath);
  const level = bucket.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`Level not found: ${levelId} in ${bucketPath}`);
  return level;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    batch4x4: false,
    batchSummaryOnly: false,
    spec: null,
    compare: null,
    equate: {},
    quiet: false,
    jsonSummary: false,
    maxSol: 500,
    maxSeeds: Infinity,
    maxItersPerSeed: 80_000_000,
    pruning: 'full',
    streamSolvesOut: null,
    streamSolvesDir: null,
    streamSolvesNoFsync: false,
    progressEvery: 500,
    progressOnJson: false,
    viableSeedsOnly: false,
    /** If set after --viable-seeds-only, enumerate only that SH/ET seed (0-based in viable list). */
    onlyViableSeedIndex: null,
    /** null | true (default solves/<level.solvesFile>) | string path */
    writeSolves: null,
    /** With --compare only: write JSON audit artifact (does not modify canonical solve). */
    auditReport: null,
  };
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-4x4') flags.batch4x4 = true;
    else if (args[i] === '--batch-summary-only') flags.batchSummaryOnly = true;
    else if (args[i] === '--quiet') flags.quiet = true;
    else if (args[i] === '--json-summary') flags.jsonSummary = true;
    else if (args[i] === '--spec' && args[i + 1]) flags.spec = args[++i];
    else if (args[i] === '--compare' && args[i + 1]) flags.compare = args[++i];
    else if (args[i] === '--audit-report' && args[i + 1]) flags.auditReport = args[++i];
    else if (args[i] === '--equate' && args[i + 1]) {
      const pair = args[++i].split('=');
      if (pair.length === 2) flags.equate[pair[0].trim()] = pair[1].trim();
    } else if (args[i] === '--max-sol' && args[i + 1]) flags.maxSol = parseInt(args[++i], 10);
    else if (args[i] === '--max-seeds' && args[i + 1]) flags.maxSeeds = parseInt(args[++i], 10);
    else if (args[i] === '--max-iters-seed' && args[i + 1])
      flags.maxItersPerSeed = parseInt(args[++i], 10);
    else if (args[i] === '--no-prune') flags.pruning = 'none';
    else if (args[i] === '--prune-isolated') flags.pruning = 'isolated';
    else if (args[i] === '--stream-solves-out' && args[i + 1]) flags.streamSolvesOut = args[++i];
    else if (args[i] === '--stream-solves-dir' && args[i + 1]) flags.streamSolvesDir = args[++i];
    else if (args[i] === '--stream-solves-no-fsync') flags.streamSolvesNoFsync = true;
    else if (args[i] === '--progress-every' && args[i + 1]) flags.progressEvery = Math.max(1, parseInt(args[++i], 10));
    else if (args[i] === '--progress-on-json') flags.progressOnJson = true;
    else if (args[i] === '--viable-seeds-only') flags.viableSeedsOnly = true;
    else if (args[i] === '--only-viable-seed-index' && args[i + 1])
      flags.onlyViableSeedIndex = parseInt(args[++i], 10);
    else if (args[i] === '--write-solves') {
      if (args[i + 1] && !args[i + 1].startsWith('-')) flags.writeSolves = args[++i];
      else flags.writeSolves = true;
    } else if (!args[i].startsWith('-')) positionals.push(args[i]);
  }
  const levelId = positionals[0] || null;
  return { levelId, flags };
}

function loadSpec(specRelativePath) {
  const full = path.isAbsolute(specRelativePath)
    ? specRelativePath
    : path.join(ROOT, specRelativePath.split('/').join(path.sep));
  const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (!doc.board || !doc.tiles) throw new Error(`Spec must include board and tiles: ${full}`);
  return doc;
}

/** Tile kinds this enumerator cannot model yet. */
function unsupportedTileReasons(levelTiles, tilesJson) {
  const reasons = [];
  for (const [k, n] of Object.entries(levelTiles || {})) {
    if (!n || n <= 0) continue;
    const def = tilesJson[k];
    if (!def) {
      reasons.push(`unknown:${k}`);
      continue;
    }
    // Single-cell tiles such as E1/E2 are valid and supported by the solver.
  }
  return [...new Set(reasons)];
}

function buildPruneFlags(pruning) {
  if (pruning === 'none') {
    return {
      isolatedCheck: false,
      holeIsolated: false,
      holeEven: false,
      holeConnectivity: false,
      useHole: false,
    };
  }
  if (pruning === 'isolated') {
    return {
      isolatedCheck: true,
      holeIsolated: false,
      holeEven: false,
      holeConnectivity: false,
      useHole: false,
    };
  }
  return {
    isolatedCheck: true,
    holeIsolated: true,
    holeEven: true,
    holeConnectivity: true,
    useHole: true,
  };
}

/**
 * Exhaustive SH×ET seeds × DFS; merges unique layouts (C4 on squares, half-turn on rectangles).
 */
function safeLevelDirName(labelTag) {
  return String(labelTag).replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '_') || 'level';
}

function writeStreamedLayout(
  streamLevelDir,
  streamFd,
  labelTag,
  idx,
  placements,
  streamSolvesNoFsync
) {
  if (streamLevelDir != null) {
    const solvePath = path.join(streamLevelDir, `solve-${String(idx).padStart(8, '0')}.json`);
    const solveFd = fs.openSync(solvePath, 'w');
    try {
      const body = JSON.stringify(
        {
          id: `${labelTag}-solve-${String(idx).padStart(8, '0')}`,
          label: `Solve ${idx}`,
          placements,
          levelId: labelTag,
          index: idx,
        },
        null,
        2
      );
      fs.writeSync(solveFd, body, 'utf8');
      if (!streamSolvesNoFsync) fs.fsyncSync(solveFd);
    } finally {
      fs.closeSync(solveFd);
    }
  }
  if (streamFd != null) {
    const rec = {
      id: `${labelTag}-solve-${String(idx).padStart(8, '0')}`,
      label: `Solve ${idx}`,
      placements,
      levelId: labelTag,
      index: idx,
    };
    fs.writeSync(streamFd, `${JSON.stringify(rec)}\n`, 'utf8');
    if (!streamSolvesNoFsync) fs.fsyncSync(streamFd);
  }
}

function solutionsFromStreamDir(streamLevelDir, labelTag) {
  if (!streamLevelDir || !fs.existsSync(streamLevelDir)) return [];
  const files = fs
    .readdirSync(streamLevelDir)
    .filter((f) => /^solve-\d+\.json$/.test(f))
    .sort();
  return files.map((f, i) => {
    const doc = JSON.parse(fs.readFileSync(path.join(streamLevelDir, f), 'utf8'));
    return {
      id: `solve-${i + 1}`,
      label: `${labelTag} solver ${i + 1}`,
      placements: doc.placements,
    };
  });
}

function performEnumeration(level, labelTag, flags, tilesJson, solve, targetCells) {
  const rows = level.board.rows;
  const cols = level.board.cols;
  const cfg = { rows, cols };
  const levelTiles = level.tiles;

  const blockerParse = parseCatalogBlockers(level.blockers, rows, cols);
  if (!blockerParse.ok) {
    throw new Error(`[solve-level] ${labelTag}: ${blockerParse.reason}`);
  }
  const blockerCells = blockerParse.cells;
  const blockedSet = new Set(blockerCells.map((b) => `${b.r},${b.c}`));

  let streamLevelDir = null;
  if (flags.streamSolvesDir) {
    const streamBase = path.isAbsolute(flags.streamSolvesDir)
      ? flags.streamSolvesDir
      : path.join(ROOT, flags.streamSolvesDir.split('/').join(path.sep));
    streamLevelDir = path.join(streamBase, safeLevelDirName(labelTag));
    fs.mkdirSync(streamLevelDir, { recursive: true });
    const metaPath = path.join(streamLevelDir, '_meta.json');
    const metaFd = fs.openSync(metaPath, 'w');
    try {
      const metaBody = JSON.stringify(
        {
          type: 'stream-solves-dir-v1',
          levelId: labelTag,
          board: { rows, cols },
          tiles: levelTiles,
          blockers: blockerCells,
          startedAt: new Date().toISOString(),
        },
        null,
        2
      );
      fs.writeSync(metaFd, metaBody, 'utf8');
      if (!flags.streamSolvesNoFsync) fs.fsyncSync(metaFd);
    } finally {
      fs.closeSync(metaFd);
    }
    if (!flags.jsonSummary) {
      console.error(
        `[solve-level] writing each new layout to ${streamLevelDir}/solve-########.json (fsync=${!flags.streamSolvesNoFsync})`
      );
    }
  }

  let streamFd = null;
  if (flags.streamSolvesOut) {
    const streamPath = path.isAbsolute(flags.streamSolvesOut)
      ? flags.streamSolvesOut
      : path.join(ROOT, flags.streamSolvesOut.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(streamPath), { recursive: true });
    streamFd = fs.openSync(streamPath, 'a');
    fs.writeSync(
      streamFd,
      `${JSON.stringify({
        type: 'stream-solves-v1',
        levelId: labelTag,
        board: { rows, cols },
        blockers: blockerCells,
        startedAt: new Date().toISOString(),
      })}\n`,
      'utf8'
    );
    if (!flags.streamSolvesNoFsync) fs.fsyncSync(streamFd);
    if (!flags.jsonSummary) {
      console.error(`[solve-level] streaming each new unique layout to ${streamPath} (fsync=${!flags.streamSolvesNoFsync})`);
    }
  }

  function inBounds(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  const pruneFlags = buildPruneFlags(flags.pruning);
  let seeds = allSeeds(rows, cols, targetCells, inBounds, blockedSet);
  const seedsAllDomino = seeds.length;
  if (flags.viableSeedsOnly) {
    seeds = seeds.filter((pair) => {
      const sh = pair[0];
      const et = pair[1];
      return isViableSeed({ r: sh.r, c: sh.c, deg: sh.deg }, { r: et.r, c: et.c, deg: et.deg }, rows, cols, tilesJson);
    });
  }
  const viableSeedsAfterFilter = seeds.length;
  if (flags.onlyViableSeedIndex != null) {
    if (!flags.viableSeedsOnly) {
      throw new Error('[solve-level] --only-viable-seed-index requires --viable-seeds-only');
    }
    const ix = flags.onlyViableSeedIndex;
    if (!Number.isInteger(ix) || ix < 0 || ix >= seeds.length) {
      throw new Error(
        `[solve-level] --only-viable-seed-index ${ix} out of range 0..${seeds.length - 1} (${seeds.length} viable seeds)`
      );
    }
    seeds = [seeds[ix]];
  }
  const seedLimit = Math.min(seeds.length, flags.maxSeeds);

  if (!flags.jsonSummary) {
    console.error(`Level ${labelTag}  board ${rows}x${cols}  tiles from level JSON only  tileset data/tiles/tiles-live-edges.json`);
    console.error(
      `SH/ET seeds: ${seedLimit}/${seeds.length}${flags.viableSeedsOnly ? ` (from ${seedsAllDomino} domino pairs)` : ''}  pruning: ${flags.pruning}`
    );
  }

  const layoutSeen = new Set();
  const allSolutions = [];
  let uniqueCount = 0;
  let totalIters = 0;
  const useStreamLowMem = streamLevelDir != null;

  const solveOpts = useStreamLowMem
    ? {
        onUniqueSolution(placements) {
          const layoutKey = uniqueLayoutKey(placements, rows, cols, tilesJson);
          if (layoutSeen.has(layoutKey)) return false;
          layoutSeen.add(layoutKey);
          uniqueCount++;
          writeStreamedLayout(
            streamLevelDir,
            streamFd,
            labelTag,
            uniqueCount,
            placements,
            flags.streamSolvesNoFsync
          );
          return uniqueCount >= flags.maxSol;
        },
      }
    : undefined;

  try {
    for (let si = 0; si < seedLimit; si++) {
      const initial = seeds[si];
      const remainingSol = flags.maxSol - (useStreamLowMem ? uniqueCount : allSolutions.length);
      const res = solve(
        cfg,
        initial,
        levelTiles,
        remainingSol,
        pruneFlags,
        flags.maxItersPerSeed,
        blockerCells,
        solveOpts
      );
      totalIters += res.iters;
      if (!useStreamLowMem) {
        for (const sol of res.solutions) {
          const layoutKey = uniqueLayoutKey(sol, rows, cols, tilesJson);
          if (!layoutSeen.has(layoutKey)) {
            layoutSeen.add(layoutKey);
            allSolutions.push(sol);
            if (streamLevelDir != null) {
              writeStreamedLayout(
                streamLevelDir,
                streamFd,
                labelTag,
                allSolutions.length,
                sol,
                flags.streamSolvesNoFsync
              );
            } else if (streamFd != null) {
              writeStreamedLayout(
                null,
                streamFd,
                labelTag,
                allSolutions.length,
                sol,
                flags.streamSolvesNoFsync
              );
            }
          }
          if (allSolutions.length >= flags.maxSol) break;
        }
      }
      const countNow = useStreamLowMem ? uniqueCount : allSolutions.length;
      if (countNow >= flags.maxSol) break;
      if ((!flags.jsonSummary || flags.progressOnJson) && (si + 1) % flags.progressEvery === 0) {
        const progressLine = ` Progress: seeds ${si + 1}/${seedLimit}, unique layouts ${countNow}, iters ${totalIters}\n`;
        try {
          fs.writeSync(2, progressLine);
        } catch {
          console.error(progressLine.trimEnd());
        }
      }
    }
  } finally {
    if (streamFd != null) {
      try {
        fs.closeSync(streamFd);
      } catch {
        /* ignore */
      }
      streamFd = null;
    }
  }

  const finalCount = useStreamLowMem ? uniqueCount : allSolutions.length;
  const out = {
    board: { rows, cols, cells: rows * cols },
    tileSet: 'tiles-live-edges.json',
    tiles: levelTiles,
    totalUniqueSolutions: finalCount,
    solverMeta: {
      seedsTotal: flags.onlyViableSeedIndex != null ? viableSeedsAfterFilter : seeds.length,
      seedsUsed: seedLimit,
      seedsDominoNonOverlap: seedsAllDomino,
      ...(flags.viableSeedsOnly ? { viableSeedsOnly: true } : {}),
      ...(flags.onlyViableSeedIndex != null
        ? { onlyViableSeedIndex: flags.onlyViableSeedIndex, viableSeedsAfterFilter }
        : {}),
      totalIters,
      pruning: flags.pruning,
      ...(blockerCells.length ? { catalogBlockersB1: blockerCells.map((b) => [b.r, b.c]) } : {}),
      enumerateNote:
        rows === cols
          ? 'tiles-live-edges + level bag; single SH/ET; dedupe square layouts up to 90° rotation (C4)'
          : 'tiles-live-edges + level bag; single SH/ET; dedupe half-turn (180°) only',
      ...(useStreamLowMem ? { streamSolvesDir: streamLevelDir } : {}),
    },
    solutions: useStreamLowMem
      ? []
      : allSolutions.map((pl, i) => ({
          id: `solve-${i + 1}`,
          label: `${labelTag} solver ${i + 1}`,
          placements: pl,
        })),
  };

  return {
    out,
    rows,
    cols,
    allSolutions: useStreamLowMem ? [] : allSolutions,
    seedsLength: seeds.length,
    streamLevelDir,
  };
}

function runBatch4x4(flags, tilesJson, solve, targetCells) {
  const buckets = [
    { tier: '0A', path: 'data/levels/4x4-0A.json' },
    { tier: '0B', path: 'data/levels/4x4-0B.json' },
  ];
  const batchFlags = {
    ...flags,
    maxSeeds: flags.maxSeeds,
    maxSol: Math.max(flags.maxSol, 50000),
  };

  const report = {
    schema: 'batch-4x4-enumeration-v2',
    note:
      'Every single-snake 4x4 level in 0A+0B; full SH×ET seeds unless --max-seeds set. Rows include level tiles multiset; solutions deduped up to 90° rotation (C4) unless --batch-summary-only. CR/CT/CQ path routing matches tiles-live-edges paths[]. Single-cell tiles (E1/E2) still unsupported.',
    generatedAt: new Date().toISOString(),
    pruning: flags.pruning,
    maxSolCap: batchFlags.maxSol,
    batchSummaryOnly: flags.batchSummaryOnly,
    results: [],
  };

  let idx = 0;
  for (const b of buckets) {
    const doc = loadJson(b.path);
    for (const level of doc.levels || []) {
      idx++;
      const id = level.id;
      if (level.board.rows !== 4 || level.board.cols !== 4) {
        report.results.push({ id, tiles: level.tiles, skipped: 'not-4x4-board' });
        continue;
      }
      if (level.pathMode && level.pathMode !== 'single') {
        report.results.push({ id, tiles: level.tiles, skipped: 'pathMode-not-single', pathMode: level.pathMode });
        continue;
      }
      const unsup = unsupportedTileReasons(level.tiles, tilesJson);
      if (unsup.length) {
        report.results.push({ id, tiles: level.tiles, skipped: 'unsupported-tiles', reasons: unsup });
        continue;
      }
      const bp = parseCatalogBlockers(level.blockers, level.board.rows, level.board.cols);
      if (!bp.ok) {
        report.results.push({ id, tiles: level.tiles, skipped: 'unsupported-blockers', detail: bp.reason });
        continue;
      }
      console.error(`[batch ${idx}] ${id} …`);
      const { out } = performEnumeration(level, id, batchFlags, tilesJson, solve, targetCells);
      const row = {
        id,
        tier: b.tier,
        tiles: level.tiles,
        totalUniqueSolutions: out.totalUniqueSolutions,
        seedsTotal: out.solverMeta.seedsTotal,
        seedsUsed: out.solverMeta.seedsUsed,
        totalIters: out.solverMeta.totalIters,
      };
      if (!flags.batchSummaryOnly) row.solutions = out.solutions;
      report.results.push(row);
    }
  }

  const outPath = path.join(ROOT, 'solves', 'reports', 'batch-4x4-0A-0B.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.error(`Wrote ${outPath} (${report.results.length} rows)`);
}

function main() {
  const { levelId, flags } = parseArgs(process.argv);

  if (flags.compare && flags.writeSolves != null) {
    console.error(
      '[solve-level] --compare is read-only against the canonical solve; ignoring --write-solves (no overwrite).'
    );
    flags.writeSolves = null;
  }
  if (flags.auditReport && !flags.compare) {
    console.error('[solve-level] --audit-report requires --compare.');
    process.exit(1);
  }

  const tilesPath = 'data/tiles/tiles-live-edges.json';
  const tilesJson = loadJson(tilesPath);
  const { solve, targetCells } = makeSolver(tilesJson);

  if (flags.batch4x4) {
    runBatch4x4(flags, tilesJson, solve, targetCells);
    return;
  }

  if (!levelId && !flags.spec) {
    console.error(
      'Usage: node solves/solve-level.js <level-id> | --spec solves/spec.json | --batch-4x4 [--batch-summary-only] [--compare …] [--audit-report …] [--equate OB=UT]'
    );
    process.exit(1);
  }

  let level;
  let label;
  if (flags.spec) {
    level = loadSpec(flags.spec);
    label = level.id || flags.spec;
  } else {
    level = loadLevel(levelId);
    label = levelId;
  }
  if (level.pathMode && level.pathMode !== 'single') {
    console.error('This enumerator only supports single-snake levels (pathMode single).');
    process.exit(1);
  }

  const unsup = unsupportedTileReasons(level.tiles, tilesJson);
  if (unsup.length) {
    console.error(`Unsupported tiles for this enumerator: ${unsup.join(', ')}`);
    process.exit(1);
  }

  const { out, rows, cols, allSolutions } = performEnumeration(level, label, flags, tilesJson, solve, targetCells);
  const hitMaxSolCap = out.totalUniqueSolutions >= flags.maxSol;

  if (flags.writeSolves != null) {
    if (out.totalUniqueSolutions > 0) {
      const solvesFile = level.solvesFile || `${label}.json`;
      const defaultRel = path.join('solves', solvesFile);
      const outPath =
        flags.writeSolves === true
          ? path.join(ROOT, defaultRel.split('/').join(path.sep))
          : path.isAbsolute(flags.writeSolves)
            ? flags.writeSolves
            : path.join(ROOT, flags.writeSolves.split('/').join(path.sep));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const streamDir = out.solverMeta?.streamSolvesDir;
      const solutionsForDoc = streamDir
        ? solutionsFromStreamDir(streamDir, label)
        : out.solutions;
      const doc = {
        ...out,
        solutions: solutionsForDoc,
        levelId: label,
        generatedAt: new Date().toISOString(),
      };
      if (doc.solverMeta && doc.solverMeta.streamSolvesDir) {
        delete doc.solverMeta.streamSolvesDir;
      }
      fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
      console.error(`[solve-level] wrote ${out.totalUniqueSolutions} solution(s) to ${path.relative(ROOT, outPath)}`);
    } else {
      console.error('[solve-level] --write-solves: no solutions found; file not written');
    }
  }

  if (flags.jsonSummary) {
    console.log(
      JSON.stringify({
        id: label,
        totalUniqueSolutions: out.totalUniqueSolutions,
        hitMaxSolCap,
        maxSol: flags.maxSol,
        solverMeta: out.solverMeta,
      })
    );
  } else if (!flags.quiet) console.log(JSON.stringify(out, null, 2));

  if (flags.compare) {
    const compareResolved = path.isAbsolute(flags.compare)
      ? flags.compare
      : path.join(ROOT, flags.compare);
    const canon = JSON.parse(fs.readFileSync(compareResolved, 'utf8'));
    const canonSet = new Set(
      (canon.solutions || []).map((s) =>
        mirrorClassKeyEquated(s.placements || [], rows, cols, {}, tilesJson)
      )
    );
    const foundSet = new Set(
      allSolutions.map((pl) => mirrorClassKeyEquated(pl, rows, cols, flags.equate || {}, tilesJson))
    );
    let matched = 0;
    for (const s of canonSet) if (foundSet.has(s)) matched++;
    let missingCt = 0;
    let extraCt = 0;
    for (const s of canonSet) {
      if (!foundSet.has(s)) missingCt++;
    }
    for (const s of foundSet) {
      if (!canonSet.has(s)) extraCt++;
    }
    console.error(
      `Compare ${flags.compare}: canonical mirror-classes ${canonSet.size}, solver mirror-classes ${foundSet.size}, matched ${matched}`
    );
    for (const s of canonSet) {
      if (!foundSet.has(s)) console.error('  MISSING mirror-class vs canonical');
    }
    for (const s of foundSet) {
      if (!canonSet.has(s)) console.error('  EXTRA mirror-class vs canonical');
    }
    if (hitMaxSolCap) {
      console.error(
        '[solve-level] Compare may be incomplete: enumeration hit --max-sol cap. Raise --max-sol and rerun.'
      );
    }

    if (flags.auditReport) {
      const compareRelForAudit = path.relative(ROOT, compareResolved).split(path.sep).join('/');
      const auditOutAbs = path.isAbsolute(flags.auditReport)
        ? flags.auditReport
        : path.join(ROOT, flags.auditReport.split('/').join(path.sep));
      fs.mkdirSync(path.dirname(auditOutAbs), { recursive: true });
      const auditDoc = {
        schema: 'solve-level-compare-audit-v1',
        generatedAt: new Date().toISOString(),
        levelId: label,
        canonicalCompared: compareRelForAudit,
        equate: flags.equate,
        maxSol: flags.maxSol,
        hitMaxSolCap,
        enumeration: {
          board: out.board,
          tiles: out.tiles,
          tileSet: out.tileSet,
          totalUniqueSolutions: out.totalUniqueSolutions,
          solverMeta: out.solverMeta,
          solutions: out.solutions,
        },
        compare: {
          canonicalMirrorClasses: canonSet.size,
          enumeratorMirrorClasses: foundSet.size,
          matchedMirrorClasses: matched,
          missingVsCanonical: missingCt,
          extraVsCanonical: extraCt,
          agree: !hitMaxSolCap && missingCt === 0 && extraCt === 0,
        },
        note:
          'Review-only artifact. The canonical file under solves/ was not modified; merge any new layouts manually if desired.',
      };
      fs.writeFileSync(auditOutAbs, JSON.stringify(auditDoc, null, 2) + '\n', 'utf8');
      console.error(`[solve-level] compare audit written to ${path.relative(ROOT, auditOutAbs)}`);
    }

    if (hitMaxSolCap || missingCt > 0 || extraCt > 0) {
      process.exit(1);
    }
  }
}

main();
