#!/usr/bin/env node
/**
 * Export every puzzle as Excel-friendly CSVs (UTF-8 with BOM) for sorting adventure paths,
 * challenge sets and Head2Head pools.
 *
 *   node tools/scripts/export-puzzle-list.js [--out tools/data/catalog-export] [--no-candidates]
 *
 * Writes:
 *   catalog-puzzles.csv       every catalog level (data/levels/index.json buckets), one row per level,
 *                             with adventure position (data/adventure_path.json) and daily dates
 *                             (data/daily_challenges_import.csv + data/daily_sols_calendar.csv)
 *   catalog-summary.csv       totals per board / tier and status
 *   nightly-candidates.csv    solved puzzles (> 0 solutions) that are not in the catalog: nightly run
 *                             results plus the candidate sets' results-progress files (git-ignored)
 *
 * Nightly state (tools/data/solver-runs/nightly) is only ever read, never written or locked,
 * so this is safe while a nightly run is going.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const NIGHTLY = path.join(ROOT, 'tools', 'data', 'solver-runs', 'nightly');
const CAND = path.join(ROOT, 'tools', 'data', 'swap-candidates');
// nightly group -> candidate set folder (same as SETS in nightly-solves.js)
const SET_DIRS = {
  'pasted-new-bags': 'pasted-new-bags',
  'generated-0c-small': 'generated-0c-small',
  'swap-bags': 'swap-bags',
  drafts: 'pair-swap-drafts',
};

const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : null;
const OUT = path.resolve(ROOT, outArg || path.join('tools', 'data', 'catalog-export'));
const withCandidates = !argv.includes('--no-candidates');

const readJson = (p, def) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch { if (def !== undefined) return def; throw new Error(`cannot read ${p}`); }
};
const readLines = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : []);

function parseCsv(p) {
  const lines = readLines(p).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (l) => l.replace(/^\uFEFF/, '').split(',').map((s) => s.trim());
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

function isoDate(s) {
  s = (s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return s;
}

const TILE_ORDER = ['SH', 'ET'];
function bagString(tiles) {
  const keys = Object.keys(tiles || {}).filter((k) => tiles[k] > 0);
  keys.sort((a, b) => {
    const ia = TILE_ORDER.indexOf(a), ib = TILE_ORDER.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b);
  });
  return keys.map((k) => `${k}${tiles[k]}`).join(' ');
}
const tileCount = (tiles) => Object.values(tiles || {}).reduce((s, n) => s + (+n || 0), 0);
const bagKey = (size, tiles, blockers) =>
  `${size}|${bagString(tiles)}|${(blockers || []).map((b) => b.join(':')).sort().join(';')}`;

function blockerInfo(blockers) {
  const list = Array.isArray(blockers) ? blockers : [];
  const types = {};
  for (const b of list) { const t = b[2] || 'B?'; types[t] = (types[t] || 0) + 1; }
  return {
    count: list.length,
    types: Object.keys(types).sort().map((t) => `${t}x${types[t]}`).join(' '),
    cells: list.map((b) => `r${b[0]}c${b[1]}${b[2] ? `:${b[2]}` : ''}`).join(' '),
  };
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file, columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  fs.writeFileSync(file, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
  console.log(`wrote ${path.relative(ROOT, file)} (${rows.length} rows)`);
}

const idOrder = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const sizeOrder = (a, b) => {
  const [ar, ac] = a.split('x').map(Number), [br, bc] = b.split('x').map(Number);
  return ar * ac - br * bc || ar - br || ac - bc;
};

// ---------------------------------------------------------------- catalog

function loadAdventure() {
  const doc = readJson(path.join(ROOT, 'data', 'adventure_path.json'), { steps: [], postgame: [] });
  const ranks = readJson(path.join(ROOT, 'data', 'adventure_ranks.json'), []);
  const rankName = new Map(ranks.map((r) => [r.rank_id, `${r.rank_code} ${r.rank_name}`]));
  const byId = new Map();
  const add = (p, section) => {
    const list = byId.get(p.levelId) || byId.set(p.levelId, []).get(p.levelId);
    list.push({ ...p, section, rankLabel: rankName.get(p.rankId) || '' });
  };
  for (const s of doc.steps || []) for (const p of s.puzzles || []) add(p, 'main');
  for (const p of doc.postgame || []) add(p, 'postgame');
  return byId;
}

function loadDaily() {
  const byId = new Map();
  const add = (id, date, schedule, total) => {
    id = (id || '').replace(/\.json$/, '').trim();
    if (!id || !date) return;
    const e = byId.get(id) || byId.set(id, new Map()).get(id);
    const prev = e.get(date) || {};
    e.set(date, { schedule: schedule || prev.schedule || '', total: total || prev.total || '' });
  };
  for (const r of parseCsv(path.join(ROOT, 'data', 'daily_challenges_import.csv'))) add(r.level_id, isoDate(r.challenge_date), '', r.total_solutions);
  for (const r of parseCsv(path.join(ROOT, 'data', 'daily_sols_calendar.csv'))) add(r.level_id, isoDate(r.date), r.schedule, r.total_solutions);
  return byId;
}

function exportCatalog() {
  const index = readJson(path.join(LEVELS_DIR, 'index.json'));
  const flatIds = new Set((readJson(path.join(LEVELS_DIR, 'levels.json')).levels || []).map((l) => l.id));
  const adventure = loadAdventure();
  const daily = loadDaily();

  const rows = [];
  const bagIndex = new Map();
  for (const b of index.buckets) {
    for (const lv of readJson(path.join(LEVELS_DIR, b.file)).levels || []) {
      if (/-ZZZ$/.test(lv.id)) continue;
      const [size, tier, name] = lv.id.split('-');
      const bl = blockerInfo(lv.blockers);
      const adv = (adventure.get(lv.id) || []).sort((x, y) => x.advId - y.advId);
      const days = [...(daily.get(lv.id) || new Map()).entries()].sort(([a], [b2]) => a.localeCompare(b2));
      const inAdv = adv.length > 0, inDaily = days.length > 0;
      const a0 = adv[0] || {};
      rows.push({
        level_id: lv.id,
        board: size,
        rows: lv.board && lv.board.rows,
        cols: lv.board && lv.board.cols,
        tier,
        name: lv.name || name,
        tile_bag: bagString(lv.tiles),
        tile_count: tileCount(lv.tiles),
        tile_types: Object.keys(lv.tiles || {}).length,
        blocker_count: bl.count,
        blocker_types: bl.types,
        blocker_cells: bl.cells,
        path_mode: lv.pathMode || '',
        path_count: lv.pathCount != null ? lv.pathCount : '',
        solution_count: lv.totalUniqueSolutions != null ? lv.totalUniqueSolutions : '',
        status: inAdv && inDaily ? 'both' : inAdv ? 'adventure' : inDaily ? 'daily' : 'unreleased',
        adventure_section: adv.map((p) => p.section).join(';'),
        adventure_adv_id: adv.map((p) => p.advId).join(';'),
        adventure_rank: a0.rankId != null ? a0.rankId : '',
        adventure_rank_name: a0.rankLabel || '',
        adventure_sublevel: a0.subLevel != null ? a0.subLevel : '',
        adventure_puzzle_order: a0.puzzleOrder != null ? a0.puzzleOrder : '',
        adventure_is_challenge: inAdv ? (adv.some((p) => p.isChallenge) ? 'yes' : 'no') : '',
        daily_count: days.length,
        daily_first: days.length ? days[0][0] : '',
        daily_last: days.length ? days[days.length - 1][0] : '',
        daily_dates: days.map(([d]) => d).join(' '),
        daily_schedule: [...new Set(days.map(([, v]) => v.schedule).filter(Boolean))].join(';'),
        in_levels_json: flatIds.has(lv.id) ? 'yes' : 'no',
        bucket_file: b.file,
      });
      const k = bagKey(size, lv.tiles, lv.blockers);
      (bagIndex.get(k) || bagIndex.set(k, []).get(k)).push(lv.id);
    }
  }
  rows.sort((x, y) => sizeOrder(x.board, y.board) || x.tier.localeCompare(y.tier) || idOrder(x.level_id, y.level_id));

  const columns = [
    'level_id', 'board', 'rows', 'cols', 'tier', 'name', 'tile_bag', 'tile_count', 'tile_types',
    'blocker_count', 'blocker_types', 'blocker_cells', 'path_mode', 'path_count', 'solution_count', 'status',
    'adventure_section', 'adventure_adv_id', 'adventure_rank', 'adventure_rank_name', 'adventure_sublevel',
    'adventure_puzzle_order', 'adventure_is_challenge', 'daily_count', 'daily_first', 'daily_last',
    'daily_dates', 'daily_schedule', 'in_levels_json', 'bucket_file',
  ];
  writeCsv(path.join(OUT, 'catalog-puzzles.csv'), columns, rows);

  const known = new Set(rows.map((r) => r.level_id));
  const advMissing = [...adventure.keys()].filter((id) => !known.has(id));
  const dailyMissing = [...daily.keys()].filter((id) => !known.has(id));
  if (advMissing.length) console.log(`WARN adventure ids not in catalog: ${advMissing.length} (${advMissing.slice(0, 5).join(', ')})`);
  if (dailyMissing.length) console.log(`WARN daily ids not in catalog: ${dailyMissing.length} (${dailyMissing.slice(0, 5).join(', ')})`);

  const summary = new Map();
  const bump = (board, tier, r) => {
    const k = `${board}|${tier}`;
    const s = summary.get(k) || summary.set(k, { board, tier, total: 0, adventure: 0, daily: 0, both: 0, unreleased: 0, solutions: 0, not_in_levels_json: 0 }).get(k);
    s.total++; s[r.status]++; s.solutions += +r.solution_count || 0;
    if (r.in_levels_json !== 'yes') s.not_in_levels_json++;
  };
  for (const r of rows) { bump(r.board, r.tier, r); bump(r.board, 'all', r); bump('all', 'all', r); }
  const sumRows = [...summary.values()].sort((a, b) =>
    (a.board === 'all') - (b.board === 'all') || (a.board !== 'all' && b.board !== 'all' ? sizeOrder(a.board, b.board) : 0) ||
    (a.tier === 'all') - (b.tier === 'all') || a.tier.localeCompare(b.tier));
  writeCsv(path.join(OUT, 'catalog-summary.csv'),
    ['board', 'tier', 'total', 'adventure', 'daily', 'both', 'unreleased', 'solutions', 'not_in_levels_json'], sumRows);
  for (const s of sumRows) {
    console.log(`  ${s.board.padEnd(4)} ${s.tier.padEnd(4)} total ${String(s.total).padStart(5)}  adventure ${String(s.adventure).padStart(5)}  daily ${String(s.daily).padStart(4)}  both ${String(s.both).padStart(3)}  unreleased ${String(s.unreleased).padStart(5)}`);
  }
  return { known, bagIndex };
}

// ---------------------------------------------------------------- nightly candidates

function exportCandidates({ known, bagIndex }) {
  const found = new Map();
  const take = (id, rec) => {
    const prev = found.get(id);
    if (!prev || rec.rank > prev.rank || (rec.rank === prev.rank && (rec.ts || '') > (prev.ts || ''))) found.set(id, rec);
  };
  // Lowest priority first: old swap-parallel results, set progress files, then nightly results.ndjson.
  const oldRuns = readJson(path.join(NIGHTLY, 'old-run-results.json'), {});
  for (const [id, r] of Object.entries(oldRuns)) {
    if (r && r.exit === 0) take(id, { group: id.split('-').slice(0, 2).join('-'), solutions: r.solutions, capped: false, ts: '', run: r.run || '', source: 'old-run-results.json', rank: 0 });
  }
  for (const [group, dir] of Object.entries(SET_DIRS)) {
    for (const line of readLines(path.join(CAND, dir, 'results-progress.ndjson'))) {
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (r.exit !== 0 || r.totalUniqueSolutions == null) continue;
      take(r.id, { group, solutions: r.totalUniqueSolutions, capped: !!r.hitMaxSolCap, ts: r.ts || '', run: '', source: `${dir}/results-progress.ndjson`, rank: 1 });
    }
  }
  for (const line of readLines(path.join(NIGHTLY, 'results.ndjson'))) {
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.status !== 'ok') continue;
    take(r.id, { group: r.group, solutions: r.solutions, capped: !!r.capped, ts: r.ts || '', run: r.run || '', source: 'nightly/results.ndjson', rank: 2 });
  }

  const rows = [];
  let zero = 0, inCatalog = 0, noSpec = 0;
  for (const [id, r] of found) {
    if (!(r.solutions > 0)) { zero++; continue; }
    const setDir = SET_DIRS[r.group];
    const specPath = setDir ? path.join(CAND, setDir, 'specs', `${id}.json`) : path.join(NIGHTLY, 'specs', `${id}.json`);
    const spec = readJson(specPath, null);
    if (!spec) noSpec++;
    const tiles = spec ? spec.tiles : null;
    const size = (spec && spec.size) || (/^\d+x\d+/.exec(id) || [''])[0];
    const key = tiles ? bagKey(size, tiles, spec.blockers) : null;
    const sameBag = key ? bagIndex.get(key) || [] : [];
    if (known.has(id) && (sameBag.includes(id) || !tiles)) { inCatalog++; continue; }
    const src = spec && Array.isArray(spec.sources) && spec.sources[0];
    const bl = blockerInfo(spec && spec.blockers);
    rows.push({
      candidate_id: id,
      source_set: r.group,
      board: size,
      rows: spec && spec.board ? spec.board.rows : '',
      cols: spec && spec.board ? spec.board.cols : '',
      tier: (spec && spec.tier) || id.split('-')[1] || '',
      tile_bag: tiles ? bagString(tiles) : '',
      tile_count: tiles ? tileCount(tiles) : '',
      blocker_count: bl.count,
      solution_count: r.solutions,
      capped: r.capped ? 'yes' : '',
      solved_at: r.ts,
      run: r.run,
      result_source: r.source,
      derived_from: (spec && spec.from) || (src && src.level) || '',
      swap: spec && spec.swapOut ? `${spec.swapOut.join('+')} -> ${(spec.swapIn || []).join('+')}` : src ? `${src.found || ''} -> ${src.replaceWith || ''}` : '',
      same_bag_as_catalog: sameBag.join(' '),
      id_also_in_catalog: known.has(id) ? 'yes (different bag)' : '',
      spec_file: spec ? path.relative(ROOT, specPath).replace(/\\/g, '/') : 'missing',
    });
  }
  rows.sort((a, b) => sizeOrder(a.board || '0x0', b.board || '0x0') || a.tier.localeCompare(b.tier) || a.source_set.localeCompare(b.source_set) || idOrder(a.candidate_id, b.candidate_id));
  writeCsv(path.join(OUT, 'nightly-candidates.csv'), [
    'candidate_id', 'source_set', 'board', 'rows', 'cols', 'tier', 'tile_bag', 'tile_count', 'blocker_count',
    'solution_count', 'capped', 'solved_at', 'run', 'result_source', 'derived_from', 'swap',
    'same_bag_as_catalog', 'id_also_in_catalog', 'spec_file',
  ], rows);
  const bySet = {};
  for (const r of rows) bySet[r.source_set] = (bySet[r.source_set] || 0) + 1;
  console.log(`  candidates by set: ${Object.entries(bySet).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  skipped: ${zero} with 0 solutions, ${inCatalog} already in catalog; ${noSpec} without a spec file`);
  console.log(`  ${rows.filter((r) => r.same_bag_as_catalog).length} candidates have the same bag as a catalog level`);
}

fs.mkdirSync(OUT, { recursive: true });
const cat = exportCatalog();
if (withCandidates) exportCandidates(cat);
