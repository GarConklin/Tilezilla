/**
 * integrate-batch.js
 * Reads batch solver results and generates an updated levels.json
 * with basic-tile levels first, then advanced-tile levels.
 * Also renames solution files to match their new level IDs.
 */
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const EXISTING = JSON.parse(fs.readFileSync(path.join(DIR, "levels.json"), "utf-8"));

// Board size config: puzzle number prefix
const BOARD_PREFIX = {
  "2x4": "1", "3x3": "2", "3x4": "3", "3x5": "4", "3x6": "5",
  "4x4": "6", "4x5": "7", "4x6": "8", "5x5": "9",
  "5x6": "A", "6x5": "A", "6x6": "B"
};

// Load batch results for each board size
const BATCH_SIZES = ["2x4", "3x4", "4x4", "3x6", "4x5", "6x5"];
const batchResults = {};
for (const size of BATCH_SIZES) {
  const f = path.join(DIR, "batch-" + size + "-results.json");
  if (fs.existsSync(f)) batchResults[size] = JSON.parse(fs.readFileSync(f, "utf-8"));
}

// Helper: normalize tile set to a canonical key for comparison
function tileSetKey(tiles) {
  return Object.entries(tiles)
    .filter(([k]) => k.endsWith(".png"))
    .map(([k, v]) => k.replace("-Snake-Tile.png", "") + (v > 1 ? "x" + v : ""))
    .sort()
    .join("_");
}

// Collect existing level tile keys
const existingKeys = {};
for (const lev of EXISTING.levels) {
  const key = tileSetKey(lev.tiles);
  existingKeys[key] = lev;
}

// Basic body tiles
const BASIC_SET = new Set(["SH","ET","UT","RC","LC","DB","HL","VL","LL","LR"]);
function isBasicOnly(tiles) {
  return Object.keys(tiles).every(k => {
    const short = k.replace("-Snake-Tile.png", "");
    return BASIC_SET.has(short);
  });
}

// Separate existing levels into basic and advanced per board size
const boardGroups = {};
for (const lev of EXISTING.levels) {
  const size = lev.board.rows + "x" + lev.board.cols;
  if (!boardGroups[size]) boardGroups[size] = { basic: [], advanced: [] };
  const bucket = isBasicOnly(lev.tiles) ? "basic" : "advanced";
  boardGroups[size][bucket].push(lev);
}

// For each batch result, check if the tile set already exists
const newLevels = {};
for (const [size, batch] of Object.entries(batchResults)) {
  newLevels[size] = [];
  for (const result of batch.results) {
    const key = tileSetKey(result.tiles);
    if (existingKeys[key]) {
      // Already exists - update solution count if batch found more
      continue;
    }
    newLevels[size].push(result);
  }
}

// Report
console.log("=== BATCH INTEGRATION REPORT ===\n");
for (const size of ["2x4", "3x4", "3x6", "4x4", "4x5", "6x5"]) {
  const batch = batchResults[size];
  if (!batch) continue;
  const newCount = newLevels[size] ? newLevels[size].length : 0;
  const existBasic = boardGroups[size] ? boardGroups[size].basic.length : 0;
  const existAdv = boardGroups[size] ? boardGroups[size].advanced.length : 0;
  console.log(size + ":");
  console.log("  Batch found: " + batch.solvableCombos + " solvable combos");
  console.log("  Existing basic levels: " + existBasic);
  console.log("  Existing advanced levels: " + existAdv);
  console.log("  NEW basic levels to add: " + newCount);
  console.log();
}

// Build new levels.json
const allLevels = [];
const SIZE_ORDER = ["2x4", "3x4", "3x6", "4x4", "4x5", "6x5", "6x6"];

for (const size of SIZE_ORDER) {
  const [rows, cols] = size.split("x").map(Number);
  const prefix = BOARD_PREFIX[size] || "X";
  let letter = 0; // 0=A, 1=B, ...

  function nextLetter() {
    let n = letter;
    letter++;
    // A-Z (26), then AA-ZZ (676), then AAA-ZZZ (17576)
    if (n < 26) return String.fromCharCode(65 + n);
    n -= 26;
    if (n < 676) {
      return String.fromCharCode(65 + Math.floor(n / 26))
           + String.fromCharCode(65 + (n % 26));
    }
    n -= 676;
    return String.fromCharCode(65 + Math.floor(n / 676))
         + String.fromCharCode(65 + Math.floor((n % 676) / 26))
         + String.fromCharCode(65 + (n % 26));
  }

  // 1. Add all basic levels (from batch + existing basic)
  const batchForSize = batchResults[size];
  if (batchForSize) {
    for (const result of batchForSize.results) {
      const key = tileSetKey(result.tiles);
      const existing = existingKeys[key];
      const ltr = nextLetter();
      const id = size + "-" + ltr;
      const name = "Fix " + prefix + ltr;
      
      // Determine blockers from batch results or existing level
      const blockers = result.blockers || (batchForSize.blockers) || [];

      if (existing) {
        // Keep existing solution file
        const entry = {
          id, name,
          board: { rows, cols },
          tiles: existing.tiles,
          solvesFile: existing.solvesFile
        };
        if (blockers.length > 0) entry.blockers = blockers;
        allLevels.push(entry);
      } else {
        // New level from batch - rename file
        const oldFile = result.file;
        const newFile = id + ".json";
        const oldPath = path.join(DIR, oldFile);
        const newPath = path.join(DIR, newFile);
        if (fs.existsSync(oldPath)) {
          // Update labels inside
          const data = JSON.parse(fs.readFileSync(oldPath, "utf-8"));
          data.solutions = data.solutions.map((s, i) => ({
            ...s,
            id: "solve-" + (i + 1),
            label: name + " #" + (i + 1) + " - " + (s.placements[0].tile.replace("-Snake-Tile.png","") + "(" + s.placements[0].r + "," + s.placements[0].c + ")d" + s.placements[0].deg)
          }));
          if (blockers.length > 0) data.blockers = blockers;
          fs.writeFileSync(newPath, JSON.stringify(data, null, 2));
        }
        const entry = {
          id, name,
          board: { rows, cols },
          tiles: result.tiles,
          solvesFile: newFile
        };
        if (blockers.length > 0) entry.blockers = blockers;
        allLevels.push(entry);
      }
    }
  } else {
    // No batch for this size - add existing basic levels
    const basics = boardGroups[size] ? boardGroups[size].basic : [];
    for (const lev of basics) {
      const ltr = nextLetter();
      const entry = {
        id: size + "-" + ltr,
        name: "Fix " + prefix + ltr,
        board: lev.board,
        tiles: lev.tiles,
        solvesFile: lev.solvesFile
      };
      if (lev.blockers && lev.blockers.length > 0) entry.blockers = lev.blockers;
      allLevels.push(entry);
    }
  }

  // 2. Add existing basic levels not found in batch results
  if (batchForSize) {
    const batchKeys = new Set(batchForSize.results.map(r => tileSetKey(r.tiles)));
    const extraBasics = boardGroups[size] ? boardGroups[size].basic.filter(lev => !batchKeys.has(tileSetKey(lev.tiles))) : [];
    for (const lev of extraBasics) {
      const ltr = nextLetter();
      const entry = {
        id: size + "-" + ltr,
        name: "Fix " + prefix + ltr,
        board: lev.board,
        tiles: lev.tiles,
        solvesFile: lev.solvesFile
      };
      if (lev.blockers && lev.blockers.length > 0) entry.blockers = lev.blockers;
      allLevels.push(entry);
    }
  }

  // 3. Add all advanced levels
  const advanceds = boardGroups[size] ? boardGroups[size].advanced : [];
  for (const lev of advanceds) {
    const ltr = nextLetter();
    const entry = {
      id: size + "-" + ltr,
      name: "Fix " + prefix + ltr,
      board: lev.board,
      tiles: lev.tiles,
      solvesFile: lev.solvesFile
    };
    if (lev.blockers && lev.blockers.length > 0) entry.blockers = lev.blockers;
    allLevels.push(entry);
  }
}

// Add sandbox at the end
const sandbox = EXISTING.levels.find(l => l.id === "7x6-Sandbox");
if (sandbox) allLevels.push(sandbox);

// Write new levels.json
const output = {
  _comment: "Puzzle level manifest. Basic-tile levels listed first per board size, then advanced-tile variants.",
  levels: allLevels
};

fs.writeFileSync(path.join(DIR, "levels-new.json"), JSON.stringify(output, null, 2));
console.log("Wrote levels-new.json with " + allLevels.length + " total levels");
console.log("(Review before replacing levels.json)");
