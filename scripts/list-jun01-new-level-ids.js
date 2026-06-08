#!/usr/bin/env node
/**
 * New levels from ingest of `data/tilepz solves 01 jun 2026.txt` (38 ids).
 *
 *   node scripts/list-jun01-new-level-ids.js
 */

'use strict';

const { indexToThreeLetterCode, threeLetterCodeToIndex } = require('./lib/three-letter-codes');

const IDS_6X6 = ['6x6-0B-ACF', '6x6-0B-ACG'];

function ids5x6() {
  const start = threeLetterCodeToIndex('AVB');
  const end = threeLetterCodeToIndex('AWK');
  const out = [];
  for (let i = start; i <= end; i++) out.push(`5x6-0B-${indexToThreeLetterCode(i)}`);
  return out;
}

function main() {
  for (const id of [...ids5x6(), ...IDS_6X6]) console.log(id);
}

main();
