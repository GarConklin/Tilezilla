#!/usr/bin/env node
/**
 * Rebuild data/levels/solve-queue.json:
 * - Default: levels in bucket files touched within the last N hours (default 24)
 * - With --all-buckets: every tier bucket JSON is scanned (use after adding many levels
 *   spread across files, so missing solves/ files are not tied to recent mtime)
 * - single-snake only (pathMode absent or "single")
 * - solve file path solves/<solvesFile> does not exist yet
 * - union with manualIds from the existing solve-queue.json (or pass --manual id,id)
 *
 * Usage (repo root):
 *   node scripts/refresh-solve-queue.js
 *   node scripts/refresh-solve-queue.js --hours 48
 *   node scripts/refresh-solve-queue.js --all-buckets
 *   node scripts/refresh-solve-queue.js --manual 6x6-0C-AZZ,5x5-0A-AAA
 *
 * Docker (compose file at repo root; `.` mounted at `/app` in service `web`):
 *   docker compose run --rm web node scripts/refresh-solve-queue.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'levels', 'solve-queue.json');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');

function parseArgs(argv) {
  let hours = 24;
  let allBuckets = false;
  const manual = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--hours' && argv[i + 1]) hours = Math.max(1, parseInt(argv[++i], 10));
    else if (argv[i] === '--all-buckets') allBuckets = true;
    else if (argv[i] === '--manual' && argv[i + 1]) {
      manual.push(
        ...argv[++i]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  return { hours, manual, allBuckets };
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function bucketsRecent(hours) {
  const cutoff = Date.now() - hours * 3600 * 1000;
  const out = [];
  for (const name of fs.readdirSync(LEVELS_DIR)) {
    if (!name.endsWith('.json')) continue;
    if (['levels.json', 'index.json', 'solve-queue.json'].includes(name)) continue;
    const full = path.join(LEVELS_DIR, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.mtimeMs >= cutoff) out.push(full);
  }
  out.sort();
  return out;
}

/** Every `data/levels/*-*.json` bucket (excludes index, flat catalog, queue). */
function bucketsAll() {
  const out = [];
  for (const name of fs.readdirSync(LEVELS_DIR)) {
    if (!name.endsWith('.json')) continue;
    if (['levels.json', 'index.json', 'solve-queue.json'].includes(name)) continue;
    out.push(path.join(LEVELS_DIR, name));
  }
  out.sort();
  return out;
}

function buildLevelIndex() {
  /** @type {Map<string, { bucket: string, solvesFile: string, level: object }>} */
  const map = new Map();
  for (const name of fs.readdirSync(LEVELS_DIR)) {
    if (!name.endsWith('.json')) continue;
    if (['levels.json', 'index.json', 'solve-queue.json'].includes(name)) continue;
    const full = path.join(LEVELS_DIR, name);
    let doc;
    try {
      doc = loadJson(full);
    } catch {
      continue;
    }
    const levels = doc.levels;
    if (!Array.isArray(levels)) continue;
    for (const L of levels) {
      if (!L || !L.id) continue;
      map.set(L.id, { bucket: name, solvesFile: L.solvesFile || `${L.id}.json`, level: L });
    }
  }
  return map;
}

function solvePath(solvesFile) {
  return path.join(ROOT, 'solves', ...solvesFile.split('/'));
}

function runDockerSolveArgs(levelId) {
  return `docker compose run --rm web node solves/solve-level.js ${levelId} --viable-seeds-only --write-solves --json-summary`;
}

function main() {
  const { hours, manual: manualCli, allBuckets } = parseArgs(process.argv);
  let manualIds = [...manualCli];
  if (fs.existsSync(QUEUE_PATH)) {
    try {
      const prev = loadJson(QUEUE_PATH);
      if (Array.isArray(prev.manualIds)) manualIds.push(...prev.manualIds);
    } catch {
      /* ignore */
    }
  }
  manualIds = [...new Set(manualIds)];

  const scanBuckets = allBuckets ? bucketsAll() : bucketsRecent(hours);
  const index = buildLevelIndex();
  const autoIds = [];

  for (const bp of scanBuckets) {
    const doc = loadJson(bp);
    for (const L of doc.levels || []) {
      if (!L || !L.id) continue;
      if (L.pathMode && L.pathMode !== 'single') continue;
      const sf = L.solvesFile || `${L.id}.json`;
      if (!fs.existsSync(solvePath(sf))) autoIds.push(L.id);
    }
  }

  const combined = [...new Set([...autoIds, ...manualIds])];
  const pending = [];
  const skippedManual = [];

  for (const id of combined.sort((a, b) => a.localeCompare(b))) {
    const meta = index.get(id);
    if (!meta) {
      if (manualIds.includes(id)) skippedManual.push({ id, reason: 'not found in any bucket' });
      continue;
    }
    if (meta.level.pathMode && meta.level.pathMode !== 'single') continue;
    if (fs.existsSync(solvePath(meta.solvesFile))) continue;
    pending.push({
      id,
      bucket: meta.bucket,
      solvesFile: meta.solvesFile,
      run: `node solves/solve-level.js ${id} --viable-seeds-only --write-solves --json-summary`,
      runDocker: runDockerSolveArgs(id),
    });
  }

  const first = pending[0];
  const doc = {
    schema: 'solve-queue-v1',
    note:
      'Run one pending job at a time (docker: pending[].runDocker; host: pending[].run). Regenerate: docker compose run --rm web node scripts/refresh-solve-queue.js',
    scanMode: allBuckets ? 'all-buckets' : 'recent-mtime',
    windowHours: allBuckets ? null : hours,
    generatedAt: new Date().toISOString(),
    bucketsScanned: scanBuckets.map((p) => path.basename(p)),
    manualIds,
    skippedManual,
    pending,
    next: first
      ? {
          id: first.id,
          bucket: first.bucket,
          solvesFile: first.solvesFile,
          run: first.run,
          runDocker: first.runDocker,
        }
      : null,
  };

  fs.writeFileSync(QUEUE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  process.stderr.write(
    `Wrote ${path.relative(ROOT, QUEUE_PATH)} — ${pending.length} pending (${autoIds.length} auto + ${manualIds.length} manual ids, overlapping removed); scan=${allBuckets ? 'all buckets' : `mtime<=${hours}h`}.\n`
  );
  if (pending[0]) {
    process.stderr.write(`Next (host): ${pending[0].run}\n`);
    process.stderr.write(`Next (docker): ${pending[0].runDocker}\n`);
  }
}

main();
