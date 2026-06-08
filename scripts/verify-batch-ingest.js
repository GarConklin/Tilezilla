#!/usr/bin/env node
/**
 * Verify a concatenated solve batch vs catalog + solves on disk.
 * Usage: node scripts/verify-batch-ingest.js "data/tilepz solves newset26.txt"
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TILES_PATH = path.join(ROOT, 'data', 'tiles', 'tiles-live-edges.json');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const SOLVES_DIR = path.join(ROOT, 'solves');

const tileData = JSON.parse(fs.readFileSync(TILES_PATH, 'utf8'));

function splitJsonDocs(s) {
  const out = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          out.push(s.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return out;
}

function normTiles(t) {
  const o = {};
  for (const [k, v] of Object.entries(t || {})) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) o[k] = n;
  }
  return o;
}

function tileMultisetKey(tiles) {
  const o = normTiles(tiles);
  return JSON.stringify(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]])
  );
}

function loadCatalog() {
  const idx = JSON.parse(fs.readFileSync(path.join(LEVELS_DIR, 'index.json'), 'utf8'));
  /** @type {Map<string, string>} — same as merge: last catalog row wins per signature */
  const bySig = new Map();
  /** @type {Map<string, string[]>} */
  const allIdsPerSig = new Map();
  /** @type {Map<string, { tiles, board, sig }>} */
  const byId = new Map();
  for (const b of idx.buckets || []) {
    if (!b?.file) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(LEVELS_DIR, b.file), 'utf8'));
    for (const L of doc.levels || []) {
      if (!L?.id || !L.board) continue;
      const sig = `${L.board.rows}x${L.board.cols}|${tileMultisetKey(L.tiles)}`;
      bySig.set(sig, L.id);
      if (!allIdsPerSig.has(sig)) allIdsPerSig.set(sig, []);
      allIdsPerSig.get(sig).push(L.id);
      byId.set(L.id, { tiles: L.tiles, board: L.board, sig });
    }
  }
  return { bySig, allIdsPerSig, byId };
}

function edgesFor(tileName, deg, which) {
  const rn = `r${((deg % 360) + 360) % 360}`;
  const t = tileData[tileName];
  if (!t || !t[rn]) return [];
  return (t[rn][which] || []).slice().sort();
}

function cellCount(tileName) {
  const def = tileData[tileName];
  if (!def || !Array.isArray(def.shape)) return 2;
  return def.shape.length;
}

function targetCells(r, c, deg) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function buildCellGrid(placements, rows, cols) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const p of placements) {
    const deg = ((p.deg % 360) + 360) % 360;
    if (cellCount(p.tile) === 1) {
      grid[p.r][p.c] = `${p.tile}:${edgesFor(p.tile, deg, 'A').join(',')}`;
    } else {
      const cells = targetCells(p.r, p.c, deg);
      const labels = ['A', 'B'];
      for (let i = 0; i < cells.length; i++) {
        const [cr, cc] = cells[i];
        if (cr >= 0 && cr < rows && cc >= 0 && cc < cols) {
          grid[cr][cc] = `${p.tile}:${edgesFor(p.tile, deg, labels[i]).join(',')}`;
        }
      }
    }
  }
  return grid;
}

const EDGE_ROT_90 = { N: 'E', E: 'S', S: 'W', W: 'N' };
const EDGE_ROT_180 = { N: 'S', S: 'N', E: 'W', W: 'E' };

function rotateEdges90(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  const edges = parts[1]
    .split(',')
    .filter(Boolean)
    .map((e) => EDGE_ROT_90[e] || e)
    .sort()
    .join(',');
  return `${parts[0]}:${edges}`;
}

function rotateEdges180(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  const edges = parts[1]
    .split(',')
    .filter(Boolean)
    .map((e) => EDGE_ROT_180[e] || e)
    .sort()
    .join(',');
  return `${parts[0]}:${edges}`;
}

function gridFingerprint(grid) {
  return grid.map((row) => row.map((c) => c || '.').join('|')).join('\n');
}

function rotateGrid180(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[rows - 1 - r][cols - 1 - c] = rotateEdges180(grid[r][c]);
    }
  }
  return out;
}

function rotateGrid90CW(grid) {
  const n = grid.length;
  const out = Array.from({ length: n }, () => Array(n).fill(null));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[c][n - 1 - r] = rotateEdges90(grid[r][c]);
    }
  }
  return out;
}

function allRotationFingerprints(placements, rows, cols) {
  const grid = buildCellGrid(placements, rows, cols);
  const fps = new Set([gridFingerprint(grid), gridFingerprint(rotateGrid180(grid))]);
  if (rows === cols) {
    let cur = grid;
    for (let k = 0; k < 3; k++) {
      cur = rotateGrid90CW(cur);
      fps.add(gridFingerprint(cur));
    }
  }
  return fps;
}

function layoutExistsInDoc(doc, placements, rows, cols) {
  const incoming = allRotationFingerprints(placements, rows, cols);
  for (const sol of doc.solutions || []) {
    const fps = allRotationFingerprints(sol.placements || [], rows, cols);
    for (const fp of incoming) {
      if (fps.has(fp)) return true;
    }
  }
  return false;
}

function resolveTargetId(doc, byId, bySig, allIdsPerSig) {
  const rows = Number(doc.board?.rows);
  const cols = Number(doc.board?.cols);
  const tiles = normTiles(doc.tiles);
  const sig = `${rows}x${cols}|${tileMultisetKey(tiles)}`;
  const requested = doc.levelId;

  if (bySig.has(sig)) {
    return {
      targetId: bySig.get(sig),
      reason: 'catalog-signature',
      sig,
      catalogIds: allIdsPerSig.get(sig) || [],
    };
  }
  if (requested && byId.has(requested)) {
    const cat = byId.get(requested);
    if (cat.sig === sig) {
      return { targetId: requested, reason: 'id-and-bag-match', sig, catalogIds: [requested] };
    }
  }
  return { targetId: null, reason: 'new-bag', sig, catalogIds: [] };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/verify-batch-ingest.js <batch.txt>');
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file.split('/').join(path.sep));
  const { bySig, allIdsPerSig, byId } = loadCatalog();
  const chunks = splitJsonDocs(fs.readFileSync(abs, 'utf8'));

  /** @type {Map<string, string[]>} */
  const batchSigToPasted = new Map();
  /** @type {string[]} */
  const batchLayoutFps = [];

  const results = [];
  for (const chunk of chunks) {
    const doc = JSON.parse(chunk);
    const rows = Number(doc.board?.rows);
    const cols = Number(doc.board?.cols);
    const tiles = normTiles(doc.tiles);
    const pasted = doc.levelId || '';
    const pl = (doc.solutions?.[0]?.placements) || [];
    const { targetId, reason, sig, catalogIds } = resolveTargetId(doc, byId, bySig, allIdsPerSig);

    const pastedCat = byId.get(pasted);
    const pastedBagOk = pastedCat && pastedCat.sig === sig;

    let layoutOnCanonical = false;
    let layoutOnPasted = false;
    let canonicalSolveCount = 0;
    if (targetId) {
      const sp = path.join(SOLVES_DIR, `${targetId}.json`);
      if (fs.existsSync(sp)) {
        const sd = JSON.parse(fs.readFileSync(sp, 'utf8'));
        canonicalSolveCount = (sd.solutions || []).length;
        layoutOnCanonical = layoutExistsInDoc(sd, pl, rows, cols);
      }
    }
    const pastedSolve = path.join(SOLVES_DIR, `${pasted}.json`);
    if (fs.existsSync(pastedSolve)) {
      layoutOnPasted = layoutExistsInDoc(
        JSON.parse(fs.readFileSync(pastedSolve, 'utf8')),
        pl,
        rows,
        cols
      );
    }

    let mergeAction = 'NEW_LEVEL';
    if (targetId && layoutOnCanonical) mergeAction = 'SKIP_DUP_LAYOUT';
    else if (targetId && !layoutOnCanonical) mergeAction = 'APPEND_NEW_LAYOUT';
    else if (!targetId) mergeAction = 'NEW_LEVEL';

    const layoutFp = [...allRotationFingerprints(pl, rows, cols)][0];
    batchLayoutFps.push({ pasted, layoutFp });
    if (!batchSigToPasted.has(sig)) batchSigToPasted.set(sig, []);
    batchSigToPasted.get(sig).push(pasted);

    results.push({
      pasted,
      board: `${rows}x${cols}`,
      targetId,
      mergeAction,
      reason,
      catalogIdsSameBag: catalogIds.length,
      pastedBagOk,
      layoutOnCanonical,
      layoutOnPasted,
      canonicalSolveCount,
    });
  }

  const layoutFpCounts = new Map();
  for (const { pasted, layoutFp } of batchLayoutFps) {
    if (!layoutFpCounts.has(layoutFp)) layoutFpCounts.set(layoutFp, []);
    layoutFpCounts.get(layoutFp).push(pasted);
  }
  const duplicateLayoutsInBatch = [...layoutFpCounts.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([fp, ids]) => ({ ids, fp: fp.slice(0, 48) }));
  const duplicateBagsInBatch = [...batchSigToPasted.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([sig, ids]) => ({ count: ids.length, pasted: ids }));

  const summary = {
    total: results.length,
    uniqueLayoutsInBatch: layoutFpCounts.size,
    duplicateLayoutsInBatch: duplicateLayoutsInBatch.length,
    uniqueTileBagsInBatch: batchSigToPasted.size,
    duplicateTileBagsInBatch: duplicateBagsInBatch.length,
    catalogHasSameBag: results.filter((r) => r.catalogIdsSameBag > 0).length,
    brandNewBag: results.filter((r) => r.catalogIdsSameBag === 0).length,
    skipDupLayout: results.filter((r) => r.mergeAction === 'SKIP_DUP_LAYOUT').length,
    appendNewLayout: results.filter((r) => r.mergeAction === 'APPEND_NEW_LAYOUT').length,
    newLevel: results.filter((r) => r.mergeAction === 'NEW_LEVEL').length,
    sameBagDifferentLayout: results.filter(
      (r) => r.catalogIdsSameBag > 0 && !r.layoutOnCanonical
    ).length,
    pastedLabelBagMismatch: results.filter((r) => r.pasted && byId.has(r.pasted) && !r.pastedBagOk)
      .length,
    multiCatalogSameBag: results.filter((r) => r.catalogIdsSameBag > 1).length,
  };

  console.log(
    JSON.stringify({ summary, duplicateLayoutsInBatch, duplicateBagsInBatch, results }, null, 2)
  );
}

main();
