#!/usr/bin/env node
/**
 * Level ids from `data/tilepz solves 6x6 13 jun 2026.txt` (17 levels — enumerate later).
 *
 *   node scripts/list-jun13-6x6-level-ids.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BATCH_PATH = path.join(__dirname, '..', 'data', 'tilepz solves 6x6 13 jun 2026.txt');

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

function main() {
  const docs = splitJsonDocs(fs.readFileSync(BATCH_PATH, 'utf8'));
  for (const d of docs) {
    const id = d.levelId || d.solutions?.[0]?.label?.split(/\s+/)[0];
    if (id) console.log(id);
  }
}

main();
