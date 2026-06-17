#!/usr/bin/env node
/**
 * Level ids from `data/tilepz solves 5x6 13 jun 2026.txt` (150 levels, 5x6-0B-AUA … BAT).
 *
 *   node scripts/list-jun13-5x6-level-ids.js
 *   node scripts/list-jun13-5x6-level-ids.js --phase Batch1
 *   node scripts/list-jun13-5x6-level-ids.js --phase Batch4
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BATCH_PATH = path.join(__dirname, '..', 'data', 'tilepz solves 5x6 13 jun 2026.txt');
const CHUNK_COUNT = 4;

function splitJsonDocs(s) {
  const out = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          out.push(JSON.parse(s.slice(start, i + 1)));
          start = -1;
        }
      }
    }
  }
  return out;
}

function loadIds() {
  const docs = splitJsonDocs(fs.readFileSync(BATCH_PATH, 'utf8'));
  return docs.map((d) => {
    const id = d.levelId || d.solutions?.[0]?.label?.split(/\s+/)[0];
    if (!id) throw new Error('Missing levelId in batch doc');
    return id;
  });
}

function chunkIds(ids, chunks) {
  const per = Math.ceil(ids.length / chunks);
  const out = [];
  for (let c = 0; c < chunks; c++) {
    out.push(ids.slice(c * per, (c + 1) * per));
  }
  return out.filter((a) => a.length);
}

function main() {
  const phaseArg = process.argv.find((a, i) => process.argv[i - 1] === '--phase') || 'All';
  const ids = loadIds();
  const batches = chunkIds(ids, CHUNK_COUNT);
  const map = {
    Batch1: batches[0] || [],
    Batch2: batches[1] || [],
    Batch3: batches[2] || [],
    Batch4: batches[3] || [],
    All: ids,
  };
  const phase = phaseArg;
  const out = map[phase];
  if (!out) {
    console.error('Use --phase Batch1 | Batch2 | Batch3 | Batch4 | All');
    process.exit(1);
  }
  for (const id of out) console.log(id);
}

main();
