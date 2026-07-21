#!/usr/bin/env node
/**
 * Promote overnight-generated 5x6-0C levels into the live catalog.
 *
 * Copies levels from data/levels/generated/5x6-0C.generated.json into
 * data/levels/5x6-0C.json (and levels.json), syncs totalUniqueSolutions from
 * solves/<id>.json, updates index.json counts, rebuilds stats-index.json.
 *
 * Usage:
 *   node tools/scripts/promote-0c-generated.js
 *   node tools/scripts/promote-0c-generated.js --dry-run
 *   node tools/scripts/promote-0c-generated.js --require-solves
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const GEN = path.join(ROOT, 'data/levels/generated/5x6-0C.generated.json');
const LIVE = path.join(ROOT, 'data/levels/5x6-0C.json');
const FLAT = path.join(ROOT, 'data/levels/levels.json');
const INDEX = path.join(ROOT, 'data/levels/index.json');
const SOLVES = path.join(ROOT, 'solves');

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    requireSolves: argv.includes('--require-solves') || !argv.includes('--allow-missing-solves'),
  };
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, doc) {
  fs.writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
}

function catalogRow(level, totalFromSolve) {
  const tiles = { ...(level.tiles || {}) };
  const row = {
    id: level.id,
    name: level.name || String(level.id).split('-').pop(),
    board: {
      rows: Number(level.board?.rows) || 6,
      cols: Number(level.board?.cols) || 5,
    },
    tiles,
    solvesFile: level.solvesFile || `${level.id}.json`,
    pathMode: level.pathMode || 'single',
    pathCount: Number(level.pathCount) || 1,
    totalUniqueSolutions:
      totalFromSolve != null
        ? totalFromSolve
        : Number(level.totalUniqueSolutions) || 0,
  };
  if (Array.isArray(level.blockers) && level.blockers.length) {
    row.blockers = level.blockers;
  }
  return row;
}

function solveTotal(id) {
  const p = path.join(SOLVES, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const doc = readJson(p);
    const n = Array.isArray(doc.solutions) ? doc.solutions.length : 0;
    const claimed = Number(doc.totalUniqueSolutions);
    return Number.isFinite(claimed) && claimed > 0 ? claimed : n;
  } catch {
    return null;
  }
}

function upsertFlat(flatDoc, row) {
  const arr = Array.isArray(flatDoc) ? flatDoc : flatDoc.levels || [];
  const i = arr.findIndex((l) => l?.id === row.id);
  if (i >= 0) arr[i] = { ...arr[i], ...row };
  else arr.push(row);
  if (Array.isArray(flatDoc)) return arr;
  flatDoc.levels = arr;
  if (typeof flatDoc.count === 'number') flatDoc.count = arr.length;
  return flatDoc;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(GEN)) {
    console.error(`Missing ${path.relative(ROOT, GEN)}`);
    process.exit(1);
  }
  if (!fs.existsSync(LIVE)) {
    console.error(`Missing ${path.relative(ROOT, LIVE)}`);
    process.exit(1);
  }

  const genDoc = readJson(GEN);
  const liveDoc = readJson(LIVE);
  const byId = new Map();
  for (const l of liveDoc.levels || []) {
    if (l?.id) byId.set(l.id, l);
  }

  let added = 0;
  let updated = 0;
  let skippedNoSolve = 0;
  const promoted = [];

  for (const raw of genDoc.levels || []) {
    if (!raw?.id) continue;
    const total = solveTotal(raw.id);
    if (opts.requireSolves && (total == null || total <= 0)) {
      skippedNoSolve += 1;
      continue;
    }
    const row = catalogRow(raw, total);
    const prev = byId.get(row.id);
    if (!prev) {
      added += 1;
      byId.set(row.id, row);
      promoted.push(row.id);
    } else {
      const next = {
        ...prev,
        ...row,
        tiles: row.tiles,
        totalUniqueSolutions: row.totalUniqueSolutions || prev.totalUniqueSolutions || 0,
      };
      if (JSON.stringify(prev) !== JSON.stringify(next)) updated += 1;
      byId.set(row.id, next);
    }
  }

  const mergedLevels = [...byId.values()].sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );
  const outLive = {
    schema: liveDoc.schema || 'levels-bucket-v1',
    size: '5x6',
    tier: '0C',
    count: mergedLevels.length,
    levels: mergedLevels,
  };

  console.log(
    JSON.stringify(
      {
        dryRun: opts.dryRun,
        liveBefore: (liveDoc.levels || []).length,
        liveAfter: mergedLevels.length,
        added,
        updated,
        skippedNoSolve,
        sampleAdded: promoted.slice(0, 8),
      },
      null,
      2
    )
  );

  if (opts.dryRun) return;

  writeJson(LIVE, outLive);

  if (fs.existsSync(FLAT)) {
    let flatDoc = readJson(FLAT);
    for (const row of mergedLevels) {
      flatDoc = upsertFlat(flatDoc, row);
    }
    writeJson(FLAT, flatDoc);
  }

  if (fs.existsSync(INDEX)) {
    const index = readJson(INDEX);
    for (const b of index.buckets || []) {
      if (b.file === '5x6-0C.json' || (b.size === '5x6' && b.tier === '0C')) {
        b.count = mergedLevels.length;
        b.file = '5x6-0C.json';
      }
    }
    writeJson(INDEX, index);
  }

  const stats = spawnSync('node', ['tools/scripts/build-level-stats-index.js'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (stats.stdout) process.stdout.write(stats.stdout);
  if (stats.stderr) process.stderr.write(stats.stderr);
  if (stats.status) process.exit(stats.status);

  console.log(`Promoted into ${path.relative(ROOT, LIVE)} (${mergedLevels.length} levels).`);
}

main();
