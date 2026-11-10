#!/usr/bin/env node
/**
 * Drop candidate puzzles that already exist elsewhere, before the nightly runner solves them.
 *
 *   node tools/scripts/dedupe-candidate-sets.js [--apply] [--old <old repo>] [--sets a,b,c]
 *
 * Same puzzle = same board, same tile bag (blocker tiles B1/B2 excluded) and same typed blockers, after any
 * whole-board turn (180 degrees; 90/270 too, which also maps a 5x6 onto a 6x5). Compared against, in order:
 * the live catalog (data/levels), the old copy's swap-named specs (solved in its ledger or still waiting),
 * the pair-swap drafts, and earlier sets in --sets order (and earlier puzzles in the same set).
 *
 * Dry run by default. --apply keeps the full list in queue-all.txt (first time only), rewrites queue.txt with
 * the puzzles to solve, writes promote.txt and duplicates.json. 6x6 boards are left out (too slow for nightly).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CAND = path.join(ROOT, 'tools', 'data', 'swap-candidates');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const APPLY = process.argv.includes('--apply');
const OLD = opt('--old', 'C:\\Users\\~Gar\\Tile-Puzzle\\Tilezilla');
const SETS = opt('--sets', 'pasted-new-bags,generated-0c-small,swap-bags').split(',');
const log = (s) => console.log(`[dedupe] ${s}`);

function key(rows, cols, tiles, blockers) {
  const bag = Object.entries(tiles || {})
    .filter(([t, n]) => n > 0 && t !== 'B1' && t !== 'B2')
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([t, n]) => `${t}${n}`)
    .join('.');
  const bl = (blockers || []).map((b) => (Array.isArray(b) ? b : [b.r, b.c, b.tile || b.type]));
  const turns = [
    [rows, cols, ([r, c, t]) => [r, c, t]],
    [rows, cols, ([r, c, t]) => [rows - 1 - r, cols - 1 - c, t]],
    [cols, rows, ([r, c, t]) => [c, rows - 1 - r, t]],
    [cols, rows, ([r, c, t]) => [cols - 1 - c, r, t]],
  ];
  return turns
    .map(([R, C, f]) => `${R}x${C}|${bag}|${bl.map(f).map((x) => x.join(',')).sort().join(';')}`)
    .sort()[0];
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const queueIds = (file) =>
  fs.readFileSync(file, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));

// key -> first place it was seen: { where, id, solved, solutions }
const seen = new Map();
const remember = (k, rec) => { if (!seen.has(k)) seen.set(k, rec); };

// Load the candidate sets first so the big list only needs the sizes they use.
const sets = SETS.map((name) => {
  const dir = path.join(CAND, name);
  const all = fs.existsSync(path.join(dir, 'queue-all.txt')) ? path.join(dir, 'queue-all.txt') : path.join(dir, 'queue.txt');
  const ids = queueIds(all);
  const items = ids.map((id) => {
    const s = readJson(path.join(dir, 'specs', `${id}.json`));
    return { id, rows: s.board.rows, cols: s.board.cols, k: key(s.board.rows, s.board.cols, s.tiles, s.blockers) };
  });
  return { name, dir, items };
});
const sizes = new Set();
for (const s of sets) for (const it of s.items) { sizes.add(`${it.rows}x${it.cols}`); sizes.add(`${it.cols}x${it.rows}`); }

let n = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'levels')).filter((x) => x.endsWith('.json'))) {
  for (const l of readJson(path.join(ROOT, 'data', 'levels', f)).levels || []) {
    remember(key(l.board.rows, l.board.cols, l.tiles, l.blockers), { where: 'catalog', id: l.id, solved: true, solutions: l.totalUniqueSolutions });
    n++;
  }
}
log(`catalog: ${n} levels`);

const named = path.join(OLD, 'tools', 'data', 'solver-runs', 'swap-named');
const ledger = readJson(path.join(named, 'ledger.json'));
const done = ledger.done || {};
const specDir = path.join(named, 'specs');
const files = fs.readdirSync(specDir).filter((f) => {
  const m = /^(\d+)x(\d+)-/.exec(f);
  return m && sizes.has(`${m[1]}x${m[2]}`);
});
log(`old copy swap-named: reading ${files.length} spec(s) of matching board sizes (read-only)`);
let i = 0;
for (const f of files) {
  const id = f.slice(0, -5);
  try {
    const s = readJson(path.join(specDir, f));
    const d = done[id];
    remember(key(s.board.rows, s.board.cols, s.tiles, s.blockers), {
      where: d ? 'old ledger (solved)' : 'old ledger (waiting, in the nightly big list)', id, solved: !!d, solutions: d ? d.solutions : null,
    });
  } catch { /* unreadable spec */ }
  if (++i % 25000 === 0) log(`  ${i}/${files.length}`);
}

const draftDir = path.join(CAND, 'pair-swap-drafts');
for (const id of queueIds(path.join(draftDir, 'queue.txt'))) {
  const s = readJson(path.join(draftDir, 'specs', `${id}.json`));
  remember(key(s.board.rows, s.board.cols, s.tiles, s.blockers), { where: 'pair-swap-drafts', id, solved: false, solutions: null });
}
log('pair-swap drafts loaded');

// A candidate that is still waiting in the old ledger is not solved under a second id: its old-ledger id goes
// in promote.txt, and the nightly import moves that id up to this set's place in the queue.
console.log('');
const WAITING = 'old ledger (waiting, in the nightly big list)';
for (const s of sets) {
  const keep = [];
  const promote = [];
  const dups = [];
  let six = 0;
  const why = {};
  for (const it of s.items) {
    const prev = seen.get(it.k);
    if (prev && prev.where === WAITING && !(it.rows === 6 && it.cols === 6)) {
      promote.push(prev.id);
      dups.push({ id: it.id, sameAs: prev.id, where: prev.where, action: 'promoted (solved under the old-ledger id)' });
      seen.set(it.k, { ...prev, where: `${s.name} (promoted ${prev.id})` });
      continue;
    }
    if (prev) {
      dups.push({ id: it.id, sameAs: prev.id, where: prev.where, solved: prev.solved, solutions: prev.solutions, action: 'dropped' });
      why[prev.where] = (why[prev.where] || 0) + 1;
      continue;
    }
    seen.set(it.k, { where: s.name, id: it.id, solved: false, solutions: null });
    if (it.rows === 6 && it.cols === 6) { six++; continue; }
    keep.push(it.id);
  }
  const dropped = dups.filter((d) => d.action === 'dropped');
  log(`${s.name}: ${s.items.length} total, ${dropped.length} duplicate(s) dropped` +
    `${dropped.length ? ` (${Object.entries(why).map(([w, c]) => `${c} ${w}`).join(', ')})` : ''}` +
    `, ${promote.length} promoted from the waiting list${six ? `, ${six} 6x6 left out` : ''}, ${keep.length} new to solve`);
  for (const d of dups.slice(0, 4)) log(`    e.g. ${d.id} = ${d.sameAs} (${d.where}${d.solutions != null ? `, ${d.solutions} solution(s)` : ''}) - ${d.action}`);
  if (APPLY) {
    const allFile = path.join(s.dir, 'queue-all.txt');
    if (!fs.existsSync(allFile)) fs.copyFileSync(path.join(s.dir, 'queue.txt'), allFile);
    const head = `# ${s.name}: puzzles to solve (queue-all.txt minus duplicates.json and 6x6). Written by dedupe-candidate-sets.js.`;
    fs.writeFileSync(path.join(s.dir, 'queue.txt'), [head, ...keep].join('\n') + '\n');
    const phead = `# ${s.name}: old-ledger puzzles identical to candidates here; the nightly import solves them in this set's place.`;
    fs.writeFileSync(path.join(s.dir, 'promote.txt'), [phead, ...promote].join('\n') + '\n');
    fs.writeFileSync(path.join(s.dir, 'duplicates.json'), JSON.stringify({ note: 'Not in queue.txt: same board, bag and blockers (after a whole-board turn) as sameAs.', duplicates: dups }, null, 1) + '\n');
  }
}
log(APPLY ? 'queue.txt / duplicates.json written.' : 'dry run (add --apply to write queue.txt and duplicates.json)');
