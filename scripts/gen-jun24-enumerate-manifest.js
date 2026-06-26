#!/usr/bin/env node
'use strict';

/**
 * Build jun24-enumerate-manifest.json from a Jun 24 ingest log (WRITE lines).
 * Splits ingested level IDs into 4 parallel enumeration batches.
 *
 * Usage:
 *   node scripts/gen-jun24-enumerate-manifest.js
 *   node scripts/gen-jun24-enumerate-manifest.js data/solver-runs/ingest-batch-YYYYMMDD-HHMMSS.log
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RUNS = path.join(ROOT, 'data/solver-runs');
const OUT = path.join(RUNS, 'jun24-enumerate-manifest.json');
const BATCH_CHUNKS = 4;
const BATCH_FILE = 'data/5x6 tilepz solves 24 June  2026.txt';

function parseWriteIds(logText) {
  return [...logText.matchAll(/WRITE \/app\/solves\/(5x6-0B-[A-Z]{3})\.json/g)].map((m) => m[1]);
}

function findJun24IngestLogs(explicitPath) {
  if (explicitPath) {
    const p = path.resolve(ROOT, explicitPath);
    return fs.existsSync(p) ? [p] : [];
  }
  if (!fs.existsSync(RUNS)) return [];
  return fs
    .readdirSync(RUNS)
    .filter((f) => f.startsWith('ingest-batch-') && f.endsWith('.log'))
    .map((f) => path.join(RUNS, f))
    .filter((p) => {
      const text = fs.readFileSync(p, 'utf8');
      return (
        text.includes('WRITE /app/solves/5x6-0B-CQG.json')
        && text.includes('WRITE /app/solves/5x6-0B-DIW.json')
      );
    })
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function collectWriteIds(logPaths) {
  const seen = new Set();
  const ids = [];
  for (const logPath of logPaths) {
    for (const id of parseWriteIds(fs.readFileSync(logPath, 'utf8'))) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return ids;
}

function chunkIds(ids, chunks) {
  const size = Math.ceil(ids.length / chunks);
  const batches = {};
  for (let i = 0; i < chunks; i += 1) {
    const slice = ids.slice(i * size, (i + 1) * size);
    if (!slice.length) continue;
    const key = `Batch${i + 1}`;
    batches[key] = {
      count: slice.length,
      from: slice[0],
      to: slice[slice.length - 1],
      ids: slice,
    };
  }
  return batches;
}

function main() {
  const explicit = process.argv[2];
  const logPaths = explicit ? findJun24IngestLogs(explicit) : findJun24IngestLogs();

  if (!logPaths.length) {
    console.error('No Jun 24 ingest log found. Run ingest first, or pass log path.');
    process.exit(1);
  }

  const ids = collectWriteIds(logPaths);
  if (!ids.length) {
    console.error(`No WRITE lines in: ${logPaths.join(', ')}`);
    process.exit(1);
  }

  const batches = chunkIds(ids, BATCH_CHUNKS);
  const manifest = {
    source: logPaths.map((p) => path.relative(ROOT, p).replace(/\\/g, '/')),
    batchFile: BATCH_FILE,
    ingestDate: '2026-06-24',
    total: ids.length,
    range: `${ids[0]} … ${ids[ids.length - 1]}`,
    chunks: BATCH_CHUNKS,
    batches,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  const summary = Object.fromEntries(
    Object.entries(batches).map(([k, v]) => [k, { count: v.count, from: v.from, to: v.to }]),
  );
  console.log(JSON.stringify({ out: path.relative(ROOT, OUT), total: ids.length, batches: summary }, null, 2));
}

main();
