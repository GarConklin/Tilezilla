#!/usr/bin/env node
/**
 * Sync catalog from solves/*.json and tile bags:
 *   totalUniqueSolutions <- solve file solution count (0 if no file)
 *   pathCount            <- snakes on board (min SH, ET), default 1
 *   pathMode             <- tile bag (never from solution count)
 *
 * Default: --dry-run. Use --apply to write bucket + levels.json.
 *
 *   node scripts/sync-catalog-path-count-from-solves.js --apply
 *   node scripts/sync-catalog-path-count-from-solves.js --apply --ids 5x6-0B-AWL,5x6-0B-AWM
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { catalogFieldsForLevel } = require('./lib/path-mode-from-tiles');

const ROOT = path.join(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const FLAT_PATH = path.join(LEVELS_DIR, 'levels.json');
const SOLVES_DIR = path.join(ROOT, 'solves');
const SANDBOX = /-ZZZ$/;

function parseArgs(argv) {
  let apply = false;
  let ids = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--ids' && argv[i + 1]) {
      ids = new Set(
        argv[++i]
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  return { apply, ids };
}

const { apply, ids: onlyIds } = parseArgs(process.argv);

function loadSolveDoc(solvesFile) {
  if (!solvesFile) return null;
  const sp = path.join(SOLVES_DIR, ...String(solvesFile).split('/'));
  if (!fs.existsSync(sp)) return null;
  try {
    return JSON.parse(fs.readFileSync(sp, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const flat = JSON.parse(fs.readFileSync(FLAT_PATH, 'utf8'));
  const flatById = new Map((flat.levels || []).map((L) => [L.id, L]));
  const updates = [];

  for (const b of idx.buckets || []) {
    if (!b?.file) continue;
    const fp = path.join(LEVELS_DIR, b.file);
    if (!fs.existsSync(fp)) continue;
    const doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    let bucketChanged = false;

    for (const L of doc.levels || []) {
      if (!L?.id || SANDBOX.test(L.id)) continue;
      if (onlyIds && !onlyIds.has(L.id)) continue;
      const sf = L.solvesFile || `${L.id}.json`;
      const sdoc = loadSolveDoc(sf);
      const want = catalogFieldsForLevel(L, sdoc);
      if (
        L.pathCount !== want.pathCount ||
        L.pathMode !== want.pathMode ||
        L.totalUniqueSolutions !== want.totalUniqueSolutions
      ) {
        updates.push({
          id: L.id,
          from: {
            pathCount: L.pathCount,
            pathMode: L.pathMode,
            totalUniqueSolutions: L.totalUniqueSolutions,
          },
          to: want,
        });
        L.pathCount = want.pathCount;
        L.pathMode = want.pathMode;
        L.totalUniqueSolutions = want.totalUniqueSolutions;
        bucketChanged = true;
        const flatL = flatById.get(L.id);
        if (flatL) {
          flatL.pathCount = want.pathCount;
          flatL.pathMode = want.pathMode;
          flatL.totalUniqueSolutions = want.totalUniqueSolutions;
        }
      }
    }

    if (apply && bucketChanged) {
      fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    }
  }

  if (apply && updates.length) {
    fs.writeFileSync(FLAT_PATH, JSON.stringify(flat, null, 2) + '\n', 'utf8');
  }

  const out = path.join(ROOT, 'data', 'solver-runs', `catalog-sync-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        apply,
        ids: onlyIds ? [...onlyIds] : null,
        updated: updates.length,
        samples: updates.slice(0, 40),
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  console.log(JSON.stringify({ apply, updated: updates.length, out }, null, 2));
}

main();
