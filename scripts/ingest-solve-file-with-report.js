#!/usr/bin/env node
/**
 * Ingest solve batch with a concrete per-level report (tile bag + catalog match + layout).
 * Usage: node scripts/ingest-solve-file-with-report.js <batch.txt> [--dry-run]
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
const RUNS_DIR = path.join(ROOT, 'data', 'solver-runs');

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
          out.push(JSON.parse(s.slice(start, i + 1)));
          start = -1;
        }
      }
    }
  }
  return out;
}

function normTiles(tiles) {
  const o = {};
  for (const [k, v] of Object.entries(tiles || {})) {
    const n = Number(v);
    if (n > 0) o[k] = n;
  }
  return o;
}

function tilesSig(rows, cols, tiles) {
  return `${rows}x${cols}|${JSON.stringify(
    Object.keys(normTiles(tiles))
      .sort()
      .map((k) => [k, normTiles(tiles)[k]])
  )}`;
}

function tilesStr(tiles) {
  return Object.keys(normTiles(tiles))
    .sort()
    .map((k) => `${k}×${normTiles(tiles)[k]}`)
    .join(' ');
}

function normPlacement(p) {
  return {
    tile: String(p.tile),
    r: Number(p.r),
    c: Number(p.c),
    deg: ((Number(p.deg) % 360) + 360) % 360,
  };
}

function placementKey(placements) {
  return JSON.stringify(
    placements.map(normPlacement).sort((a, b) => {
      return a.tile.localeCompare(b.tile) || a.r - b.r || a.c - b.c || a.deg - b.deg;
    })
  );
}

function edgesFor(tile, deg, which) {
  const rk = `r${((deg % 360) + 360) % 360}`;
  const rot = tileData[tile]?.[rk];
  return Array.isArray(rot?.[which]) ? rot[which].slice().sort() : [];
}

function cellCount(t) {
  return tileData[t]?.shape?.length || 2;
}

function targetCells(r, c, deg) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function buildGrid(placements, rows, cols) {
  const g = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const p of placements) {
    const deg = ((p.deg % 360) + 360) % 360;
    if (cellCount(p.tile) === 1) {
      g[p.r][p.c] = `${p.tile}:${edgesFor(p.tile, deg, 'A').join(',')}`;
    } else {
      const cells = targetCells(p.r, p.c, deg);
      ['A', 'B'].forEach((w, i) => {
        const [cr, cc] = cells[i];
        if (cr >= 0 && cr < rows && cc >= 0 && cc < cols) {
          g[cr][cc] = `${p.tile}:${edgesFor(p.tile, deg, w).join(',')}`;
        }
      });
    }
  }
  return g;
}

function gridFp(g) {
  return g.map((r) => r.map((c) => c || '.').join('|')).join('\n');
}

const EDGE_ROT_90 = { N: 'E', E: 'S', S: 'W', W: 'N' };
const EDGE_ROT_180 = { N: 'S', S: 'N', E: 'W', W: 'E' };

function rotateEdges90(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  if (parts.length < 2) return cellStr;
  return `${parts[0]}:${parts[1].split(',').filter(Boolean).map((e) => EDGE_ROT_90[e] || e).sort().join(',')}`;
}

function rotateEdges180(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  if (parts.length < 2) return cellStr;
  return `${parts[0]}:${parts[1].split(',').filter(Boolean).map((e) => EDGE_ROT_180[e] || e).sort().join(',')}`;
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

function allRotationFps(grid, rows, cols) {
  const fps = new Set([gridFp(grid)]);
  fps.add(gridFp(rotateGrid180(grid)));
  if (rows === cols) {
    let cur = grid;
    for (let k = 0; k < 3; k++) {
      cur = rotateGrid90CW(cur);
      fps.add(gridFp(cur));
    }
  }
  return fps;
}

function layoutMatchesExisting(solveDoc, placements, rows, cols) {
  const incoming = allRotationFps(buildGrid(placements, rows, cols), rows, cols);
  for (let i = 0; i < (solveDoc.solutions || []).length; i++) {
    const sol = solveDoc.solutions[i];
    const fps = allRotationFps(buildGrid(sol.placements || [], rows, cols), rows, cols);
    for (const fp of incoming) {
      if (fps.has(fp)) return { match: true, index: i, id: sol.id, label: sol.label };
    }
  }
  return { match: false };
}

function loadCatalogMaps() {
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const byId = new Map();
  const bySig = new Map();
  for (const b of idx.buckets || []) {
    if (!b?.file) continue;
    const full = path.join(LEVELS_DIR, b.file);
    if (!fs.existsSync(full)) continue;
    const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const L of doc.levels || []) {
      if (!L?.id || !L.board) continue;
      const sig = tilesSig(L.board.rows, L.board.cols, L.tiles);
      byId.set(L.id, { id: L.id, tiles: L.tiles, board: L.board, bucketFile: b.file });
      if (!bySig.has(sig)) bySig.set(sig, L.id);
    }
  }
  return { byId, bySig };
}

function classifyTierFromTiles(tiles) {
  const keys = Object.keys(tiles || {});
  if (keys.some((t) => ['CR', 'CT', 'CQ', 'E1', 'E2', 'B2', '2SH', '2ET'].includes(t))) return '0C';
  if (keys.some((t) => ['SZ', 'SS', 'DS', 'QC', 'QS', 'DC'].includes(t))) return '0B';
  return '0A';
}

function sizePrefix(rows, cols) {
  if (rows === 6 && cols === 5) return '5x6';
  return `${rows}x${cols}`;
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

function nextCode(used) {
  for (let a = 0; a < 26; a++) {
    for (let b = 0; b < 26; b++) {
      for (let c = 0; c < 26; c++) {
        const code =
          String.fromCharCode(65 + a) + String.fromCharCode(65 + b) + String.fromCharCode(65 + c);
        if (!used.has(code)) return code;
      }
    }
  }
  throw new Error('no code');
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const fileArg = process.argv.find((a) => !a.startsWith('-') && a.endsWith('.txt'));
  if (!fileArg) {
    console.error('Usage: node scripts/ingest-solve-file-with-report.js <batch.txt> [--dry-run]');
    process.exit(1);
  }
  const abs = path.isAbsolute(fileArg) ? fileArg : path.join(ROOT, fileArg);
  const docs = splitJsonDocs(fs.readFileSync(abs, 'utf8'));
  const { byId, bySig } = loadCatalogMaps();

  const rows = [];
  let appended = 0;
  let skippedDup = 0;
  let newLevels = 0;

  const flat = JSON.parse(fs.readFileSync(FLAT_PATH, 'utf8'));
  const flatLevels = flat.levels || [];
  const flatIds = new Set(flatLevels.map((l) => l.id));
  const bucketDocs = new Map();
  const usedCodesCache = new Map();

  for (const doc of docs) {
    const fileId = doc.levelId || '(missing)';
    const rowsN = Number(doc.board?.rows);
    const colsN = Number(doc.board?.cols);
    const fileTiles = normTiles(doc.tiles);
    const sig = tilesSig(rowsN, colsN, fileTiles);
    const incomingP = doc.solutions?.[0]?.placements || [];

    const catById = byId.get(fileId);
    const catByBag = bySig.get(sig);

    let catalogId = null;
    let tileBagNote = '';
    if (catById) {
      catalogId = fileId;
      const catSig = tilesSig(catById.board.rows, catById.board.cols, catById.tiles);
      tileBagNote =
        catSig === sig
          ? 'catalog has same id + SAME tile bag'
          : `catalog has id ${fileId} but DIFFERENT bag → catalog: ${tilesStr(catById.tiles)}`;
    } else if (catByBag) {
      catalogId = catByBag;
      tileBagNote = `no catalog row for ${fileId}; SAME bag already at ${catByBag}`;
    } else {
      catalogId = fileId;
      tileBagNote = 'NEW tile bag (not in catalog yet)';
    }

    const targetId = catById && tilesSig(catById.board.rows, catById.board.cols, catById.tiles) === sig
      ? fileId
      : catByBag || fileId;

    const solvePath = path.join(SOLVES_DIR, `${targetId}.json`);
    const solveExists = fs.existsSync(solvePath);
    let storedSolveCount = 0;
    let layoutNote = '';
    let action = '';

    if (solveExists) {
      const solveDoc = JSON.parse(fs.readFileSync(solvePath, 'utf8'));
      storedSolveCount = (solveDoc.solutions || []).length;
      const lm = layoutMatchesExisting(solveDoc, incomingP, rowsN, colsN);
      if (lm.match) {
        layoutNote = `layout already stored as ${lm.id} (${lm.label})`;
        action = 'SKIP duplicate layout';
        skippedDup++;
      } else {
        layoutNote = `NEW layout vs ${storedSolveCount} existing solve(s)`;
        action = `APPEND as solve-${storedSolveCount + 1}`;
        if (!dryRun) {
          solveDoc.solutions.push({
            id: `solve-${storedSolveCount + 1}`,
            label: `${targetId} solve ${storedSolveCount + 1}`,
            placements: incomingP,
          });
          solveDoc.totalUniqueSolutions = solveDoc.solutions.length;
          fs.writeFileSync(solvePath, JSON.stringify(solveDoc, null, 2) + '\n', 'utf8');
        }
        appended++;
      }
    } else {
      layoutNote = 'no solve file yet';
      const isNewBag = !catByBag && !catById;
      if (isNewBag && !byId.has(fileId)) {
        action = `CREATE level + solve at ${fileId}`;
        newLevels++;
      } else if (!byId.has(targetId)) {
        action = `CREATE level + solve at ${targetId}`;
        newLevels++;
      } else {
        action = `CREATE solve file ${targetId}.json`;
      }
      if (!dryRun) {
        const out = {
          board: doc.board,
          tileSet: doc.tileSet || 'tiles-live-edges.json',
          tiles: fileTiles,
          totalUniqueSolutions: 1,
          solutions: [
            {
              id: 'solve-1',
              label: `${targetId} solve 1`,
              placements: incomingP,
            },
          ],
          levelId: targetId,
          generatedAt: doc.generatedAt || new Date().toISOString(),
          ingestedFrom: path.relative(ROOT, abs).replace(/\\/g, '/'),
        };
        if (doc.solverMeta) out.solverMeta = doc.solverMeta;
        fs.mkdirSync(SOLVES_DIR, { recursive: true });
        fs.writeFileSync(solvePath, JSON.stringify(out, null, 2) + '\n', 'utf8');
        if (!byId.has(targetId)) {
          const tier = classifyTierFromTiles(fileTiles);
          const bf = `${sizePrefix(rowsN, colsN)}-${tier}.json`;
          const bp = path.join(LEVELS_DIR, bf);
          if (!bucketDocs.has(bf)) bucketDocs.set(bf, JSON.parse(fs.readFileSync(bp, 'utf8')));
          const bdoc = bucketDocs.get(bf);
          bdoc.levels.push({
            id: targetId,
            name: targetId.slice(-3),
            board: { rows: rowsN, cols: colsN },
            tiles: fileTiles,
            blockers: [],
            solvesFile: `${targetId}.json`,
            pathMode: 'single',
            pathCount: 1,
          });
          byId.set(targetId, { id: targetId, tiles: fileTiles, board: { rows: rowsN, cols: colsN }, bucketFile: bf });
          bySig.set(sig, targetId);
          if (!flatIds.has(targetId)) {
            flatLevels.push(bdoc.levels[bdoc.levels.length - 1]);
            flatIds.add(targetId);
          }
        }
      }
      appended++;
    }

    rows.push({
      nameInYourFile: fileId,
      fileTileBag: tilesStr(fileTiles),
      catalogLevelId: catalogId,
      repoTargetId: targetId,
      tileBagVsCatalog: tileBagNote,
      solveFile: solveExists ? `${targetId}.json (${storedSolveCount} solves)` : '(none)',
      layoutCheck: layoutNote,
      action: dryRun ? `[dry-run] ${action}` : action,
      firstPlacementsSample: incomingP.slice(0, 3).map((p) => `${p.tile}@(${p.r},${p.c})${p.deg}`).join('; '),
    });
  }

  if (!dryRun && bucketDocs.size) {
    for (const [bf, bdoc] of bucketDocs) {
      bdoc.levels.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
      bdoc.count = bdoc.levels.length;
      fs.writeFileSync(path.join(LEVELS_DIR, bf), JSON.stringify(bdoc, null, 2) + '\n', 'utf8');
    }
    flat.levels = flatLevels.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    fs.writeFileSync(FLAT_PATH, JSON.stringify(flat, null, 2) + '\n', 'utf8');
    const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    for (const b of idx.buckets || []) {
      if (bucketDocs.has(b.file)) {
        b.count = bucketDocs.get(b.file).count;
      }
    }
    fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2) + '\n', 'utf8');
  }

  const stamp = Date.now();
  const reportJson = path.join(RUNS_DIR, `ingest-report-${stamp}.json`);
  const reportMd = path.join(RUNS_DIR, `ingest-report-${stamp}.md`);
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  const report = {
    sourceFile: path.relative(ROOT, abs).replace(/\\/g, '/'),
    generatedAt: new Date().toISOString(),
    dryRun,
    summary: { total: rows.length, appended, skippedDup, newLevels },
    rows,
  };
  fs.writeFileSync(reportJson, JSON.stringify(report, null, 2) + '\n', 'utf8');

  let md = `# Ingest report: ${report.sourceFile}\n\n`;
  md += `Generated: ${report.generatedAt}${dryRun ? ' (dry-run)' : ''}\n\n`;
  md += `| Metric | Count |\n|--------|------:|\n`;
  md += `| Levels in file | ${rows.length} |\n`;
  md += `| Appended / created | ${appended} |\n`;
  md += `| Skipped (duplicate layout) | ${skippedDup} |\n`;
  md += `| New catalog levels | ${newLevels} |\n\n`;
  md += `| Name in your file | File tile bag | Catalog match | Repo target | Tile bag vs catalog | Solve file | Layout | Action |\n`;
  md += `|-------------------|---------------|---------------|-------------|---------------------|------------|--------|--------|\n`;
  for (const r of rows) {
    md += `| ${r.nameInYourFile} | ${r.fileTileBag} | ${r.catalogLevelId} | ${r.repoTargetId} | ${r.tileBagVsCatalog} | ${r.solveFile} | ${r.layoutCheck} | ${r.action} |\n`;
  }
  fs.writeFileSync(reportMd, md, 'utf8');

  console.log('Report:', reportMd);
  console.log('JSON:', reportJson);
  console.log('Summary:', report.summary);
}

main();
