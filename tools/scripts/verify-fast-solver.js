#!/usr/bin/env node
/**
 * Re-solve a sample of puzzles the old copy already solved and compare with its results.
 *
 *   node tools/scripts/verify-fast-solver.js [--old <old repo root>] [--parallel 2]
 *        [--n-0a 150] [--n-small 50] [--ids a,b,c]
 *
 * Reads the old copy's swap-named ledger/specs/enumerated READ-ONLY. Writes the new solves and
 * report.json under tools/data/solver-runs/nightly/verify/<stamp>/. Old per-puzzle times come from
 * the "==> <id> HH:mm:ss" lines in the old swap-parallel worker logs (includes container start).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const { uniqueLayoutKey } = require(path.join(ROOT, 'tools/scripts/lib/layout-equivalence-key.js'));
const TILES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tiles/tiles-live-edges.json'), 'utf8'));

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] != null ? process.argv[i + 1] : def;
}

const OLD = arg('--old', 'C:\\Users\\~Gar\\Tile-Puzzle\\Tilezilla');
const NAMED = path.join(OLD, 'tools', 'data', 'solver-runs', 'swap-named');
const PARALLEL = parseInt(arg('--parallel', '2'), 10);
const N_0A = parseInt(arg('--n-0a', '150'), 10);
const N_SMALL = parseInt(arg('--n-small', '50'), 10);
const MAX_SOL = 500000;

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = path.join(ROOT, 'tools', 'data', 'solver-runs', 'nightly', 'verify', stamp);
fs.mkdirSync(path.join(OUT, 'solves'), { recursive: true });

const group = (id) => id.split('-').slice(0, 2).join('-');
const size = (id) => id.split('-')[0];

function spread(list, n) {
  if (list.length <= n) return list.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor((i * list.length) / n)]);
  return out;
}

function oldTimes() {
  const runs = path.join(OLD, 'tools', 'data', 'solver-runs', 'swap-parallel');
  const times = {};
  if (!fs.existsSync(runs)) return times;
  for (const run of fs.readdirSync(runs)) {
    const dir = path.join(runs, run);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^worker-\d+\.log$/.test(f)); } catch { continue; }
    for (const f of files) {
      const starts = [];
      let failed = new Set();
      for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
        const m = /^==> (\S+)\s+(\d\d):(\d\d):(\d\d)/.exec(line);
        if (m) starts.push([m[1], +m[2] * 3600 + +m[3] * 60 + +m[4]]);
        const fm = /^FAILED (\S+)/.exec(line);
        if (fm) failed.add(fm[1]);
      }
      for (let i = 0; i + 1 < starts.length; i++) {
        const [id, t] = starts[i];
        if (failed.has(id)) continue;
        let d = starts[i + 1][1] - t;
        if (d < 0) d += 86400;
        (times[id] = times[id] || []).push(d);
      }
    }
  }
  return times;
}

function layoutKeys(doc, rows, cols) {
  const keys = new Set();
  for (const s of doc.solutions || []) keys.add(uniqueLayoutKey(s.placements, rows, cols, TILES));
  return keys;
}

function solveOne(id) {
  return new Promise((resolve) => {
    const spec = path.join(NAMED, 'specs', `${id}.json`);
    const outFile = path.join(OUT, 'solves', `${id}.json`);
    const t0 = Date.now();
    const child = spawn(process.execPath, [
      path.join(ROOT, 'solves', 'solve-level.js'),
      '--spec', spec, '--viable-seeds-only', '--json-summary', '--max-sol', String(MAX_SOL),
      '--write-solves', outFile,
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    child.on('close', (code) => {
      const secs = (Date.now() - t0) / 1000;
      let summary = null;
      for (const line of out.split(/\r?\n/)) {
        if (line.trim().startsWith('{') && line.includes('"totalUniqueSolutions"')) {
          try { summary = JSON.parse(line.trim()); } catch { /* ignore */ }
        }
      }
      resolve({ code, secs, summary, outFile, errTail: err.split(/\r?\n/).slice(-5).join(' | ') });
    });
  });
}

async function main() {
  const ledger = JSON.parse(fs.readFileSync(path.join(NAMED, 'ledger.json'), 'utf8'));
  const done = ledger.done || {};
  const hasSpec = (id) => fs.existsSync(path.join(NAMED, 'specs', `${id}.json`));
  const solved = Object.keys(done).filter((id) => done[id] && done[id].exit === 0 && done[id].solutions != null).sort();

  let ids;
  const only = arg('--ids', '');
  if (only) ids = only.split(',').map((s) => s.trim()).filter(Boolean);
  else {
    const by = (g) => solved.filter((id) => group(id) === g && hasSpec(id));
    const smallSizes = ['4x5', '4x6', '5x5'];
    const smallPool = smallSizes.map((s) => solved.filter((id) => size(id) === s && hasSpec(id)));
    const perSize = Math.ceil(N_SMALL / smallSizes.length);
    const small = [];
    smallPool.forEach((pool) => small.push(...spread(pool, perSize)));
    ids = [...spread(by('5x6-0A'), N_0A), ...by('5x6-0B'), ...small];
  }

  const times = oldTimes();
  const total = ids.length;
  console.log(`[verify] ${total} puzzles, ${PARALLEL} at a time. Output: ${OUT}`);
  const rows = [];
  let next = 0;
  let finished = 0;
  const t0 = Date.now();

  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      const r = await solveOne(id);
      const oldCount = done[id] ? done[id].solutions : null;
      const newCount = r.summary ? r.summary.totalUniqueSolutions : null;
      const row = {
        id, group: group(id), size: size(id), oldCount, newCount,
        capped: r.summary ? !!r.summary.hitMaxSolCap : null,
        exit: r.code, newSecs: +r.secs.toFixed(2),
        oldSecs: times[id] ? Math.min(...times[id]) : null,
        countMatch: oldCount === newCount,
        layouts: 'n/a',
      };
      const oldEnum = path.join(NAMED, 'enumerated', `${id}.json`);
      if (newCount > 0 && fs.existsSync(oldEnum) && fs.existsSync(r.outFile)) {
        try {
          const a = JSON.parse(fs.readFileSync(oldEnum, 'utf8'));
          const b = JSON.parse(fs.readFileSync(r.outFile, 'utf8'));
          const rr = b.board.rows;
          const cc = b.board.cols;
          const ka = layoutKeys(a, rr, cc);
          const kb = layoutKeys(b, rr, cc);
          let onlyOld = 0;
          let onlyNew = 0;
          for (const k of ka) if (!kb.has(k)) onlyOld++;
          for (const k of kb) if (!ka.has(k)) onlyNew++;
          row.layouts = onlyOld === 0 && onlyNew === 0 ? 'same' : `DIFF onlyOld=${onlyOld} onlyNew=${onlyNew}`;
        } catch (e) {
          row.layouts = `error ${e.message}`;
        }
      } else if (newCount === 0 && oldCount === 0) row.layouts = 'both 0';
      if (r.code !== 0) row.err = r.errTail;
      rows.push(row);
      finished++;
      const ok = row.countMatch && !String(row.layouts).startsWith('DIFF');
      console.log(`[verify] ${finished}/${total} ${id} old=${oldCount} new=${newCount} layouts=${row.layouts} ` +
        `new ${row.newSecs}s old ${row.oldSecs == null ? '?' : row.oldSecs + 's'} ${ok ? 'OK' : 'MISMATCH'}` +
        ` (elapsed ${Math.round((Date.now() - t0) / 1000)}s)`);
      fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 1));
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const med = (a) => {
    const s = a.filter((x) => x != null).sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  const allOld = {};
  for (const [id, ts] of Object.entries(times)) (allOld[group(id)] = allOld[group(id)] || []).push(Math.min(...ts));
  const groups = [...new Set(rows.map((r) => r.group))].sort();
  console.log('');
  console.log('group      sampled  countMatch  layoutsSame  mismatches  newMedian  newMax  oldMedian(sample)  oldMedian(all logs)');
  const summary = [];
  for (const g of groups) {
    const rs = rows.filter((r) => r.group === g);
    const s = {
      group: g,
      sampled: rs.length,
      countMatch: rs.filter((r) => r.countMatch).length,
      layoutsSame: rs.filter((r) => r.layouts === 'same' || r.layouts === 'both 0').length,
      mismatches: rs.filter((r) => !r.countMatch || String(r.layouts).startsWith('DIFF')).map((r) => r.id),
      newMedianSecs: med(rs.map((r) => r.newSecs)),
      newMaxSecs: Math.max(...rs.map((r) => r.newSecs)),
      oldMedianSecsSample: med(rs.map((r) => r.oldSecs)),
      oldMedianSecsAllLogs: med(allOld[g] || []),
    };
    summary.push(s);
    console.log(`${g.padEnd(10)} ${String(s.sampled).padStart(7)} ${String(s.countMatch).padStart(11)} ${String(s.layoutsSame).padStart(12)} ` +
      `${String(s.mismatches.length).padStart(11)} ${String(s.newMedianSecs).padStart(10)} ${String(s.newMaxSecs).padStart(7)} ` +
      `${String(s.oldMedianSecsSample).padStart(18)} ${String(s.oldMedianSecsAllLogs).padStart(20)}`);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  const bad = rows.filter((r) => !r.countMatch || String(r.layouts).startsWith('DIFF'));
  console.log(`[verify] done in ${Math.round((Date.now() - t0) / 1000)}s. ${bad.length} mismatch(es). Report: ${path.join(OUT, 'report.json')}`);
  for (const r of bad) console.log(`[verify] MISMATCH ${r.id} old=${r.oldCount} new=${r.newCount} layouts=${r.layouts} exit=${r.exit} ${r.err || ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
