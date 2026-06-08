#!/usr/bin/env node
/**
 * List catalog levels that expect a solve library (totalUniqueSolutions > 0) but have none on disk.
 * Only single-snake levels (SH <= 1, ET <= 1) — same rule as solve-level.js.
 *
 * Usage (repo root):
 *   node scripts/list-missing-solve-levels.js
 *   node scripts/list-missing-solve-levels.js --json
 *   node scripts/list-missing-solve-levels.js --only-sizes 4x4
 *   node scripts/list-missing-solve-levels.js --ids 4x4-0A-ADC,4x4-0A-ADD
 *   node scripts/list-missing-solve-levels.js --fix-path-mode --apply
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const FLAT_PATH = path.join(LEVELS_DIR, 'levels.json');
const SOLVES_DIR = path.join(ROOT, 'solves');

function parseArgs(argv) {
  const out = {
    json: false,
    onlySizes: null,
    ids: null,
    fixPathMode: false,
    apply: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--json') out.json = true;
    else if (argv[i] === '--fix-path-mode') out.fixPathMode = true;
    else if (argv[i] === '--apply') out.apply = true;
    else if (argv[i] === '--only-sizes' && argv[i + 1]) {
      out.onlySizes = new Set(
        argv[++i]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    } else if (argv[i] === '--ids' && argv[i + 1]) {
      out.ids = new Set(
        argv[++i]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  return out;
}

function solveCount(solvesFile) {
  const sp = path.join(SOLVES_DIR, ...solvesFile.split('/'));
  if (!fs.existsSync(sp)) return 0;
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(sp, 'utf8'));
  } catch {
    return 0;
  }
  if (typeof doc.totalUniqueSolutions === 'number') return doc.totalUniqueSolutions;
  const sols = doc.solutions;
  return Array.isArray(sols) ? sols.length : 0;
}

function isSingleSnake(tiles) {
  const sh = Number((tiles && tiles.SH) || 0);
  const et = Number((tiles && tiles.ET) || 0);
  return sh <= 1 && et <= 1;
}

function levelSize(id) {
  const p = String(id).split('-')[0];
  return p || '';
}

function main() {
  const opts = parseArgs(process.argv);
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  let flatDoc = null;
  let flatById = null;
  if (opts.fixPathMode && opts.apply) {
    flatDoc = JSON.parse(fs.readFileSync(FLAT_PATH, 'utf8'));
    flatById = new Map((flatDoc.levels || []).map((L) => [L.id, L]));
  }

  const missing = [];
  const pathModeFixes = [];

  for (const b of idx.buckets || []) {
    if (!b?.file) continue;
    const fp = path.join(LEVELS_DIR, b.file);
    if (!fs.existsSync(fp)) continue;
    const doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    let bucketChanged = false;

    for (const L of doc.levels || []) {
      if (!L?.id) continue;
      if (opts.ids && !opts.ids.has(L.id)) continue;
      const size = levelSize(L.id);
      if (opts.onlySizes && !opts.onlySizes.has(size)) continue;

      const expectSolutions = Number(
        L.totalUniqueSolutions != null ? L.totalUniqueSolutions : L.pathCount || 0
      );
      if (expectSolutions <= 0) continue;
      if (!isSingleSnake(L.tiles)) continue;

      const sf = L.solvesFile || `${L.id}.json`;
      const sc = solveCount(sf);
      if (sc > 0) continue;

      const pm = L.pathMode || '';
      const needsPathModeFix = pm !== '' && pm !== 'single';

      missing.push({
        id: L.id,
        bucket: b.file,
        pathCount,
        pathMode: pm || '(unset)',
        solvesFile: sf,
        needsPathModeFix,
      });

      if (opts.fixPathMode && needsPathModeFix) {
        pathModeFixes.push({ id: L.id, bucket: b.file, from: pm, to: 'single' });
        if (opts.apply) {
          L.pathMode = 'single';
          bucketChanged = true;
          const flatL = flatById && flatById.get(L.id);
          if (flatL) flatL.pathMode = 'single';
        }
      }
    }

    if (opts.fixPathMode && opts.apply && bucketChanged) {
      fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    }
  }

  if (opts.fixPathMode && opts.apply && flatDoc) {
    fs.writeFileSync(FLAT_PATH, JSON.stringify(flatDoc, null, 2) + '\n', 'utf8');
  }

  missing.sort((a, b) => a.id.localeCompare(b.id));

  if (opts.json) {
    console.log(JSON.stringify({ missing, pathModeFixes }, null, 2));
    return;
  }

  if (pathModeFixes.length) {
    console.error(`[list-missing] pathMode fixes: ${pathModeFixes.length}${opts.apply ? ' (applied)' : ' (dry-run; use --apply)'}`);
    for (const f of pathModeFixes) console.error(`  ${f.id}: ${f.from} -> single`);
  }

  console.error(`[list-missing] ${missing.length} level(s) with totalUniqueSolutions > 0 and no solve file`);
  for (const row of missing) {
    console.log(row.id);
  }
}

main();
