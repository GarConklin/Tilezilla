#!/usr/bin/env node
/**
 * Remove solve files whose play bag belongs on a different catalog id (Type A misfiles).
 * Reads audit output from audit-level-solve-tile-bags.js.
 *
 *   node scripts/fix-misfiled-duplicate-solves.js --dry-run
 *   node scripts/fix-misfiled-duplicate-solves.js --apply
 *   node scripts/fix-misfiled-duplicate-solves.js --apply --report data/solver-runs/level-solve-bag-match-latest.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOLVES_DIR = path.join(ROOT, 'solves');
const RUNS_DIR = path.join(ROOT, 'data', 'solver-runs');

const apply = process.argv.includes('--apply');
let reportPath = path.join(RUNS_DIR, 'level-solve-bag-match-latest.json');
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--report' && process.argv[i + 1]) {
    reportPath = path.isAbsolute(process.argv[i + 1])
      ? process.argv[i + 1]
      : path.join(ROOT, process.argv[i + 1]);
    i++;
  }
}

function main() {
  if (!fs.existsSync(reportPath)) {
    console.error('Missing report. Run: node scripts/audit-level-solve-tile-bags.js --out', reportPath);
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const toRemove = (report.catalogMismatch || []).filter(
    (r) => r.correctCatalogIds && r.correctCatalogIds.length > 0
  );

  const stamp = Date.now();
  const backupDir = path.join(RUNS_DIR, `misfiled-solve-backup-${stamp}`);
  const actions = [];

  for (const r of toRemove) {
    const sf = `${r.id}.json`;
    const sp = path.join(SOLVES_DIR, sf);
    if (!fs.existsSync(sp)) {
      actions.push({ id: r.id, action: 'skip-missing-file', owner: r.correctCatalogIds[0] });
      continue;
    }
    actions.push({
      id: r.id,
      action: apply ? 'removed' : 'would-remove',
      owner: r.correctCatalogIds.join(', '),
      playBag: r.solve1Bag,
      catalogBag: r.catalogBag,
    });
    if (apply) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.copyFileSync(sp, path.join(backupDir, sf));
      fs.unlinkSync(sp);
    }
  }

  const out = path.join(RUNS_DIR, `misfiled-solve-fix-${stamp}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        apply,
        reportPath: path.relative(ROOT, reportPath),
        backupDir: apply ? path.relative(ROOT, backupDir) : null,
        removedCount: actions.filter((a) => a.action === 'removed').length,
        actions,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log(JSON.stringify({ apply, count: toRemove.length, out: path.relative(ROOT, out) }, null, 2));
  for (const a of actions) {
    console.error(`${a.action}: ${a.id} (play bag belongs on ${a.owner})`);
  }
}

main();
