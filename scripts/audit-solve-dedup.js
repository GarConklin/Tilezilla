#!/usr/bin/env node
/**
 * Audit solve files for rotational duplicates.
 * Non-square boards: checks 180° rotation.
 * Square boards: checks 90°, 180°, 270° rotations.
 *
 * Uses cell-level edge fingerprints (not anchor tuples) to avoid
 * false negatives from tiles with equivalent re-anchorings (SS, SZ, etc.).
 *
 * Usage:
 *   node scripts/audit-solve-dedup.js                     # all solve files
 *   node scripts/audit-solve-dedup.js solves/4x5-0B-AAB.json
 *   node scripts/audit-solve-dedup.js --summary           # one line per affected file
 *   node scripts/audit-solve-dedup.js --report-out data/solver-runs/rotation-dedup-audit.json
 *   node scripts/audit-solve-dedup.js --fix               # remove duplicates in-place
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOLVES_DIR = path.join(ROOT, 'solves');
const TILES_PATH = path.join(ROOT, 'data', 'tiles', 'tiles-live-edges.json');

const tileData = JSON.parse(fs.readFileSync(TILES_PATH, 'utf8'));
const fix = process.argv.includes('--fix');
const summary = process.argv.includes('--summary');
const reportOutIdx = process.argv.indexOf('--report-out');
const reportOut =
  reportOutIdx >= 0 && process.argv[reportOutIdx + 1]
    ? path.resolve(ROOT, process.argv[reportOutIdx + 1])
    : null;

function edgesFor(tileName, deg, which) {
  const def = tileData[tileName];
  if (!def) return [];
  const rk = `r${((deg % 360) + 360) % 360}`;
  const rot = def[rk];
  if (!rot) return [];
  return Array.isArray(rot[which]) ? rot[which].slice().sort() : [];
}

function targetCells(r, c, deg) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function cellCount(tileName) {
  const def = tileData[tileName];
  if (!def || !Array.isArray(def.shape)) return 2;
  return def.shape.length;
}

function buildCellGrid(placements, rows, cols) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const p of placements) {
    const deg = ((p.deg % 360) + 360) % 360;
    if (cellCount(p.tile) === 1) {
      grid[p.r][p.c] = `${p.tile}:${edgesFor(p.tile, deg, 'A').join(',')}`;
    } else {
      const cells = targetCells(p.r, p.c, deg);
      const whichLabels = ['A', 'B'];
      for (let i = 0; i < cells.length; i++) {
        const [cr, cc] = cells[i];
        if (cr >= 0 && cr < rows && cc >= 0 && cc < cols) {
          grid[cr][cc] = `${p.tile}:${edgesFor(p.tile, deg, whichLabels[i]).join(',')}`;
        }
      }
    }
  }
  return grid;
}

function gridFingerprint(grid) {
  return grid.map(row => row.map(c => c || '.').join('|')).join('\n');
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

const EDGE_ROT_90 = { N: 'E', E: 'S', S: 'W', W: 'N' };

function rotateEdgeLabel(e) {
  return EDGE_ROT_90[e] || e;
}

function rotateEdges90(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  if (parts.length < 2) return cellStr;
  const edges = parts[1].split(',').filter(Boolean).map(rotateEdgeLabel).sort().join(',');
  return `${parts[0]}:${edges}`;
}

const EDGE_ROT_180 = { N: 'S', S: 'N', E: 'W', W: 'E' };

function rotateEdges180(cellStr) {
  if (!cellStr || cellStr === '.') return cellStr;
  const parts = cellStr.split(':');
  if (parts.length < 2) return cellStr;
  const edges = parts[1].split(',').filter(Boolean).map(e => EDGE_ROT_180[e] || e).sort().join(',');
  return `${parts[0]}:${edges}`;
}

function getRotations(grid, rows, cols) {
  const fps = [gridFingerprint(grid)];
  const r180 = rotateGrid180(grid);
  fps.push(gridFingerprint(r180));
  if (rows === cols) {
    let cur = grid;
    for (let k = 0; k < 3; k++) {
      cur = rotateGrid90CW(cur);
      fps.push(gridFingerprint(cur));
    }
  }
  return fps;
}

function auditFile(filePath) {
  const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(doc.solutions) || doc.solutions.length < 2) return null;
  const rows = doc.board?.rows;
  const cols = doc.board?.cols;
  if (!rows || !cols) return null;
  const isSquare = rows === cols;
  const rotLabel = isSquare ? '90/180/270' : '180';

  const fingerprints = [];
  const duplicates = [];

  for (let i = 0; i < doc.solutions.length; i++) {
    const sol = doc.solutions[i];
    const grid = buildCellGrid(sol.placements, rows, cols);
    const fp = gridFingerprint(grid);
    const allRots = getRotations(grid, rows, cols);

    let isDup = false;
    for (let j = 0; j < fingerprints.length; j++) {
      if (allRots.includes(fingerprints[j])) {
        duplicates.push({ index: i, id: sol.id, dupOf: doc.solutions[j].id });
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      fingerprints.push(fp);
    }
  }

  return duplicates.length > 0
    ? { file: path.basename(filePath), rows, cols, rotLabel, total: doc.solutions.length, duplicates, doc, filePath }
    : null;
}

const fileArgs = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    if (a === '--report-out') i++;
    continue;
  }
  fileArgs.push(path.resolve(a));
}
let files;
if (fileArgs.length) {
  files = fileArgs;
} else {
  files = fs.readdirSync(SOLVES_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .sort()
    .map(f => path.join(SOLVES_DIR, f));
}

let totalDups = 0;
let filesWithDups = 0;
const reportRows = [];

if (summary) {
  console.log('levelId\tstored\trotDups\tuniqueAfter\tboard\trotationsChecked');
}

for (const f of files) {
  const result = auditFile(f);
  if (!result) continue;
  filesWithDups++;
  const dupCount = result.duplicates.length;
  totalDups += dupCount;
  const levelId = result.file.replace(/\.json$/, '');
  const after = result.total - dupCount;
  reportRows.push({
    levelId,
    file: result.file,
    rows: result.rows,
    cols: result.cols,
    rotLabel: result.rotLabel,
    stored: result.total,
    rotationalDuplicates: dupCount,
    uniqueAfterDedup: after,
  });

  if (summary) {
    console.log(
      `${levelId}\t${result.total}\t${dupCount}\t${after}\t${result.rows}x${result.cols}\t${result.rotLabel}`
    );
  } else {
    console.log(`\n${result.file} (${result.rows}x${result.cols}, checking ${result.rotLabel}):`);
    for (const d of result.duplicates) {
      console.log(`  ${d.id} is a rotational duplicate of ${d.dupOf}`);
    }
    console.log(`  ${result.total} solutions, ${dupCount} duplicate(s)`);
  }

  if (fix) {
    const dupIndices = new Set(result.duplicates.map((d) => d.index));
    result.doc.solutions = result.doc.solutions.filter((_, i) => !dupIndices.has(i));
    result.doc.solutions.forEach((s, i) => {
      s.id = `solve-${i + 1}`;
    });
    result.doc.totalUniqueSolutions = result.doc.solutions.length;
    fs.writeFileSync(result.filePath, JSON.stringify(result.doc, null, 2) + '\n', 'utf8');
    if (!summary) {
      console.log(`  FIXED: wrote ${result.doc.solutions.length} solutions`);
    }
  }
}

const scannedAt = new Date().toISOString();
const report = {
  scannedAt,
  filesScanned: files.length,
  filesWithRotationalDuplicates: filesWithDups,
  totalRotationalDuplicateSolutions: totalDups,
  levels: reportRows.sort((a, b) => b.rotationalDuplicates - a.rotationalDuplicates),
};

if (reportOut) {
  fs.mkdirSync(path.dirname(reportOut), { recursive: true });
  fs.writeFileSync(reportOut, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Wrote report: ${reportOut}`);
}

console.log(
  `\nTotal: ${files.length} files scanned, ${filesWithDups} with rotational duplicates, ${totalDups} duplicate solution(s).`
);
if (totalDups > 0 && !fix) {
  console.log('Run with --fix to remove duplicates (or .\\scripts\\dedupe-solve-rotations.ps1).');
}
