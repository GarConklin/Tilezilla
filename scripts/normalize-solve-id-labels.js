#!/usr/bin/env node
/**
 * Normalize solution id/label inside solves/*.json (never renames files).
 *
 * Per solution[i]:
 *   id:    solve-{i+1}
 *   label: {levelId} solve {i+1}
 * levelId = filename without .json unless --use-doc-level-id and doc.levelId is set.
 *
 * Safety:
 *   Default: --dry-run (no writes)
 *   --apply: write changes
 *   --backup: before each changed file, copy to data/solver-runs/solve-label-backup-<ts>/
 *   --file <path>: only one file
 *   --limit N: cap files changed per run
 *
 * Usage:
 *   node scripts/normalize-solve-id-labels.js
 *   node scripts/normalize-solve-id-labels.js --apply --backup --file solves/5x6-0B-AEM.json
 *   node scripts/normalize-solve-id-labels.js --apply --backup --limit 100
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOLVES_DIR = path.join(ROOT, 'solves');
const OUT_DIR = path.join(ROOT, 'data', 'solver-runs');

const SKIP_FILES = new Set([
  'migrate-apply-report.json',
  'migrate-dry-run-report.json',
]);

function parseArgs() {
  let dryRun = true;
  let backup = false;
  let oneFile = null;
  let limit = Infinity;
  let useDocLevelId = false;
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--apply') dryRun = false;
    else if (a === '--backup') backup = true;
    else if (a === '--use-doc-level-id') useDocLevelId = true;
    else if (a === '--file' && process.argv[i + 1]) {
      oneFile = process.argv[++i];
    } else if (a === '--limit' && process.argv[i + 1]) {
      limit = parseInt(process.argv[++i], 10) || Infinity;
    }
  }
  return { dryRun, backup, oneFile, limit, useDocLevelId };
}

function expected(levelId, index) {
  const n = index + 1;
  return { id: `solve-${n}`, label: `${levelId} solve ${n}` };
}

function planFile(fp, useDocLevelId) {
  const base = path.basename(fp);
  if (SKIP_FILES.has(base)) return null;
  const fromName = base.replace(/\.json$/i, '');
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return { file: base, error: e.message };
  }
  const levelId = useDocLevelId && doc.levelId ? doc.levelId : fromName;
  const sols = doc.solutions || [];
  const changes = [];
  for (let i = 0; i < sols.length; i++) {
    const exp = expected(levelId, i);
    const sol = sols[i];
    if (sol.id !== exp.id || sol.label !== exp.label) {
      changes.push({
        index: i,
        from: { id: sol.id, label: sol.label },
        to: exp,
      });
      sol.id = exp.id;
      sol.label = exp.label;
    }
  }
  let levelIdFix = null;
  if (doc.levelId !== levelId) {
    levelIdFix = { from: doc.levelId, to: levelId };
    doc.levelId = levelId;
  }
  const countFix =
    doc.totalUniqueSolutions !== sols.length
      ? { from: doc.totalUniqueSolutions, to: sols.length }
      : null;
  if (countFix) doc.totalUniqueSolutions = sols.length;

  if (!changes.length && !levelIdFix && !countFix) return null;
  return { file: base, path: fp, levelId, changes, levelIdFix, countFix, doc };
}

function main() {
  const { dryRun, backup, oneFile, limit, useDocLevelId } = parseArgs();
  const ts = Date.now();
  const backupDir = path.join(OUT_DIR, `solve-label-backup-${ts}`);

  let files;
  if (oneFile) {
    files = [path.isAbsolute(oneFile) ? oneFile : path.join(ROOT, oneFile)];
  } else {
    files = fs
      .readdirSync(SOLVES_DIR)
      .filter((f) => f.endsWith('.json') && !f.includes('solve-level'))
      .filter((f) => !SKIP_FILES.has(f))
      .map((f) => path.join(SOLVES_DIR, f))
      .sort();
  }

  const plans = [];
  for (const fp of files) {
    const p = planFile(fp, useDocLevelId);
    if (p && !p.error) plans.push(p);
    else if (p?.error) console.error('skip', p.file, p.error);
  }

  const toApply = plans.slice(0, limit);
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    backup,
    filesNeedingChange: plans.length,
    filesToApply: toApply.length,
    samples: toApply.slice(0, 30).map((p) => ({
      file: p.file,
      levelId: p.levelId,
      changes: p.changes,
      levelIdFix: p.levelIdFix,
      countFix: p.countFix,
    })),
  };

  if (!dryRun && backup && toApply.length) {
    fs.mkdirSync(backupDir, { recursive: true });
    report.backupDir = backupDir;
  }

  let written = 0;
  for (const p of toApply) {
    if (!dryRun) {
      if (backup) {
        fs.copyFileSync(p.path, path.join(backupDir, p.file));
      }
      fs.writeFileSync(p.path, JSON.stringify(p.doc, null, 2) + '\n', 'utf8');
      written++;
    }
  }

  report.written = dryRun ? 0 : written;
  const outPath = path.join(OUT_DIR, `solve-id-label-normalize-${ts}.json`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(
    JSON.stringify(
      {
        dryRun,
        filesNeedingChange: plans.length,
        wouldWrite: toApply.length,
        written: report.written,
        backupDir: report.backupDir || null,
        report: outPath,
      },
      null,
      2
    )
  );
}

main();
