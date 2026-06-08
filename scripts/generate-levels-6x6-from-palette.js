#!/usr/bin/env node
'use strict';

const { runSizeGenerator } = require('./generate-levels-from-palette-core.js');

const ADVANCED_0B = new Set(['SZ', 'SS', 'DS', 'QC', 'DC']);
const ADVANCED_0C = new Set(['CR', 'CT', 'CQ', 'QS', 'E1', 'E2']);

function hasAny(bag, set) {
  for (const k of set) if (Number(bag[k] || 0) > 0) return true;
  return false;
}

runSizeGenerator({
  size: '6x6',
  rows: 6,
  cols: 6,
  defaultTier: '0C',
  tiers: {
    '0A': {
      note: 'No required advanced/crossover markers.',
      acceptBag: () => true,
    },
    '0B': {
      note: 'Must include at least one 0B marker tile: SZ/SS/DS/QC/DC.',
      acceptBag: (bag) => hasAny(bag, ADVANCED_0B),
    },
    '0C': {
      note: 'Must include at least one 0C marker tile: CR/CT/CQ/QS/E1/E2.',
      acceptBag: (bag) => hasAny(bag, ADVANCED_0C),
    },
  },
}).catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
