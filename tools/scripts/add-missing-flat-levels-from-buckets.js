#!/usr/bin/env node
/**
 * Add bucket levels (data/levels/<size>-<tier>.json) that are missing from data/levels/levels.json.
 * levels.json is what import-catalog-to-mysql.py reads, so a level missing there has no MySQL row.
 *
 * Add-only: existing levels.json rows are never changed or reordered. Each new row is a copy of its
 * bucket entry with totalUniqueSolutions taken from solves/<solvesFile>, inserted after the nearest
 * earlier level (in index/bucket order) that is already in levels.json. Sandbox *-ZZZ ids are skipped.
 *
 * Default: --dry-run. Use --apply to write levels.json.
 *
 *   node tools/scripts/add-missing-flat-levels-from-buckets.js
 *   node tools/scripts/add-missing-flat-levels-from-buckets.js --apply
 *   node tools/scripts/add-missing-flat-levels-from-buckets.js --apply --ids 5x6-0B-DNR,6x6-0B-AAC
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const FLAT_PATH = path.join(LEVELS_DIR, 'levels.json');
const SOLVES_DIR = path.join(ROOT, 'solves');
const SANDBOX = /-ZZZ$/;

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const idsArg = argv.indexOf('--ids') >= 0 ? argv[argv.indexOf('--ids') + 1] : null;
const onlyIds = idsArg ? new Set(idsArg.split(/[,\s]+/).filter(Boolean)) : null;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function solveCount(solvesFile) {
  const p = path.join(SOLVES_DIR, ...String(solvesFile).split('/'));
  if (!fs.existsSync(p)) return null;
  const doc = readJson(p);
  if (Number.isInteger(doc.totalUniqueSolutions)) return doc.totalUniqueSolutions;
  return Array.isArray(doc.solutions) ? doc.solutions.length : null;
}

function main() {
  const index = readJson(INDEX_PATH);
  const flat = readJson(FLAT_PATH);
  const flatIds = new Set(flat.levels.map((l) => l.id));

  const ordered = [];
  for (const b of index.buckets) {
    for (const lv of readJson(path.join(LEVELS_DIR, b.file)).levels || []) ordered.push(lv);
  }

  const toAdd = [];
  const problems = [];
  let anchor = null;
  for (const lv of ordered) {
    if (flatIds.has(lv.id)) { anchor = lv.id; continue; }
    if (SANDBOX.test(lv.id) || (onlyIds && !onlyIds.has(lv.id))) continue;
    const solvesFile = lv.solvesFile || `${lv.id}.json`;
    const n = solveCount(solvesFile);
    if (n == null || n < 1) { problems.push(`${lv.id}: no usable solve file solves/${solvesFile}`); continue; }
    const row = JSON.parse(JSON.stringify(lv));
    if (row.totalUniqueSolutions !== n) {
      console.log(`  ${lv.id}: bucket totalUniqueSolutions ${row.totalUniqueSolutions} -> ${n} (solve file)`);
      row.totalUniqueSolutions = n;
    }
    toAdd.push({ row, after: anchor });
    anchor = lv.id;
  }

  const groups = {};
  for (const { row } of toAdd) {
    const g = row.id.split('-').slice(0, 2).join('-');
    (groups[g] ||= []).push(row.id.split('-')[2]);
  }
  for (const [g, names] of Object.entries(groups)) {
    console.log(`  ${g}: ${names.length} (${names.length > 6 ? `${names[0]}..${names[names.length - 1]}` : names.join(', ')})`);
  }
  for (const p of problems) console.log(`  SKIP ${p}`);
  console.log(`levels.json rows: ${flat.levels.length}; missing bucket levels to add: ${toAdd.length}`);

  if (!apply) {
    console.log('Dry run. Re-run with --apply to write levels.json.');
    return;
  }
  if (!toAdd.length) return;

  const after = new Map();
  const head = [];
  const listOf = new Map();
  for (const { row, after: a } of toAdd) {
    let list;
    if (a == null) list = head;
    else if (flatIds.has(a)) list = after.get(a) || after.set(a, []).get(a);
    else list = listOf.get(a);
    list.push(row);
    listOf.set(row.id, list);
  }
  const out = [...head];
  for (const l of flat.levels) {
    out.push(l);
    if (after.has(l.id)) out.push(...after.get(l.id));
  }
  if (out.length !== flat.levels.length + toAdd.length) throw new Error('insert bookkeeping failed');
  flat.levels = out;
  fs.writeFileSync(FLAT_PATH, JSON.stringify(flat, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${FLAT_PATH} (${out.length} rows)`);
}

main();
