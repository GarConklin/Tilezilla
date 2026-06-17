#!/usr/bin/env node
/**
 * Build one concatenated batch file of all 6x6 levels that still need full enumeration.
 *
 * "Done" = solve-level ran: solverMeta.enumerateNote mentions dedupe AND totalIters > 0.
 * Everything else (ingest seed only, old partial files, missing solves/) is included.
 *
 * Usage:
 *   node scripts/build-6x6-unsolved-batch.js
 *   node scripts/build-6x6-unsolved-batch.js --out "data/tilepz solves 6x6 need-enumeration.txt"
 *   node scripts/build-6x6-unsolved-batch.js --include-jun13-batch
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { splitJsonDocs } = require('./lib/split-json-docs');

const ROOT = path.join(__dirname, '..');
const LEVELS_PATH = path.join(ROOT, 'data', 'levels', 'levels.json');
const SOLVES_DIR = path.join(ROOT, 'solves');
const JUN13_BATCH = path.join(ROOT, 'data', 'tilepz solves 6x6 13 jun 2026.txt');

const outIdx = process.argv.indexOf('--out');
const manifestIdx = process.argv.indexOf('--manifest');
const outPath =
  outIdx >= 0 && process.argv[outIdx + 1]
    ? path.resolve(ROOT, process.argv[outIdx + 1])
    : path.join(ROOT, 'data', 'tilepz solves 6x6 need-enumeration.txt');
const manifestPath =
  manifestIdx >= 0 && process.argv[manifestIdx + 1]
    ? path.resolve(ROOT, process.argv[manifestIdx + 1])
    : path.join(ROOT, 'data', 'solver-runs', '6x6-need-enumeration-manifest.json');
const includeJun13 = process.argv.includes('--include-jun13-batch');

function isFullyEnumerated(doc) {
  const meta = doc?.solverMeta;
  if (!meta || !(meta.totalIters > 0)) return false;
  const note = String(meta.enumerateNote || '');
  return note.includes('dedupe');
}

function levelIdFromDoc(doc) {
  return (
    doc.levelId ||
    doc.solutions?.[0]?.label?.split(/\s+/)[0] ||
    null
  );
}

function seedDocFromSolveFile(doc, levelId) {
  const sol = doc.solutions?.[0];
  if (!sol) return null;
  return {
    board: doc.board,
    tileSet: doc.tileSet || 'tiles-live-edges.json',
    tiles: doc.tiles,
    levelId,
    totalUniqueSolutions: 1,
    solutions: [
      {
        id: 'solve-1',
        label: `${levelId} solver 1`,
        placements: sol.placements,
      },
    ],
  };
}

function loadJun13SeedsById() {
  if (!fs.existsSync(JUN13_BATCH)) return new Map();
  const map = new Map();
  for (const doc of splitJsonDocs(fs.readFileSync(JUN13_BATCH, 'utf8'))) {
    const id = levelIdFromDoc(doc);
    if (id) map.set(id, doc);
  }
  return map;
}

function main() {
  const levels = JSON.parse(fs.readFileSync(LEVELS_PATH, 'utf8')).levels.filter(
    (l) => l.board?.rows === 6 && l.board?.cols === 6
  );
  const jun13 = includeJun13 ? loadJun13SeedsById() : new Map();

  const need = [];
  const seen = new Set();

  for (const lv of levels.sort((a, b) => a.id.localeCompare(b.id))) {
    seen.add(lv.id);
    const solvePath = path.join(SOLVES_DIR, lv.solvesFile || `${lv.id}.json`);
    let doc = null;
    let reason = 'missing-solve-file';

    if (fs.existsSync(solvePath)) {
      doc = JSON.parse(fs.readFileSync(solvePath, 'utf8'));
      if (isFullyEnumerated(doc)) continue;
      reason =
        (doc.solutions?.length || 0) <= 1
          ? 'seed-only'
          : 'partial-without-enumerator-meta';
    } else if (jun13.has(lv.id)) {
      doc = jun13.get(lv.id);
      reason = 'jun13-batch-not-ingested';
    } else {
      need.push({ id: lv.id, reason, seed: null });
      continue;
    }

    const seed = seedDocFromSolveFile(doc, lv.id) || doc;
    need.push({ id: lv.id, reason, seed, storedSolutions: doc.solutions?.length || 0 });
  }

  if (includeJun13) {
    for (const [id, doc] of jun13) {
      if (seen.has(id)) continue;
      const solvePath = path.join(SOLVES_DIR, `${id}.json`);
      if (fs.existsSync(solvePath)) {
        const cur = JSON.parse(fs.readFileSync(solvePath, 'utf8'));
        if (isFullyEnumerated(cur)) continue;
      }
      need.push({
        id,
        reason: 'jun13-batch-not-in-catalog',
        seed: seedDocFromSolveFile(doc, id) || doc,
        storedSolutions: doc.solutions?.length || 0,
      });
    }
  }

  need.sort((a, b) => a.id.localeCompare(b.id));

  const chunks = [];
  for (const row of need) {
    if (!row.seed) {
      console.warn(`WARN: no seed for ${row.id} (${row.reason}) — skipped from batch body`);
      continue;
    }
    chunks.push(JSON.stringify(row.seed, null, 2));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(outPath, chunks.join('\n\n') + (chunks.length ? '\n' : ''), 'utf8');

  const manifest = {
    generatedAt: new Date().toISOString(),
    batchFile: path.relative(ROOT, outPath).replace(/\\/g, '/'),
    totalNeedingEnumeration: need.length,
    withSeedInBatch: chunks.length,
    skippedNoSeed: need.filter((r) => !r.seed).map((r) => r.id),
    levels: need.map(({ id, reason, storedSolutions }) => ({
      id,
      reason,
      storedSolutions: storedSolutions ?? null,
    })),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const idsPath = path.join(path.dirname(manifestPath), '6x6-need-enumeration-ids.txt');
  fs.writeFileSync(idsPath, need.map((r) => r.id).join('\n') + (need.length ? '\n' : ''), 'utf8');

  console.log(`6x6 catalog levels: ${levels.length}`);
  console.log(`Need enumeration: ${need.length}`);
  console.log(`Batch file (${chunks.length} seeds): ${path.relative(ROOT, outPath)}`);
  console.log(`Manifest: ${path.relative(ROOT, manifestPath)}`);
  console.log(`Id list: ${path.relative(ROOT, idsPath)}`);
  if (need.length) {
    console.log('\nFirst 10:');
    for (const row of need.slice(0, 10)) {
      console.log(`  ${row.id}\t${row.reason}\tstored=${row.storedSolutions ?? '—'}`);
    }
    if (need.length > 10) console.log(`  … +${need.length - 10} more`);
  }
}

main();
