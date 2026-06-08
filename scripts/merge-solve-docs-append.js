#!/usr/bin/env node
/**
 * Merge external solve JSON docs into solves/<levelId>.json:
 * - Never replace existing solutions; append only if layout is new (dedupe by cell fingerprint).
 * - If catalog levelId exists but tile bag differs, assign next free code in the correct bucket.
 * - If level missing from catalog, append level row + solves file.
 *
 * Usage:
 *   node scripts/merge-solve-docs-append.js <concatenated-json.txt>
 *   node scripts/merge-solve-docs-append.js --dry-run <file>
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const FLAT_PATH = path.join(LEVELS_DIR, 'levels.json');
const SOLVES_DIR = path.join(ROOT, 'solves');
const TILES_PATH = path.join(ROOT, 'data', 'tiles', 'tiles-live-edges.json');

const tileData = JSON.parse(fs.readFileSync(TILES_PATH, 'utf8'));

function parseArgs(argv) {
  let dryRun = false;
  const files = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (!argv[i].startsWith('-')) files.push(argv[i]);
  }
  return { dryRun, file: files[0] };
}

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

function normTilesObj(tiles) {
  const o = {};
  if (!tiles || typeof tiles !== 'object') return o;
  for (const [k, v] of Object.entries(tiles)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) o[k] = n;
  }
  return o;
}

function tileMultisetKey(tiles) {
  const o = normTilesObj(tiles);
  return JSON.stringify(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]])
  );
}

function sizePrefixFromBoard(rows, cols) {
  const r = Number(rows);
  const c = Number(cols);
  if (r === 6 && c === 5) return '5x6';
  return `${r}x${c}`;
}

function classifyTierFromTiles(tiles) {
  const keys = Object.keys(tiles || {});
  const hasSuperior = keys.some((t) => ['CR', 'CT', 'CQ', 'E1', 'E2', 'B2', '2SH', '2ET'].includes(t));
  if (hasSuperior) return '0C';
  const hasAdvanced = keys.some((t) => ['SZ', 'SS', 'DS', 'QC', 'QS', 'DC'].includes(t));
  if (hasAdvanced) return '0B';
  return '0A';
}

function loadCatalog() {
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  /** @type {Map<string, { id, bucketFile, tiles, board }>} */
  const byId = new Map();
  /** @type {Map<string, string>} */
  const bySig = new Map();
  for (const b of idx.buckets || []) {
    if (!b?.file) continue;
    const full = path.join(LEVELS_DIR, b.file);
    if (!fs.existsSync(full)) continue;
    const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const L of doc.levels || []) {
      if (!L?.id) continue;
      byId.set(L.id, {
        id: L.id,
        bucketFile: b.file,
        tiles: L.tiles,
        board: L.board,
      });
      if (L.board) {
        const sig = `${L.board.rows}x${L.board.cols}|${tileMultisetKey(L.tiles)}`;
        bySig.set(sig, L.id);
      }
    }
  }
  return { idx, byId, bySig };
}

function usedCodesInBucket(bucketPath) {
  const used = new Set();
  if (!fs.existsSync(bucketPath)) return used;
  const doc = JSON.parse(fs.readFileSync(bucketPath, 'utf8'));
  for (const L of doc.levels || []) {
    const m = String(L.id || '').match(/-([A-Z]{3})$/);
    if (m) used.add(m[1]);
  }
  return used;
}

const { nextThreeLetterCode } = require('./lib/three-letter-codes');

function edgesFor(tileName, deg, which) {
  const def = tileData[tileName];
  if (!def) return [];
  const rk = `r${((deg % 360) + 360) % 360}`;
  const rot = def[rk];
  if (!rot) return [];
  return Array.isArray(rot[which]) ? rot[which].slice().sort() : [];
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

function gridFingerprint(grid) {
  return grid.map((row) => row.map((c) => c || '.').join('|')).join('\n');
}

const EDGE_ROT_90 = { N: 'E', E: 'S', S: 'W', W: 'N' };
const EDGE_ROT_180 = { N: 'S', S: 'N', E: 'W', W: 'E' };

function rotateEdges90(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  if (parts.length < 2) return cellStr;
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
  if (parts.length < 2) return cellStr;
  const edges = parts[1]
    .split(',')
    .filter(Boolean)
    .map((e) => EDGE_ROT_180[e] || e)
    .sort()
    .join(',');
  return `${parts[0]}:${edges}`;
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

function allRotationFingerprints(grid, rows, cols) {
  const fps = new Set([gridFingerprint(grid)]);
  fps.add(gridFingerprint(rotateGrid180(grid)));
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
  const incoming = allRotationFingerprints(buildCellGrid(placements, rows, cols), rows, cols);
  for (const sol of doc.solutions || []) {
    const fps = allRotationFingerprints(
      buildCellGrid(sol.placements || [], rows, cols),
      rows,
      cols
    );
    for (const fp of incoming) {
      if (fps.has(fp)) return true;
    }
  }
  return false;
}

const { catalogFieldsForLevel } = require('./lib/path-mode-from-tiles');

function pathFieldsForNewLevel(tiles, solveDoc) {
  return catalogFieldsForLevel({ tiles }, solveDoc);
}

function resolveTargetId(doc, byId, bySig, usedCodesCache) {
  const rows = Number(doc.board?.rows);
  const cols = Number(doc.board?.cols);
  const tiles = normTilesObj(doc.tiles);
  const sig = `${rows}x${cols}|${tileMultisetKey(tiles)}`;
  const requested = doc.levelId;

  if (bySig.has(sig)) return { targetId: bySig.get(sig), remapped: false, reason: 'catalog-signature' };

  if (requested && byId.has(requested)) {
    const cat = byId.get(requested);
    const catSig = `${cat.board.rows}x${cat.board.cols}|${tileMultisetKey(cat.tiles)}`;
    if (catSig === sig) return { targetId: requested, remapped: false, reason: 'id-and-bag-match' };
  }

  const sizePx = sizePrefixFromBoard(rows, cols);
  const tier = classifyTierFromTiles(tiles);
  const bucketFile = `${sizePx}-${tier}.json`;
  const bucketPath = path.join(LEVELS_DIR, bucketFile);
  if (!usedCodesCache.has(bucketFile)) {
    usedCodesCache.set(bucketFile, usedCodesInBucket(bucketPath));
  }
  const used = usedCodesCache.get(bucketFile);
  const code = nextThreeLetterCode(used);
  used.add(code);
  const targetId = `${sizePx}-${tier}-${code}`;
  return {
    targetId,
    remapped: true,
    reason: requested && byId.has(requested) ? `id ${requested} bag mismatch` : 'new bag',
    bucketFile,
  };
}

function main() {
  const { dryRun, file } = parseArgs(process.argv);
  if (!file) {
    console.error('Usage: node scripts/merge-solve-docs-append.js [--dry-run] <concatenated-json.txt>');
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file.split('/').join(path.sep));
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  let raw = '';
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    const names = fs
      .readdirSync(abs)
      .filter((n) => n.endsWith('.json'))
      .sort();
    for (const n of names) raw += fs.readFileSync(path.join(abs, n), 'utf8') + '\n';
  } else {
    raw = fs.readFileSync(abs, 'utf8');
  }
  const chunks = splitJsonDocs(raw);
  const { idx, byId, bySig } = loadCatalog();
  const flat = JSON.parse(fs.readFileSync(FLAT_PATH, 'utf8'));
  const flatLevels = flat.levels || [];
  const flatIds = new Set(flatLevels.map((l) => l.id));

  /** @type {Map<string, object>} */
  const bucketDocs = new Map();
  /** @type {Map<string, Set<string>>} */
  const usedCodesCache = new Map();
  const countDelta = new Map();

  let appended = 0;
  let skippedDup = 0;
  let created = 0;
  let remapped = 0;

  for (const chunk of chunks) {
    let doc;
    try {
      doc = JSON.parse(chunk);
    } catch (e) {
      console.error('skip bad JSON:', e.message);
      continue;
    }

    const rows = Number(doc.board?.rows);
    const cols = Number(doc.board?.cols);
    const tiles = normTilesObj(doc.tiles);
    const incomingSols = doc.solutions || [];
    if (!rows || !cols || !incomingSols.length) {
      console.error('skip incomplete doc', doc.levelId);
      continue;
    }

    const { targetId, remapped: wasRemapped, reason, bucketFile } = resolveTargetId(
      doc,
      byId,
      bySig,
      usedCodesCache
    );
    if (wasRemapped) {
      console.error('REMAP', doc.levelId, '->', targetId, `(${reason})`);
      remapped++;
    }

    const solvesPath = path.join(SOLVES_DIR, `${targetId}.json`);
    let solveDoc;
    if (fs.existsSync(solvesPath)) {
      solveDoc = JSON.parse(fs.readFileSync(solvesPath, 'utf8'));
    } else {
      solveDoc = {
        board: doc.board,
        tileSet: doc.tileSet || 'tiles-live-edges.json',
        tiles,
        totalUniqueSolutions: 0,
        solutions: [],
        generatedAt: doc.generatedAt || new Date().toISOString(),
      };
      created++;
    }

    let addedHere = 0;
    for (const sol of incomingSols) {
      const placements = sol.placements || [];
      if (!placements.length) continue;
      if (layoutExistsInDoc(solveDoc, placements, rows, cols)) {
        skippedDup++;
        console.error('SKIP dup layout', targetId, doc.levelId || '');
        continue;
      }
      const n = (solveDoc.solutions || []).length + 1;
      solveDoc.solutions.push({
        id: `solve-${n}`,
        label: `${targetId} solve ${n}`,
        placements,
      });
      addedHere++;
    }

    if (!addedHere) continue;

    solveDoc.tiles = tiles;
    solveDoc.board = doc.board;
    solveDoc.totalUniqueSolutions = solveDoc.solutions.length;
    if (doc.solverMeta) solveDoc.solverMeta = doc.solverMeta;
    solveDoc.levelId = targetId;
    solveDoc.mergedAt = new Date().toISOString();
    solveDoc.mergedFrom = doc.levelId || abs;

    appended += addedHere;
    console.error(dryRun ? 'dry-run' : 'WRITE', solvesPath, `+${addedHere} solve(s)`);

    if (!dryRun) {
      fs.mkdirSync(SOLVES_DIR, { recursive: true });
      fs.writeFileSync(solvesPath, JSON.stringify(solveDoc, null, 2) + '\n', 'utf8');

      if (!byId.has(targetId)) {
        const bf = bucketFile || `${sizePrefixFromBoard(rows, cols)}-${classifyTierFromTiles(tiles)}.json`;
        const bucketPath = path.join(LEVELS_DIR, bf);
        if (!bucketDocs.has(bf)) {
          bucketDocs.set(bf, JSON.parse(fs.readFileSync(bucketPath, 'utf8')));
        }
        const bdoc = bucketDocs.get(bf);
        const { pathMode, pathCount, totalUniqueSolutions } = pathFieldsForNewLevel(tiles, solveDoc);
        const levelRow = {
          id: targetId,
          name: targetId.slice(-3),
          board: { rows, cols },
          tiles,
          blockers: [],
          solvesFile: `${targetId}.json`,
          pathMode,
          pathCount,
          totalUniqueSolutions,
        };
        bdoc.levels = bdoc.levels || [];
        bdoc.levels.push(levelRow);
        byId.set(targetId, { id: targetId, bucketFile: bf, tiles, board: levelRow.board });
        const sig = `${rows}x${cols}|${tileMultisetKey(tiles)}`;
        bySig.set(sig, targetId);
        if (!flatIds.has(targetId)) {
          flatLevels.push(levelRow);
          flatIds.add(targetId);
        }
        countDelta.set(bf, (countDelta.get(bf) || 0) + 1);
      }
    }
  }

  if (!dryRun && bucketDocs.size) {
    for (const [bf, bdoc] of bucketDocs) {
      bdoc.levels.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
      bdoc.count = bdoc.levels.length;
      fs.writeFileSync(path.join(LEVELS_DIR, bf), JSON.stringify(bdoc, null, 2) + '\n', 'utf8');
    }
    flat.levels = flatLevels.sort((a, b) =>
      String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true })
    );
    fs.writeFileSync(FLAT_PATH, JSON.stringify(flat, null, 2) + '\n', 'utf8');
    for (const b of idx.buckets || []) {
      if (countDelta.has(b.file)) {
        const bdoc = bucketDocs.get(b.file);
        if (bdoc) b.count = bdoc.count;
      }
    }
    fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2) + '\n', 'utf8');
  }

  console.error(
    `Done: appended ${appended}, skipped duplicate ${skippedDup}, new files ${created}, remapped ids ${remapped}${dryRun ? ' (dry-run)' : ''}`
  );
}

main();
