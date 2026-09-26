#!/usr/bin/env node
/**
 * Build a partial batch-6x5-results.json from individual 6x5-basic-*.json files.
 * This allows running integrate-batch.js before the full batch solver completes.
 */
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const ROWS = 6, COLS = 5;
const prefix = ROWS + "x" + COLS + "-basic-";

const files = fs.readdirSync(DIR)
  .filter(f => f.startsWith(prefix) && f.endsWith(".json"))
  .sort();

const results = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf-8"));
  results.push({
    comboIndex: results.length + 1,
    tiles: data.tiles,
    tileKey: data.tileKey,
    solutionCount: data.totalUniqueSolutions,
    file: file
  });
}

const summary = {
  board: { rows: ROWS, cols: COLS },
  tilePool: "basic",
  totalCombos: files.length,
  solvableCombos: files.length,
  elapsedSeconds: 0,
  note: "Partial results - batch solver still running",
  results: results.sort((a, b) => a.solutionCount - b.solutionCount)
};

const outFile = path.join(DIR, "batch-" + ROWS + "x" + COLS + "-results.json");
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
console.log("Built partial batch-" + ROWS + "x" + COLS + "-results.json with " + results.length + " solvable combos");
