'use strict';

/**
 * TileZilla solver farm worker. Runs inside the solver image (one solver per container).
 *
 * Loop: claim a job from Redis (lease) -> write its spec to a temp file -> run
 * solves/solve-level.js -> store the result (and gzip of the solves JSON) right away.
 * A heartbeat keeps the lease alive while the solver runs; if this container dies the lease
 * expires and any worker's reaper puts the job back in the queue.
 *
 * Environment (all optional):
 *   REDIS_HOST (redis) REDIS_PORT (6379) REDIS_PASSWORD or REDIS_PASSWORD_FILE, REDIS_USERNAME
 *   REDIS_TLS (0/1) REDIS_TLS_SERVERNAME REDIS_TLS_CA_FILE REDIS_TLS_INSECURE (0/1)
 *   FARM_PREFIX (farm) NODE_NAME (host name)  MAX_SOL (500000)  MAX_ATTEMPTS (3)
 *   LEASE_MS (120000)  HEARTBEAT_MS (20000)  IDLE_POLL_MS (5000)  REAP_EVERY_MS (30000)
 *   SOLVER_TIMEOUT_MS (0 = no limit)  PROGRESS_EVERY (500)  SOLVER_NODE_OPTIONS ('')
 *   STORE_SOLVES (1)  SOLVES_MAX_GZ_BYTES (268435456)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { RedisClient, clientOptions } = require('./resp');
const { Farm } = require('./farm-core');

const env = process.env;
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

const REDIS_OPTS = clientOptions({
  host: env.REDIS_HOST || 'redis',
  port: env.REDIS_PORT || 6379,
  password: env.REDIS_PASSWORD,
  passwordFile: env.REDIS_PASSWORD_FILE,
  username: env.REDIS_USERNAME,
  tls: env.REDIS_TLS,
  tlsServername: env.REDIS_TLS_SERVERNAME,
  tlsCaFile: env.REDIS_TLS_CA_FILE,
  tlsInsecure: env.REDIS_TLS_INSECURE,
});

const CFG = {
  host: REDIS_OPTS.host,
  port: REDIS_OPTS.port,
  prefix: env.FARM_PREFIX || 'farm',
  node: env.NODE_NAME || os.hostname(),
  maxSol: num(env.MAX_SOL, 500000),
  maxAttempts: num(env.MAX_ATTEMPTS, 3),
  leaseMs: num(env.LEASE_MS, 120000),
  heartbeatMs: num(env.HEARTBEAT_MS, 20000),
  idlePollMs: num(env.IDLE_POLL_MS, 5000),
  reapEveryMs: num(env.REAP_EVERY_MS, 30000),
  solverTimeoutMs: num(env.SOLVER_TIMEOUT_MS, 0),
  progressEvery: num(env.PROGRESS_EVERY, 500),
  solverNodeOptions: env.SOLVER_NODE_OPTIONS || '',
  storeSolves: env.STORE_SOLVES !== '0',
  solvesMaxGzBytes: num(env.SOLVES_MAX_GZ_BYTES, 256 * 1024 * 1024),
  solverPath: env.SOLVER_PATH || '/app/solves/solve-level.js',
  workDir: env.WORK_DIR || path.join(os.tmpdir(), 'farm-jobs'),
};

const WORKER_ID = `${CFG.node}/${os.hostname()}-${process.pid}`;
const SOLVER_HASH = fs.existsSync(CFG.solverPath)
  ? crypto.createHash('sha1').update(fs.readFileSync(CFG.solverPath)).digest('hex').slice(0, 12)
  : 'missing';
const IMAGE_COMMIT = env.FARM_GIT_COMMIT || 'unknown';

const log = (...a) => console.log(new Date().toISOString(), `[${WORKER_ID}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let client = null;
let farm = null;
let stopping = false;
let current = null; // { job, token, child, startedAt, progress }

async function connect() {
  for (let delay = 1000; ; delay = Math.min(delay * 2, 30000)) {
    if (stopping) throw new Error('stopping');
    try {
      const c = new RedisClient(REDIS_OPTS);
      await c.connect();
      c.socket.on('close', () => {
        if (client === c) {
          client = null;
          farm = null;
        }
      });
      client = c;
      farm = new Farm(c, CFG.prefix);
      log(`connected to redis ${CFG.host}:${CFG.port}`);
      return farm;
    } catch (e) {
      log(`redis not reachable (${e.message}); retrying in ${delay / 1000}s`);
      await sleep(delay);
    }
  }
}

async function getFarm() {
  if (farm && client && !client.closed) return farm;
  return connect();
}

/** Run fn(farm); on connection problems reconnect and retry until it works (or forever). */
async function withRedis(fn, { retries = Infinity, label = 'redis call' } = {}) {
  for (let attempt = 0; ; attempt++) {
    const f = await getFarm();
    try {
      return await fn(f);
    } catch (e) {
      if (e.name === 'RedisError') throw e;
      if (attempt + 1 >= retries) throw e;
      log(`${label} failed (${e.message}); retrying`);
      if (client) client.close();
      client = null;
      farm = null;
      await sleep(Math.min(1000 * (attempt + 1), 15000));
    }
  }
}

async function registerWorker(state) {
  const f = await getFarm();
  const now = await f.redisNow();
  await client.call(
    'HSET',
    f.k('workers'),
    WORKER_ID,
    JSON.stringify({ node: CFG.node, lastSeen: now, solverHash: SOLVER_HASH, ...state })
  );
}

function runSolver(job, specPath, outPath) {
  return new Promise((resolve) => {
    const args = [];
    if (CFG.solverNodeOptions) args.push(...CFG.solverNodeOptions.split(/\s+/).filter(Boolean));
    args.push(
      CFG.solverPath,
      '--spec', specPath,
      '--viable-seeds-only',
      '--write-solves', outPath,
      '--json-summary',
      '--progress-every', String(CFG.progressEvery),
      '--progress-on-json',
      '--max-sol', String(CFG.maxSol)
    );
    const child = spawn(process.execPath, args, {
      cwd: path.dirname(path.dirname(CFG.solverPath)),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    current.child = child;
    let summary = null;
    const tail = [];
    const pushTail = (line) => {
      tail.push(line);
      if (tail.length > 40) tail.shift();
    };
    let outBuf = '';
    child.stdout.on('data', (d) => {
      outBuf += d.toString('utf8');
      let i;
      while ((i = outBuf.indexOf('\n')) >= 0) {
        const line = outBuf.slice(0, i).trim();
        outBuf = outBuf.slice(i + 1);
        if (line.startsWith('{') && line.includes('"totalUniqueSolutions"')) {
          try {
            summary = JSON.parse(line);
          } catch {
            pushTail(line.slice(0, 500));
          }
        } else if (line) pushTail(line.slice(0, 500));
      }
    });
    let errBuf = '';
    child.stderr.on('data', (d) => {
      errBuf += d.toString('utf8');
      let i;
      while ((i = errBuf.indexOf('\n')) >= 0) {
        const line = errBuf.slice(0, i).trim();
        errBuf = errBuf.slice(i + 1);
        if (!line) continue;
        if (line.startsWith('Progress:')) current.progress = line;
        else pushTail(line.slice(0, 500));
      }
    });
    let timedOut = false;
    const timer = CFG.solverTimeoutMs > 0
      ? setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, CFG.solverTimeoutMs)
      : null;
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (outBuf.trim()) {
        const line = outBuf.trim();
        if (line.startsWith('{') && line.includes('"totalUniqueSolutions"')) {
          try { summary = JSON.parse(line); } catch { /* ignore */ }
        }
      }
      resolve({ code, signal, summary, tail, timedOut });
    });
    child.on('error', (err) => {
      pushTail(`spawn error: ${err.message}`);
    });
  });
}

async function processJob(claim) {
  const { job, spec, attempt } = claim;
  const token = current.token;
  const safe = job.replace(/[^A-Za-z0-9._-]+/g, '__');
  fs.mkdirSync(CFG.workDir, { recursive: true });
  const specPath = path.join(CFG.workDir, `${safe}.spec.json`);
  const outPath = path.join(CFG.workDir, `${safe}.solves.json`);
  try { fs.unlinkSync(outPath); } catch { /* none */ }

  if (!spec) {
    await withRedis((f) => f.fail(job, token, CFG.maxAttempts, { reason: 'no spec stored for job', worker: WORKER_ID }));
    return;
  }
  fs.writeFileSync(specPath, spec, 'utf8');
  log(`START ${job} (attempt ${attempt})`);

  const hb = setInterval(async () => {
    try {
      const f = await getFarm();
      const ok = await f.heartbeat(job, token, CFG.leaseMs);
      if (!ok) log(`WARNING lease for ${job} was lost (will still report the result)`);
      await registerWorker({ job, startedAt: current.startedAt, progress: current.progress, attempt });
    } catch (e) {
      log(`heartbeat failed: ${e.message}`);
      if (client) client.close();
    }
  }, CFG.heartbeatMs);

  let run;
  try {
    run = await runSolver(job, specPath, outPath);
  } finally {
    clearInterval(hb);
  }
  const durationMs = Date.now() - current.startedAt;

  if (stopping && (run.signal || run.code !== 0)) {
    return; // shutdown() releases the job
  }

  if (run.code === 0 && run.summary) {
    const solutions = Number(run.summary.totalUniqueSolutions) || 0;
    let solvesGz = null;
    let solvesBytes = 0;
    let solvesNote = null;
    if (fs.existsSync(outPath)) {
      const raw = fs.readFileSync(outPath);
      solvesBytes = raw.length;
      if (CFG.storeSolves) {
        const gz = zlib.gzipSync(raw, { level: 6 });
        if (gz.length <= CFG.solvesMaxGzBytes) solvesGz = gz;
        else solvesNote = `solves too large to store (${gz.length} bytes gzipped)`;
      }
    } else if (solutions > 0) {
      solvesNote = 'solver reported solutions but wrote no solves file';
    }
    const result = {
      id: job.slice(job.indexOf('/') + 1),
      job,
      solutions,
      hitMaxSolCap: !!run.summary.hitMaxSolCap,
      maxSol: run.summary.maxSol ?? CFG.maxSol,
      exit: run.code,
      worker: WORKER_ID,
      node: CFG.node,
      attempt,
      durationMs,
      solverHash: SOLVER_HASH,
      imageCommit: IMAGE_COMMIT,
      solvesBytes,
      solvesGzBytes: solvesGz ? solvesGz.length : 0,
      solvesStored: !!solvesGz,
      solvesNote,
      solverMeta: run.summary.solverMeta ?? null,
      ts: new Date().toISOString(),
    };
    await withRedis((f) => f.complete(job, token, result, solvesGz, CFG.node), { label: `store result ${job}` });
    log(`DONE  ${job} -> ${solutions} solution(s)${result.hitMaxSolCap ? ' (HIT CAP)' : ''} in ${(durationMs / 1000).toFixed(1)}s`);
  } else {
    const error = {
      reason: run.timedOut ? `solver timed out after ${CFG.solverTimeoutMs} ms` : 'solver failed',
      exit: run.code,
      signal: run.signal,
      worker: WORKER_ID,
      node: CFG.node,
      attempt,
      durationMs,
      tail: run.tail.slice(-20),
      ts: new Date().toISOString(),
    };
    const outcome = await withRedis((f) => f.fail(job, token, CFG.maxAttempts, error), { label: `report failure ${job}` });
    log(`FAIL  ${job} exit=${run.code} signal=${run.signal} -> ${outcome}`);
  }
  for (const p of [specPath, outPath]) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

async function main() {
  log(`starting; solver ${CFG.solverPath} (sha1 ${SOLVER_HASH}), maxSol ${CFG.maxSol}, lease ${CFG.leaseMs}ms, maxAttempts ${CFG.maxAttempts}`);
  if (SOLVER_HASH === 'missing') {
    log('solver script not found - exiting');
    process.exit(2);
  }
  let lastReap = 0;
  let lastIdleBeat = 0;
  let idleSaid = '';
  while (!stopping) {
    try {
      const f = await getFarm();
      if (Date.now() - lastReap > CFG.reapEveryMs) {
        lastReap = Date.now();
        const r = await f.reap(CFG.maxAttempts);
        if (r.requeued || r.failed) log(`reaper: ${r.requeued} expired job(s) requeued, ${r.failed} moved to failed`);
      }
      const token = crypto.randomBytes(8).toString('hex');
      const claim = await f.claim(WORKER_ID, CFG.node, CFG.leaseMs, token);
      if (claim.kind !== 'job') {
        if (idleSaid !== claim.kind) log(claim.kind === 'paused' ? 'farm is paused; waiting' : 'queue empty; waiting');
        idleSaid = claim.kind;
        if (Date.now() - lastIdleBeat > CFG.heartbeatMs) {
          lastIdleBeat = Date.now();
          await registerWorker({ job: null, state: claim.kind });
        }
        await sleep(CFG.idlePollMs);
        continue;
      }
      idleSaid = '';
      current = { job: claim.job, token, child: null, startedAt: Date.now(), progress: null };
      await registerWorker({ job: claim.job, startedAt: current.startedAt, progress: null, attempt: claim.attempt });
      await processJob(claim);
      if (!stopping) current = null;
    } catch (e) {
      if (stopping) break;
      log(`loop error: ${e.stack || e.message}`);
      if (client) client.close();
      client = null;
      farm = null;
      await sleep(3000);
    }
  }
}

async function shutdown(sig) {
  if (stopping) return;
  stopping = true;
  log(`${sig} received; shutting down`);
  const cur = current;
  if (cur && cur.child && cur.child.exitCode === null) cur.child.kill('SIGTERM');
  try {
    if (cur) {
      await withRedis((f) => f.release(cur.job, cur.token), { retries: 3, label: 'release job' });
      log(`released ${cur.job} back to the queue`);
    }
    if (client) await client.call('HDEL', farm.k('workers'), WORKER_ID);
  } catch (e) {
    log(`shutdown cleanup failed (${e.message}); the lease will expire and the job will be requeued`);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((e) => {
  log(`fatal: ${e.stack || e.message}`);
  process.exit(1);
});
