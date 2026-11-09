#!/usr/bin/env node
/**
 * Record a finished homemade enumeration onto the seed draft and the draft index.
 * Usage: node tools/scripts/record-qz-homemade-enum.js <id> <hitMaxSolCap 0|1>
 * Reads tools/data/solver-runs/qz-drafts/enumerated/<id>.json
 */
const fs = require('fs');
const path = require('path');

const id = process.argv[2];
const hit = process.argv[3] === '1';
if (!id || !/^qz-homemade-\d+$/.test(id)) {
  console.error('Usage: node tools/scripts/record-qz-homemade-enum.js qz-homemade-N 0|1');
  process.exit(1);
}

const enumPath = path.join('tools/data/solver-runs/qz-drafts/enumerated', `${id}.json`);
const draftPath = path.join('tools/data/solver-runs/qz-drafts', `${id}.json`);
const indexPath = path.join('tools/data/solver-runs/qz-drafts/index.json');
const enumerated = JSON.parse(fs.readFileSync(enumPath, 'utf8'));
const count = enumerated.totalUniqueSolutions;
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
draft.id = id;
draft.totalUniqueSolutions = count;
draft.hitMaxSolCap = hit;
draft.enumeratedFile = `tools/data/solver-runs/qz-drafts/enumerated/${id}.json`;
draft.note = hit
  ? `Enumeration hit the solution cap at ${count}. Full layouts in enumerated/${id}.json. Not in the published catalog.`
  : `Enumerated ${count} unique solution(s). Full layouts in enumerated/${id}.json. Not in the published catalog.`;
fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2) + '\n');

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const row = (index.handmade || []).find((h) => h.file === `${id}.json`);
if (row) {
  row.totalUniqueSolutions = count;
  row.hitMaxSolCap = hit;
  row.enumeratedFile = `enumerated/${id}.json`;
}
index.note =
  '5x6 0B handmade drafts. Counts are unique solutions from solves/solve-level.js. Not in the published catalog.';
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(JSON.stringify({ id, totalUniqueSolutions: count, hitMaxSolCap: hit }));
