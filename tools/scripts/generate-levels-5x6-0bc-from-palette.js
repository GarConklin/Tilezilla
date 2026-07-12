#!/usr/bin/env node
'use strict';

const { runSizeGenerator } = require('./generate-levels-from-palette-core.js');

const TILES_0B = new Set(['SZ', 'SS', 'DS', 'QC', 'DC']);
const TILES_0C = new Set(['CR', 'CT', 'CQ', 'QS', 'E1', 'E2']);

function hasAny(bag, set) {
  for (const k of set) if (Number(bag[k] || 0) > 0) return true;
  return false;
}

runSizeGenerator({
  size: '5x6',
  rows: 6,
  cols: 5,
  defaultTier: '0B',
  tiers: {
    '0B': {
      note: '5x6 0B generation: include at least one 0B marker tile (SZ/SS/DS/QC/DC).',
      acceptBag: (bag) => hasAny(bag, TILES_0B),
    },
    '0C': {
      note: '5x6 0C generation: include at least one 0C marker tile (CR/CT/CQ/QS/E1/E2).',
      acceptBag: (bag) => hasAny(bag, TILES_0C),
    },
  },
}).catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
