#!/usr/bin/env node
/**
 * Match catalog levels to solves by tile bag (board + multiset).
 * Reports: catalog vs solves.json vs solve-1 placements; wrong pairing; orphan solves.
 *
 * Usage:
 *   node scripts/audit-level-solve-tile-bags.js
 *   node scripts/audit-level-solve-tile-bags.js --out data/solver-runs/level-solve-bag-match.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const SOLVES_DIR = path.join(ROOT, 'solves');
const SANDBOX_IDS = new Set(['3x5-0C-ZZZ', '3x6-0C-ZZZ', '5x6-0C-ZZZ', '6x7-0C-ZZZ']);

function parseArgs() {
  let out = path.join(ROOT, 'data', 'solver-runs', `level-solve-bag-match-${Date.now()}.json`);
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--out' && process.argv[i + 1]) {
      out = path.isAbsolute(process.argv[i + 1])
        ? process.argv[i + 1]
        : path.join(ROOT, process.argv[i + 1]);
      i++;
    }
  }
  return { out };
}

function norm(t) {
  const o = {};
  for (const [k, v] of Object.entries(t || {})) {
    const n = +v;
    if (n > 0) o[k] = n;
  }
  return o;
}

function fmt(t) {
  return Object.keys(norm(t))
    .sort()
    .map((k) => `${k}×${norm(t)[k]}`)
    .join(' ');
}

function sig(board, tiles) {
  const r = board?.rows;
  const c = board?.cols;
  return `${r}x${c}|${JSON.stringify(
    Object.keys(norm(tiles))
      .sort()
      .map((k) => [k, norm(tiles)[k]])
  )}`;
}

function bagFromPlacements(placements) {
  const o = {};
  for (const p of placements || []) o[p.tile] = (o[p.tile] || 0) + 1;
  return o;
}

function bagsEqual(a, b) {
  const na = norm(a);
  const nb = norm(b);
  const keys = new Set([...Object.keys(na), ...Object.keys(nb)]);
  for (const k of keys) if ((na[k] || 0) !== (nb[k] || 0)) return false;
  return true;
}

function classifyTier(tiles) {
  const keys = Object.keys(norm(tiles));
  if (keys.some((t) => ['CR', 'CT', 'CQ', 'E1', 'E2', 'B2', '2SH', '2ET'].includes(t))) return '0C';
  if (keys.some((t) => ['SZ', 'SS', 'DS', 'QC', 'QS', 'DC'].includes(t))) return '0B';
  return '0A';
}

function main() {
  const { out } = parseArgs();
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  /** @type {Map<string, { id, bucketFile, board, catalogTiles, sig }>} */
  const catalogBySig = new Map();
  /** @type {Map<string, object>} */
  const catalogById = new Map();

  for (const b of idx.buckets || []) {
    if (!b?.file) continue;
    const fp = path.join(LEVELS_DIR, b.file);
    if (!fs.existsSync(fp)) continue;
    const doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const L of doc.levels || []) {
      const s = sig(L.board, L.tiles);
      catalogById.set(L.id, {
        id: L.id,
        bucketFile: b.file,
        board: L.board,
        catalogTiles: norm(L.tiles),
        sig: s,
        blockers: L.blockers || [],
      });
      if (!catalogBySig.has(s)) catalogBySig.set(s, []);
      catalogBySig.get(s).push(L.id);
    }
  }

  const solveFiles = fs
    .readdirSync(SOLVES_DIR)
    .filter((f) => f.endsWith('.json') && !f.includes('solve-level'));

  /** @type {Map<string, string[]>} */
  const solveBySig = new Map();
  /** @type {Map<string, object>} */
  const solveByFile = new Map();

  for (const f of solveFiles) {
    const fp = path.join(SOLVES_DIR, f);
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
      continue;
    }
    const board = doc.board || {};
    const tilesJson = norm(doc.tiles);
    const fromSol1 =
      doc.solutions?.[0]?.placements?.length > 0
        ? bagFromPlacements(doc.solutions[0].placements)
        : null;
    const playBag = fromSol1 || tilesJson;
    const s = sig(board, playBag);
    const idFromName = f.replace(/\.json$/, '');
    const entry = {
      file: f,
      idFromName,
      levelIdInDoc: doc.levelId || null,
      board,
      tilesJson,
      placementsBag: fromSol1,
      playBag: norm(playBag),
      sig: s,
      solutionCount: (doc.solutions || []).length,
    };
    solveByFile.set(f, entry);
    if (!solveBySig.has(s)) solveBySig.set(s, []);
    solveBySig.get(s).push(f);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {},
    catalogMismatch: [],
    correctOwner: [],
    orphanSolveFiles: [],
    catalogMissingSolve: [],
    multiCatalogSameBag: [],
    multiSolveSameBag: [],
  };

  for (const [id, cat] of catalogById) {
    if (SANDBOX_IDS.has(id)) continue;
    const sf = `${id}.json`;
    const solve = solveByFile.get(sf);
    if (!solve) {
      report.catalogMissingSolve.push({ id, bucketFile: cat.bucketFile });
      continue;
    }

    const catBag = cat.catalogTiles;
    const jsonBag = solve.tilesJson;
    const playBag = solve.playBag;
    const catVsJson = bagsEqual(catBag, jsonBag);
    const catVsPlay = bagsEqual(catBag, playBag);
    const jsonVsPlay = bagsEqual(jsonBag, playBag);

    const owners = catalogBySig.get(solve.sig) || [];
    const correctCatalogIds = owners.filter((oid) => oid !== id);
    const tierFromPlay = classifyTier(playBag);
    const idTier = (id.match(/-([^-]+)-/) || [])[1];

    if (!catVsPlay) {
      const matchByPlay = catalogBySig.get(solve.sig) || [];
      report.catalogMismatch.push({
        id,
        bucketFile: cat.bucketFile,
        catalogBag: fmt(catBag),
        solvesJsonBag: fmt(jsonBag),
        solve1Bag: fmt(playBag),
        correctCatalogIds: matchByPlay.filter((x) => x !== id),
        suggestedAction:
          matchByPlay.length && !matchByPlay.includes(id)
            ? `catalog tiles wrong; play bag matches ${matchByPlay.join(', ')}`
            : matchByPlay.length === 0
              ? 'no catalog row for play bag — new level or fix catalog tiles from solve-1'
              : 'sync catalog.tiles from solve-1 placements',
        idTier,
        tierFromPlay,
      });
    }

    if (correctCatalogIds.length) {
      report.correctOwner.push({
        id,
        solveFile: sf,
        playBag: fmt(playBag),
        alsoOwnedByCatalog: correctCatalogIds,
        note: 'same bag exists on other catalog id(s)',
      });
    }
  }

  for (const [f, solve] of solveByFile) {
    const id = solve.idFromName;
    if (SANDBOX_IDS.has(id)) continue;
    if (!catalogById.has(id)) {
      const owners = catalogBySig.get(solve.sig) || [];
      report.orphanSolveFiles.push({
        file: f,
        idFromName: id,
        levelIdInDoc: solve.levelIdInDoc,
        playBag: fmt(solve.playBag),
        matchingCatalogIds: owners,
      });
    }
  }

  for (const [s, ids] of catalogBySig) {
    if (ids.length > 1) report.multiCatalogSameBag.push({ sig: s, ids });
  }
  for (const [s, files] of solveBySig) {
    if (files.length > 1) {
      const nonSandbox = files.filter((f) => !SANDBOX_IDS.has(f.replace('.json', '')));
      if (nonSandbox.length > 1) report.multiSolveSameBag.push({ sig: s, files: nonSandbox });
    }
  }

  report.summary = {
    catalogLevels: catalogById.size,
    solveFiles: solveFiles.length,
    catalogMissingSolve: report.catalogMissingSolve.length,
    catalogMismatch: report.catalogMismatch.length,
    orphanSolveFiles: report.orphanSolveFiles.length,
    multiCatalogSameBag: report.multiCatalogSameBag.length,
    multiSolveSameBag: report.multiSolveSameBag.length,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const md = out.replace(/\.json$/i, '.md');
  const lines = [
    '# Level ↔ solve tile bag matching',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '**Rule:** board size + tile multiset from **solve-1 placements** (or `solves.json` tiles if no placements) is the play bag. Catalog `tiles` should match that.',
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Catalog levels | ${report.summary.catalogLevels} |`,
    `| Solve files | ${report.summary.solveFiles} |`,
    `| Catalog bag ≠ play bag | ${report.summary.catalogMismatch} |`,
    `| Orphan solve (no catalog id) | ${report.summary.orphanSolveFiles} |`,
    `| Missing solve file | ${report.summary.catalogMissingSolve} |`,
    '',
  ];

  if (report.catalogMismatch.length) {
    lines.push('## Catalog tiles wrong — correct owner by play bag', '');
    lines.push('| Level (wrong catalog tiles) | Solve-1 bag | Should match catalog id(s) |');
    lines.push('|-----------------------------|-------------|------------------------------|');
    for (const r of report.catalogMismatch) {
      lines.push(
        `| ${r.id} | ${r.solve1Bag} | ${r.correctCatalogIds.length ? r.correctCatalogIds.join(', ') : '*(none — fix catalog from solve)*'} |`
      );
    }
    lines.push('');
  }

  if (report.orphanSolveFiles.length) {
    lines.push('## Orphan solve files', '');
    for (const o of report.orphanSolveFiles.slice(0, 30)) {
      lines.push(
        `- \`${o.file}\` bag ${o.playBag} → catalog: ${o.matchingCatalogIds.join(', ') || 'none'}`
      );
    }
    lines.push('');
  }

  fs.writeFileSync(md, lines.join('\n') + '\n', 'utf8');

  console.log(JSON.stringify(report.summary, null, 2));
  console.error('Wrote', out);
  console.error('Wrote', md);
  if (report.catalogMismatch.length) {
    console.log('\nCatalog ≠ play bag:');
    for (const r of report.catalogMismatch) {
      console.log(`  ${r.id}`);
      console.log(`    catalog: ${r.catalogBag}`);
      console.log(`    play:    ${r.solve1Bag}`);
      console.log(`    owner:   ${r.correctCatalogIds.join(', ') || '(sync catalog from solve)'}`);
    }
  }
}

main();
