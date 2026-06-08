#!/usr/bin/env node
/**
 * Level ids added by ingest of `data/tilepz solves 28 may 2026a.txt`.
 *
 *   node scripts/list-may28-new-level-ids.js
 *   node scripts/list-may28-new-level-ids.js --json
 *
 * Four new 6×6 bags (remote labels 6x6-0A-ABA…ABD were remapped to 6x6-0B-ABU…ABX).
 */

'use strict';

const IDS = ['6x6-0B-ABU', '6x6-0B-ABV', '6x6-0B-ABW', '6x6-0B-ABX'];

function main() {
  const json = process.argv.includes('--json');
  if (json) {
    console.log(JSON.stringify({ count: IDS.length, ids: IDS }, null, 2));
    return;
  }
  for (const id of IDS) console.log(id);
}

main();
