#!/usr/bin/env node
/**
 * Walk the catalog (data/levels/index.json + bucket JSONs) and validate every
 * solve entry in each level's solvesFile using the same rules as the web app
 * "Check Solution" success path: validateBoard() then inventory match
 * (web/js/app_v16.js — inventory is checked only after validateBoard passes).
 *
 * Implementation: scripts/lib/web-validate-board-node.js (makeCtx / validatePlacements).
 * Catalog solves must be complete boards (no partial); partial placements count as invalid.
 *
 * Docker (from repo root; compose bind-mounts . to /app):
 *   docker compose run --rm web node scripts/validate-solve-docs-web-checker.js
 *   docker compose run --rm web node scripts/validate-solve-docs-web-checker.js --level=6x6-0A-AAB
 *   docker compose run --rm web node scripts/validate-solve-docs-web-checker.js --bucket=6x6-0A.json
 *   docker compose run --rm web node scripts/validate-solve-docs-web-checker.js --out=data/solver-runs/my-audit.json
 *
 * Local:
 *   node scripts/validate-solve-docs-web-checker.js [--level=id] [--bucket=file] [--out=path] [--quiet]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { makeCtx, parseBlockersToSet } = require('./lib/web-validate-board-node.js');

const ROOT = path.join(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const LIVE_EDGES_PATH = path.join(ROOT, 'data', 'tiles', 'tiles-live-edges.json');
const SOLVES_DIR = path.join(ROOT, 'solves');
const RUNS_DIR = path.join(ROOT, 'data', 'solver-runs');

function argVal(name) {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const filterLevelId = argVal('level');
const filterBucketFile = argVal('bucket');
const quiet = hasFlag('quiet');
const outArg = argVal('out');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toPlaced(sol) {
  const raw = Array.isArray(sol.placements) ? sol.placements : [];
  return raw.map((p, i) => ({
    id: p.id != null ? p.id : i + 1,
    tile: p.tile,
    r: Number(p.r),
    c: Number(p.c),
    deg: Number(p.deg),
  }));
}

function classify(res) {
  if (!res.ok) return { valid: false, reason: res.msg || 'invalid', partial: !!res.partial, inventory: res.inventory || null };
  if (res.partial) return { valid: false, reason: res.msg || 'partial board', partial: true, inventory: null };
  return { valid: true, reason: null, partial: false, inventory: null };
}

function main() {
  const liveEdges = readJson(LIVE_EDGES_PATH);
  const index = readJson(INDEX_PATH);
  const buckets = Array.isArray(index.buckets) ? index.buckets : [];

  const byLevel = [];
  let solutionsChecked = 0;
  let invalidCount = 0;
  let missingSolveFiles = 0;
  let levelRows = 0;

  for (const b of buckets) {
    const file = b && b.file;
    if (!file || typeof file !== 'string') continue;
    if (filterBucketFile && path.basename(file) !== path.basename(filterBucketFile) && file !== filterBucketFile) continue;

    const bucketPath = path.join(LEVELS_DIR, file);
    if (!fs.existsSync(bucketPath)) {
      byLevel.push({
        levelId: null,
        bucketFile: file,
        error: `missing bucket file: ${bucketPath}`,
      });
      continue;
    }

    const bucket = readJson(bucketPath);
    const levels = Array.isArray(bucket.levels) ? bucket.levels : [];

    for (const level of levels) {
      if (filterLevelId && level.id !== filterLevelId) continue;

      levelRows++;
      const board = level.board || {};
      const rows = Number(board.rows);
      const cols = Number(board.cols);
      const solvesName = level.solvesFile;
      const entry = {
        levelId: level.id,
        bucketFile: file,
        solvesFile: solvesName || null,
        rows,
        cols,
        counts: { solutions: 0, invalid: 0 },
        invalid: [],
      };

      if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0) {
        entry.error = 'invalid or missing board.rows/cols';
        byLevel.push(entry);
        continue;
      }

      if (!solvesName || typeof solvesName !== 'string') {
        entry.error = 'missing solvesFile';
        byLevel.push(entry);
        continue;
      }

      const solvesPath = path.join(SOLVES_DIR, path.basename(solvesName));
      if (!fs.existsSync(solvesPath)) {
        entry.error = `missing solve file: ${solvesPath}`;
        missingSolveFiles++;
        byLevel.push(entry);
        continue;
      }

      const blockerSet = parseBlockersToSet(level.blockers, rows, cols);
      const currentLevel = {
        pathMode: level.pathMode,
        pathCount: level.pathCount,
        id: level.id,
      };
      const ctx = makeCtx(rows, cols, liveEdges, level.tiles || {}, currentLevel, blockerSet);
      const { validatePlacements } = ctx;

      let solveDoc;
      try {
        solveDoc = readJson(solvesPath);
      } catch (e) {
        entry.error = `failed to read/parse solves JSON: ${e && e.message}`;
        byLevel.push(entry);
        continue;
      }

      const solutions = Array.isArray(solveDoc.solutions) ? solveDoc.solutions : [];
      entry.counts.solutions = solutions.length;

      for (let i = 0; i < solutions.length; i++) {
        const sol = solutions[i];
        solutionsChecked++;
        const placed = toPlaced(sol);
        if (!placed.length) {
          invalidCount++;
          entry.counts.invalid++;
          entry.invalid.push({
            index: i,
            solutionId: sol.id != null ? sol.id : null,
            label: sol.label != null ? sol.label : null,
            msg: 'No placements',
            partial: false,
          });
          continue;
        }

        const res = validatePlacements(placed);
        const c = classify(res);
        if (!c.valid) {
          invalidCount++;
          entry.counts.invalid++;
          entry.invalid.push({
            index: i,
            solutionId: sol.id != null ? sol.id : null,
            label: sol.label != null ? sol.label : null,
            msg: c.reason,
            partial: c.partial,
            inventory: c.inventory,
          });
        }
      }

      byLevel.push(entry);
    }
  }

  const report = {
    schema: 'invalid-solves-audit-v1',
    generatedAt: new Date().toISOString(),
    summary: {
      bucketsSeen: buckets.length,
      levelRows,
      solutionsChecked,
      invalid: invalidCount,
      missingSolveFiles,
    },
    byLevel,
  };

  let outPath = outArg;
  if (!outPath) {
    ensureDir(RUNS_DIR);
    const stamp = Date.now();
    outPath = path.join(RUNS_DIR, `invalid-solves-audit-${stamp}.json`);
  } else {
    ensureDir(path.dirname(path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath)));
    outPath = path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath);
  }

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  if (!quiet) {
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`Wrote ${outPath}`);
  }
}

main();
