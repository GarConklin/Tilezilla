#!/usr/bin/env node
/**
 * New levels from ingest of `data/tilepz solves 07 jun 2026.txt` (37 new ids).
 *
 * Pasted labels remapped by merge (wrong tier / bag mismatch on existing codes):
 *   6x6-0C-AAY…AAC → 6x6-0B-ACZ…ADD
 *   6x6-0A-AAT → 6x6-0B-ADE
 *   5x6-0B-ANR…AOW → 5x6-0B-AZD…BAH (5x6-0B-AOS skipped: dup of 5x6-0B-AEA)
 *
 *   node scripts/list-jun07-new-level-ids.js
 *   node scripts/list-jun07-new-level-ids.js --phase 5x6
 *   node scripts/list-jun07-new-level-ids.js --phase 6x6
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
  return idsInRange('5x6-0B', 'AZD', 'BAH');
}

function ids6x6() {
  return idsInRange('6x6-0B', 'ACZ', 'ADE');
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
