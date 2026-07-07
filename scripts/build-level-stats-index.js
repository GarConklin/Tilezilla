#!/usr/bin/env node
/**
 * Compact level stats for passport / adventure metadata (no tile bags).
 * Output: data/levels/stats-index.json
 *
 *   node scripts/build-level-stats-index.js
 */
const fs = require('fs');
const path = require('path');

const LEVELS_DIR = path.join(__dirname, '..', 'data', 'levels');
const INDEX_PATH = path.join(LEVELS_DIR, 'index.json');
const OUT_PATH = path.join(LEVELS_DIR, 'stats-index.json');

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const byId = {};
  let count = 0;

  for (const bucket of index.buckets || []) {
    const filePath = path.join(LEVELS_DIR, bucket.file);
    if (!fs.existsSync(filePath)) {
      console.warn('missing bucket', bucket.file);
      continue;
    }
    const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const level of doc.levels || []) {
      if (!level?.id) continue;
      const rows = Number(level.board?.rows) || 0;
      const cols = Number(level.board?.cols) || 0;
      const total = Number(level.totalUniqueSolutions) || 0;
      byId[level.id] = { t: total, r: rows, c: cols };
      count += 1;
    }
  }

  const out = {
    schema: 'levels-stats-v1',
    generatedAt: new Date().toISOString(),
    count,
    byId,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`Wrote ${OUT_PATH} — ${count} levels, ${kb} KB`);
}

main();
