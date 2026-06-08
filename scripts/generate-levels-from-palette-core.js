#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  indexToThreeLetterCode,
  nextThreeLetterCode,
  loadUsedCodesFromBucketFile,
} = require('./lib/three-letter-codes');

const ROOT = path.join(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
}

function bagCanonical(tiles) {
  const out = {};
  for (const k of Object.keys(tiles).sort()) {
    const n = Number(tiles[k] || 0);
    if (n > 0) out[k] = n;
  }
  return out;
}

function bagKey(tiles) {
  return JSON.stringify(bagCanonical(tiles));
}

function parseCli(argv) {
  const out = {
    paletteSpec: path.join(ROOT, 'data', 'levels', 'specs', 'create-levels-6x6-palette-v2.json'),
    tier: null,
    parallel: 4,
    maxTested: 0,
    progressEvery: 100,
    outLevels: null,
    outSolvesDir: null,
    maxSolPerLevel: 1,
    /** If set, assign next free suffix from this bucket (e.g. data/levels/5x6-0B.json). */
    reserveCodesFrom: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--palette-spec' && argv[i + 1]) {
      out.paletteSpec = path.isAbsolute(argv[++i]) ? argv[i] : path.join(ROOT, argv[i]);
    } else if (a === '--tier' && argv[i + 1]) out.tier = String(argv[++i]).trim();
    else if (a === '--parallel' && argv[i + 1]) out.parallel = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === '--max-tested' && argv[i + 1]) out.maxTested = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === '--progress-every' && argv[i + 1]) {
      out.progressEvery = Math.max(1, parseInt(argv[++i], 10) || 100);
    } else if (a === '--out-levels' && argv[i + 1]) {
      out.outLevels = path.isAbsolute(argv[++i]) ? argv[i] : path.join(ROOT, argv[i]);
    } else if (a === '--out-solves-dir' && argv[i + 1]) {
      out.outSolvesDir = path.isAbsolute(argv[++i]) ? argv[i] : path.join(ROOT, argv[i]);
    } else if (a === '--max-sol-per-level' && argv[i + 1]) {
      out.maxSolPerLevel = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (a === '--reserve-codes-from' && argv[i + 1]) {
      out.reserveCodesFrom = path.isAbsolute(argv[++i]) ? argv[i] : path.join(ROOT, argv[i]);
    }
  }
  return out;
}

function solveRun(args) {
  return new Promise((resolve) => {
    const cp = spawn('node', args, { cwd: ROOT });
    let out = '';
    let err = '';
    cp.stdout.on('data', (d) => (out += String(d)));
    cp.stderr.on('data', (d) => (err += String(d)));
    cp.on('close', (code) => resolve({ code, out, err }));
  });
}

async function solveSpecSummary(specPath, maxSol) {
  const args = [
    'solves/solve-level.js',
    '--spec',
    specPath,
    '--json-summary',
    '--quiet',
    '--max-sol',
    String(maxSol),
  ];
  const r = await solveRun(args);
  if (r.code !== 0) return { ok: false, err: r.err || r.out };
  try {
    const line = r.out.trim().split(/\r?\n/).filter(Boolean).pop();
    const js = JSON.parse(line);
    return { ok: true, summary: js };
  } catch (e) {
    return { ok: false, err: `summary parse failed: ${String(e.message || e)}\n${r.out}\n${r.err}` };
  }
}

async function solveSpecWrite(specPath, outPath, maxSol) {
  const args = [
    'solves/solve-level.js',
    '--spec',
    specPath,
    '--json-summary',
    '--quiet',
    '--max-sol',
    String(maxSol),
    '--write-solves',
    outPath,
  ];
  const r = await solveRun(args);
  return { ok: r.code === 0, err: r.err || r.out };
}

function buildEnumerator({ rows, cols, maxPool, cellSize, acceptBag }) {
  const fixed = { SH: 1, ET: 1 };
  const vars = Object.keys(maxPool).filter((t) => !Object.prototype.hasOwnProperty.call(fixed, t)).sort();
  const target = rows * cols;
  const fixedCells = Object.entries(fixed).reduce((a, [t, c]) => a + (cellSize[t] || 0) * c, 0);
  const need = target - fixedCells;
  if (need < 0) throw new Error('SH/ET fixed cells exceed board size.');

  const maxRemain = Array(vars.length + 1).fill(0);
  for (let i = vars.length - 1; i >= 0; i--) {
    maxRemain[i] = maxRemain[i + 1] + (maxPool[vars[i]] || 0) * (cellSize[vars[i]] || 0);
  }

  function* rec(i, cells, counts) {
    if (cells > need) return;
    if (cells + maxRemain[i] < need) return;
    if (i >= vars.length) {
      if (cells !== need) return;
      const bag = { ...fixed };
      for (const [k, v] of Object.entries(counts)) if (v > 0) bag[k] = v;
      if (acceptBag && !acceptBag(bag)) return;
      yield bag;
      return;
    }
    const t = vars[i];
    const maxC = maxPool[t] || 0;
    const cs = cellSize[t] || 0;
    for (let c = 0; c <= maxC; c++) {
      counts[t] = c;
      yield* rec(i + 1, cells + c * cs, counts);
    }
    delete counts[t];
  }

  return rec(0, 0, {});
}

function loadCellSizeMap(maxPool) {
  const tiles = readJson(path.join(ROOT, 'data', 'tiles', 'tiles-live-edges.json'));
  const out = {};
  for (const t of Object.keys(maxPool)) {
    const def = tiles[t];
    if (!def || !Array.isArray(def.shape) || !def.shape.length) {
      throw new Error(`Tile "${t}" not defined in data/tiles/tiles-live-edges.json`);
    }
    out[t] = def.shape.length;
  }
  return out;
}

function buildSpec(id, rows, cols, bag) {
  return {
    id,
    name: id,
    board: { rows, cols },
    tiles: bagCanonical(bag),
    blockers: [],
    pathMode: 'single',
    pathCount: 1,
  };
}

function allocateSuffix({ found, reservedUsed, localUsed }) {
  if (reservedUsed) {
    return nextThreeLetterCode(reservedUsed);
  }
  const suffix = indexToThreeLetterCode(found - 1);
  if (localUsed.has(suffix)) {
    throw new Error(
      `Suffix collision ${suffix} at found=${found} — use --reserve-codes-from data/levels/<bucket>.json`
    );
  }
  localUsed.add(suffix);
  return suffix;
}

async function runSizeGenerator(sizeCfg) {
  const cli = parseCli(process.argv);
  const palette = readJson(cli.paletteSpec);
  const level = palette.levels && palette.levels[0];
  if (!level || !level.tiles) throw new Error(`Invalid palette spec: ${cli.paletteSpec}`);

  const tier = cli.tier || sizeCfg.defaultTier;
  const tierRule = (sizeCfg.tiers || {})[tier];
  if (!tierRule) {
    throw new Error(`Unsupported tier "${tier}". Allowed: ${Object.keys(sizeCfg.tiers || {}).join(', ')}`);
  }

  const maxPool = {};
  for (const [k, v] of Object.entries(level.tiles)) maxPool[k] = Number(v || 0);
  const cellSize = loadCellSizeMap(maxPool);

  const outLevels =
    cli.outLevels ||
    path.join(ROOT, 'data', 'levels', 'generated', `${sizeCfg.size}-${tier}.generated.json`);
  const outSolvesDir =
    cli.outSolvesDir || path.join(ROOT, 'solves', 'generated', `${sizeCfg.size}-${tier}`);
  const outProgress = path.join(
    ROOT,
    'data',
    'levels',
    'reports',
    `generate-${sizeCfg.size}-${tier}-${Date.now()}.ndjson`
  );
  fs.mkdirSync(path.dirname(outProgress), { recursive: true });
  fs.mkdirSync(outSolvesDir, { recursive: true });

  const reservedUsed = cli.reserveCodesFrom
    ? loadUsedCodesFromBucketFile(cli.reserveCodesFrom)
    : null;
  const localUsed = new Set();
  if (reservedUsed) {
    console.error(
      `[codes] reserving from ${path.relative(ROOT, cli.reserveCodesFrom)} (${reservedUsed.size} used) → next ${nextThreeLetterCode(reservedUsed)}`
    );
  }

  const bucket = {
    schema: 'levels-bucket-v1',
    size: sizeCfg.size,
    tier,
    count: 0,
    generatedAt: new Date().toISOString(),
    sourcePalette: path.relative(ROOT, cli.paletteSpec).split(path.sep).join('/'),
    note: tierRule.note || '',
    levels: [],
  };
  writeJson(outLevels, bucket);

  const acceptBag = (bag) => (typeof tierRule.acceptBag === 'function' ? !!tierRule.acceptBag(bag) : true);
  const iter = buildEnumerator({
    rows: sizeCfg.rows,
    cols: sizeCfg.cols,
    maxPool,
    cellSize,
    acceptBag,
  });

  const fd = fs.openSync(outProgress, 'a');
  const append = (obj) => {
    fs.writeSync(fd, JSON.stringify(obj) + '\n', 'utf8');
    fs.fsyncSync(fd);
  };

  let tested = 0;
  let found = 0;
  let unsolved = 0;
  let errors = 0;
  const seen = new Set();
  const t0 = Date.now();
  const active = new Set();

  const runOne = async (bag) => {
    const key = bagKey(bag);
    if (seen.has(key)) return;
    seen.add(key);

    const tmpId = `${sizeCfg.size}-${tier}-TMP-${String(tested + 1).padStart(8, '0')}`;
    const tmpSpec = path.join(ROOT, 'data', 'levels', 'reports', 'tmp-specs', `${tmpId}.json`);
    writeJson(tmpSpec, buildSpec(tmpId, sizeCfg.rows, sizeCfg.cols, bag));

    const t1 = Date.now();
    const summary = await solveSpecSummary(tmpSpec, 1);
    const sec = Number(((Date.now() - t1) / 1000).toFixed(3));
    tested++;

    if (!summary.ok) {
      errors++;
      append({ kind: 'error', tested, bag: bagCanonical(bag), seconds: sec, err: String(summary.err || 'solver failed') });
      return;
    }
    const total = Number(summary.summary?.totalUniqueSolutions || 0);
    if (total <= 0) {
      unsolved++;
      append({ kind: 'unsolved', tested, bag: bagCanonical(bag), seconds: sec });
      return;
    }

    found++;
    const suffix = allocateSuffix({ found, reservedUsed, localUsed });
    if (reservedUsed) reservedUsed.add(suffix);

    const id = `${sizeCfg.size}-${tier}-${suffix}`;
    const solvesFile = `${id}.json`;
    const finalSpec = path.join(ROOT, 'data', 'levels', 'reports', 'tmp-specs', `${id}.json`);
    writeJson(finalSpec, buildSpec(id, sizeCfg.rows, sizeCfg.cols, bag));
    const solvesPath = path.join(outSolvesDir, solvesFile);
    const w = await solveSpecWrite(finalSpec, solvesPath, cli.maxSolPerLevel);
    if (!w.ok) {
      errors++;
      append({
        kind: 'error-write',
        tested,
        id,
        bag: bagCanonical(bag),
        seconds: sec,
        err: String(w.err || 'write-solves failed'),
      });
      return;
    }

    bucket.levels.push({
      id,
      name: suffix,
      board: { rows: sizeCfg.rows, cols: sizeCfg.cols },
      tiles: bagCanonical(bag),
      blockers: [],
      solvesFile,
      pathMode: 'single',
      pathCount: 1,
      _solvesPath: path.relative(ROOT, solvesPath).split(path.sep).join('/'),
    });
    bucket.count = bucket.levels.length;
    writeJson(outLevels, bucket);
    append({
      kind: 'found',
      tested,
      found,
      id,
      bag: bagCanonical(bag),
      seconds: sec,
      solvesPath: path.relative(ROOT, solvesPath).split(path.sep).join('/'),
    });
  };

  for (const bag of iter) {
    if (cli.maxTested > 0 && tested >= cli.maxTested) break;
    const p = runOne(bag).finally(() => active.delete(p));
    active.add(p);
    while (active.size >= cli.parallel) {
      await Promise.race(active);
      if (tested > 0 && tested % cli.progressEvery === 0) {
        const elapsed = (Date.now() - t0) / 1000;
        const rate = tested / Math.max(1, elapsed);
        console.error(
          `[${sizeCfg.size}/${tier}] tested=${tested} found=${found} unsolved=${unsolved} errors=${errors} rate=${rate.toFixed(2)}/s elapsed=${elapsed.toFixed(1)}s`
        );
      }
    }
  }

  await Promise.all(active);
  fs.closeSync(fd);

  const elapsed = (Date.now() - t0) / 1000;
  console.error(
    `DONE ${sizeCfg.size}/${tier}: tested=${tested}, found=${found}, unsolved=${unsolved}, errors=${errors}, elapsed=${elapsed.toFixed(1)}s`
  );
  console.error(`Levels: ${path.relative(ROOT, outLevels)}`);
  console.error(`Solves: ${path.relative(ROOT, outSolvesDir)}`);
  console.error(`Progress: ${path.relative(ROOT, outProgress)}`);
}

module.exports = { runSizeGenerator, parseCli };
