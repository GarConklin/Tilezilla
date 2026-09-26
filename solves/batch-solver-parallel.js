#!/usr/bin/env node
/**
 * Parallel batch solver using worker_threads with per-combo timeout.
 * Supports --corners flag for large boards to restrict SH/ET to corner positions.
 *
 * One board size per run: `<rows> <cols>` for that grid only. (Neutral E1/B1/E2/B2 modes live in batch-solver.js, not here.)
 *
 * Usage:  node batch-solver-parallel.js <rows> <cols> [--workers N] [--timeout S] [--corners] [--advanced]
 */

const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ============================================================
// WORKER CODE
// ============================================================
if (!isMainThread) {
  const { ROWS, COLS, tilesJson, SH, ET, CORNERS_ONLY, BLOCKERS = [] } = workerData;
  const blockerSet = new Set(BLOCKERS.map(b => b[0] + "," + b[1]));

  const OPP = { N: "S", S: "N", E: "W", W: "E" };
  function rotName(d) { const r = ((d % 360) + 360) % 360; return r === 0 ? "r0" : r === 90 ? "r90" : r === 180 ? "r180" : "r270"; }
  function targetCells(r, c, d) { const rot = ((d % 360) + 360) % 360; if (rot === 0) return [[r, c], [r, c + 1]]; if (rot === 90) return [[r, c], [r + 1, c]]; if (rot === 180) return [[r, c], [r, c - 1]]; return [[r, c], [r - 1, c]]; }
  function edgesFor(tn, d, wh) { const rn = rotName(d); const t = tilesJson[tn]; if (!t || !t[rn]) return []; return t[rn][wh] || []; }

  class PuzzleSolver {
    constructor(rows, cols, tileCounts, timeoutMs, blockerList = BLOCKERS) {
      this.ROWS = rows; this.COLS = cols; this.board = []; this.remaining = {}; this.placedTiles = []; this.solutions = []; this.hashes = new Set(); this.maxSolutions = 200;
      this.timeoutMs = timeoutMs || 0;
      this.startTime = 0;
      this.dfsCount = 0;
      this.timedOut = false;
      for (let r = 0; r < rows; r++) { this.board.push([]); for (let c = 0; c < cols; c++) this.board[r].push(null); }
      // Mark blocker cells
      for (const [br, bc] of blockerList) this.board[br][bc] = { blocked: true };
      for (const [name, count] of Object.entries(tileCounts)) this.remaining[name] = count;
    }
    inBounds(r, c) { return r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS; }
    place(tn, r, c, d) { const cells = targetCells(r, c, d); const tid = "t" + this.placedTiles.length; this.placedTiles.push({ id: tid, tile: tn, r, c, deg: d }); this.remaining[tn]--; for (let i = 0; i < cells.length; i++) this.board[cells[i][0]][cells[i][1]] = { tile: tn, deg: d, which: i === 0 ? "A" : "B", tileId: tid }; }
    unplace() { const last = this.placedTiles.pop(); this.remaining[last.tile]++; const cells = targetCells(last.r, last.c, last.deg); for (let i = 0; i < cells.length; i++) this.board[cells[i][0]][cells[i][1]] = null; }

    canPlace(tn, r, c, deg) {
      if (!this.remaining[tn] || this.remaining[tn] <= 0) return false;
      const cells = targetCells(r, c, deg);
      for (let i = 0; i < cells.length; i++) { const [rr, cc] = cells[i]; if (!this.inBounds(rr, cc)) return false; if (this.board[rr][cc] !== null) return false;
        const wh = i === 0 ? "A" : "B"; const edges = edgesFor(tn, deg, wh); for (const e of edges) { const nr = rr + (e === "N" ? -1 : e === "S" ? 1 : 0), nc = cc + (e === "W" ? -1 : e === "E" ? 1 : 0); if (!this.inBounds(nr, nc)) return false; if (this.board[nr]?.[nc]?.blocked) return false; } }
      let hasLive = this.placedTiles.length === 0; const fp = new Set(cells.map(c => c[0] + "," + c[1]));
      for (let i = 0; i < cells.length; i++) { const [rr, cc] = cells[i]; const wh = i === 0 ? "A" : "B"; const our = edgesFor(tn, deg, wh);
        for (const [d, dr, dc] of [["N", -1, 0], ["S", 1, 0], ["E", 0, 1], ["W", 0, -1]]) { const nr = rr + dr, nc = cc + dc; if (!this.inBounds(nr, nc)) continue; const nb = this.board[nr][nc]; if (!nb || nb.blocked) continue;
          const ne = edgesFor(nb.tile, nb.deg, nb.which); const we = our.includes(d); const nh = ne.includes(OPP[d]); if (we !== nh) return false; if (we && nh) hasLive = true; } }
      if (!hasLive) return false;
      for (let i = 0; i < cells.length; i++) { const [rr, cc] = cells[i]; for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nr = rr + dr, nc = cc + dc; if (!this.inBounds(nr, nc)) continue; if (fp.has(nr + "," + nc)) continue; const nbc = this.board[nr]?.[nc]; if (nbc !== null) continue;
          let hasEN = false; for (const [dr2, dc2] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nnr = nr + dr2, nnc = nc + dc2; if (!this.inBounds(nnr, nnc)) continue; if (fp.has(nnr + "," + nnc)) continue; if (this.board[nnr]?.[nnc] === null) { hasEN = true; break; } } if (!hasEN) return false; } }
      return true;
    }

    wouldCreateHole(tn, r, c, deg) {
      if (!this.canPlace(tn, r, c, deg)) return true; this.place(tn, r, c, deg);
      const empties = []; for (let rr = 0; rr < this.ROWS; rr++) for (let cc = 0; cc < this.COLS; cc++) if (this.board[rr][cc] === null) empties.push([rr, cc]);
      const key = (r, c) => r + "," + c; const emptySet = new Set(empties.map(e => key(e[0], e[1])));
      for (const [rr, cc] of empties) { let has = false; for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { if (emptySet.has(key(rr + dr, cc + dc))) { has = true; break; } } if (!has) { this.unplace(); return true; } }
      const vis = new Set(); for (const [sR, sC] of empties) { if (vis.has(key(sR, sC))) continue; const reg = [], q = [[sR, sC]]; vis.add(key(sR, sC));
        while (q.length > 0) { const cur = q.shift(); reg.push(cur); for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nk = key(cur[0] + dr, cur[1] + dc); if (emptySet.has(nk) && !vis.has(nk)) { vis.add(nk); q.push([cur[0] + dr, cur[1] + dc]); } } }
        if (reg.length % 2 !== 0) { this.unplace(); return true; } }
      // ET reachability: can snake tip reach ET through empty cells?
      const tip = this.getSnakeTip();
      if (tip) {
        const etP = this.placedTiles.find(t => t.tile.includes("ET"));
        if (etP) {
          const etCells = targetCells(etP.r, etP.c, etP.deg); let etEntry = null;
          for (let i = 0; i < etCells.length; i++) { const wh = i === 0 ? "A" : "B"; const edges = edgesFor(etP.tile, etP.deg, wh);
            for (const e of edges) { const nr = etCells[i][0] + (e === "N" ? -1 : e === "S" ? 1 : 0), nc = etCells[i][1] + (e === "W" ? -1 : e === "E" ? 1 : 0);
              if (this.inBounds(nr, nc)) { etEntry = { r: nr, c: nc }; break; } } if (etEntry) break; }
          if (etEntry && !this.board[etEntry.r][etEntry.c]) {
            const bVis = new Set([key(tip.needR, tip.needC)]), bQ = [[tip.needR, tip.needC]]; let reached = false;
            while (bQ.length > 0 && !reached) {
              const cur = bQ.shift(); if (cur[0] === etEntry.r && cur[1] === etEntry.c) { reached = true; break; }
              for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nr = cur[0] + dr, nc = cur[1] + dc; if (!this.inBounds(nr, nc)) continue; const nk = key(nr, nc); if (bVis.has(nk)) continue;
                if (this.board[nr][nc] === null) { bVis.add(nk); bQ.push([nr, nc]); } } }
            if (!reached) { this.unplace(); return true; }
          }
        }
      }
      this.unplace(); return false;
    }

    getSnakeTip() {
      const sh = this.placedTiles.find(t => t.tile.includes("SH")); if (!sh) return null; const shCells = targetCells(sh.r, sh.c, sh.deg); let sR = null, sC = null, sE = null;
      for (let i = 0; i < shCells.length; i++) { const wh = i === 0 ? "A" : "B"; const edges = edgesFor(sh.tile, sh.deg, wh); for (const e of edges) { sR = shCells[i][0]; sC = shCells[i][1]; sE = e; } }
      if (sR === null) return null; const vis = new Set(shCells.map(c => c[0] + "," + c[1])); let curR = sR, curC = sC, exitDir = sE;
      for (let iter = 0; iter < 200; iter++) { const nR = curR + (exitDir === "N" ? -1 : exitDir === "S" ? 1 : 0), nC = curC + (exitDir === "W" ? -1 : exitDir === "E" ? 1 : 0);
        if (!this.inBounds(nR, nC)) return null; if (!this.board[nR][nC]) return { needR: nR, needC: nC, neededEdge: OPP[exitDir] };
        const nc = this.board[nR][nC]; if (!edgesFor(nc.tile, nc.deg, nc.which).includes(OPP[exitDir])) return null; const ck = nR + "," + nC; if (vis.has(ck)) return null; vis.add(ck);
        const tp = this.placedTiles.find(t => targetCells(t.r, t.c, t.deg).some(c => c[0] === nR && c[1] === nC)); if (!tp) return null;
        const tc2 = targetCells(tp.r, tp.c, tp.deg); const eci = tc2.findIndex(c => c[0] === nR && c[1] === nC); const order = [eci, ...tc2.map((_, i) => i).filter(i => i !== eci)]; let found = false;
        for (const cii of order) { const cR = tc2[cii][0], cC = tc2[cii][1], wh = cii === 0 ? "A" : "B"; const ce = edgesFor(tp.tile, tp.deg, wh);
          for (const e of ce) { if (cR === nR && cC === nC && e === OPP[exitDir]) continue; const eR = cR + (e === "N" ? -1 : e === "S" ? 1 : 0), eC = cC + (e === "W" ? -1 : e === "E" ? 1 : 0); if (!this.inBounds(eR, eC)) continue; curR = cR; curC = cC; exitDir = e; found = true; break; } if (found) break; }
        if (!found) return null; }
      return null;
    }

    getOptions(tipR, tipC, neededEdge) {
      const opts = []; let tileNames = Object.keys(this.remaining).filter(n => this.remaining[n] > 0);
      let tilesLeft = 0; for (const k in this.remaining) tilesLeft += this.remaining[k];
      if (tilesLeft - (this.remaining["ET-Snake-Tile.png"] || 0) > 0) tileNames = tileNames.filter(n => !n.includes("ET"));
      for (const tn of tileNames) { for (let di = 0; di < 4; di++) { const deg = di * 90;
          if (edgesFor(tn, deg, "A").includes(neededEdge) && this.canPlace(tn, tipR, tipC, deg)) { if (!this.wouldCreateHole(tn, tipR, tipC, deg)) opts.push({ tile: tn, r: tipR, c: tipC, deg }); }
          if (edgesFor(tn, deg, "B").includes(neededEdge)) { const rot = ((deg % 360) + 360) % 360; const aR = tipR + (rot === 90 ? -1 : rot === 270 ? 1 : 0), aC = tipC + (rot === 0 ? -1 : rot === 180 ? 1 : 0);
            if (this.inBounds(aR, aC) && this.canPlace(tn, aR, aC, deg)) { if (!this.wouldCreateHole(tn, aR, aC, deg)) opts.push({ tile: tn, r: aR, c: aC, deg }); } } } }
      const seen = new Set(); return opts.filter(o => { const k = o.tile + "|" + o.r + "|" + o.c + "|" + o.deg; if (seen.has(k)) return false; seen.add(k); return true; });
    }

    hash() { const p = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) { const cl = this.board[r][c]; if (cl) { const e = edgesFor(cl.tile, cl.deg, cl.which).slice().sort().join(""); p.push(r + "," + c + ":" + e); } } return p.join("|"); }

    checkTimeout() {
      if (this.timeoutMs <= 0) return false;
      this.dfsCount++;
      if (this.dfsCount % 500 === 0) {
        if (Date.now() - this.startTime > this.timeoutMs) { this.timedOut = true; return true; }
      }
      return false;
    }

    solve(initial) {
      this.startTime = Date.now();
      this.dfsCount = 0;
      this.timedOut = false;
      for (const p of initial) this.place(p.tile, p.r, p.c, p.deg);
      const dfs = () => {
        if (this.solutions.length >= this.maxSolutions) return;
        if (this.checkTimeout()) return;
        let tl = 0; for (const k in this.remaining) tl += this.remaining[k];
        if (tl === 0) { const h = this.hash(); if (!this.hashes.has(h)) { this.hashes.add(h); this.solutions.push(this.placedTiles.map(t => ({ tile: t.tile, r: t.r, c: t.c, deg: t.deg }))); } return; }
        const tip = this.getSnakeTip(); if (!tip) return; const opts = this.getOptions(tip.needR, tip.needC, tip.neededEdge);
        for (const o of opts) { this.place(o.tile, o.r, o.c, o.deg); dfs(); this.unplace(); if (this.solutions.length >= this.maxSolutions || this.timedOut) return; }
      };
      dfs(); return this.solutions;
    }
  }

  function isValidPlacement(rows, cols, tn, r, c, deg) { const cells = targetCells(r, c, deg); for (let i = 0; i < cells.length; i++) { const [cr, cc] = cells[i]; if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) return false; if (blockerSet.has(cr + "," + cc)) return false; const wh = i === 0 ? "A" : "B"; const edges = edgesFor(tn, deg, wh); for (const e of edges) { const nr = cr + (e === "N" ? -1 : e === "S" ? 1 : 0), nc = cc + (e === "W" ? -1 : e === "E" ? 1 : 0); if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false; if (blockerSet.has(nr + "," + nc)) return false; } } return true; }
  function overlaps(r1, c1, d1, r2, c2, d2) { const c1s = targetCells(r1, c1, d1), c2s = targetCells(r2, c2, d2); for (const a of c1s) for (const b of c2s) if (a[0] === b[0] && a[1] === b[1]) return true; return false; }
  function mirror180Hash(placements, rows, cols) { const ps = new PuzzleSolver(rows, cols, {}, 0); for (const p of placements) { const mr = rows - 1 - p.r, mc = cols - 1 - p.c, md = (p.deg + 180) % 360; const cells = targetCells(mr, mc, md); for (let i = 0; i < cells.length; i++) { const wh = i === 0 ? "A" : "B"; if (!ps.board[cells[i][0]][cells[i][1]]?.blocked) ps.board[cells[i][0]][cells[i][1]] = { tile: p.tile, deg: md, which: wh }; } } return ps.hash(); }

  function solveCombo(rows, cols, tiles, timeoutMs) {
    const allSolutions = [], allHashes = new Set();
    const comboStart = Date.now();

    // Build position lists based on CORNERS_ONLY flag
    const shPositions = [], etPositions = [];
    if (CORNERS_ONLY) {
      // Corners only for SH
      for (let r = 0; r < rows; r += rows - 1)
        for (let c = 0; c < cols; c += cols - 1)
          shPositions.push([r, c]);
      // Full edges for ET (corners + edges)
      for (let r = 0; r < rows; r += rows - 1)
        for (let c = 0; c < cols; c += cols - 1)
          etPositions.push([r, c]);
      for (let c = 1; c < cols - 1; c++) { etPositions.push([0, c]); etPositions.push([rows - 1, c]); }
      for (let r = 1; r < rows - 1; r++) { etPositions.push([r, 0]); etPositions.push([r, cols - 1]); }
    } else {
      // All edge positions for both
      for (let r = 0; r < rows; r += rows - 1)
        for (let c = 0; c < cols; c += cols - 1)
          shPositions.push([r, c]);
      for (let c = 1; c < cols - 1; c++) { shPositions.push([0, c]); shPositions.push([rows - 1, c]); }
      for (let r = 1; r < rows - 1; r++) { shPositions.push([r, 0]); shPositions.push([r, cols - 1]); }
      etPositions.push(...shPositions);
    }

    // Build unique SH placements
    const shPlacements = [], shSeen = new Set();
    for (const [sr, sc] of shPositions) {
      for (let sd = 0; sd < 4; sd++) {
        const sDeg = sd * 90; if (!isValidPlacement(rows, cols, SH, sr, sc, sDeg)) continue;
        const shCells = targetCells(sr, sc, sDeg);
        const shKey = shCells.map(cc => cc[0] + "," + cc[1]).sort().join("|") + ":" + edgesFor(SH, sDeg, "B").join("");
        if (shSeen.has(shKey)) continue; shSeen.add(shKey);
        shPlacements.push({ r: sr, c: sc, deg: sDeg });
      }
    }

    let timedOut = false;
    for (const sh of shPlacements) {
      if (timedOut) break;
      for (const [er, ec] of etPositions) {
        if (timedOut) break;
        for (let ed = 0; ed < 4; ed++) {
          if (timeoutMs > 0 && (Date.now() - comboStart) > timeoutMs) { timedOut = true; break; }
          const eDeg = ed * 90; if (!isValidPlacement(rows, cols, ET, er, ec, eDeg)) continue; if (overlaps(sh.r, sh.c, sh.deg, er, ec, eDeg)) continue;
          const solver = new PuzzleSolver(rows, cols, { ...tiles }, timeoutMs > 0 ? Math.max(1000, timeoutMs - (Date.now() - comboStart)) : 0);
          const initial = [{ tile: SH, r: sh.r, c: sh.c, deg: sh.deg }, { tile: ET, r: er, c: ec, deg: eDeg }];
          const sols = solver.solve(initial);
          if (solver.timedOut) { timedOut = true; break; }
          for (const sol of sols) {
            const ts = new PuzzleSolver(rows, cols, { ...tiles }, 0);
            for (const p of sol) ts.place(p.tile, p.r, p.c, p.deg);
            const h = ts.hash();
            if (!allHashes.has(h)) { const mh = mirror180Hash(sol, rows, cols); if (!allHashes.has(mh)) { allHashes.add(h); allHashes.add(mh); allSolutions.push(sol); } }
          }
          if (allSolutions.length >= 200) return { solutions: allSolutions, timedOut: false };
        }
      }
    }
    return { solutions: allSolutions, timedOut };
  }

  parentPort.on("message", (msg) => {
    if (msg.type === "solve") {
      const { comboIndex, bodyCombo, timeoutMs } = msg;
      const tiles = { [SH]: 1, [ET]: 1 };
      for (const t of bodyCombo) tiles[t] = (tiles[t] || 0) + 1;
      const t0 = Date.now();
      const { solutions, timedOut } = solveCombo(ROWS, COLS, tiles, timeoutMs || 0);
      const elapsed = Date.now() - t0;
      parentPort.postMessage({
        type: "result", comboIndex, bodyCombo, tiles,
        solutionCount: solutions.length,
        solutions: solutions.length > 0 ? solutions : null,
        elapsedMs: elapsed, timedOut
      });
    }
  });
  parentPort.postMessage({ type: "ready" });

} else {

  // ============================================================
  // MAIN THREAD
  // ============================================================
  const args = process.argv.slice(2);
  if (args.length < 2) { console.log("Usage: node batch-solver-parallel.js <rows> <cols> [--workers N] [--timeout S] [--corners] [--start N] [--solvable-start N] [--advanced]"); process.exit(1); }

  const ROWS = parseInt(args[0], 10);
  const COLS = parseInt(args[1], 10);
  const ADVANCED = args.includes("--advanced");
  const CORNERS_ONLY = args.includes("--corners");

  // Parse --blockers "r,c;r2,c2"
  const bIdx = args.indexOf("--blockers");
  const BLOCKERS = bIdx >= 0 && args[bIdx + 1]
    ? args[bIdx + 1].split(";").map(s => s.split(",").map(Number))
    : [];

  const CELLS = ROWS * COLS;
  const PLAYABLE_CELLS = CELLS - BLOCKERS.length;
  const TOTAL_TILES = PLAYABLE_CELLS / 2;
  const BODY_SLOTS = TOTAL_TILES - 2;

  let NUM_WORKERS = Math.max(1, os.cpus().length - 2);
  const wIdx = args.indexOf("--workers");
  if (wIdx !== -1 && args[wIdx + 1]) NUM_WORKERS = parseInt(args[wIdx + 1], 10);

  let TIMEOUT_SEC = 120;
  const tIdx = args.indexOf("--timeout");
  if (tIdx !== -1 && args[tIdx + 1]) TIMEOUT_SEC = parseInt(args[tIdx + 1], 10);
  const TIMEOUT_MS = TIMEOUT_SEC * 1000;

  // Resume support: --start N skips the first N combos, --solvable-start N sets the solvable counter
  let START_COMBO = 0;
  const sIdx = args.indexOf("--start");
  if (sIdx !== -1 && args[sIdx + 1]) START_COMBO = parseInt(args[sIdx + 1], 10);

  let SOLVABLE_START = 0;
  const ssIdx = args.indexOf("--solvable-start");
  if (ssIdx !== -1 && args[ssIdx + 1]) SOLVABLE_START = parseInt(args[ssIdx + 1], 10);

  if (PLAYABLE_CELLS % 2 !== 0) { console.error("Playable cells must be even (board cells minus blockers)"); process.exit(1); }

  const EDGES_PATH = path.resolve(__dirname, "../data/tiles/tiles-live-edges.json");
  const tilesJson = JSON.parse(fs.readFileSync(EDGES_PATH, "utf-8"));

  const BASIC_BODY = ["UT-Snake-Tile.png", "RC-Snake-Tile.png", "LC-Snake-Tile.png", "DB-Snake-Tile.png", "HL-Snake-Tile.png", "VL-Snake-Tile.png", "LL-Snake-Tile.png", "LR-Snake-Tile.png"];
  const ADVANCED_BODY = ["SZ-Snake-Tile.png", "SS-Snake-Tile.png", "DS-Snake-Tile.png", "QC-Snake-Tile.png", "DC-Snake-Tile.png"];
  const BODY_TILES = ADVANCED ? [...BASIC_BODY, ...ADVANCED_BODY] : BASIC_BODY;
  const SH = "SH-Snake-Tile.png";
  const ET = "ET-Snake-Tile.png";

  function* combosWithRepetition(items, k, start = 0, current = []) {
    if (current.length === k) { yield [...current]; return; }
    for (let i = start; i < items.length; i++) { current.push(items[i]); yield* combosWithRepetition(items, k, i, current); current.pop(); }
  }
  function countCombos(n, k) { let num = 1, den = 1; for (let i = 0; i < k; i++) { num *= (n + k - 1 - i); den *= (i + 1); } return Math.round(num / den); }

  const totalCombos = countCombos(BODY_TILES.length, BODY_SLOTS);
  console.log("Parallel batch solver: " + ROWS + "x" + COLS + " (" + CELLS + " cells" + (BLOCKERS.length ? ", " + BLOCKERS.length + " blocker(s), " + PLAYABLE_CELLS + " playable" : "") + ", " + TOTAL_TILES + " tiles, " + BODY_SLOTS + " body slots)");
  console.log("Tile pool: " + BODY_TILES.length + " body types (" + (ADVANCED ? "basic+advanced" : "basic only") + ")" + (BLOCKERS.length ? " | Blockers: " + BLOCKERS.map(b=>b.join(",")).join(";") : ""));
  console.log("Total combinations to test: " + totalCombos);
  console.log("Workers: " + NUM_WORKERS + ", Timeout: " + TIMEOUT_SEC + "s, Corners-only SH: " + CORNERS_ONLY);
  if (START_COMBO > 0) console.log("Resuming from combo " + START_COMBO + " (solvable counter starts at " + SOLVABLE_START + ")");
  console.log("Starting...\n");

  const allCombos = [];
  for (const combo of combosWithRepetition(BODY_TILES, BODY_SLOTS)) allCombos.push(combo);

  const results = [];
  const outDir = path.resolve(__dirname);
  let tested = START_COMBO, solvable = SOLVABLE_START, skipped = 0, nextCombo = START_COMBO;
  const t0 = Date.now();
  const workerBusy = new Array(NUM_WORKERS).fill(false);
  const workers = [];
  let allDone = false;

  function reportProgress() {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    const rate = tested > 0 ? (tested / ((Date.now() - t0) / 1000)).toFixed(1) : "0";
    const eta = tested > 0 ? (((totalCombos - tested) / (tested / ((Date.now() - t0) / 1000))) / 3600).toFixed(1) : "?";
    console.log("  [" + tested + "/" + totalCombos + "] " + solvable + " solvable, " + skipped + " timed-out | " + elapsed + "s | " + rate + " combos/s | ETA: " + eta + "h");
  }

  function sendNext(workerIdx) {
    if (nextCombo >= allCombos.length) {
      workerBusy[workerIdx] = false;
      if (workerBusy.every(b => !b)) finalize();
      return;
    }
    const idx = nextCombo++;
    workerBusy[workerIdx] = true;
    workers[workerIdx].postMessage({ type: "solve", comboIndex: idx, bodyCombo: allCombos[idx], timeoutMs: TIMEOUT_MS });
  }

  function finalize() {
    if (allDone) return;
    allDone = true;
    clearInterval(progressInterval);
    const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("\n\nDONE: " + tested + " combos tested, " + solvable + " solvable, " + skipped + " timed-out, " + totalElapsed + "s");
    const summaryFile = "batch-" + ROWS + "x" + COLS + "-results.json";
    // If resuming, merge with existing results
    let prevResults = [];
    const summaryPath = path.join(outDir, summaryFile);
    if (START_COMBO > 0 && fs.existsSync(summaryPath)) {
      try { const prev = JSON.parse(fs.readFileSync(summaryPath, "utf-8")); prevResults = prev.results || []; } catch (e) {}
    }
    const allResults = [...prevResults, ...results];
    const summary = {
      board: { rows: ROWS, cols: COLS }, tilePool: ADVANCED ? "basic+advanced" : "basic",
      ...(BLOCKERS.length > 0 ? { blockers: BLOCKERS } : {}),
      totalCombos: tested, solvableCombos: solvable, timedOutCombos: skipped,
      elapsedSeconds: parseFloat(totalElapsed), timeoutPerCombo: TIMEOUT_SEC,
      cornersOnlySH: CORNERS_ONLY,
      results: allResults.sort((a, b) => a.solutionCount - b.solutionCount)
    };
    fs.writeFileSync(path.join(outDir, summaryFile), JSON.stringify(summary, null, 2));
    console.log("Summary written to " + summaryFile);
    for (const w of workers) w.terminate();
    process.exit(0);
  }

  const progressInterval = setInterval(() => { if (!allDone) reportProgress(); }, 30000);

  for (let i = 0; i < NUM_WORKERS; i++) {
    const w = new Worker(__filename, { workerData: { ROWS, COLS, tilesJson, SH, ET, CORNERS_ONLY, BLOCKERS } });
    const workerIdx = i;

    w.on("message", (msg) => {
      if (msg.type === "ready") { sendNext(workerIdx); return; }
      if (msg.type === "result") {
        tested++;
        if (msg.timedOut && msg.solutionCount === 0) skipped++;
        if (msg.solutionCount > 0) {
          solvable++;
          const shortNames = msg.bodyCombo.map(t => t.replace("-Snake-Tile.png", ""));
          const tileKey = Object.entries(msg.tiles).map(([k, v]) => k.replace("-Snake-Tile.png", "") + (v > 1 ? "x" + v : "")).sort().join("_");
          const tag = msg.timedOut ? " [PARTIAL, " + msg.elapsedMs + "ms]" : " [" + msg.elapsedMs + "ms]";
          console.log("  FOUND #" + solvable + ": " + shortNames.join(",") + " -> " + msg.solutionCount + " solution(s)" + tag);
          const filename = ROWS + "x" + COLS + "-basic-" + String(solvable).padStart(3, "0") + ".json";
          const output = {
            board: { rows: ROWS, cols: COLS, cells: CELLS }, tileSet: "tiles-live-edges.json",
            tiles: msg.tiles, tileKey, totalUniqueSolutions: msg.solutionCount,
            ...(BLOCKERS.length > 0 ? { blockers: BLOCKERS } : {}),
            generatedAt: new Date().toISOString(),
            solutions: msg.solutions.map((s, si) => ({ id: "solve-" + (si + 1), label: ROWS + "x" + COLS + " #" + solvable + " solve " + (si + 1), placements: s }))
          };
          fs.writeFileSync(path.join(outDir, filename), JSON.stringify(output, null, 2));
          results.push({ comboIndex: solvable, tiles: msg.tiles, tileKey, solutionCount: msg.solutionCount, file: filename });
        }
        if (tested % 200 === 0) reportProgress();
        sendNext(workerIdx);
      }
    });
    w.on("error", (err) => { console.error("Worker " + workerIdx + " error:", err); tested++; skipped++; sendNext(workerIdx); });
    workers.push(w);
  }
}
