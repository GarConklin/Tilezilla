#!/usr/bin/env node
'use strict';

/**
 * TileZilla solver farm admin CLI (runs on the Windows PC with plain Node, no npm install).
 * The PowerShell scripts in tools/swarm/ call this; you can also run it directly:
 *
 *   node tools/swarm/farm.js status
 *   node tools/swarm/farm.js watch
 *   node tools/swarm/farm.js load --set pair-swap-drafts --queue <queue.txt> --specs <dir>
 *   node tools/swarm/farm.js load-ledger --set swap-named --ledger <ledger.json> --specs <dir>
 *   node tools/swarm/farm.js export --set pair-swap-drafts --out <results dir>
 *   node tools/swarm/farm.js requeue-failed [--set NAME]
 *   node tools/swarm/farm.js failed --set NAME        (list failed jobs with their last error)
 *   node tools/swarm/farm.js pause | resume
 *   node tools/swarm/farm.js clear-queue --set NAME
 *   node tools/swarm/farm.js wipe --yes               (delete ALL farm data in redis)
 *
 * Connection (first match wins): command-line flags, env vars, then the JSON config file
 * (--config FILE, env FARM_CONFIG, default tools/swarm/farm.local.json - gitignored):
 *   flag              env                         config key
 *   --host            FARM_REDIS_HOST             redisHost
 *   --port            FARM_REDIS_PORT             redisPort
 *   --password        FARM_REDIS_PASSWORD         password
 *   --password-file   FARM_REDIS_PASSWORD_FILE    passwordFile
 *   --username        FARM_REDIS_USERNAME         username      (Redis ACL user, optional)
 *   --tls             FARM_REDIS_TLS              tls           (true for TLS, e.g. rediss / stunnel)
 *   --tls-servername  FARM_REDIS_TLS_SERVERNAME   tlsServername
 *   --tls-ca-file     FARM_REDIS_TLS_CA_FILE      tlsCaFile
 *   --tls-insecure    FARM_REDIS_TLS_INSECURE     tlsInsecure   (skip certificate check)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { RedisClient, clientOptions } = require('./lib/resp');
const { Farm, describeSpec, scoreFor, TIER_RANK } = require('./lib/farm-core');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || 'help';

function loadConfig() {
  const cfgPath = args.config || process.env.FARM_CONFIG || path.join(__dirname, 'farm.local.json');
  let cfg = {};
  if (fs.existsSync(cfgPath)) cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
  const e = process.env;
  const pick = (argName, envName, cfgName) => (args[argName] !== undefined ? args[argName] : e[envName] !== undefined ? e[envName] : cfg[cfgName]);
  const settings = {
    host: pick('host', 'FARM_REDIS_HOST', 'redisHost') || '127.0.0.1',
    port: pick('port', 'FARM_REDIS_PORT', 'redisPort') || 6379,
    password: pick('password', 'FARM_REDIS_PASSWORD', 'password'),
    passwordFile: pick('password-file', 'FARM_REDIS_PASSWORD_FILE', 'passwordFile'),
    username: pick('username', 'FARM_REDIS_USERNAME', 'username'),
    tls: pick('tls', 'FARM_REDIS_TLS', 'tls'),
    tlsServername: pick('tls-servername', 'FARM_REDIS_TLS_SERVERNAME', 'tlsServername'),
    tlsCaFile: pick('tls-ca-file', 'FARM_REDIS_TLS_CA_FILE', 'tlsCaFile'),
    tlsInsecure: pick('tls-insecure', 'FARM_REDIS_TLS_INSECURE', 'tlsInsecure'),
  };
  const opts = clientOptions(settings);
  return { ...opts, opts, prefix: args.prefix || cfg.prefix || 'farm', cfgPath };
}

async function open() {
  const cfg = loadConfig();
  const c = new RedisClient(cfg.opts);
  try {
    await c.connect();
  } catch (e) {
    console.error(`Cannot connect to the farm's Redis at ${cfg.host}:${cfg.port}: ${e.message}`);
    console.error(`(config: ${fs.existsSync(cfg.cfgPath) ? cfg.cfgPath : 'none found - run tools/swarm/bootstrap-swarm.ps1 or set-farm-config.ps1'})`);
    process.exit(3);
  }
  return { client: c, farm: new Farm(c, cfg.prefix), cfg };
}

function listArg(v) {
  if (!v || v === true) return [];
  return String(v).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

function fmtDur(ms) {
  if (!isFinite(ms) || ms < 0) return '--';
  const s = Math.round(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

function readSpec(specsDir, id) {
  const p = path.join(specsDir, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  return JSON.stringify(JSON.parse(text));
}

/** Common filtering/sorting/loading for both load commands. */
async function loadIds(set, ids, specsDir, label) {
  if (!set || /[\/\s]/.test(set)) throw new Error('--set NAME is required (no slashes or spaces)');
  if (!fs.existsSync(specsDir)) throw new Error(`specs folder not found: ${specsDir}`);
  const sizes = listArg(args.sizes);
  const exclude = listArg(args['exclude-sizes'] === undefined ? '6x6' : args['exclude-sizes']);
  const tiers = listArg(args.tiers);
  const priority = Number(args.priority ?? 10);
  const limit = Number(args.limit || 0);
  const skipResultsDir = args['skip-results'] && args['skip-results'] !== true ? args['skip-results'] : null;

  console.log(`${label}: ${ids.length} id(s). Reading specs from ${specsDir} ...`);
  const items = [];
  let missing = 0;
  let filtered = 0;
  let haveResult = 0;
  let n = 0;
  for (const id of ids) {
    n++;
    if (n % 20000 === 0) console.log(`  read ${n}/${ids.length} ...`);
    const pre = describeSpec(id, null);
    if (pre.cells > 0) {
      if (exclude.includes(pre.size) || (sizes.length && !sizes.includes(pre.size))) {
        filtered++;
        continue;
      }
    }
    if (skipResultsDir && fs.existsSync(path.join(skipResultsDir, `${id}.json`))) {
      haveResult++;
      continue;
    }
    const spec = readSpec(specsDir, id);
    if (!spec) {
      missing++;
      continue;
    }
    const d = describeSpec(id, JSON.parse(spec));
    if (exclude.includes(d.size) || (sizes.length && !sizes.includes(d.size)) || (tiers.length && !tiers.includes(d.tier))) {
      filtered++;
      continue;
    }
    items.push({ id, spec, ...d, order: items.length });
  }
  const tr = (t) => (t in TIER_RANK ? TIER_RANK[t] : 3);
  items.sort((a, b) => a.cells - b.cells || tr(a.tier) - tr(b.tier) || a.rows - b.rows || a.order - b.order);
  const chosen = limit > 0 ? items.slice(0, limit) : items;
  const jobs = chosen.map((it, seq) => ({ set, id: it.id, spec: it.spec, score: scoreFor({ priority, cells: it.cells, tier: it.tier, seq }) }));

  const bySize = {};
  for (const it of chosen) {
    const k = `${it.size} ${it.tier}`;
    bySize[k] = (bySize[k] || 0) + 1;
  }
  console.log(`Specs ok: ${items.length}   filtered out by size/tier: ${filtered}   missing spec file: ${missing}${skipResultsDir ? `   already have local result: ${haveResult}` : ''}`);
  console.log(`To load: ${jobs.length} (priority ${priority}; lower runs first)`);
  for (const [k, v] of Object.entries(bySize)) console.log(`   ${k.padEnd(10)} ${v}`);
  if (args['dry-run']) {
    console.log('Dry run - nothing sent to the farm.');
    return;
  }
  const { client, farm, cfg } = await open();
  console.log(`Sending to ${cfg.host}:${cfg.port} ...`);
  const res = await farm.addJobs(jobs, { force: !!args.force }, (done, total) => {
    if (done % 10000 === 0 || done === total) console.log(`  sent ${done}/${total}`);
  });
  console.log(`Added ${res.added}. Skipped: already done ${res.alreadyDone}, already queued ${res.alreadyQueued}, running now ${res.running}, in failed list ${res.failed}.`);
  client.close();
}

async function cmdLoad() {
  const queue = args.queue;
  if (!queue || !fs.existsSync(queue)) throw new Error(`--queue file not found: ${queue}`);
  const ids = fs.readFileSync(queue, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  await loadIds(args.set, [...new Set(ids)], args.specs, `Queue ${path.basename(queue)}`);
}

async function cmdLoadLedger() {
  const ledgerPath = args.ledger;
  if (!ledgerPath || !fs.existsSync(ledgerPath)) throw new Error(`--ledger file not found: ${ledgerPath}`);
  console.log(`Reading ledger ${ledgerPath} (read-only) ...`);
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').replace(/^\uFEFF/, ''));
  const done = ledger.done || {};
  const pending = (ledger.pending || []).filter((id) => !(id in done));
  console.log(`Ledger: ${(ledger.pending || []).length} pending, ${Object.keys(done).length} done -> ${pending.length} to consider.`);
  await loadIds(args.set, [...new Set(pending)], args.specs, 'Ledger pending');
}

function bar(frac, width = 30) {
  const f = Math.max(0, Math.min(1, frac || 0));
  const full = Math.round(f * width);
  return '[' + '#'.repeat(full) + '.'.repeat(width - full) + ']';
}

function renderStatus(st, cfg) {
  const L = [];
  const t = new Date(st.now).toLocaleString();
  L.push(`TileZilla solver farm   ${cfg.host}:${cfg.port}   ${t}${st.paused ? '   *** PAUSED ***' : ''}`);
  L.push('='.repeat(100));
  let tq = 0, td = 0, tf = 0, tr = 0, r5 = 0, r60 = 0;
  L.push(`${'Set'.padEnd(26)}${'Solved'.padStart(9)}${'Waiting'.padStart(10)}${'Running'.padStart(9)}${'Failed'.padStart(8)}${'Capped'.padStart(8)}${'Zero'.padStart(8)}${'Exported'.padStart(10)}   Progress`);
  for (const s of st.sets) {
    const total = s.done + s.queued + s.running + s.failed;
    tq += s.queued; td += s.done; tf += s.failed; tr += s.running;
    r5 += s.doneInWindow[5] || 0; r60 += s.doneInWindow[60] || 0;
    L.push(`${s.name.slice(0, 25).padEnd(26)}${String(s.done).padStart(9)}${String(s.queued).padStart(10)}${String(s.running).padStart(9)}${String(s.failed).padStart(8)}${String(s.capped).padStart(8)}${String(s.zero).padStart(8)}${String(s.exported).padStart(10)}   ${bar(total ? s.done / total : 0, 20)} ${total ? ((100 * s.done) / total).toFixed(1) : '0.0'}%`);
  }
  if (!st.sets.length) L.push('  (no jobs loaded yet - run tools/swarm/load-queue.ps1)');
  L.push('-'.repeat(100));
  const total = tq + td + tf + tr;
  const rate = r5 >= 5 ? r5 / 5 : r60 / 60; // per minute
  const left = tq + tr;
  const eta = rate > 0 ? (left / rate) * 60000 : Infinity;
  L.push(`TOTAL  solved ${td}   waiting ${tq}   in progress ${tr}   failed ${tf}   of ${total}   ${bar(total ? td / total : 0)} ${total ? ((100 * td) / total).toFixed(1) : '0.0'}%`);
  L.push(`Rate   last 5 min: ${(r5 / 5).toFixed(1)}/min   last 60 min: ${(r60 / 60).toFixed(1)}/min (${r60}/h)   ETA: ${left === 0 ? 'done' : fmtDur(eta)}   Redis memory: ${st.redisMemory}`);
  L.push('');

  const nodes = {};
  const touch = (n) => (nodes[n] = nodes[n] || { workers: 0, busy: 0, running: 0, done: 0 });
  for (const w of st.workers) if (w.alive) {
    const n = touch(w.node || '?');
    n.workers++;
    if (w.job) n.busy++;
  }
  for (const r of st.running) touch(r.node || '?').running++;
  for (const [n, c] of Object.entries(st.nodeDone)) touch(n).done = c;
  const alive = st.workers.filter((w) => w.alive).length;
  L.push(`Nodes (${Object.keys(nodes).length})   workers alive: ${alive}`);
  L.push(`  ${'Node'.padEnd(28)}${'Workers'.padStart(8)}${'Running'.padStart(9)}${'Solved'.padStart(10)}`);
  for (const [n, c] of Object.entries(nodes).sort()) {
    L.push(`  ${n.slice(0, 27).padEnd(28)}${String(c.workers).padStart(8)}${String(c.running).padStart(9)}${String(c.done).padStart(10)}`);
  }
  L.push('');
  const runs = [...st.running].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  const show = Number(args.jobs || 12);
  L.push(`Running jobs (longest first, showing ${Math.min(show, runs.length)} of ${runs.length})`);
  for (const r of runs.slice(0, show)) {
    const el = st.now - (r.startedAt || st.now);
    const prog = r.progress ? r.progress.replace(/^Progress:\s*/, '') : '';
    L.push(`  ${r.job.slice(0, 44).padEnd(45)}${String(r.node || '?').slice(0, 16).padEnd(17)}${fmtDur(el).padStart(10)}  try ${r.attempt || '?'}  ${prog.slice(0, 60)}`);
  }
  return L.join('\n');
}

async function cmdStatus() {
  const { client, farm, cfg } = await open();
  const st = await farm.status();
  if (args.out && args.out !== true) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, renderStatus(st, cfg) + '\n');
  }
  if (args['json-out'] && args['json-out'] !== true) {
    fs.mkdirSync(path.dirname(path.resolve(args['json-out'])), { recursive: true });
    fs.writeFileSync(args['json-out'], JSON.stringify(st, null, 2) + '\n');
  }
  if (args.json) console.log(JSON.stringify(st, null, 2));
  else if (!args.quiet) console.log(renderStatus(st, cfg));
  client.close();
}

async function cmdWatch() {
  const interval = Number(args.interval || 5) * 1000;
  const cfg = loadConfig();
  let client = null;
  let farm = null;
  for (;;) {
    let text;
    try {
      if (!client || client.closed) {
        client = new RedisClient(cfg.opts);
        await client.connect();
        farm = new Farm(client, cfg.prefix);
      }
      text = renderStatus(await farm.status(), cfg);
    } catch (e) {
      if (client) client.close();
      client = null;
      text = `TileZilla solver farm   ${cfg.host}:${cfg.port}   ${new Date().toLocaleString()}\n\nCannot reach the farm: ${e.message}\nRetrying every ${interval / 1000}s ...`;
    }
    process.stdout.write('\x1b[2J\x1b[H' + text + `\n\n(refreshing every ${interval / 1000}s - Ctrl+C to close)\n`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

async function cmdExport() {
  const set = args.set;
  const outDir = args.out;
  if (!set || !outDir || outDir === true) throw new Error('export needs --set NAME --out DIR');
  const summaryPath = args.summary && args.summary !== true ? args.summary : path.join(path.dirname(path.resolve(outDir)), 'farm-results.ndjson');
  const progressPath = args.progress && args.progress !== true ? args.progress : path.join(path.dirname(path.resolve(outDir)), 'results-progress.ndjson');
  fs.mkdirSync(outDir, { recursive: true });
  const { client, farm } = await open();
  const r = client;
  const doneKey = farm.sk(set, 'done');
  const exportedKey = farm.sk(set, 'exported');
  const all = await r.str('ZRANGE', doneKey, 0, -1);
  const exported = new Set(args.all ? [] : await r.str('SMEMBERS', exportedKey));
  const todo = all.filter((j) => !exported.has(j));
  console.log(`Set ${set}: ${all.length} solved in the farm, ${todo.length} to export -> ${path.resolve(outDir)}`);
  const gzipOver = Number(args['gzip-over'] || 0);
  let files = 0, gzFiles = 0, zero = 0, notStored = 0, n = 0;
  const B = 200;
  for (let i = 0; i < todo.length; i += B) {
    const batch = todo.slice(i, i + B);
    const results = await r.str('HMGET', farm.k('result'), ...batch);
    const blobs = await Promise.all(batch.map((j) => r.call('GET', farm.k('solves', j))));
    const summaryLines = [];
    const progressLines = [];
    for (let k = 0; k < batch.length; k++) {
      const job = batch[k];
      const res = results[k] ? JSON.parse(results[k]) : { job, id: job.slice(job.indexOf('/') + 1) };
      const id = res.id || job.slice(job.indexOf('/') + 1);
      if (blobs[k]) {
        const plain = path.join(outDir, `${id}.json`);
        const gzPath = `${plain}.gz`;
        if (gzipOver > 0 && (res.solvesBytes || Infinity) > gzipOver) {
          fs.writeFileSync(gzPath, blobs[k]);
          if (fs.existsSync(plain)) fs.unlinkSync(plain);
          gzFiles++;
        } else {
          fs.writeFileSync(plain, zlib.gunzipSync(blobs[k]));
          if (fs.existsSync(gzPath)) fs.unlinkSync(gzPath);
        }
        files++;
      } else if (res.solutions === 0) zero++;
      else notStored++;
      summaryLines.push(JSON.stringify(res));
      progressLines.push(JSON.stringify({ totalUniqueSolutions: res.solutions, hitMaxSolCap: !!res.hitMaxSolCap, ts: res.ts, id, exit: res.exit, source: 'swarm', node: res.node }));
    }
    fs.appendFileSync(summaryPath, summaryLines.join('\n') + '\n');
    if (!args['no-progress-log']) fs.appendFileSync(progressPath, progressLines.join('\n') + '\n');
    await r.call('SADD', exportedKey, ...batch);
    if (args['purge-solves']) await r.call('DEL', ...batch.map((j) => farm.k('solves', j)));
    n += batch.length;
    if (n % 2000 === 0 || n === todo.length) console.log(`  exported ${n}/${todo.length}`);
  }
  console.log(`Wrote ${files} solves file(s)${gzFiles ? ` (${gzFiles} large ones as .json.gz)` : ''}; ${zero} had zero solutions (no file, same as the old queue runner)${notStored ? `; ${notStored} had no stored solves (see farm-results.ndjson solvesNote)` : ''}.`);
  console.log(`Summary lines appended to ${summaryPath}`);
  if (!args['no-progress-log']) console.log(`Progress lines appended to ${progressPath}`);

  if (args['ledger-out'] && args['ledger-out'] !== true) {
    const doneMap = {};
    for (let i = 0; i < all.length; i += 1000) {
      const batch = all.slice(i, i + 1000);
      const rs = await r.str('HMGET', farm.k('result'), ...batch);
      rs.forEach((txt, k) => {
        if (!txt) return;
        const x = JSON.parse(txt);
        doneMap[x.id || batch[k].slice(batch[k].indexOf('/') + 1)] = { solutions: x.solutions, exit: x.exit, ts: x.ts, capped: !!x.hitMaxSolCap };
      });
    }
    fs.writeFileSync(args['ledger-out'], JSON.stringify({ set, exportedAt: new Date().toISOString(), done: doneMap }, null, 1));
    console.log(`Ledger-style done map (${Object.keys(doneMap).length} entries) written to ${args['ledger-out']}`);
  }
  client.close();
}

async function cmdRequeueFailed() {
  const { client, farm } = await open();
  const sets = args.set && args.set !== true ? [args.set] : await farm.sets();
  let total = 0;
  for (const s of sets) {
    const n = await farm.requeueFailed(s);
    if (n) console.log(`${s}: ${n} failed job(s) back in the queue (attempt counter reset)`);
    total += n;
  }
  console.log(`Requeued ${total} job(s).`);
  client.close();
}

async function cmdFailed() {
  const { client, farm } = await open();
  const sets = args.set && args.set !== true ? [args.set] : await farm.sets();
  for (const s of sets) {
    const jobs = await client.str('ZRANGE', farm.sk(s, 'failed'), 0, -1);
    if (!jobs.length) continue;
    console.log(`${s}: ${jobs.length} failed`);
    const errs = await client.str('HMGET', farm.k('error'), ...jobs);
    jobs.forEach((j, i) => {
      let e = {};
      try { e = JSON.parse(errs[i] || '{}'); } catch { /* ignore */ }
      console.log(`  ${j}  ${e.reason || ''} exit=${e.exit ?? ''} signal=${e.signal ?? ''} node=${e.node || ''}`);
      if (args.verbose && e.tail) for (const l of e.tail) console.log(`      ${l}`);
    });
  }
  client.close();
}

async function simple(fn) {
  const { client, farm } = await open();
  await fn(client, farm);
  client.close();
}

const HELP = `TileZilla solver farm admin
  node tools/swarm/farm.js <command> [options]
Commands: status [--json] | watch [--interval 5] | load | load-ledger | export | requeue-failed |
          failed [--verbose] | pause | resume | clear-queue --set NAME | wipe --yes | ping
Load options: --set NAME --queue FILE | --ledger FILE, --specs DIR, --priority 10, --sizes 3x5,4x4,
          --exclude-sizes 6x6 (default), --tiers 0A,0C, --limit N, --skip-results DIR, --force, --dry-run
Export options: --set NAME --out DIR [--all] [--gzip-over BYTES] [--purge-solves] [--summary FILE]
          [--ledger-out FILE] [--no-progress-log]
Status options: --json | --out FILE (text) | --json-out FILE | --quiet`;

(async () => {
  switch (cmd) {
    case 'load': return cmdLoad();
    case 'load-ledger': return cmdLoadLedger();
    case 'status': return cmdStatus();
    case 'watch': return cmdWatch();
    case 'export': return cmdExport();
    case 'requeue-failed': return cmdRequeueFailed();
    case 'failed': return cmdFailed();
    case 'ping': return simple(async (c) => console.log(`Connected OK (${await c.str('PING')})`));
    case 'pause': return simple(async (c, f) => { await c.call('SET', f.k('paused'), '1'); console.log('Paused: workers finish their current job, then wait.'); });
    case 'resume': return simple(async (c, f) => { await c.call('DEL', f.k('paused')); console.log('Resumed.'); });
    case 'clear-queue':
      if (!args.set || args.set === true) throw new Error('clear-queue needs --set NAME');
      return simple(async (c, f) => console.log(`Removed ${await f.clearQueue(args.set)} waiting job(s) from ${args.set} (running/solved/failed untouched).`));
    case 'wipe':
      if (!args.yes) throw new Error('wipe deletes ALL farm data in redis; add --yes to confirm');
      return simple(async (c, f) => {
        let cursor = '0', n = 0;
        do {
          const [next, keys] = await c.str('SCAN', cursor, 'MATCH', `${f.P}:*`, 'COUNT', 1000);
          cursor = next;
          if (keys.length) n += await c.call('DEL', ...keys);
        } while (cursor !== '0');
        console.log(`Deleted ${n} key(s).`);
      });
    default:
      console.log(HELP);
  }
})().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
