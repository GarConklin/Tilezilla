#!/usr/bin/env node
/**
 * Split a concatenated TilePz solve export into N chunk files (JSON docs preserved in order).
 *
 * Usage:
 *   node scripts/split-solve-batch-file.js "data/tilepz solves 5x6 13 jun 2026.txt" --chunks 4
 *   node scripts/split-solve-batch-file.js input.txt --chunks 4 --out "data/tilepz solves 5x6 13 jun 2026 - batch"
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
          out.push(s.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return out;
}

function usage() {
  console.error('Usage: node scripts/split-solve-batch-file.js <batch.txt> [--chunks N] [--out prefix]');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) usage();

  const input = args[0];
  let chunks = 4;
  let outPrefix = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--chunks' && args[i + 1]) {
      chunks = Math.max(1, Number(args[i + 1]) || 4);
      i++;
    } else if (args[i] === '--out' && args[i + 1]) {
      outPrefix = args[i + 1];
      i++;
    }
  }

  const abs = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  const docs = splitJsonDocs(fs.readFileSync(abs, 'utf8'));
  if (!docs.length) {
    console.error('No JSON documents found in', input);
    process.exit(1);
  }

  const base = outPrefix || abs.replace(/\.txt$/i, '');
  const per = Math.ceil(docs.length / chunks);
  const written = [];

  for (let c = 0; c < chunks; c++) {
    const slice = docs.slice(c * per, (c + 1) * per);
    if (!slice.length) break;
    const outPath = `${base} - batch${c + 1}.txt`;
    fs.writeFileSync(outPath, `${slice.join('\n\n')}\n`, 'utf8');
    const first = JSON.parse(slice[0]).levelId || '?';
    const last = JSON.parse(slice[slice.length - 1]).levelId || '?';
    written.push({ path: outPath, count: slice.length, first, last });
  }

  console.log(JSON.stringify({
    source: input,
    totalDocs: docs.length,
    chunks: written.length,
    files: written.map((w) => ({
      file: path.relative(process.cwd(), w.path).replace(/\\/g, '/'),
      count: w.count,
      first: w.first,
      last: w.last,
    })),
  }, null, 2));
}

main();
