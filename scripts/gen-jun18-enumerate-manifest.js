#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const logPath = path.join(ROOT, 'data/solver-runs/ingest-batch-20260618-183633.log');
const outPath = path.join(ROOT, 'data/solver-runs/jun18-enumerate-manifest.json');

const log = fs.readFileSync(logPath, 'utf8');
const ids = [...log.matchAll(/WRITE \/app\/solves\/(5x6-0B-[A-Z]{3})\.json/g)].map((m) => m[1]);
if (!ids.length) {
  console.error('No WRITE lines in ingest log');
  process.exit(1);
}

const mid = Math.ceil(ids.length / 2);
const b1 = ids.slice(0, mid);
const b2 = ids.slice(mid);

const manifest = {
  source: 'data/solver-runs/ingest-batch-20260618-183633.log',
  ingestDate: '2026-06-18',
  total: ids.length,
  range: `${ids[0]} to ${ids[ids.length - 1]}`,
  batches: {
    Batch1: { count: b1.length, from: b1[0], to: b1[b1.length - 1], ids: b1 },
    Batch2: { count: b2.length, from: b2[0], to: b2[b2.length - 1], ids: b2 },
  },
};

fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ out: outPath, total: ids.length, batch1: b1.length, batch2: b2.length }, null, 2));
