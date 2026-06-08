#!/usr/bin/env node
/**
 * Reassign levelIds in a concatenated solve batch (fixes exporter wrapping AAA after AZZ).
 * For each doc matching --size (e.g. 5x6), ignores pasted levelId and assigns the next
 * free 3-letter code in --bucket order (file order preserved).
 *
 *   node scripts/recode-batch-fresh-ids.js --size 5x6 --bucket 5x6-0B.json \
 *     "data/new solves May 25.txt" data/solver-runs/may25-prepared.txt
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const { nextThreeLetterCode } = require('./lib/three-letter-codes');

function parseArgs(argv) {
  const out = { size: null, bucket: null, inFile: null, outFile: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--size' && argv[i + 1]) out.size = argv[++i];
    else if (argv[i] === '--bucket' && argv[i + 1]) out.bucket = argv[++i];
    else if (!argv[i].startsWith('-')) {
      if (!out.inFile) out.inFile = argv[i];
      else out.outFile = argv[i];
    }
  }
  return out;
}

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

function usedCodesInBucket(bucketPath) {
  const used = new Set();
  if (!fs.existsSync(bucketPath)) return used;
  const doc = JSON.parse(fs.readFileSync(bucketPath, 'utf8'));
  for (const L of doc.levels || []) {
    const m = String(L.id || '').match(/-([A-Z]{3})$/);
    if (m) used.add(m[1]);
  }
  return used;
}

function main() {
  const { size, bucket, inFile, outFile } = parseArgs(process.argv);
  if (!size || !bucket || !inFile || !outFile) {
    console.error(
      'Usage: node scripts/recode-batch-fresh-ids.js --size 5x6 --bucket 5x6-0B.json <in.txt> <out.txt>'
    );
    process.exit(1);
  }
  const [sizeCols, sizeRows] = size.split('x').map(Number);
  const wantRows = sizeRows;
  const wantCols = sizeCols;
  const tier = bucket.replace(/^\d+x\d+-/, '').replace(/\.json$/, '');
  const idPrefix = `${size}-${tier}-`;
  const bucketPath = path.join(LEVELS_DIR, bucket);
  const used = usedCodesInBucket(bucketPath);

  const inAbs = path.isAbsolute(inFile) ? inFile : path.join(ROOT, inFile);
  const outAbs = path.isAbsolute(outFile) ? outFile : path.join(ROOT, outFile);
  const raw = fs.readFileSync(inAbs, 'utf8');
  const chunks = splitJsonDocs(raw);
  const outChunks = [];
  let recoded = 0;
  const map = [];

  for (const chunk of chunks) {
    let doc;
    try {
      doc = JSON.parse(chunk);
    } catch (e) {
      console.error('skip bad JSON:', e.message);
      continue;
    }
    const rows = Number(doc.board?.rows);
    const cols = Number(doc.board?.cols);
    const idMatch = typeof doc.levelId === 'string' && doc.levelId.startsWith(idPrefix);
    const boardMatch = rows === wantRows && cols === wantCols;
    if (idMatch || boardMatch) {
      const oldId = doc.levelId;
      const code = nextThreeLetterCode(used);
      used.add(code);
      const newId = `${size}-${tier}-${code}`;
      doc.levelId = newId;
      if (Array.isArray(doc.solutions)) {
        for (let i = 0; i < doc.solutions.length; i++) {
          const s = doc.solutions[i];
          if (s && typeof s === 'object') {
            s.label = `${newId} solve ${i + 1}`;
          }
        }
      }
      map.push({ from: oldId, to: newId });
      recoded++;
    }
    outChunks.push(JSON.stringify(doc, null, 2));
  }

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, outChunks.join('\n\n') + '\n', 'utf8');
  const mapPath = outAbs.replace(/\.txt$/i, '-recode-map.json');
  fs.writeFileSync(
    mapPath,
    JSON.stringify({ size, bucket, recoded, firstNew: map[0]?.to, lastNew: map[map.length - 1]?.to, map }, null, 2) +
      '\n',
    'utf8'
  );
  console.log(JSON.stringify({ recoded, out: outAbs, mapPath, first: map[0], last: map[map.length - 1] }, null, 2));
}

main();
