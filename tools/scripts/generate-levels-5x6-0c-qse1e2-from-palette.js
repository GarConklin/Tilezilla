#!/usr/bin/env node
'use strict';

/**
 * Generate solvable 5x6-0C levels whose bags include QS, E1, or E2,
 * and do NOT include CR, CQ, or CT (those belong on the CR/CQ/CT VM).
 *
 *   node tools/scripts/generate-levels-5x6-0c-qse1e2-from-palette.js --tier 0C --parallel 2 \
 *     --reserve-codes-from data/levels/5x6-0C.json --progress-every 50
 */

const { runSizeGenerator } = require('./generate-levels-from-palette-core.js');

const TILES_QS_E1_E2 = new Set(['QS', 'E1', 'E2']);
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
      note: '5x6 0C generation: QS/E1/E2 only (no CR/CQ/CT — other VM owns those).',
      acceptBag: (bag) => hasAny(bag, TILES_QS_E1_E2) && !hasAny(bag, TILES_CR_CQ_CT),
    },
  },
}).catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
