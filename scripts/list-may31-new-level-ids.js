#!/usr/bin/env node
/**
 * Nine new levels from ingest of `data/tilepz solves 31 may 2026.txt`.
 *
 *   node scripts/list-may31-new-level-ids.js
 *   node scripts/list-may31-new-level-ids.js --phase 5x6
 *   node scripts/list-may31-new-level-ids.js --phase 6x6
 */

'use strict';

const IDS_5X6 = [
  '5x6-0B-AUV',
  '5x6-0B-AUW',
  '5x6-0B-AUX',
  '5x6-0B-AUY',
  '5x6-0B-AUZ',
  '5x6-0B-AVA',
];

const IDS_6X6 = ['6x6-0B-ACC', '6x6-0B-ACD', '6x6-0B-ACE'];

function main() {
  const phase = (
    process.argv.find((a, i) => process.argv[i - 1] === '--phase') || 'all'
  ).toLowerCase();
  let out = [];
  if (phase === '5x6') out = IDS_5X6;
  else if (phase === '6x6') out = IDS_6X6;
  else if (phase === 'all') out = [...IDS_5X6, ...IDS_6X6];
  else {
    console.error('Use --phase 5x6 | 6x6 | all');
    process.exit(1);
  }
  for (const id of out) console.log(id);
}

main();
