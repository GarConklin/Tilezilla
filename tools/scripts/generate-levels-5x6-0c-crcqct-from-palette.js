#!/usr/bin/env node
'use strict';

/**
 * Generate solvable 5x6-0C levels whose bags include at least one of CR, CQ, or CT.
 *
 * Same pipeline as generate-levels-5x6-0bc-from-palette.js --tier 0C, but QS/E1/E2
 * alone are not enough — the bag must contain a CR, CQ, or CT tile.
 *
 * Remote example (repo root):
 *   node tools/scripts/generate-levels-5x6-0c-crcqct-from-palette.js --tier 0C --parallel 8 \
 *     --reserve-codes-from data/levels/5x6-0C.json --progress-every 50
 *
 * Or use the launcher:
 *   .\tools\scripts\remote-run-5x6-0c-crcqct.ps1
 *   bash tools/scripts/remote-run-5x6-0c-crcqct.sh
 */

const { runSizeGenerator } = require('./generate-levels-from-palette-core.js');

const TILES_CR_CQ_CT = new Set(['CR', 'CQ', 'CT']);

function hasAny(bag, set) {
  for (const k of set) if (Number(bag[k] || 0) > 0) return true;
  return false;
}

runSizeGenerator({
  size: '5x6',
  rows: 6,
  cols: 5,
  defaultTier: '0C',
  tiers: {
    '0C': {
      note: '5x6 0C generation: bag must include at least one CR, CQ, or CT.',
      acceptBag: (bag) => hasAny(bag, TILES_CR_CQ_CT),
    },
  },
}).catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
