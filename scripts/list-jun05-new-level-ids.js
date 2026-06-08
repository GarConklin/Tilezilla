#!/usr/bin/env node
/**
 * New levels from ingest of `data/tilepz solves 05 June  2026.txt` (44 ids).
 *
 * Pasted labels were remapped by merge (wrong tier / bag mismatch on existing codes):
 *   5x6-0B-AMJ…ANQ → 5x6-0B-AXV…AZC
 *   6x6-0C-AAO…AAX → 6x6-0B-ACP…ACY
 *
 *   node scripts/list-jun05-new-level-ids.js
 *   node scripts/list-jun05-new-level-ids.js --phase 5x6
 *   node scripts/list-jun05-new-level-ids.js --phase 6x6
 */

'use strict';

const { indexToThreeLetterCode, threeLetterCodeToIndex } = require('./lib/three-letter-codes');

function idsInRange(prefix, startCode, endCode) {
  const start = threeLetterCodeToIndex(startCode);
  const end = threeLetterCodeToIndex(endCode);
  const out = [];
  for (let i = start; i <= end; i++) out.push(`${prefix}-${indexToThreeLetterCode(i)}`);
  return out;
}

function ids5x6() {
  return idsInRange('5x6-0B', 'AXV', 'AZC');
}

function ids6x6() {
  return idsInRange('6x6-0B', 'ACP', 'ACY');
}

function main() {
  const phase = (
    process.argv.find((a, i) => process.argv[i - 1] === '--phase') || 'all'
  ).toLowerCase();
  let out = [];
  if (phase === '5x6') out = ids5x6();
  else if (phase === '6x6') out = ids6x6();
  else if (phase === 'all') out = [...ids5x6(), ...ids6x6()];
  else {
    console.error('Use --phase 5x6 | 6x6 | all');
    process.exit(1);
  }
  for (const id of out) console.log(id);
}

main();
