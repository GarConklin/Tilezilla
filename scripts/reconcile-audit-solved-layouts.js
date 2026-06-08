#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORTS_ROOT = path.join(ROOT, 'data', 'levels', 'reports');
const INDEX_PATH = path.join(ROOT, 'data', 'levels', 'index.json');

function parseArgs(argv) {
  const out = { folder: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('-') && !out.folder) out.folder = a;
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (!out.folder) {
    throw new Error('Usage: node scripts/reconcile-audit-solved-layouts.js <audit-solved-layouts-...> [--dry-run]');
  }
  return out;
}

function loadLevelMeta() {
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const levelMeta = new Map();
  for (const b of idx.buckets || []) {
    const bp = path.join(ROOT, 'data', 'levels', b.file);
    if (!fs.existsSync(bp)) continue;
    const doc = JSON.parse(fs.readFileSync(bp, 'utf8'));
    for (const lv of doc.levels || []) {
      levelMeta.set(lv.id, { level: lv, bucketFile: b.file, bucketPath: bp, bucketDoc: doc });
    }
  }
  return levelMeta;
}

function sig(placements) {
  return (placements || []).map((p) => `${String(p.tile)},${p.r},${p.c},${p.deg}`).sort().join('|');
}

function bagFromPlacements(placements) {
  const out = {};
  for (const p of placements || []) {
    const t = p?.tile;
    if (typeof t !== 'string' || !t) continue;
    out[t] = (out[t] || 0) + 1;
  }
  return out;
}

function normalizeBag(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

function bagsEqual(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

function ensureSolveDoc(levelId, lv, dryRun) {
  const sf = lv.solvesFile || `${levelId}.json`;
  if (!lv.solvesFile) lv.solvesFile = sf;
  const solvePath = path.join(ROOT, 'solves', sf);
  if (!fs.existsSync(solvePath)) {
    const doc = {
      board: { rows: lv.board.rows, cols: lv.board.cols, cells: lv.board.rows * lv.board.cols },
      tileSet: 'tiles-live-edges.json',
      tiles: lv.tiles,
      totalUniqueSolutions: 0,
      generatedAt: new Date().toISOString(),
      solutions: [],
    };
    if (!dryRun) fs.writeFileSync(solvePath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    return { solvePath, solveDoc: doc };
  }
  return { solvePath, solveDoc: JSON.parse(fs.readFileSync(solvePath, 'utf8')) };
}

function main() {
  const opts = parseArgs(process.argv);
  const auditRoot = path.join(REPORTS_ROOT, opts.folder);
  if (!fs.existsSync(auditRoot) || !fs.statSync(auditRoot).isDirectory()) {
    throw new Error(`Missing folder: ${auditRoot}`);
  }

  const levelMeta = loadLevelMeta();
  const bucketDirty = new Set();
  const report = {
    schema: 'reconcile-audit-solved-layouts-v1',
    auditRoot: path.relative(ROOT, auditRoot).split(path.sep).join('/'),
    generatedAt: new Date().toISOString(),
    dryRun: opts.dryRun,
    totals: {
      levelDirs: 0,
      auditFilesSeen: 0,
      deletedAlreadyExisting: 0,
      importedNew: 0,
      deletedAfterImport: 0,
      discrepancies: 0,
      unknownLevelDirs: 0,
    },
    discrepancies: [],
    perLevel: {},
  };

  const levelDirs = fs.readdirSync(auditRoot).filter((n) => fs.statSync(path.join(auditRoot, n)).isDirectory());
  const progressEvery = 25;
  let levelIndex = 0;
  for (const levelId of levelDirs) {
    levelIndex++;
    if (levelIndex === 1 || levelIndex % progressEvery === 0 || levelIndex === levelDirs.length) {
      console.error(
        `[reconcile] level ${levelIndex}/${levelDirs.length} ${levelId} (imported so far: ${report.totals.importedNew})`
      );
    }
    report.totals.levelDirs++;
    const levelDir = path.join(auditRoot, levelId);
    const files = fs
      .readdirSync(levelDir)
      .filter((n) => n.endsWith('.json'))
      .filter((n) => n !== '_meta.json');

    if (!levelMeta.has(levelId)) {
      report.totals.unknownLevelDirs++;
      report.totals.discrepancies++;
      report.discrepancies.push({ levelId, kind: 'unknown-level-id', message: 'No matching level in catalog', files });
      continue;
    }

    const m = levelMeta.get(levelId);
    const lv = m.level;
    const expectedBag = normalizeBag(lv.tiles);
    const { solvePath, solveDoc } = ensureSolveDoc(levelId, lv, opts.dryRun);
    const solveSigs = new Set((solveDoc.solutions || []).map((s) => sig(s.placements)));

    let importedForLevel = 0;
    let deletedExistingForLevel = 0;
    for (const fn of files) {
      report.totals.auditFilesSeen++;
      const ap = path.join(levelDir, fn);
      let ad;
      try {
        ad = JSON.parse(fs.readFileSync(ap, 'utf8'));
      } catch (e) {
        report.totals.discrepancies++;
        report.discrepancies.push({ levelId, file: fn, kind: 'invalid-json', message: String(e.message || e) });
        continue;
      }
      const placements = ad?.placements;
      if (!Array.isArray(placements)) {
        report.totals.discrepancies++;
        report.discrepancies.push({ levelId, file: fn, kind: 'bad-audit-layout', message: 'placements is not an array' });
        continue;
      }
      const usedBag = bagFromPlacements(placements);
      if (!bagsEqual(expectedBag, usedBag)) {
        report.totals.discrepancies++;
        report.discrepancies.push({ levelId, file: fn, kind: 'tile-bag-mismatch', expected: expectedBag, used: usedBag });
        continue;
      }
      const k = sig(placements);
      if (solveSigs.has(k)) {
        if (!opts.dryRun) fs.unlinkSync(ap);
        report.totals.deletedAlreadyExisting++;
        deletedExistingForLevel++;
        continue;
      }
      const next = (solveDoc.solutions || []).length + 1;
      solveDoc.solutions.push({ id: `solve-${next}`, label: ad?.label || `Imported ${levelId} ${next}`, placements });
      solveSigs.add(k);
      importedForLevel++;
      report.totals.importedNew++;
      if (!opts.dryRun) fs.unlinkSync(ap);
      report.totals.deletedAfterImport++;
    }

    if (importedForLevel > 0 && !opts.dryRun) {
      solveDoc.totalUniqueSolutions = solveDoc.solutions.length;
      solveDoc.generatedAt = new Date().toISOString();
      fs.writeFileSync(solvePath, JSON.stringify(solveDoc, null, 2) + '\n', 'utf8');
      if (lv.totalUniqueSolutions !== solveDoc.solutions.length) {
        lv.totalUniqueSolutions = solveDoc.solutions.length;
        bucketDirty.add(m.bucketFile);
      }
    }

    if (deletedExistingForLevel || importedForLevel) {
      report.perLevel[levelId] = {
        solvesFile: lv.solvesFile,
        deletedAlreadyExisting: deletedExistingForLevel,
        importedNew: importedForLevel,
        totalNow: solveDoc.solutions.length,
      };
    }
  }

  if (!opts.dryRun) {
    for (const bf of bucketDirty) {
      const m = [...levelMeta.values()].find((x) => x.bucketFile === bf);
      if (m) fs.writeFileSync(m.bucketPath, JSON.stringify(m.bucketDoc, null, 2) + '\n', 'utf8');
    }
  }

  const outPath = path.join(REPORTS_ROOT, `reconcile-${opts.folder}-${Date.now()}.json`);
  if (!opts.dryRun) fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(
    JSON.stringify(
      {
        folder: opts.folder,
        dryRun: opts.dryRun,
        totals: report.totals,
        levelsChanged: Object.keys(report.perLevel).length,
        reportPath: opts.dryRun ? null : path.relative(ROOT, outPath).split(path.sep).join('/'),
      },
      null,
      2
    )
  );
}

main();
