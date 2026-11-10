#!/usr/bin/env node
/**
 * Local nightly solver queue (one PC, plain Node, no Docker, no ports).
 *
 *   node tools/scripts/nightly-solves.js import  [--old <old repo>] [--skip-old-run-results]
 *   node tools/scripts/nightly-solves.js run     [--workers 8] [--until <ISO time>] [--grace-min 10]
 *                                                [--limit N] [--per-group N] [--timeout-min 60] [--retry-failed]
 *   node tools/scripts/nightly-solves.js watch | status | stop | export [--old <old repo>]
 *
 * State lives in tools/data/solver-runs/nightly/ (git-ignored):
 *   queue.json            ordered work list [[id, group]]: candidate sets (SETS order), then smallest boards
 *   specs/<id>.json       spec copies imported from the old copy's swap-named/specs (sets use the repo spec)
 *   results.ndjson        one line per finished puzzle, appended and fsynced the moment it finishes
 *   enumerated/<id>.json  full solutions for swap-named puzzles (same format as the old enumerated/)
 *   old-run-results.json  results the old copy's swap-parallel runs found but never recorded
 *   status.json           live status for `watch`; STOP asks a running runner to finish in-flight and exit
 * Candidate-set solutions go to tools/data/swap-candidates/<set>/results/<id>.json (+ results-progress.ndjson)
 * like run-candidate-queue.ps1. The old copy is only ever read.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const STATE = path.join(ROOT, 'tools', 'data', 'solver-runs', 'nightly');
const CAND_REL = 'tools/data/swap-candidates';
// Candidate sets, solved in this order before the old waiting list. Group name -> folder under CAND_REL.
const SETS = [
  ['pasted-new-bags', 'pasted-new-bags'],
  ['generated-0c-small', 'generated-0c-small'],
  ['swap-bags', 'swap-bags'],
  ['drafts', 'pair-swap-drafts'],
];
const SET_DIR = new Map(SETS.map(([g, dir]) => [g, path.join(ROOT, ...CAND_REL.split('/'), dir)]));
const isSet = (g) => SET_DIR.has(g);
const setDone = (g) => {
  const dir = path.join(SET_DIR.get(g), 'results');
  return fs.existsSync(dir) ? new Set(fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5))) : new Set();
};
const SOLVER = path.join(ROOT, 'solves', 'solve-level.js');
const MAX_SOL = 500000;
const MAX_ATTEMPTS = 2;
const DEFAULT_OLD = 'C:\\Users\\~Gar\\Tile-Puzzle\\Tilezilla';

const P = {
  queue: path.join(STATE, 'queue.json'),
  specs: path.join(STATE, 'specs'),
  results: path.join(STATE, 'results.ndjson'),
  enumerated: path.join(STATE, 'enumerated'),
  oldRuns: path.join(STATE, 'old-run-results.json'),
  importInfo: path.join(STATE, 'import.json'),
  status: path.join(STATE, 'status.json'),
  stop: path.join(STATE, 'STOP'),
  lock: path.join(STATE, 'runner.lock'),
  work: path.join(STATE, 'work'),
  logs: path.join(STATE, 'logs'),
  exports: path.join(STATE, 'export'),
};

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] != null && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(name);
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const stampNow = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const hhmm = (ms) => {
  if (ms == null || !isFinite(ms)) return '?';
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
};
const clock = (t) => new Date(t).toTimeString().slice(0, 8);

function oldPaths(old) {
  const runs = path.join(old, 'tools', 'data', 'solver-runs');
  return {
    named: path.join(runs, 'swap-named'),
    ledger: path.join(runs, 'swap-named', 'ledger.json'),
    specs: path.join(runs, 'swap-named', 'specs'),
    renumberMap: path.join(runs, 'swap-named', 'mapping-renumber.json'),
    parallel: path.join(runs, 'swap-parallel'),
  };
}

function groupOf(id) {
  return id.split('-').slice(0, 2).join('-');
}
function areaOf(id) {
  const m = /^(\d+)x(\d+)-/.exec(id);
  return m ? +m[1] * +m[2] : 1e9;
}
const tierRank = (id) => (id.split('-')[1] || '').charCodeAt(1) || 0;

function readJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}

function readResults() {
  const latest = new Map();
  const failures = new Map();
  if (!fs.existsSync(P.results)) return { latest, failures, rows: [] };
  const rows = [];
  for (const line of fs.readFileSync(P.results, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    rows.push(r);
    if (r.status === 'ok') latest.set(r.id, r);
    else failures.set(r.id, (failures.get(r.id) || 0) + 1);
  }
  return { latest, failures, rows };
}

// ---------------------------------------------------------------- import

function cmdImport() {
  const old = opt('--old', DEFAULT_OLD);
  const O = oldPaths(old);
  fs.mkdirSync(P.specs, { recursive: true });
  const log = (s) => console.log(`[import] ${s}`);

  const prevInfo = readJson(P.importInfo, null);
  const renumberMtime = fs.existsSync(O.renumberMap) ? fs.statSync(O.renumberMap).mtimeMs : 0;
  if (prevInfo && prevInfo.renumberMtime !== renumberMtime && !flag('--force')) {
    console.error('[import] The old copy was renumbered since the last import, so imported spec ids may now mean other puzzles.');
    console.error('[import] Move tools/data/solver-runs/nightly aside (or delete specs/ and queue.json) and import again, or pass --force.');
    process.exit(2);
  }

  log(`reading old ledger ${O.ledger}`);
  const ledger = JSON.parse(fs.readFileSync(O.ledger, 'utf8'));
  const done = ledger.done || {};
  const pending = (ledger.pending || []).filter((id) => !(id in done));
  log(`old ledger: ${pending.length} waiting, ${Object.keys(done).length} done`);

  // Results the old runs wrote to worker-*.txt but never recorded. Runs from before the renumber use stale ids.
  const oldRuns = {};
  if (fs.existsSync(O.parallel)) {
    for (const run of fs.readdirSync(O.parallel).sort()) {
      const m = /^(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)$/.exec(run);
      if (!m) continue;
      const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
      if (t <= renumberMtime) continue;
      const dir = path.join(O.parallel, run);
      for (const f of fs.readdirSync(dir).filter((n) => /^worker-.*\.txt$/.test(n))) {
        for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
          const parts = line.trim().split(/\s+/);
          if (parts.length !== 3 || parts[0] in done) continue;
          oldRuns[parts[0]] = { solutions: +parts[1], exit: +parts[2], run };
        }
      }
    }
  }
  fs.writeFileSync(P.oldRuns, JSON.stringify(oldRuns, null, 1));
  const skipOld = flag('--skip-old-run-results');
  log(`old runs: ${Object.keys(oldRuns).length} unrecorded result(s) found` +
    (skipOld ? ' - skipping those puzzles' : ' - solving them again (old counts often double 180-degree turns)'));

  const swap = pending
    .filter((id) => !id.startsWith('6x6-'))
    .filter((id) => !(skipOld && id in oldRuns))
    .sort((a, b) => areaOf(a) - areaOf(b) || tierRank(a) - tierRank(b) || (a < b ? -1 : a > b ? 1 : 0));

  const have = new Set(fs.readdirSync(P.specs).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)));
  let copied = 0;
  let missing = 0;
  const need = swap.filter((id) => !have.has(id));
  if (need.length) log(`copying ${need.length} spec file(s) from the old copy (first import takes a few minutes)`);
  for (const id of need) {
    const src = path.join(O.specs, `${id}.json`);
    try {
      fs.copyFileSync(src, path.join(P.specs, `${id}.json`));
      have.add(id);
      copied++;
    } catch {
      missing++;
    }
    if ((copied + missing) % 10000 === 0) log(`  specs ${copied + missing}/${need.length}`);
  }
  // Candidate sets first, each in its queue.txt order, followed by the waiting-list puzzles it promotes
  // (promote.txt: identical to a candidate, so solved here under the old-ledger id instead of twice).
  const readIds = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((s) => s.trim()).filter((s) => s && !s.startsWith('#')) : []);
  const waiting = new Set(swap.filter((id) => have.has(id)));
  const promoted = new Set();
  const items = [];
  for (const [group] of SETS) {
    const dir = SET_DIR.get(group);
    if (!fs.existsSync(path.join(dir, 'queue.txt'))) continue;
    let added = 0;
    let skipped6 = 0;
    for (const id of readIds(path.join(dir, 'queue.txt'))) {
      const spec = readJson(path.join(dir, 'specs', `${id}.json`), null);
      if (!spec) continue;
      if (spec.board && spec.board.rows === 6 && spec.board.cols === 6) { skipped6++; continue; }
      items.push([id, group]);
      added++;
    }
    let up = 0;
    for (const id of readIds(path.join(dir, 'promote.txt'))) {
      if (!waiting.has(id) || promoted.has(id)) continue;
      promoted.add(id);
      items.push([id, groupOf(id)]);
      up++;
    }
    log(`${group}: ${added} in queue.txt${up ? `, ${up} waiting-list puzzle(s) moved up` : ''}${skipped6 ? ` (${skipped6} 6x6 skipped)` : ''}`);
  }
  for (const id of swap) if (have.has(id) && !promoted.has(id)) items.push([id, groupOf(id)]);

  fs.writeFileSync(P.queue + '.tmp', JSON.stringify({ importedAt: nowIso(), items }));
  fs.renameSync(P.queue + '.tmp', P.queue);
  fs.writeFileSync(P.importInfo, JSON.stringify({ importedAt: nowIso(), old, renumberMtime, items: items.length }, null, 1));

  const counts = {};
  for (const [, g] of items) counts[g] = (counts[g] || 0) + 1;
  log(`specs copied ${copied}, missing ${missing}. Queue: ${Object.entries(counts).map(([g, n]) => `${g} ${n}`).join(', ')}`);
}

// ---------------------------------------------------------------- run

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// Windows reuses pids, so a lock also needs a status file written in the last minute.
function runnerAlive() {
  const lock = readJson(P.lock, null);
  if (!lock || !pidAlive(lock.pid)) return null;
  const s = readJson(P.status, null);
  const fresh = s && s.pid === lock.pid && Date.now() - new Date(s.updated).getTime() < 60000;
  const young = Date.now() - new Date(lock.started).getTime() < 60000;
  return fresh || young ? lock : null;
}

function cmdRun() {
  const workers = Math.max(1, parseInt(opt('--workers', '8'), 10));
  const until = opt('--until', '') ? new Date(opt('--until', '')).getTime() : Infinity;
  const graceMs = parseFloat(opt('--grace-min', '10')) * 60000;
  const timeoutMs = parseFloat(opt('--timeout-min', '60')) * 60000;
  const limit = parseInt(opt('--limit', '0'), 10);
  const perGroup = parseInt(opt('--per-group', '0'), 10);
  const retryFailed = flag('--retry-failed');

  fs.mkdirSync(P.work, { recursive: true });
  fs.mkdirSync(P.logs, { recursive: true });
  fs.mkdirSync(P.enumerated, { recursive: true });
  for (const dir of SET_DIR.values()) if (fs.existsSync(dir)) fs.mkdirSync(path.join(dir, 'results'), { recursive: true });

  const queue = readJson(P.queue, null);
  if (!queue) {
    console.error('No queue yet. Run the import first (run-nightly-solves.ps1 does it for you).');
    process.exit(2);
  }
  const lock = runnerAlive();
  if (lock && lock.pid !== process.pid) {
    console.error(`Another nightly runner is already running (pid ${lock.pid}). Watch it with watch-nightly-solves.ps1.`);
    process.exit(3);
  }
  fs.writeFileSync(P.lock, JSON.stringify({ pid: process.pid, started: nowIso() }));
  try { fs.unlinkSync(P.stop); } catch { /* none */ }

  const runStamp = stampNow();
  const logFile = path.join(P.logs, `run-${runStamp}.log`);
  const logFd = fs.openSync(logFile, 'a');
  const log = (s) => {
    const line = `${clock(Date.now())} ${s}`;
    fs.writeSync(logFd, line + '\n');
    if (!process.stdout.isTTY) console.log(line);
  };

  const { latest, failures } = readResults();
  const setResults = new Map(SETS.map(([g]) => [g, setDone(g)]));
  const isDone = (id, g) => latest.has(id) || (isSet(g) && setResults.get(g).has(id));

  const groups = new Map();
  const G = (g) => {
    if (!groups.has(g)) groups.set(g, { group: g, total: 0, done: 0, failed: 0, secs: 0, n: 0 });
    return groups.get(g);
  };
  for (const r of latest.values()) {
    if (r.secs != null) { G(r.group).secs += r.secs; G(r.group).n++; }
  }
  const todo = [];
  const perGroupCount = {};
  for (const [id, g] of queue.items) {
    const s = G(g);
    s.total++;
    if (isDone(id, g)) { s.done++; continue; }
    if (!retryFailed && (failures.get(id) || 0) >= MAX_ATTEMPTS) { s.failed++; continue; }
    if (perGroup && (perGroupCount[g] || 0) >= perGroup) continue;
    if (limit && todo.length >= limit) continue;
    perGroupCount[g] = (perGroupCount[g] || 0) + 1;
    todo.push({ id, group: g, attempt: (failures.get(id) || 0) + 1 });
  }
  const resFd = fs.openSync(P.results, 'a');
  const appendResult = (row) => {
    fs.writeSync(resFd, JSON.stringify(row) + '\n');
    fs.fsyncSync(resFd);
  };

  const started = Date.now();
  const recent = [];
  const finishTimes = [];
  const run = { solved: 0, failed: 0, capped: 0, abandoned: 0 };
  const slots = Array.from({ length: workers }, (_, i) => ({ n: i + 1, job: null }));
  let next = 0;
  let stopping = null;
  let killAt = Infinity;
  let exiting = false;

  log(`run started: ${workers} worker(s), ${todo.length} puzzle(s) to start, stop starting new at ${isFinite(until) ? new Date(until).toString() : 'never'}`);
  log(`log ${logFile}`);

  function specFor(job) {
    return isSet(job.group)
      ? path.join(SET_DIR.get(job.group), 'specs', `${job.id}.json`)
      : path.join(P.specs, `${job.id}.json`);
  }
  function finalPath(job) {
    return isSet(job.group)
      ? path.join(SET_DIR.get(job.group), 'results', `${job.id}.json`)
      : path.join(P.enumerated, `${job.id}.json`);
  }

  function startJob(slot, job) {
    const tmp = path.join(P.work, `w${slot.n}-${job.id}.json`);
    try { fs.unlinkSync(tmp); } catch { /* none */ }
    const child = spawn(process.execPath, [
      SOLVER, '--spec', specFor(job), '--viable-seeds-only', '--json-summary',
      '--max-sol', String(MAX_SOL), '--write-solves', tmp,
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    slot.job = { ...job, child, tmp, t0: Date.now(), out: '', tail: [] };
    const j = slot.job;
    child.stdout.on('data', (d) => { j.out += d; if (j.out.length > 1e6) j.out = j.out.slice(-1e5); });
    child.stderr.on('data', (d) => {
      for (const line of String(d).split(/\r?\n/)) if (line.trim()) { j.tail.push(line.trim().slice(0, 300)); if (j.tail.length > 6) j.tail.shift(); }
    });
    child.on('close', (code) => setTimeout(() => onClose(slot, j, code), code === 0 ? 0 : 300));
    child.on('error', (e) => j.tail.push(`spawn error: ${e.message}`));
    log(`w${slot.n} START ${job.id} (${job.group}${job.attempt > 1 ? `, attempt ${job.attempt}` : ''})`);
  }

  function onClose(slot, j, code) {
    if (slot.job !== j) return;
    slot.job = null;
    const secs = +((Date.now() - j.t0) / 1000).toFixed(2);
    let summary = null;
    for (const line of j.out.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('{') && t.includes('"totalUniqueSolutions"')) { try { summary = JSON.parse(t); } catch { /* ignore */ } }
    }
    if (code === 0 && summary) {
      const count = summary.totalUniqueSolutions;
      const capped = !!summary.hitMaxSolCap;
      if (count > 0 && fs.existsSync(j.tmp)) fs.renameSync(j.tmp, finalPath(j));
      const row = { id: j.id, group: j.group, status: 'ok', solutions: count, capped, exit: 0, secs, ts: nowIso(), run: runStamp };
      appendResult(row);
      if (isSet(j.group)) {
        fs.appendFileSync(path.join(SET_DIR.get(j.group), 'results-progress.ndjson'), JSON.stringify({ id: j.id, exit: 0, totalUniqueSolutions: count, hitMaxSolCap: capped, ts: new Date().toISOString() }) + '\n');
      }
      const s = G(j.group);
      s.done++; s.secs += secs; s.n++;
      run.solved++;
      if (capped) run.capped++;
      finishTimes.push(Date.now());
      recent.unshift(`${clock(Date.now())}  ${j.id.padEnd(16)} ${String(count).padStart(7)} solution(s)${capped ? ' CAPPED' : ''}  ${secs}s`);
      log(`w${slot.n} DONE  ${j.id} ${count}${capped ? ' CAPPED' : ''} ${secs}s`);
    } else if (stopping === 'now' || j.killedForStop || exiting) {
      run.abandoned++;
      log(`w${slot.n} ABANDONED ${j.id} (back in the queue)`);
    } else {
      const reason = j.timedOut ? 'timeout' : `exit ${code}`;
      appendResult({ id: j.id, group: j.group, status: j.timedOut ? 'timeout' : 'failed', exit: code, secs, ts: nowIso(), run: runStamp, tail: j.tail });
      run.failed++;
      recent.unshift(`${clock(Date.now())}  ${j.id.padEnd(16)} FAILED (${reason})`);
      log(`w${slot.n} FAILED ${j.id} ${reason} ${j.tail.join(' | ')}`);
      if (!j.timedOut && j.attempt < MAX_ATTEMPTS) todo.push({ id: j.id, group: j.group, attempt: j.attempt + 1 });
      else G(j.group).failed++;
    }
    try { fs.unlinkSync(j.tmp); } catch { /* moved or none */ }
    if (recent.length > 8) recent.length = 8;
    pump();
  }

  function pump() {
    if (!stopping && Date.now() >= until) {
      stopping = 'until';
      killAt = Date.now() + graceMs;
      log(`-Until reached: no new puzzles; in-flight ones get ${graceMs / 60000} min to finish`);
    }
    if (!stopping && fs.existsSync(P.stop)) {
      stopping = 'stopfile';
      killAt = Date.now() + graceMs;
      log(`stop requested: no new puzzles; in-flight ones get ${graceMs / 60000} min to finish`);
    }
    if (!stopping) {
      for (const slot of slots) {
        if (slot.job || next >= todo.length) continue;
        startJob(slot, todo[next++]);
      }
    }
    if (slots.every((s) => !s.job) && (stopping || next >= todo.length)) finish();
  }

  function snapshot() {
    const nowT = Date.now();
    while (finishTimes.length && finishTimes[0] < nowT - 3600000) finishTimes.shift();
    const elapsed = nowT - started;
    const window = Math.min(elapsed, 600000);
    const inWindow = finishTimes.filter((t) => t >= nowT - window).length;
    const ratePerHour = window > 30000 ? Math.round((inWindow * 3600000) / window) : null;
    const current = (slots.find((s) => s.job) || {}).job;
    const curGroup = current ? current.group : (todo[next] || {}).group;
    const groupRows = [...groups.values()].filter((s) => s.total > 0).map((s) => {
      const waiting = Math.max(0, s.total - s.done - s.failed);
      const avg = s.n ? s.secs / s.n : null;
      return { group: s.group, total: s.total, done: s.done, waiting, failed: s.failed, avgSecs: avg, etaMs: avg != null ? (waiting * avg * 1000) / workers : null, current: s.group === curGroup };
    });
    return {
      pid: process.pid, updated: nowIso(), started: new Date(started).toISOString(), until: isFinite(until) ? new Date(until).toISOString() : null,
      stopping, workers, run, ratePerHour, groups: groupRows, recent: recent.slice(),
      slots: slots.map((s) => (s.job ? { n: s.n, id: s.job.id, group: s.job.group, secs: Math.round((nowT - s.job.t0) / 1000) } : { n: s.n, id: null })),
      thisRunToStart: todo.length, thisRunStarted: next, logFile,
    };
  }

  const tick = setInterval(() => {
    const nowT = Date.now();
    for (const slot of slots) {
      const j = slot.job;
      if (!j) continue;
      if (timeoutMs > 0 && nowT - j.t0 > timeoutMs && !j.timedOut) { j.timedOut = true; j.child.kill(); }
      if (nowT >= killAt && !j.killedForStop) { j.killedForStop = true; j.child.kill(); }
    }
    pump();
    const snap = snapshot();
    try { fs.writeFileSync(P.status + '.tmp', JSON.stringify(snap)); fs.renameSync(P.status + '.tmp', P.status); } catch { /* next tick */ }
    if (process.stdout.isTTY) render(snap, true);
    else if (Math.floor((nowT - started) / 1000) % 60 < 2) console.log(oneLine(snap));
  }, 2000);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    const snap = snapshot();
    snap.finished = nowIso();
    fs.writeFileSync(P.status, JSON.stringify(snap));
    if (process.stdout.isTTY) render(snap, true);
    const why = stopping === 'until' ? '-Until reached' : stopping === 'stopfile' ? 'stop requested' : stopping === 'now' ? 'Ctrl+C' : 'nothing left to start';
    log(`run finished (${why}): solved ${run.solved}, failed ${run.failed}, capped ${run.capped}, abandoned ${run.abandoned} in ${hhmm(Date.now() - started)}`);
    console.log(`\nRun finished (${why}): solved ${run.solved}, failed ${run.failed}, capped ${run.capped}, abandoned ${run.abandoned}. Log: ${logFile}`);
    try { fs.unlinkSync(P.lock); } catch { /* none */ }
    try { fs.unlinkSync(P.stop); } catch { /* none */ }
    process.exit(0);
  }

  process.on('SIGINT', () => {
    if (stopping === 'now') return;
    stopping = 'now';
    log('Ctrl+C: stopping now; in-flight puzzles go back in the queue');
    for (const slot of slots) if (slot.job) { slot.job.killedForStop = true; try { slot.job.child.kill(); } catch { /* gone */ } }
    setTimeout(() => {
      exiting = true;
      for (const slot of slots) if (slot.job) { run.abandoned++; log(`w${slot.n} ABANDONED ${slot.job.id}`); slot.job = null; }
      finish();
    }, 1500);
  });

  if (process.stdout.isTTY) process.stdout.write('\x1b[2J');
  pump();
}

// ---------------------------------------------------------------- display

function oneLine(s) {
  const g = s.groups.find((r) => r.current) || {};
  return `${clock(Date.now())} solved ${s.run.solved} failed ${s.run.failed} capped ${s.run.capped} | ` +
    `rate ${s.ratePerHour == null ? '?' : s.ratePerHour}/h | ${g.group || '-'} waiting ${g.waiting ?? '?'} ETA ${hhmm(g.etaMs)}` +
    `${s.stopping ? ` | stopping (${s.stopping})` : ''}`;
}

function render(s, clear) {
  const L = [];
  const nowT = Date.now();
  const untilTxt = s.until ? `${new Date(s.until).toLocaleString()} (${hhmm(new Date(s.until).getTime() - nowT)} left)` : 'never';
  L.push(`TileZilla nightly solves   started ${new Date(s.started).toLocaleTimeString()}   updated ${new Date(s.updated).toLocaleTimeString()}`);
  L.push(`Stop starting new puzzles at: ${untilTxt}${s.stopping ? `   STOPPING (${s.stopping})` : ''}${s.finished ? '   FINISHED' : ''}`);
  L.push(`This run: solved ${s.run.solved}   failed ${s.run.failed}   capped ${s.run.capped}   abandoned ${s.run.abandoned}   ` +
    `rate ${s.ratePerHour == null ? '(measuring)' : `${s.ratePerHour.toLocaleString()} puzzles/hour`}   workers ${s.workers}`);
  L.push('');
  L.push('Group                 total      solved    waiting   failed   avg s   ETA (all workers)');
  for (const g of s.groups) {
    L.push(`${(g.current ? '> ' : '  ') + g.group.padEnd(18)} ${String(g.total).padStart(7)} ${String(g.done).padStart(10)} ${String(g.waiting).padStart(10)} ` +
      `${String(g.failed).padStart(8)} ${g.avgSecs == null ? '      ?' : g.avgSecs.toFixed(1).padStart(7)}   ${hhmm(g.etaMs)}`);
  }
  L.push('');
  L.push('Workers:');
  for (const w of s.slots) L.push(`  w${String(w.n).padEnd(3)} ${w.id ? `${w.id.padEnd(18)} ${w.secs}s` : '(idle)'}`);
  L.push('');
  L.push('Last results:');
  for (const r of s.recent) L.push(`  ${r}`);
  L.push('');
  L.push('Ctrl+C = stop now (in-flight puzzles go back in the queue).  Finish in-flight then stop: run-nightly-solves.ps1 -Stop');
  L.push(`Log: ${s.logFile}`);
  const out = L.map((l) => l + '\x1b[K').join('\n') + '\n\x1b[J';
  process.stdout.write(clear ? `\x1b[H${out}` : out);
}

function cmdWatch() {
  if (process.stdout.isTTY) process.stdout.write('\x1b[2J');
  const show = () => {
    const s = readJson(P.status, null);
    if (!s) { process.stdout.write('\x1b[HNo status yet - start run-nightly-solves.ps1 first.\x1b[K\n'); return; }
    if (!runnerAlive() && !s.finished) s.stopping = 'runner not running';
    if (process.stdout.isTTY) render(s, true);
    else console.log(oneLine(s));
  };
  show();
  if (!flag('--once')) setInterval(show, 2000);
}

function cmdStatus() {
  const queue = readJson(P.queue, { items: [] });
  const { latest, failures } = readResults();
  const setResults = new Map(SETS.map(([g]) => [g, setDone(g)]));
  const rows = new Map();
  for (const [id, g] of queue.items) {
    if (!rows.has(g)) rows.set(g, { total: 0, done: 0, failed: 0, capped: 0 });
    const r = rows.get(g);
    r.total++;
    if (latest.has(id) || (isSet(g) && setResults.get(g).has(id))) { r.done++; if (latest.get(id)?.capped) r.capped++; }
    else if ((failures.get(id) || 0) >= MAX_ATTEMPTS) r.failed++;
  }
  console.log('group                 total    solved   waiting   failed  capped');
  for (const [g, r] of rows) {
    console.log(`${g.padEnd(18)} ${String(r.total).padStart(7)} ${String(r.done).padStart(9)} ${String(r.total - r.done - r.failed).padStart(9)} ${String(r.failed).padStart(8)} ${String(r.capped).padStart(7)}`);
  }
  const lock = runnerAlive();
  console.log(lock ? `runner running (pid ${lock.pid})` : 'runner not running');
}

function cmdStop() {
  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(P.stop, nowIso());
  console.log('Asked the runner to stop starting new puzzles; it finishes the ones in progress and exits.');
}

// ---------------------------------------------------------------- export

function cmdExport() {
  const old = opt('--old', DEFAULT_OLD);
  const O = oldPaths(old);
  const { latest, failures } = readResults();
  const ledger = readJson(O.ledger, { done: {} });
  const outDir = path.join(P.exports, stampNow());
  fs.mkdirSync(outDir, { recursive: true });

  const swapLines = [];
  const capped = [];
  const candidates = [];
  let alreadySame = 0;
  for (const r of latest.values()) {
    if (isSet(r.group)) { candidates.push(`${r.group} ${r.id} ${r.solutions}${r.capped ? ' CAPPED' : ''}`); continue; }
    const prev = ledger.done[r.id];
    if (prev && prev.solutions === r.solutions) { alreadySame++; continue; }
    swapLines.push(`${r.id} ${r.solutions} 0`);
    if (r.capped) capped.push(r.id);
  }
  const failed = [...failures.keys()].filter((id) => !latest.has(id));
  fs.writeFileSync(path.join(outDir, 'worker-nightly.txt'), swapLines.join('\n') + (swapLines.length ? '\n' : ''));
  fs.writeFileSync(path.join(outDir, 'capped.txt'), capped.join('\n') + (capped.length ? '\n' : ''));
  fs.writeFileSync(path.join(outDir, 'failed.txt'), failed.join('\n') + (failed.length ? '\n' : ''));
  fs.writeFileSync(path.join(outDir, 'candidates.txt'), candidates.join('\n') + (candidates.length ? '\n' : ''));
  const readme = [
    'Nightly solver results, ready to record in the old copy.',
    '',
    `worker-nightly.txt  ${swapLines.length} swap-named result(s) as "<id> <solutions> <exit>" (record-many format)`,
    `capped.txt          ${capped.length} result(s) that hit the 500000 solution cap (count is a lower bound)`,
    `failed.txt          ${failed.length} puzzle(s) that failed twice or timed out (not in worker-nightly.txt)`,
    `candidates.txt      ${candidates.length} candidate-set result(s) as "<set> <id> <solutions>"; full solutions are in ${CAND_REL}/<set folder>/results/`,
    '',
    'Counts use the catalog convention: a layout and its 180-degree turn count once. The old copy counted',
    'most non-square puzzles twice (it depended on the tiles in the bag), so many of these are half of what',
    'the old runner would have recorded. See Docs/nightly-solves.md.',
    '',
    'To record (in PowerShell, from the old copy, with no old run going):',
    `  cd "${old}"`,
    `  robocopy "${P.enumerated}" "${path.join(O.named, 'enumerated')}" *.json /XC /XN /XO /NFL /NDL /NJH`,
    `  python tools/scripts/swap-batch.py record-many --file "${outDir}"`,
  ].join('\r\n');
  fs.writeFileSync(path.join(outDir, 'README.txt'), readme + '\r\n');
  console.log(readme);
  console.log(`\n(${alreadySame} result(s) already in the old ledger with the same count were left out.)`);
  console.log(`Export folder: ${outDir}`);
}

const cmd = process.argv[2];
const table = { import: cmdImport, run: cmdRun, watch: cmdWatch, status: cmdStatus, stop: cmdStop, export: cmdExport };
if (!table[cmd]) {
  console.error('usage: node tools/scripts/nightly-solves.js import|run|watch|status|stop|export [options]');
  process.exit(1);
}
table[cmd]();
