'use strict';

/**
 * Shared queue/result logic for the TileZilla solver farm (Redis).
 *
 * Job key = "<set>/<id>", e.g. "pair-swap-drafts/pair-swap-03191".
 *
 * Keys (P = prefix, default "farm"):
 *   P:queue                 ZSET  job -> priority score (lowest is claimed first)
 *   P:spec / P:score        HASH  job -> spec JSON / original score (for requeues)
 *   P:attempts              HASH  job -> number of claims so far
 *   P:leases                ZSET  job -> lease expiry (ms); P:lease HASH job -> lease JSON
 *   P:result                HASH  job -> result summary JSON
 *   P:solves:<job>          STR   gzip of the full solves JSON written by solve-level.js
 *   P:error                 HASH  job -> last error JSON
 *   P:workers               HASH  worker id -> heartbeat JSON
 *   P:nodedone              HASH  node -> jobs finished
 *   P:paused                STR   present = workers stop claiming new jobs
 *   P:sets                  SET   set names
 *   P:set:<set>:queue       ZSET  mirror of P:queue for this set (cheap counts)
 *   P:set:<set>:done        ZSET  job -> finished at (ms)
 *   P:set:<set>:failed      ZSET  job -> failed at (ms)
 *   P:set:<set>:exported    SET   jobs already written to local files by export
 *   P:set:<set>:stats       HASH  capped / zero counters
 *
 * Every state change that a worker makes is one Lua script, so it is atomic.
 */

const LUA_PRELUDE = `
local P = ARGV[1]
local function fmt(n) return string.format('%.0f', n) end
local function setOf(job) return string.match(job, '^(.-)/') or '_' end
local function sk(set, kind) return P .. ':set:' .. set .. ':' .. kind end
local function nowMs()
  local t = redis.call('TIME')
  return tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
end
local function enqueue(job)
  local score = redis.call('HGET', P .. ':score', job) or '0'
  redis.call('ZADD', P .. ':queue', score, job)
  redis.call('ZADD', sk(setOf(job), 'queue'), score, job)
end
local function dropLease(job)
  redis.call('ZREM', P .. ':leases', job)
  redis.call('HDEL', P .. ':lease', job)
end
local function leaseOwner(job, token)
  local raw = redis.call('HGET', P .. ':lease', job)
  if not raw then return nil end
  local l = cjson.decode(raw)
  if l.token == token then return true end
  return false
end
`;

const LUA = {
  // ARGV: P, worker, node, leaseMs, token
  claim: `
if redis.call('EXISTS', P .. ':paused') == 1 then return {'paused'} end
local popped = redis.call('ZPOPMIN', P .. ':queue')
if #popped == 0 then return {'empty'} end
local job = popped[1]
redis.call('ZREM', sk(setOf(job), 'queue'), job)
local now = nowMs()
local attempt = redis.call('HINCRBY', P .. ':attempts', job, 1)
redis.call('ZADD', P .. ':leases', fmt(now + tonumber(ARGV[4])), job)
redis.call('HSET', P .. ':lease', job, cjson.encode({worker = ARGV[2], node = ARGV[3], token = ARGV[5], startedAt = now, attempt = attempt}))
return {'job', job, redis.call('HGET', P .. ':spec', job) or '', tostring(attempt)}
`,
  // ARGV: P, job, token, leaseMs
  heartbeat: `
if leaseOwner(ARGV[2], ARGV[3]) ~= true then return 0 end
redis.call('ZADD', P .. ':leases', fmt(nowMs() + tonumber(ARGV[4])), ARGV[2])
return 1
`,
  // ARGV: P, job, token, resultJson, solvesBlob ('' = none), node, capped '1'/'0', zero '1'/'0'
  complete: `
local job = ARGV[2]
local set = setOf(job)
if leaseOwner(job, ARGV[3]) == true then dropLease(job) end
redis.call('ZREM', P .. ':queue', job)
redis.call('ZREM', sk(set, 'queue'), job)
redis.call('ZREM', sk(set, 'failed'), job)
redis.call('HDEL', P .. ':error', job)
redis.call('HSET', P .. ':result', job, ARGV[4])
if ARGV[5] ~= '' then redis.call('SET', P .. ':solves:' .. job, ARGV[5]) else redis.call('DEL', P .. ':solves:' .. job) end
local isNew = not redis.call('ZSCORE', sk(set, 'done'), job)
redis.call('ZADD', sk(set, 'done'), fmt(nowMs()), job)
redis.call('SREM', sk(set, 'exported'), job)
if isNew then
  redis.call('HINCRBY', P .. ':nodedone', ARGV[6], 1)
  if ARGV[7] == '1' then redis.call('HINCRBY', sk(set, 'stats'), 'capped', 1) end
  if ARGV[8] == '1' then redis.call('HINCRBY', sk(set, 'stats'), 'zero', 1) end
end
return 1
`,
  // ARGV: P, job, token, maxAttempts, errorJson
  fail: `
local job = ARGV[2]
local set = setOf(job)
redis.call('HSET', P .. ':error', job, ARGV[5])
local owner = leaseOwner(job, ARGV[3])
if owner == nil then return 'lease-lost' end
if owner == false then return 'not-owner' end
dropLease(job)
if redis.call('ZSCORE', sk(set, 'done'), job) then return 'already-done' end
local attempts = tonumber(redis.call('HGET', P .. ':attempts', job) or '0')
if attempts >= tonumber(ARGV[4]) then
  redis.call('ZADD', sk(set, 'failed'), fmt(nowMs()), job)
  return 'failed'
end
enqueue(job)
return 'requeued'
`,
  // Graceful stop: give the job back without using up an attempt. ARGV: P, job, token
  release: `
local job = ARGV[2]
if leaseOwner(job, ARGV[3]) ~= true then return 0 end
dropLease(job)
redis.call('HINCRBY', P .. ':attempts', job, -1)
if not redis.call('ZSCORE', sk(setOf(job), 'done'), job) then enqueue(job) end
return 1
`,
  // Return jobs whose lease expired (dead worker) to the queue. ARGV: P, maxAttempts
  reap: `
local now = nowMs()
local expired = redis.call('ZRANGEBYSCORE', P .. ':leases', '-inf', fmt(now), 'LIMIT', 0, 200)
local requeued, failed = 0, 0
for _, job in ipairs(expired) do
  local set = setOf(job)
  local raw = redis.call('HGET', P .. ':lease', job)
  dropLease(job)
  if not redis.call('ZSCORE', sk(set, 'done'), job) then
    local info = {}
    if raw then info = cjson.decode(raw) end
    redis.call('HSET', P .. ':error', job, cjson.encode({reason = 'lease expired (worker died or lost contact)', worker = info.worker, node = info.node, at = now}))
    local attempts = tonumber(redis.call('HGET', P .. ':attempts', job) or '0')
    if attempts >= tonumber(ARGV[2]) then
      redis.call('ZADD', sk(set, 'failed'), fmt(now), job)
      failed = failed + 1
    else
      enqueue(job)
      requeued = requeued + 1
    end
  end
end
return {requeued, failed}
`,
  // ARGV: P, set
  requeueFailed: `
local set = ARGV[2]
local jobs = redis.call('ZRANGE', sk(set, 'failed'), 0, -1)
for _, job in ipairs(jobs) do
  redis.call('ZREM', sk(set, 'failed'), job)
  redis.call('HDEL', P .. ':attempts', job)
  enqueue(job)
end
return #jobs
`,
  // ARGV: P, set
  clearQueue: `
local set = ARGV[2]
local jobs = redis.call('ZRANGE', sk(set, 'queue'), 0, -1)
for _, job in ipairs(jobs) do
  redis.call('ZREM', P .. ':queue', job)
end
redis.call('DEL', sk(set, 'queue'))
return #jobs
`,
};

const TIER_RANK = { '0A': 0, '0C': 1, '0B': 2 };

function jobKey(set, id) {
  return `${set}/${id}`;
}

function splitJob(job) {
  const i = job.indexOf('/');
  return { set: job.slice(0, i), id: job.slice(i + 1) };
}

/** Board size and tier from spec (falls back to the id, e.g. "4x5-0B-0123"). */
function describeSpec(id, spec) {
  let rows = spec && spec.board ? Number(spec.board.rows) : NaN;
  let cols = spec && spec.board ? Number(spec.board.cols) : NaN;
  const m = /^(\d+)x(\d+)-(\d[A-Z])-/.exec(id);
  if (!(rows > 0) && m) rows = Number(m[1]);
  if (!(cols > 0) && m) cols = Number(m[2]);
  const tier = (spec && spec.tier) || (m ? m[3] : '');
  return { rows, cols, cells: rows * cols, size: `${rows}x${cols}`, tier };
}

/**
 * Lower score = claimed first. Priority groups whole loads; inside a group smallest boards
 * first, then 0A, 0C, 0B, then load order.
 */
function scoreFor({ priority, cells, tier, seq }) {
  const tr = tier in TIER_RANK ? TIER_RANK[tier] : 3;
  return priority * 1e10 + Math.min(cells || 99, 999) * 1e7 + tr * 1e6 + Math.min(seq, 999999);
}

class Farm {
  constructor(client, prefix = 'farm') {
    this.r = client;
    this.P = prefix;
  }

  k(...parts) {
    return [this.P, ...parts].join(':');
  }

  sk(set, kind) {
    return `${this.P}:set:${set}:${kind}`;
  }

  eval(name, ...args) {
    return this.r.call('EVAL', LUA_PRELUDE + LUA[name], 0, this.P, ...args);
  }

  async claim(worker, node, leaseMs, token) {
    const r = await this.eval('claim', worker, node, leaseMs, token);
    const kind = String(r[0]);
    if (kind !== 'job') return { kind };
    return { kind, job: String(r[1]), spec: String(r[2] || ''), attempt: Number(String(r[3])) };
  }

  async heartbeat(job, token, leaseMs) {
    return (await this.eval('heartbeat', job, token, leaseMs)) === 1;
  }

  async complete(job, token, result, solvesGz, node) {
    return this.eval(
      'complete',
      job,
      token,
      JSON.stringify(result),
      solvesGz || '',
      node,
      result.hitMaxSolCap ? '1' : '0',
      result.solutions === 0 ? '1' : '0'
    );
  }

  async fail(job, token, maxAttempts, error) {
    return String(await this.eval('fail', job, token, maxAttempts, JSON.stringify(error)));
  }

  async release(job, token) {
    return this.eval('release', job, token);
  }

  async reap(maxAttempts) {
    const r = await this.eval('reap', maxAttempts);
    return { requeued: r[0], failed: r[1] };
  }

  async sets() {
    return (await this.r.str('SMEMBERS', this.k('sets'))).sort();
  }

  async requeueFailed(set) {
    return this.eval('requeueFailed', set);
  }

  async clearQueue(set) {
    return this.eval('clearQueue', set);
  }

  async redisNow() {
    const t = await this.r.str('TIME');
    return Number(t[0]) * 1000 + Math.floor(Number(t[1]) / 1000);
  }

  /**
   * Add jobs. jobs: [{ set, id, spec (string), score }]. Skips jobs that are already queued,
   * running, done or failed (unless opts.force). Returns counts.
   */
  async addJobs(jobs, opts = {}, onProgress = null) {
    const res = { added: 0, alreadyDone: 0, alreadyQueued: 0, running: 0, failed: 0 };
    const B = 1000;
    for (let i = 0; i < jobs.length; i += B) {
      const batch = jobs.slice(i, i + B);
      const checks = [];
      for (const j of batch) {
        const key = jobKey(j.set, j.id);
        checks.push(
          Promise.all([
            this.r.call('ZSCORE', this.sk(j.set, 'done'), key),
            this.r.call('ZSCORE', this.k('queue'), key),
            this.r.call('ZSCORE', this.k('leases'), key),
            this.r.call('ZSCORE', this.sk(j.set, 'failed'), key),
          ])
        );
      }
      const states = await Promise.all(checks);
      const writes = [];
      batch.forEach((j, idx) => {
        const [done, queued, leased, failed] = states[idx];
        if (!opts.force) {
          if (done !== null) return void res.alreadyDone++;
          if (leased !== null) return void res.running++;
          if (queued !== null) return void res.alreadyQueued++;
          if (failed !== null) return void res.failed++;
        } else if (leased !== null) return void res.running++;
        const key = jobKey(j.set, j.id);
        const score = String(j.score);
        writes.push(this.r.call('HSET', this.k('spec'), key, j.spec));
        writes.push(this.r.call('HSET', this.k('score'), key, score));
        writes.push(this.r.call('HDEL', this.k('attempts'), key));
        if (opts.force) {
          writes.push(this.r.call('ZREM', this.sk(j.set, 'done'), key));
          writes.push(this.r.call('ZREM', this.sk(j.set, 'failed'), key));
        }
        writes.push(this.r.call('ZADD', this.k('queue'), score, key));
        writes.push(this.r.call('ZADD', this.sk(j.set, 'queue'), score, key));
        res.added++;
      });
      const setsInBatch = [...new Set(batch.map((j) => j.set))];
      for (const s of setsInBatch) writes.push(this.r.call('SADD', this.k('sets'), s));
      await Promise.all(writes);
      if (onProgress) onProgress(Math.min(i + B, jobs.length), jobs.length, res);
    }
    return res;
  }

  async status({ rateWindowsMin = [5, 60], staleWorkerMs = 120000 } = {}) {
    const now = await this.redisNow();
    const sets = await this.sets();
    const leaseRaw = await this.r.str('HGETALL', this.k('lease'));
    const running = [];
    for (let i = 0; i < leaseRaw.length; i += 2) {
      try {
        running.push({ job: leaseRaw[i], ...JSON.parse(leaseRaw[i + 1]) });
      } catch {
        running.push({ job: leaseRaw[i] });
      }
    }
    const workerRaw = await this.r.str('HGETALL', this.k('workers'));
    const workers = [];
    for (let i = 0; i < workerRaw.length; i += 2) {
      try {
        const w = { id: workerRaw[i], ...JSON.parse(workerRaw[i + 1]) };
        w.alive = now - (w.lastSeen || 0) < staleWorkerMs;
        workers.push(w);
      } catch {
        /* ignore malformed */
      }
    }
    const progressByJob = {};
    for (const w of workers) if (w.job && w.progress) progressByJob[w.job] = w.progress;
    for (const r of running) r.progress = progressByJob[r.job] || null;

    const nodeDoneRaw = await this.r.str('HGETALL', this.k('nodedone'));
    const nodeDone = {};
    for (let i = 0; i < nodeDoneRaw.length; i += 2) nodeDone[nodeDoneRaw[i]] = Number(nodeDoneRaw[i + 1]);

    const setRows = await Promise.all(
      sets.map(async (name) => {
        const [queued, done, failed, exported, stats, ...rates] = await Promise.all([
          this.r.call('ZCARD', this.sk(name, 'queue')),
          this.r.call('ZCARD', this.sk(name, 'done')),
          this.r.call('ZCARD', this.sk(name, 'failed')),
          this.r.call('SCARD', this.sk(name, 'exported')),
          this.r.str('HGETALL', this.sk(name, 'stats')),
          ...rateWindowsMin.map((m) => this.r.call('ZCOUNT', this.sk(name, 'done'), String(now - m * 60000), '+inf')),
        ]);
        const st = {};
        for (let i = 0; i < stats.length; i += 2) st[stats[i]] = Number(stats[i + 1]);
        return {
          name,
          queued,
          done,
          failed,
          exported,
          capped: st.capped || 0,
          zero: st.zero || 0,
          running: running.filter((r) => r.job.startsWith(name + '/')).length,
          doneInWindow: Object.fromEntries(rateWindowsMin.map((m, i) => [m, rates[i]])),
        };
      })
    );
    const paused = (await this.r.call('EXISTS', this.k('paused'))) === 1;
    const info = await this.r.str('INFO', 'memory');
    const mem = /used_memory_human:(\S+)/.exec(info);
    return { now, paused, sets: setRows, running, workers, nodeDone, redisMemory: mem ? mem[1] : '?' };
  }
}

module.exports = { Farm, LUA, LUA_PRELUDE, jobKey, splitJob, describeSpec, scoreFor, TIER_RANK };
