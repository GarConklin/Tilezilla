#!/usr/bin/env node
/**
 * New levels from ingest of `data/tilepz solves 03 June  2026.txt` (41 ids).
 *
 * Pasted labels were remapped by merge (wrong tier / bag mismatch on existing codes):
 *   6x6-0A-AAL…AAS → 6x6-0B-ACH…ACO
 *   5x6-0B-AKU…AMA → 5x6-0B-AWO…AXU
 *
 *   node scripts/list-jun03-new-level-ids.js
 *   node scripts/list-jun03-new-level-ids.js --phase 5x6
 *   node scripts/list-jun03-new-level-ids.js --phase 6x6
 */

'use strict';

const { indexToThreeLetterCode, threeLetterCodeToIndex } = require('./lib/three-letter-codes');

const IDS_6X6 = [
  '6x6-0B-ACH',
  '6x6-0B-ACI',
  '6x6-0B-ACJ',
  '6x6-0B-ACK',
  '6x6-0B-ACL',
  '6x6-0B-ACM',
  '6x6-0B-ACN',
  '6x6-0B-ACO',
];

function ids5x6() {
  const start = threeLetterCodeToIndex('AWO');
  const end = threeLetterCodeToIndex('AXU');
  const out = [];
  for (let i = start; i <= end; i++) out.push(`5x6-0B-${indexToThreeLetterCode(i)}`);
  return out;
}

function main() {
  const phase = (
    process.argv.find((a, i) => process.argv[i - 1] === '--phase') || 'all'
  ).toLowerCase();
  let out = [];
  if (phase === '5x6') out = ids5x6();
  else if (phase === '6x6') out = IDS_6X6;
  else if (phase === 'all') out = [...ids5x6(), ...IDS_6X6];
  else {
    console.error('Use --phase 5x6 | 6x6 | all');
    process.exit(1);
  }
  for (const id of out) console.log(id);
}

main();
