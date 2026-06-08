#!/usr/bin/env node
/**
 * Exhaustive enumerator vs catalog: tiers 0A → 0B → 0C (single-snake, no blockers).
 * For each level, runs solves/solve-level.js with --json-summary and compares to:
 *   max(level.totalUniqueSolutions, solutions.length in solves/<solvesFile>) when present.
 * Flags when the solver finds MORE unique layouts than recorded (extra solves exist).
 *
 * Sandbox levels (same as web/js/app_v16.js): "sandbox" in id/name, or id ending in -ZZZ.
 *
 * Blockers: only fixed single-cell B1 in level.blockers is enumerated; other kinds are skipped.
 * Two-snake levels cannot be enumerated yet (solve-level.js is single-snake only).
 * Use --list-two-snake to print/count those levels from the same tiers (no solving).
 *
 * Run from repo root (directory with docker-compose.yml). Prefer Docker; same argv works with plain:
 *   node scripts/audit-enumerator-vs-catalog.js …
 *
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --dry-run
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --max-sol 5000000 --from-size 3x4
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --list-two-snake
 *
 * Restrict to certain board sizes only:
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --only-sizes 3x3,3x5,5x5
 *
 * Large boards first (e.g. 6×6 down to small), skip levels already backed by solve files:
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --from-size 2x4 --through-size 6x6 --reverse-size-order \
 *     --skip-solve-satisfies-catalog --skip-completed-log data/levels/reports/your-run.ndjson --parallel 8
 * On another machine: clone repo, copy data/levels + solves/ (or full repo), same command from repo root.
 *
 * Speed / resume:
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --parallel 4
 *   # 6×6: prefer parallel 1 (see scripts/audit-enumerator-6x6.ps1). parallel 4 often blocks
 *   # the pool for days on levels like 6x6-0B-AAB (400+ solves) while the log stops moving.
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --offset 1497
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --shard 0/4   # 4 terminals: 0/4 … 3/4
 *
 * Crash-safe: each finished level appends one line to
 *   data/levels/reports/audit-enumerator-vs-catalog-progress-<runId>....ndjson
 * (path printed at start). If the run dies, you still have every completed row.
 * Resume:
 *   docker compose run --rm web node scripts/audit-enumerator-vs-catalog.js --skip-completed-log data/levels/reports/audit-enumerator-vs-catalog-progress-....ndjson
 *
 * Every completed level is appended to the progress .ndjson and fsync'd immediately.
 * Every unique layout found for a level is written as soon as it is discovered:
 *   data/levels/reports/audit-solved-layouts-<runId>/<level-id>/solve-00000001.json …
 * (Pass --no-stream-solves-on-disk to disable if you need a lighter run.)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'data', 'levels', 'index.json');
const SOLVER = path.join(ROOT, 'solves', 'solve-level.js');

const DEFAULT_TIERS = ['0A', '0B', '0C'];

function parseArgs(argv) {
  const out = {
    maxSol: 2_000_000,
    dryRun: false,
    fromSize: '2x4',
    tiers: DEFAULT_TIERS,
    listTwoSnake: false,
    parallel: 1,
    offset: 0,
    shard: null,
    skipCompletedLog: null,
    streamSolvesOnDisk: true,
    onlySizes: null,
    solverProgress: false,
    solverProgressEvery: 500,
    throughSize: null,
    reverseSizeOrder: false,
    skipSolveSatisfiesCatalog: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--max-sol' && argv[i + 1]) out.maxSol = parseInt(argv[++i], 10);
    else if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--from-size' && argv[i + 1]) out.fromSize = argv[++i];
    else if (argv[i] === '--tiers' && argv[i + 1]) out.tiers = argv[++i].split(',').map((s) => s.trim());
    else if (argv[i] === '--list-two-snake') out.listTwoSnake = true;
    else if (argv[i] === '--parallel' && argv[i + 1]) out.parallel = Math.max(1, parseInt(argv[++i], 10));
    else if (argv[i] === '--workers' && argv[i + 1]) out.parallel = Math.max(1, parseInt(argv[++i], 10));
    else if (argv[i] === '--offset' && argv[i + 1]) out.offset = Math.max(0, parseInt(argv[++i], 10));
    else if (argv[i] === '--shard' && argv[i + 1]) out.shard = String(argv[++i]).trim();
    else if (argv[i] === '--skip-completed-log' && argv[i + 1]) {
      const p = argv[++i];
      out.skipCompletedLog = path.isAbsolute(p) ? p : path.join(ROOT, p);
    } else if (argv[i] === '--no-stream-solves-on-disk') out.streamSolvesOnDisk = false;
    else if (argv[i] === '--solver-progress') out.solverProgress = true;
    else if (argv[i] === '--solver-progress-every' && argv[i + 1]) {
      out.solverProgressEvery = Math.max(1, parseInt(argv[++i], 10));
    }
    else if (argv[i] === '--only-sizes' && argv[i + 1]) {
      out.onlySizes = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (argv[i] === '--through-size' && argv[i + 1]) out.throughSize = argv[++i];
    else if (argv[i] === '--upto-size' && argv[i + 1]) out.throughSize = argv[++i];
    else if (argv[i] === '--reverse-size-order') out.reverseSizeOrder = true;
    else if (argv[i] === '--skip-solve-satisfies-catalog') out.skipSolveSatisfiesCatalog = true;
  }
  return out;
}

const opts = parseArgs(process.argv);

function parseSize(sizeStr) {
  const m = /^(\d+)x(\d+)$/.exec(sizeStr);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [0, 0];
}

function sizeSortKey(sizeStr) {
  const [r, c] = parseSize(sizeStr);
  return r * 10_000 + c;
}

/** true if level has blockers this solver cannot model (only fixed single-cell B1 is supported). */
function levelBlockersUnsupportedBySolver(level) {
  const b = level.blockers;
  if (!Array.isArray(b) || b.length === 0) return false;
  const rows = level.board?.rows;
  const cols = level.board?.cols;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) return true;
  for (let i = 0; i < b.length; i++) {
    const entry = b[i];
    if (!Array.isArray(entry) || entry.length < 2) return true;
    const r = entry[0];
    const c = entry[1];
    if (!Number.isInteger(r) || !Number.isInteger(c)) return true;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return true;
    const kind = entry.length >= 3 ? String(entry[2]) : 'B1';
    if (kind !== 'B1') return true;
  }
  return false;
}

function isMultiSnake(level) {
  const pm = level.pathMode;
  if (pm && pm !== 'single') return true;
  const tiles = level.tiles || {};
  const sh = tiles.SH || 0;
  const et = tiles.ET || 0;
  return sh > 1 || et > 1;
}

function isSingleSnakeRunnable(level) {
  if (isMultiSnake(level)) return false;
  const tiles = level.tiles || {};
  return (tiles.SH || 0) === 1 && (tiles.ET || 0) === 1;
}

/** Same rule as web/js/app_v16.js isSandboxLevel(): sandbox in id/name, or id suffix -ZZZ. */
function isSandboxLevel(level) {
  const id = level?.id != null ? String(level.id) : '';
  const name = level?.name != null ? String(level.name) : '';
  return /sandbox/i.test(id) || /sandbox/i.test(name) || /-ZZZ$/i.test(id);
}

const solveFileCountCache = new Map();

function countSolutionsInSolveFile(level) {
  const sf = level.solvesFile;
  if (!sf || typeof sf !== 'string') return null;
  const full = path.join(ROOT, 'solves', sf.split('/').join(path.sep));
  if (solveFileCountCache.has(full)) return solveFileCountCache.get(full);
  if (!fs.existsSync(full)) {
    solveFileCountCache.set(full, null);
    return null;
  }
  try {
    const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
    const n = Array.isArray(doc.solutions) ? doc.solutions.length : 0;
    solveFileCountCache.set(full, n);
    return n;
  } catch (e) {
    solveFileCountCache.set(full, null);
    return null;
  }
}

/** Catalog baseline: level.totalUniqueSolutions vs solve file row count. */
function catalogBaseline(level) {
  const lib = Number(level.totalUniqueSolutions);
  const libValid = Number.isFinite(lib) ? lib : 0;
  const fileN = countSolutionsInSolveFile(level);
  if (fileN == null) return { baseline: libValid, sources: { totalUniqueSolutions: libValid } };
  const baseline = Math.max(libValid, fileN);
  return {
    baseline,
    sources: { totalUniqueSolutions: libValid, solveFileCount: fileN, solvesFile: level.solvesFile },
  };
}

/** True if solves/<file> exists and has at least as many solution rows as catalog baseline (no solver run). */
function catalogFullyCoveredBySolveFile(level) {
  const { baseline } = catalogBaseline(level);
  if (baseline <= 0) return false;
  const fileN = countSolutionsInSolveFile(level);
  if (fileN == null) return false;
  return fileN >= baseline;
}

function collectJobsSingleSnake(tiers, fromKey, throughKey, onlySizes, reverseBucketOrder) {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const jobs = [];
  const sizeAllow =
    Array.isArray(onlySizes) && onlySizes.length ? new Set(onlySizes.map((s) => String(s).trim())) : null;

  for (const tier of tiers) {
    const buckets = (index.buckets || [])
      .filter((b) => b.tier === tier)
      .filter((b) => sizeSortKey(b.size) >= fromKey)
      .filter((b) => throughKey == null || sizeSortKey(b.size) <= throughKey)
      .filter((b) => !sizeAllow || sizeAllow.has(b.size))
      .sort((a, b) =>
        reverseBucketOrder
          ? sizeSortKey(b.size) - sizeSortKey(a.size)
          : sizeSortKey(a.size) - sizeSortKey(b.size)
      );

    for (const b of buckets) {
      const full = path.join(ROOT, 'data', 'levels', b.file);
      if (!fs.existsSync(full)) {
        console.warn(`[audit] missing bucket file: ${b.file}`);
        continue;
      }
      const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
      for (const level of doc.levels || []) {
        const jobBase = { level, bucket: b, tier };
        if (isSandboxLevel(level)) {
          jobs.push({ ...jobBase, skip: 'sandbox' });
          continue;
        }
        if (!isSingleSnakeRunnable(level)) {
          jobs.push({ ...jobBase, skip: 'not-single-snake-or-wrong-inventory' });
          continue;
        }
        if (levelBlockersUnsupportedBySolver(level)) {
          jobs.push({ ...jobBase, skip: 'has-blockers-not-supported-by-solve-level' });
          continue;
        }
        jobs.push({ ...jobBase, skip: null });
      }
    }
  }
  return jobs;
}

function collectJobsTwoSnakeOnly(tiers, fromKey, throughKey, onlySizes, reverseBucketOrder) {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const list = [];
  const sizeAllow =
    Array.isArray(onlySizes) && onlySizes.length ? new Set(onlySizes.map((s) => String(s).trim())) : null;
  for (const tier of tiers) {
    const buckets = (index.buckets || [])
      .filter((b) => b.tier === tier)
      .filter((b) => sizeSortKey(b.size) >= fromKey)
      .filter((b) => throughKey == null || sizeSortKey(b.size) <= throughKey)
      .filter((b) => !sizeAllow || sizeAllow.has(b.size))
      .sort((a, b) =>
        reverseBucketOrder
          ? sizeSortKey(b.size) - sizeSortKey(a.size)
          : sizeSortKey(a.size) - sizeSortKey(b.size)
      );
    for (const b of buckets) {
      const full = path.join(ROOT, 'data', 'levels', b.file);
      if (!fs.existsSync(full)) continue;
      const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
      for (const level of doc.levels || []) {
        if (isSandboxLevel(level)) continue;
        if (!isMultiSnake(level)) continue;
        list.push({
          id: level.id,
          tier,
          size: b.size,
          pathMode: level.pathMode || 'single',
          sh: level.tiles?.SH,
          et: level.tiles?.ET,
        });
      }
    }
  }
  return list;
}

function parseSolverSpawnOutput(status, stdout, stderr) {
  if (status !== 0) {
    return {
      ok: false,
      error: (stderr || stdout || '').trim() || `exit ${status}`,
      status,
    };
  }
  let summary;
  try {
    summary = JSON.parse((stdout || '').trim());
  } catch (e) {
    return { ok: false, error: `bad JSON: ${(stdout || '').slice(0, 200)}` };
  }
  return { ok: true, summary };
}

function runSolver(levelId) {
  const r = spawnSync(
    process.execPath,
    [SOLVER, levelId, '--json-summary', '--max-sol', String(opts.maxSol)],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env },
    }
  );
  return parseSolverSpawnOutput(r.status, r.stdout, r.stderr);
}

function runSolverAsync(levelId, extraArgs = []) {
  return new Promise((resolve) => {
    const chunks = [];
    const errChunks = [];
    let errCarry = '';
    function flushErrLines(text, finalize = false) {
      const merged = errCarry + text;
      const parts = merged.split(/\r?\n/);
      errCarry = finalize ? '' : parts.pop();
      if (!opts.solverProgress) return;
      for (const line of parts) {
        const t = String(line || '').trim();
        if (!t) continue;
        console.error(`    [solver ${levelId}] ${t}`);
      }
    }
    const child = spawn(
      process.execPath,
      [SOLVER, levelId, '--json-summary', '--max-sol', String(opts.maxSol), ...extraArgs],
      { cwd: ROOT, env: { ...process.env } }
    );
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => {
      errChunks.push(d);
      flushErrLines(Buffer.from(d).toString('utf8'));
    });
    child.on('error', (err) => resolve({ ok: false, error: String(err.message || err) }));
    child.on('close', (status) => {
      const stdout = Buffer.concat(chunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8');
      flushErrLines('', true);
      resolve(parseSolverSpawnOutput(status, stdout, stderr));
    });
  });
}

function applyShardToJobs(jobs, shardStr) {
  if (!shardStr) return jobs;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(shardStr);
  if (!m) throw new Error(`--shard must be i/n (e.g. 0/4), got: ${shardStr}`);
  const i = parseInt(m[1], 10);
  const n = parseInt(m[2], 10);
  if (n < 1 || i < 0 || i >= n) throw new Error(`invalid --shard ${shardStr} (need 0 <= i < n)`);
  return jobs.filter((_, idx) => idx % n === i);
}

/** Level ids that finished successfully (match / more / fewer), from a prior progress .ndjson */
function loadCompletedIdsFromProgressLog(logPath) {
  const ids = new Set();
  if (!logPath || !fs.existsSync(logPath)) return ids;
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let o;
    try {
      o = JSON.parse(t);
    } catch {
      continue;
    }
    if (o.type === 'audit-enumerator-progress-v1') continue;
    if (!o.id || typeof o.kind !== 'string') continue;
    if (o.kind === 'match' || o.kind === 'more' || o.kind === 'fewer') ids.add(o.id);
  }
  return ids;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const slot = next++;
      if (slot >= items.length) break;
      results[slot] = await fn(items[slot], slot);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function main() {
  const fromKey = sizeSortKey(opts.fromSize);
  const throughKey = opts.throughSize != null ? sizeSortKey(opts.throughSize) : null;
  if (throughKey != null && throughKey < fromKey) {
    console.error('[audit] --through-size must be >= --from-size (board key order)');
    process.exit(1);
  }

  if (opts.listTwoSnake) {
    const list = collectJobsTwoSnakeOnly(
      opts.tiers,
      fromKey,
      throughKey,
      opts.onlySizes,
      opts.reverseSizeOrder
    );
    console.error(
      `[audit] two-snake levels in tiers ${opts.tiers.join(',')} (enumerator N/A): ${list.length}`
    );
    for (const row of list) {
      console.log(
        JSON.stringify({ id: row.id, tier: row.tier, size: row.size, pathMode: row.pathMode, SH: row.sh, ET: row.et })
      );
    }
    return;
  }

  const allJobs = collectJobsSingleSnake(
    opts.tiers,
    fromKey,
    throughKey,
    opts.onlySizes,
    opts.reverseSizeOrder
  );
  const runnable = allJobs.filter((j) => !j.skip);
  const skipped = allJobs.filter((j) => j.skip);

  const skipReasons = skipped.reduce((acc, j) => {
    const k = j.skip || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  let pending = runnable.slice();
  if (opts.skipCompletedLog) {
    const done = loadCompletedIdsFromProgressLog(opts.skipCompletedLog);
    const before = pending.length;
    pending = pending.filter((j) => !done.has(j.level.id));
    console.error(
      `[audit] --skip-completed-log ${opts.skipCompletedLog}: removed ${before - pending.length} already-finished levels (${pending.length} left)`
    );
  }
  if (opts.skipSolveSatisfiesCatalog) {
    const before = pending.length;
    let removed = 0;
    pending = pending.filter((j) => {
      if (catalogFullyCoveredBySolveFile(j.level)) {
        removed++;
        return false;
      }
      return true;
    });
    console.error(
      `[audit] --skip-solve-satisfies-catalog: removed ${removed} levels (solve file rows >= catalog baseline) (${pending.length} left)`
    );
  }

  const sharded = applyShardToJobs(pending, opts.shard);
  let toRun = sharded.slice(opts.offset);

  if (opts.onlySizes?.length) {
    console.error(`[audit] --only-sizes ${opts.onlySizes.join(',')}`);
  }
  if (throughKey != null) {
    console.error(`[audit] --through-size ${opts.throughSize} (max board inclusive)`);
  }
  if (opts.reverseSizeOrder) {
    console.error(`[audit] --reverse-size-order (larger boards before smaller within each tier)`);
  }
  console.error(
    `[audit] tiers ${opts.tiers.join('→')} single-snake, no blockers: ${runnable.length} runnable | ` +
      `pending this config: ${pending.length} | ` +
      `this run after shard/offset: ${toRun.length} (shard=${opts.shard || 'all'} offset=${opts.offset}) | ` +
      `parallel=${opts.parallel} | skipped-by-level ${skipped.length} → ${JSON.stringify(skipReasons)}`
  );

  if (opts.dryRun) {
    const sample = toRun.slice(0, 10).map((j) => `${j.tier} ${j.level.id}`);
    console.error(`[audit] dry-run sample → ${sample.join(', ')}${toRun.length > 10 ? ' …' : ''}`);
    return;
  }

  const runId = Date.now();
  const outDir = path.join(ROOT, 'data', 'levels', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const shardTag = opts.shard ? opts.shard.replace(/\//g, '-') : 'all';
  const progressPath = path.join(
    outDir,
    `audit-enumerator-vs-catalog-progress-${runId}-p${opts.parallel}-s${shardTag}-o${opts.offset}.ndjson`
  );

  const layoutStreamRoot = opts.streamSolvesOnDisk
    ? path.join(outDir, `audit-solved-layouts-${runId}`)
    : null;
  if (layoutStreamRoot) {
    fs.mkdirSync(layoutStreamRoot, { recursive: true });
  }

  const progressFd = fs.openSync(progressPath, 'a');
  let appendChain = Promise.resolve();
  function appendProgressLine(obj) {
    const line = JSON.stringify(obj);
    appendChain = appendChain.then(() => {
      fs.writeSync(progressFd, `${line}\n`, 'utf8');
      fs.fsyncSync(progressFd);
    });
    return appendChain;
  }

  await appendProgressLine({
    type: 'audit-enumerator-progress-v1',
    runId,
    startedAt: new Date().toISOString(),
    tiers: opts.tiers,
    maxSol: opts.maxSol,
    fromSize: opts.fromSize,
    throughSize: opts.throughSize,
    reverseSizeOrder: opts.reverseSizeOrder,
    skipSolveSatisfiesCatalog: opts.skipSolveSatisfiesCatalog,
    parallel: opts.parallel,
    shard: opts.shard,
    offset: opts.offset,
    skipCompletedLog: opts.skipCompletedLog,
    runnableSingleSnake: runnable.length,
    pendingAfterFilters: pending.length,
    totalThisRun: toRun.length,
  });
  console.error(`[audit] progress log (append + fsync after each finished level): ${progressPath}`);
  if (layoutStreamRoot) {
    console.error(
      `[audit] each new layout → ${layoutStreamRoot}/<level-id>/solve-########.json (off: --no-stream-solves-on-disk)`
    );
  }

  const report = {
    schema: 'audit-enumerator-vs-catalog-v1',
    runId,
    generatedAt: new Date().toISOString(),
    tiers: opts.tiers,
    maxSol: opts.maxSol,
    fromSize: opts.fromSize,
    throughSize: opts.throughSize,
    reverseSizeOrder: opts.reverseSizeOrder,
    skipSolveSatisfiesCatalog: opts.skipSolveSatisfiesCatalog,
    parallel: opts.parallel,
    shard: opts.shard,
    offset: opts.offset,
    skipCompletedLog: opts.skipCompletedLog,
    progressNdjsonPath: progressPath,
    streamSolvesOnDisk: opts.streamSolvesOnDisk,
    solvedLayoutsRootDir: layoutStreamRoot,
    jobListMeta: {
      runnableSingleSnake: runnable.length,
      pendingAfterFilters: pending.length,
      thisRunCount: toRun.length,
    },
    totals: {
      tested: 0,
      moreThanCatalog: 0,
      fewerThanCatalog: 0,
      match: 0,
      solverError: 0,
      capped: 0,
    },
    moreThanCatalog: [],
    fewerThanCatalog: [],
    solverErrors: [],
    skipped,
    note:
      'Solver counts unique layouts (C4 on squares, half-turn on rectangles). Catalog baseline = max(level.totalUniqueSolutions, solve file solution count).',
  };

  const totalThisRun = toRun.length;
  let finished = 0;

  const outcomes = await mapPool(toRun, opts.parallel, async (job, slotInBatch) => {
    const id = job.level.id;
    const posInPending = pending.indexOf(job);
    const ordinal = posInPending >= 0 ? posInPending + 1 : slotInBatch + 1 + opts.offset;
    const { baseline, sources } = catalogBaseline(job.level);

    console.error(`[start ${ordinal}/${pending.length}] [${job.tier}] ${id} (baseline=${baseline})`);

    const layoutArgs =
      layoutStreamRoot != null ? ['--stream-solves-dir', layoutStreamRoot] : [];
    if (opts.solverProgress) {
      layoutArgs.push('--progress-on-json', '--progress-every', String(opts.solverProgressEvery));
    }
    const result = await runSolverAsync(id, layoutArgs);
    finished++;
    const streamed =
      layoutStreamRoot != null && result.ok
        ? ` (${result.summary.totalUniqueSolutions} layout file(s) under ${id}/)`
        : '';
    console.error(`[done ${finished}/${totalThisRun}] [${job.tier}] ${id}${streamed}`);

    if (!result.ok) {
      console.error(`  ERROR ${id}: ${result.error}`);
      const outv = { kind: 'error', id, tier: job.tier, baseline, error: result.error };
      await appendProgressLine({
        ts: new Date().toISOString(),
        id,
        tier: job.tier,
        kind: 'error',
        baseline,
        error: result.error,
      });
      return outv;
    }

    const found = result.summary.totalUniqueSolutions;
    const capped = !!result.summary.hitMaxSolCap;

    if (found > baseline) {
      console.error(
        `  >>> ${id}: MORE than catalog found ${found} > ${baseline}${capped ? ' (MAX-SOL CAP)' : ''}`
      );
      const outv = {
        kind: 'more',
        id,
        tier: job.tier,
        baseline,
        sources,
        found,
        hitMaxSolCap: capped,
      };
      await appendProgressLine({
        ts: new Date().toISOString(),
        id,
        tier: job.tier,
        kind: 'more',
        baseline,
        found,
        hitMaxSolCap: capped,
      });
      return outv;
    }
    if (found < baseline) {
      console.error(`  <<< ${id}: fewer than catalog found ${found} < ${baseline}`);
      const outv = { kind: 'fewer', id, tier: job.tier, baseline, sources, found, capped };
      await appendProgressLine({
        ts: new Date().toISOString(),
        id,
        tier: job.tier,
        kind: 'fewer',
        baseline,
        found,
        capped,
      });
      return outv;
    }
    await appendProgressLine({
      ts: new Date().toISOString(),
      id,
      tier: job.tier,
      kind: 'match',
      baseline,
      found,
      capped,
    });
    return { kind: 'match', capped };
  });

  for (const o of outcomes) {
    report.totals.tested++;
    if (o.kind === 'error') {
      report.totals.solverError++;
      report.solverErrors.push({ id: o.id, tier: o.tier, baseline: o.baseline, error: o.error });
    } else if (o.kind === 'more') {
      report.totals.moreThanCatalog++;
      report.moreThanCatalog.push({
        id: o.id,
        tier: o.tier,
        baseline: o.baseline,
        sources: o.sources,
        found: o.found,
        hitMaxSolCap: o.hitMaxSolCap,
      });
      if (o.hitMaxSolCap) report.totals.capped++;
    } else if (o.kind === 'fewer') {
      report.totals.fewerThanCatalog++;
      report.fewerThanCatalog.push({
        id: o.id,
        tier: o.tier,
        baseline: o.baseline,
        sources: o.sources,
        found: o.found,
      });
      if (o.capped) report.totals.capped++;
    } else {
      report.totals.match++;
      if (o.capped) report.totals.capped++;
    }
  }

  const twoSnake = collectJobsTwoSnakeOnly(
    opts.tiers,
    fromKey,
    throughKey,
    opts.onlySizes,
    opts.reverseSizeOrder
  );
  report.twoSnakeNotEnumerable = {
    count: twoSnake.length,
    note: 'solve-level.js is single-snake only; re-run with --list-two-snake for JSON lines',
  };

  await appendChain;
  try {
    fs.closeSync(progressFd);
  } catch {
    /* ignore */
  }

  const outPath = path.join(
    outDir,
    `audit-enumerator-vs-catalog-${runId}-p${opts.parallel}-s${shardTag}-o${opts.offset}.json`
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.error(`[audit] Wrote ${outPath}`);
  console.error(
    `[audit] done: match=${report.totals.match} moreThanCatalog=${report.totals.moreThanCatalog} fewerThanCatalog=${report.totals.fewerThanCatalog} errors=${report.totals.solverError} capped=${report.totals.capped}`
  );
  console.error(`[audit] two-snake levels (same tiers, not tested): ${twoSnake.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
