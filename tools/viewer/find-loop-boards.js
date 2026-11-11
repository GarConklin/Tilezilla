#!/usr/bin/env node
'use strict';
/**
 * Exhaustively fill a puzzle's board with its bag and write the "loop" boards:
 * finished layouts the game validator accepts but the strict single-snake rule rejects.
 *
 *   node tools/viewer/find-loop-boards.js --spec <spec.json> --out <loops.json> [--solutions <solutions.json>]
 *
 * Layouts are deduped with the repo's uniqueLayoutKey (half-turn fold). With --solutions, also reports
 * whether the strict-passing layouts found here match the solutions file one-for-one.
 * Independent of the repo solver: fills the first empty cell (row-major) with every tile/rotation that
 * covers it and keeps only placements whose openings meet matching openings.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO = path.resolve(__dirname, '..', '..');
const { makeCtx, parseBlockersToSet } = require(path.join(REPO, 'tools/scripts/lib/web-validate-board-node.js'));
const { uniqueLayoutKey } = require(path.join(REPO, 'tools/scripts/lib/layout-equivalence-key.js'));
const { strictCheck } = require('./strict-check.js');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : null;
}
function readJson(p) {
  let buf = fs.readFileSync(p);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  return JSON.parse(buf.toString('utf8'));
}

const specPath = arg('spec');
const outPath = arg('out');
const solPath = arg('solutions');
if (!specPath || !outPath) {
  console.error('usage: node find-loop-boards.js --spec <spec.json> --out <loops.json> [--solutions <solutions.json>]');
  process.exit(2);
}
const spec = readJson(specPath);
const T = readJson(path.join(REPO, 'data/tiles', spec.tileSet || 'tiles-live-edges.json'));
const R = spec.board.rows, C = spec.board.cols, N = R * C;
const blockers = parseBlockersToSet(spec.board.blockers || spec.blockers || [], R, C);
const level = { pathMode: spec.pathMode || 'single', pathCount: spec.pathCount };

const BIT = { N: 1, E: 2, S: 4, W: 8 };
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
const OPPI = [2, 3, 0, 1];
const ANCH = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] };
const names = Object.keys(spec.tiles).filter((n) => spec.tiles[n] > 0);
const left = names.map((n) => spec.tiles[n]);
const single = names.map((n) => Array.isArray(T[n]?.shape) && T[n].shape.length === 1);
const mask = (arr) => (arr || []).reduce((m, e) => m | BIT[e], 0);
const def = names.map((n) => {
  if (!T[n]) throw new Error(`Tile ${n} missing from tile defs`);
  const o = {};
  for (const d of [0, 90, 180, 270]) o[d] = { a: mask(T[n]['r' + d].A), b: mask(T[n]['r' + d].B) };
  return o;
});

const filled = new Uint8Array(N), m = new Uint8Array(N);
for (const k of blockers) {
  const [r, c] = k.split(',').map(Number);
  filled[r * C + c] = 1;
}
function okCell(i) {
  const r = (i / C) | 0, c = i % C;
  for (let d = 0; d < 4; d++) {
    const has = (m[i] >> d) & 1;
    const rr = r + DR[d], cc = c + DC[d];
    if (rr < 0 || rr >= R || cc < 0 || cc >= C) { if (has) return false; continue; }
    const j = rr * C + cc;
    if (!filled[j]) continue;
    if (has !== ((m[j] >> OPPI[d]) & 1)) return false;
  }
  return true;
}

const stack = [];
const strictKeys = new Map();
const loops = new Map();
let boards = 0, gameOk = 0;
const t0 = Date.now();

function finish() {
  boards++;
  const pl = stack.map((s) => ({ ...s }));
  if (!makeCtx(R, C, T, spec.tiles, level, blockers).validatePlacements(pl).ok) return;
  gameOk++;
  const key = uniqueLayoutKey(pl, R, C, T);
  if (strictKeys.has(key)) return;
  // Same picture, different domino seams: a strict-passing encoding makes the layout a solution.
  const s = strictCheck({ rows: R, cols: C, liveEdges: T, placements: pl, blockers });
  if (s.ok) {
    strictKeys.set(key, pl);
    loops.delete(key);
  } else if (!loops.has(key)) {
    loops.set(key, { placements: pl, strict: s.msg });
  }
}

function place(i, t, deg, cells) {
  for (const [ci, msk] of cells) { filled[ci] = 1; m[ci] = msk; }
  if (cells.every(([ci]) => okCell(ci))) {
    left[t]--;
    stack.push({ tile: names[t], r: cells[0][2], c: cells[0][3], deg });
    rec(i + 1);
    stack.pop();
    left[t]++;
  }
  for (const [ci] of cells) { filled[ci] = 0; m[ci] = 0; }
}

function rec(first) {
  while (first < N && filled[first]) first++;
  if (first === N) return finish();
  const r = (first / C) | 0, c = first % C;
  for (let t = 0; t < names.length; t++) {
    if (!left[t]) continue;
    for (const deg of [0, 90, 180, 270]) {
      if (single[t]) {
        place(first, t, deg, [[first, def[t][deg].a, r, c]]);
        continue;
      }
      const [dr, dc] = ANCH[deg];
      const ar = deg === 0 || deg === 90 ? r : r - dr;
      const ac = deg === 0 || deg === 90 ? c : c - dc;
      const br = ar + dr, bc = ac + dc;
      if (ar < 0 || ar >= R || ac < 0 || ac >= C || br < 0 || br >= R || bc < 0 || bc >= C) continue;
      const ai = ar * C + ac, bi = br * C + bc;
      if (filled[ai] || filled[bi]) continue;
      place(first, t, deg, [[ai, def[t][deg].a, ar, ac], [bi, def[t][deg].b, br, bc]]);
    }
  }
}

console.log(`Exhaustive fill of ${spec.id || path.basename(specPath)} (${C}x${R}), bag ${JSON.stringify(spec.tiles)}`);
rec(0);
console.log(`full boards=${boards} game-valid=${gameOk} distinct strict=${strictKeys.size} distinct loop boards=${loops.size} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (solPath) {
  const sol = readJson(solPath);
  const fileKeys = new Set(sol.solutions.map((s) => uniqueLayoutKey(s.placements, R, C, T)));
  let missing = 0, extra = 0;
  for (const k of strictKeys.keys()) if (!fileKeys.has(k)) missing++;
  for (const k of fileKeys) if (!strictKeys.has(k)) extra++;
  console.log(`solutions file: ${sol.solutions.length} boards; strict layouts missing from file=${missing}; file boards not strict-found=${extra}`);
}

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  id: spec.id || null,
  note: 'Finished layouts the game validator accepts but the strict single-snake rule rejects (find-loop-boards.js).',
  totalLoopBoards: loops.size,
  strictLayouts: strictKeys.size,
  solutions: [...loops.values()],
}));
console.log(`wrote ${outPath}`);
