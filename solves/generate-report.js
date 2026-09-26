#!/usr/bin/env node
/**
 * Generate a CSV spreadsheet of all puzzle levels across all board sizes.
 */
const fs = require("fs");
const path = require("path");

const sizes = ["2x4", "3x4", "3x6", "4x4", "4x5", "6x5", "6x6"];
const rows = [];

// Header
rows.push([
  "Board Size", "Combo #", "Level ID", "Solutions", "Status",
  "UT", "RC", "LC", "DB", "HL", "VL", "LL", "LR",
  "Tile Summary"
]);

function getLetter(i) {
  if (i < 26) return String.fromCharCode(65 + i);
  let n = i - 26;
  if (n < 676) {
    return String.fromCharCode(65 + Math.floor(n / 26))
         + String.fromCharCode(65 + (n % 26));
  }
  n -= 676;
  return String.fromCharCode(65 + Math.floor(n / 676))
       + String.fromCharCode(65 + Math.floor((n % 676) / 26))
       + String.fromCharCode(65 + (n % 26));
}

function getTileCount(tiles, name) {
  return tiles[name + "-Snake-Tile.png"] || 0;
}

function tileSummary(tiles) {
  return Object.entries(tiles)
    .map(([k, v]) => k.replace("-Snake-Tile.png", "") + (v > 1 ? "x" + v : ""))
    .filter(x => !x.startsWith("SH") && !x.startsWith("ET"))
    .join(", ");
}

function csvEscape(val) {
  const s = String(val === undefined || val === null ? "" : val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

for (const size of sizes) {
  const batchFile = path.join(__dirname, "batch-" + size + "-results.json");

  if (size === "6x6") {
    // Hand-picked 6x6 levels
    rows.push(["6x6 SUMMARY", "", "", "", "3 hand-picked levels", "", "", "", "", "", "", "", "", ""]);
    const files = [
      ["6x6.json", "6x6-A"],
      ["6x6-B.json", "6x6-B"],
      ["6x6-C.json", "6x6-C"]
    ];
    for (const [file, id] of files) {
      const fp = path.join(__dirname, file);
      if (!fs.existsSync(fp)) continue;
      const d = JSON.parse(fs.readFileSync(fp, "utf-8"));
      const t = d.tiles;
      rows.push([
        "6x6", "", id, d.totalUniqueSolutions || "?", "hand-picked",
        getTileCount(t, "UT"), getTileCount(t, "RC"), getTileCount(t, "LC"),
        getTileCount(t, "DB"), getTileCount(t, "HL"), getTileCount(t, "VL"),
        getTileCount(t, "LL"), getTileCount(t, "LR"),
        tileSummary(t)
      ]);
    }
    rows.push([]);
    continue;
  }

  if (!fs.existsSync(batchFile)) continue;

  const batch = JSON.parse(fs.readFileSync(batchFile, "utf-8"));
  const status = size === "6x5" ? "partial (18%)" : "complete";

  rows.push([
    size + " SUMMARY", "", "", "",
    batch.solvableCombos + " solvable / " + batch.totalCombos + " tested (" + status + ")",
    "", "", "", "", "", "", "", "", ""
  ]);

  for (let i = 0; i < batch.results.length; i++) {
    const r = batch.results[i];
    const t = r.tiles;
    const ltr = getLetter(i);
    rows.push([
      size,
      i + 1,
      size + "-" + ltr,
      r.solutionCount,
      "batch",
      getTileCount(t, "UT"), getTileCount(t, "RC"), getTileCount(t, "LC"),
      getTileCount(t, "DB"), getTileCount(t, "HL"), getTileCount(t, "VL"),
      getTileCount(t, "LL"), getTileCount(t, "LR"),
      tileSummary(t)
    ]);
  }
  rows.push([]); // blank separator
}

// Write CSV
const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
const outPath = path.join(__dirname, "puzzle-levels-report.csv");
fs.writeFileSync(outPath, csv);
console.log("Wrote " + outPath);
console.log("Total rows: " + rows.length + " (including headers and separators)");

// Quick summary
for (const size of sizes) {
  const bf = path.join(__dirname, "batch-" + size + "-results.json");
  if (fs.existsSync(bf)) {
    const b = JSON.parse(fs.readFileSync(bf, "utf-8"));
    console.log("  " + size + ": " + b.solvableCombos + " solvable combos, solutions range " +
      Math.min(...b.results.map(r => r.solutionCount)) + "-" +
      Math.max(...b.results.map(r => r.solutionCount)));
  } else if (size === "6x6") {
    console.log("  6x6: 3 hand-picked (44, 28, 678 solutions)");
  }
}
