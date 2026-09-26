#!/usr/bin/env node
/**
 * Two-path (multi-snake) enumerator — **separate** from `solves/solve-level.js`.
 * Single-snake stays in solve-level.js; do not add multi-path search there.
 *
 * Phase 1 (this file): preflight only — load level, validate tier/path inventory,
 * compute intended path count, emit JSON or text. Enumeration comes later.
 *
 * Validation contract (game): `web/js/app_v16.js` → `validateBoard` / `computeExpectedPathCount`.
 *
 * Usage (repo root):
 *   node solves/solve-level-2snake.js 3x4-1A-AAA
 *   node solves/solve-level-2snake.js 3x6-1B-AAA --json-summary
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadJson(relativePath) {
  const full = path.join(ROOT, relativePath.split('/').join(path.sep));
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function loadLevel(levelId) {
  const m = levelId.match(/^((?:\d+)x(?:\d+))-(\d+[A-Z])-/);
  if (!m) throw new Error(`Bad level id: ${levelId}`);
  const bucketPath = `data/levels/${m[1]}-${m[2]}.json`;
  const bucket = loadJson(bucketPath);
  const level = bucket.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`Level not found: ${levelId} in ${bucketPath}`);
  return { level, bucketPath, tier: m[2] };
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/**
 * How many disjoint snakes this level is meant to carry (SH → ET/ES/…).
 * Mirrors the spirit of `computeExpectedPathCount` when only the bag is known:
 * - Prefer min(SH, ET + ES) when that yields ≥2 (covers 1A 2×ET and 1B ET+ES).
 * - Else if both SH and ET ≥2, min(SH, ET).
 * - Else if pathMode is multi and pathCount ≥2, use pathCount (explicit catalog hint).
 */
function inferExpectedSnakePaths(level) {
  const tiles = level.tiles || {};
  const sh = num(tiles.SH);
  const et = num(tiles.ET);
  const es = num(tiles.ES);
  const endCap = et + es;
  const pc = num(level.pathCount);

  let ep = 0;
  if (sh > 0 && endCap > 0) ep = Math.min(sh, endCap);
  if (ep < 2 && sh >= 2 && et >= 2) ep = Math.min(sh, et);
  const mode = level.pathMode || 'single';
  if (ep < 2 && (mode === 'multi' || mode === 'multi-flex') && pc >= 2) ep = pc;

  return { expectedPaths: ep, sh, et, es, endCap, pathCount: pc, pathMode: mode };
}

/** Same unknown-tile check as solve-level.js (expand when 2-snake supports more). */
function unsupportedTileReasons(levelTiles, tilesJson) {
  const reasons = [];
  for (const [k, n] of Object.entries(levelTiles || {})) {
    if (!n || n <= 0) continue;
    if (!tilesJson[k]) reasons.push(`unknown:${k}`);
  }
  return [...new Set(reasons)];
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = { jsonSummary: false, quiet: false };
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json-summary') flags.jsonSummary = true;
    else if (args[i] === '--quiet') flags.quiet = true;
    else if (!args[i].startsWith('-')) positionals.push(args[i]);
  }
  return { levelId: positionals[0] || null, flags };
}

const TIER_TWO_SNAKE = new Set(['1A', '1B', '1C']);

function main() {
  const { levelId, flags } = parseArgs(process.argv);
  if (!levelId) {
    console.error('Usage: node solves/solve-level-2snake.js <level-id> [--json-summary] [--quiet]');
    process.exit(1);
  }

  let loaded;
  try {
    loaded = loadLevel(levelId);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  const { level, bucketPath, tier } = loaded;
  const tilesPath = 'data/tiles/tiles-live-edges.json';
  let tilesJson;
  try {
    tilesJson = loadJson(tilesPath);
  } catch (e) {
    console.error(`Failed to load ${tilesPath}:`, e.message || e);
    process.exit(1);
  }

  const unsup = unsupportedTileReasons(level.tiles, tilesJson);
  const mode = level.pathMode || 'single';
  const { expectedPaths, sh, et, es, endCap, pathCount } = inferExpectedSnakePaths(level);

  const reasons = [];
  if (!TIER_TWO_SNAKE.has(tier)) {
    reasons.push(`tier ${tier} not in 1A/1B/1C (two-snake catalog tiers); got bucket ${path.basename(bucketPath)}`);
  }
  if (mode !== 'multi' && mode !== 'multi-flex') {
    reasons.push(`pathMode must be "multi" or "multi-flex" (got ${JSON.stringify(mode)})`);
  }
  if (sh < 2) reasons.push(`need at least 2× SH for two-snake preflight (got SH=${sh})`);
  if (expectedPaths < 2) {
    reasons.push(
      `cannot infer 2 disjoint snakes from bag (SH=${sh}, ET=${et}, ES=${es}, endCap=${endCap}, pathCount=${pathCount}) → expectedPaths=${expectedPaths}`
    );
  }
  if (unsup.length) reasons.push(`unsupported tiles: ${unsup.join(', ')}`);

  const ok = reasons.length === 0;
  let hint = null;
  if (!ok) {
    const wrongShelf = !TIER_TWO_SNAKE.has(tier) || mode === 'single' || (mode !== 'multi' && mode !== 'multi-flex');
    if (wrongShelf) {
      hint =
        'Not a two-snake level (expect tier 1A/1B/1C and pathMode multi or multi-flex). Single-snake: node solves/solve-level.js <level-id> …';
    } else {
      hint = 'Two-snake preflight failed; see preflightErrors.';
    }
  }

  const summary = {
    schema: 'solve-level-2snake-preflight-v1',
    levelId,
    tier,
    bucket: path.relative(ROOT, bucketPath).split(path.sep).join('/'),
    pathMode: mode,
    pathCount,
    tiles: level.tiles,
    board: level.board,
    inferred: { expectedPaths, sh, et, es, endCap },
    tileSet: 'data/tiles/tiles-live-edges.json',
    preflightOk: ok,
    hint,
    preflightErrors: ok ? [] : reasons,
    enumeration: { status: 'not-implemented', note: 'Search / seeds / write-solves will be added in a later phase.' },
  };

  if (flags.jsonSummary) {
    console.log(JSON.stringify(summary));
  } else if (!flags.quiet) {
    console.log(JSON.stringify(summary, null, 2));
  }

  process.exit(ok ? 0 : 2);
}

main();
