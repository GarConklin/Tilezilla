#!/usr/bin/env node
/**
 * Set catalog level.tiles from solves/<id>.json tiles (or solve-1 placement bag).
 * Skips sandboxes and rows where play bag matches a *different* catalog id (Type A).
 *
 *   node scripts/sync-catalog-tiles-from-solves.js --dry-run
 *   node scripts/sync-catalog-tiles-from-solves.js --apply
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const FLAT_PATH = path.join(LEVELS_DIR, 'levels.json');
const SOLVES_DIR = path.join(ROOT, 'solves');
const SANDBOX = /-ZZZ$/;

const apply = process.argv.includes('--apply');

function norm(t) {
  const o = {};
  for (const [k, v] of Object.entries(t || {})) {
    const n = +v;
    if (n > 0) o[k] = n;
  }
  return o;
}

function sig(board, tiles) {
  return `${board.rows}x${board.cols}|${JSON.stringify(
    Object.keys(norm(tiles))
      .sort()
      .map((k) => [k, norm(tiles)[k]])
  )}`;
}

function bagsEqual(a, b) {
  const na = norm(a);
  const nb = norm(b);
  const keys = new Set([...Object.keys(na), ...Object.keys(nb)]);
  for (const k of keys) if ((na[k] || 0) !== (nb[k] || 0)) return false;
  return true;
}

function bagFromPlacements(placements) {
  const o = {};
  for (const p of placements || []) {
    if (p.tile === 'B1' || p.tile === 'B2') continue;
    o[p.tile] = (o[p.tile] || 0) + 1;
  }
  return o;
}

function main() {
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const flat = JSON.parse(fs.readFileSync(FLAT_PATH, 'utf8'));
  const flatById = new Map((flat.levels || []).map((L) => [L.id, L]));

  const catalogBySig = new Map();
  for (const b of idx.buckets || []) {
    const doc = JSON.parse(fs.readFileSync(path.join(LEVELS_DIR, b.file), 'utf8'));
    for (const L of doc.levels || []) {
      if (!L?.id || SANDBOX.test(L.id)) continue;
      const s = sig(L.board, L.tiles);
      if (!catalogBySig.has(s)) catalogBySig.set(s, []);
      catalogBySig.get(s).push(L.id);
    }
  }

  const updates = [];
  const bucketDocs = new Map();

  for (const b of idx.buckets || []) {
    if (!b?.file) continue;
    const fp = path.join(LEVELS_DIR, b.file);
    const doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    let changed = false;

    for (const L of doc.levels || []) {
      if (!L?.id || SANDBOX.test(L.id)) continue;
      const sp = path.join(SOLVES_DIR, L.solvesFile || `${L.id}.json`);
      if (!fs.existsSync(sp)) continue;

      const sdoc = JSON.parse(fs.readFileSync(sp, 'utf8'));
      const playBag =
        (sdoc.solutions?.[0]?.placements?.length &&
          bagFromPlacements(sdoc.solutions[0].placements)) ||
        norm(sdoc.tiles);
      if (!Object.keys(playBag).length) continue;

      const playSig = sig(L.board, playBag);
      const owners = catalogBySig.get(playSig) || [];
      if (owners.length && !owners.includes(L.id)) continue;

      const wantTiles = norm(sdoc.tiles?.SH != null ? sdoc.tiles : playBag);
      if (bagsEqual(L.tiles, wantTiles)) continue;

      updates.push({
        id: L.id,
        bucket: b.file,
        was: norm(L.tiles),
        now: wantTiles,
      });

      if (apply) {
        L.tiles = wantTiles;
        changed = true;
        const flatL = flatById.get(L.id);
        if (flatL) flatL.tiles = wantTiles;
      }
    }

    if (apply && changed) {
      bucketDocs.set(b.file, doc);
      fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    }
  }

  if (apply && updates.length) {
    fs.writeFileSync(FLAT_PATH, JSON.stringify(flat, null, 2) + '\n', 'utf8');
  }

  const out = path.join(
    ROOT,
    'data/solver-runs',
    `catalog-tiles-sync-${Date.now()}.json`
  );
  fs.writeFileSync(
    out,
    JSON.stringify({ apply, updated: updates.length, updates }, null, 2) + '\n',
    'utf8'
  );
  console.log(JSON.stringify({ apply, updated: updates.length, out }, null, 2));
}

main();
