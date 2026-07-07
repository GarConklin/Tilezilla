#!/usr/bin/env node
/**
 * Validate ingested hand-made 0C solves with game-complete rules.
 * Usage: node scripts/validate-0c-ingested.js [5x6-0C-AAL ...]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TILES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tiles/tiles-live-edges.json'), 'utf8'));
const { validateCompleteLayout } = require(path.join(ROOT, 'scripts/validate-complete-layout.js'));

const DEFAULT_IDS = [
  '5x6-0C-AAK',
  '5x6-0C-AAL',
  '5x6-0C-AAM',
  '5x6-0C-AAN',
  '5x6-0C-AAO',
  '5x6-0C-AAP',
  '5x6-0C-AAQ',
];

const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_IDS;

for (const id of ids) {
  const solvePath = path.join(ROOT, 'solves', `${id}.json`);
  if (!fs.existsSync(solvePath)) {
    console.log(`${id}: MISSING ${solvePath}`);
    continue;
  }
  const doc = JSON.parse(fs.readFileSync(solvePath, 'utf8'));
  const ps = doc.solutions?.[0]?.placements;
  if (!ps) {
    console.log(`${id}: no placements`);
    continue;
  }
  const rows = doc.board?.rows ?? 6;
  const cols = doc.board?.cols ?? 5;
  const pathTiles = ['CR', 'CT', 'CQ'].filter((t) => ps.some((p) => p.tile === t));
  const v = validateCompleteLayout({ rows, cols, placements: ps, tilesJson: TILES });
  console.log(
    `${id}: ${v.ok ? 'VALID' : 'INVALID'} — 0C tiles: ${pathTiles.join('+') || 'none'}${
      v.ok ? '' : ` — ${v.reason}`
    }${v.pathPick ? ` — pathPick ${JSON.stringify(v.pathPick)}` : ''}`
  );
}
