const fs = require("fs");
const path = require("path");

const OUT_DIR = "./web/cards";
const PHYS_ROWS = 5;
const PHYS_COLS = 6;

function readJson(file) {
  let raw = fs.readFileSync(file, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--context");
  return { contextFile: (idx >= 0 && args[idx + 1]) ? args[idx + 1] : null };
}

function safeFileBase(name) {
  const raw = (name || "").toString().trim();
  const cleaned = raw
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "card";
}

function targetCells(r, c, deg, cellCount = 2) {
  if (cellCount <= 1) return [[r, c]];
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function imageMap(activeTileset) {
  const doc = readJson(path.join(__dirname, "..", "data", "tiles", "tilesets.json"));
  const setName = (activeTileset && doc.tilesets?.[activeTileset]) ? activeTileset : (doc.activeTileset || "gray-backs");
  return doc.tilesets?.[setName] || {};
}

function shapeMap() {
  return readJson(path.join(__dirname, "..", "data", "tiles", "tiles-live-edges.json"));
}

function loadMaskForSize(rows, cols) {
  const size = `${rows}x${cols}`;
  const maskPath = path.join(__dirname, "..", "data", "cards", "masks", `${size}.json`);
  if (!fs.existsSync(maskPath)) return null;
  const doc = readJson(maskPath);
  const placements = Array.isArray(doc?.placements) ? doc.placements : [];
  return placements;
}

function makeGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function fillOutsideWithBlanks(grid, playableMask, imgMap) {
  // Two-pass fill: maximize E2 pairs (horizontal, then vertical), then E1 leftovers.
  const fillerPlacements = [];
  const outside = Array.from({ length: PHYS_ROWS }, () => Array(PHYS_COLS).fill(false));
  for (let r = 0; r < PHYS_ROWS; r++) {
    for (let c = 0; c < PHYS_COLS; c++) {
      outside[r][c] = !playableMask[r][c] && !grid[r][c];
    }
  }

  // Pass 1: horizontal E2
  for (let r = 0; r < PHYS_ROWS; r++) {
    for (let c = 0; c < PHYS_COLS - 1; c++) {
      if (outside[r][c] && outside[r][c + 1]) {
        grid[r][c] = { tile: "E2", deg: 0, img: imgMap.E2 || "E2-Blank-G-Tile.png" };
        grid[r][c + 1] = { tile: "_FILL", deg: 0, img: null };
        fillerPlacements.push({ tile: "E2", r, c, deg: 0 });
        outside[r][c] = false;
        outside[r][c + 1] = false;
        c += 1;
      }
    }
  }

  // Pass 2: vertical E2 for remaining cells
  for (let r = 0; r < PHYS_ROWS - 1; r++) {
    for (let c = 0; c < PHYS_COLS; c++) {
      if (outside[r][c] && outside[r + 1][c]) {
        grid[r][c] = { tile: "E2", deg: 90, img: imgMap.E2 || "E2-Blank-G-Tile.png" };
        grid[r + 1][c] = { tile: "_FILL", deg: 0, img: null };
        fillerPlacements.push({ tile: "E2", r, c, deg: 90 });
        outside[r][c] = false;
        outside[r + 1][c] = false;
      }
    }
  }

  // Pass 3: true leftovers as E1
  for (let r = 0; r < PHYS_ROWS; r++) {
    for (let c = 0; c < PHYS_COLS; c++) {
      if (outside[r][c]) {
        grid[r][c] = { tile: "E1", deg: 0, img: imgMap.E1 || "E1-Blank-G-Tile.png" };
        fillerPlacements.push({ tile: "E1", r, c, deg: 0 });
        outside[r][c] = false;
      }
    }
  }
  return fillerPlacements;
}

const CELL = 60;

/**
 * 2:1 E2 art: treat like drawTileCanvas — in a 2*CELL×CELL (or CELL×2*CELL) box, one rotate(), no
 * combining rotate(90) with 100%×200% "stretch" hacks (that was breaking r:90 in static HTML).
 */
function cellHtmlForTile(t, wPx, hPx) {
  if (!t?.img) return "";
  const d = ((t.deg | 0) % 360 + 360) % 360;
  if (t.tile === "E2") {
    if (d === 0 || d === 180) {
      return (
        `<div class="e2h" style="width:${wPx}px;height:${hPx}px;position:relative;overflow:hidden">` +
        `<img src="../img/${t.img}" alt="E2" style="position:absolute;inset:0;width:100%;height:100%;` +
        `object-fit:cover;transform:rotate(${d}deg);transform-origin:center center"/>` +
        `</div>`
      );
    }
    if (d === 90 || d === 270) {
      return (
        `<div class="e2v" style="width:${wPx}px;height:${hPx}px;position:relative;overflow:hidden">` +
        `<img src="../img/${t.img}" alt="E2" style="position:absolute;left:50%;top:50%;` +
        `width:${2 * wPx}px;height:${wPx}px;margin-left:-${wPx}px;margin-top:-${wPx / 2}px;` +
        `object-fit:cover;transform:rotate(${d}deg);transform-origin:center center"/>` +
        `</div>`
      );
    }
  }
  return (
    `<div class="e1" style="width:${wPx}px;height:${hPx}px;position:relative;overflow:hidden">` +
    `<img src="../img/${t.img}" alt="${t.tile || ""}" style="position:absolute;inset:0;` +
    `width:100%;height:100%;object-fit:cover;transform:rotate(${d}deg);` +
    `transform-origin:center center"/>` +
    `</div>`
  );
}

function renderCard(title, grid, tileStack) {
  const items = [];
  for (let r = 0; r < PHYS_ROWS; r++) {
    for (let c = 0; c < PHYS_COLS; c++) {
      const t = grid[r][c];
      if (t?.tile === "_FILL") continue;

      const w = CELL;
      const h = CELL;
      let colSpan = 1;
      let rowSpan = 1;

      if (t && t.img && t.tile === "E2") {
        const d = ((t.deg | 0) % 360 + 360) % 360;
        if (d === 0 || d === 180) {
          colSpan = 2;
        } else if (d === 90 || d === 270) {
          rowSpan = 2;
        }
      }

      if (!t || !t.img) {
        items.push(
          `<div class="gcell empty" style="grid-row:${r + 1} / span 1;grid-column:${c + 1} / span 1">` +
            `</div>`
        );
        continue;
      }

      const innerW = colSpan * CELL;
      const innerH = rowSpan * CELL;
      const inner = cellHtmlForTile(t, innerW, innerH);
      items.push(
        `<div class="gcell" style="grid-row:${r + 1} / span ${rowSpan};grid-column:${
          c + 1
        } / span ${colSpan}">` +
          inner +
          `</div>`
      );
    }
  }

  const gridHtml = items.join("");

  const stackHtml = tileStack.map((item) => {
    const thumbW = item.cells <= 1 ? 48 : 96;
    const thumbH = 48;
    const stackInner =
      item.cells <= 1
        ? `<div class="stack-1" style="position:relative;width:${thumbW}px;height:${thumbH}px;overflow:hidden">` +
          `<img src="../img/${item.img}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>` +
          `</div>`
        : `<div class="stack-2" style="position:relative;width:${thumbW}px;height:${thumbH}px;overflow:hidden">` +
          `<img src="../img/${item.img}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>` +
          `</div>`;
    return `<div class="stack-item">
      <div class="stack-thumb-outer">${stackInner}</div>
      <div class="stack-meta"><b>${item.tile}</b> &times; ${item.count}</div>
    </div>`;
  }).join("");

  return `<html>
<head>
<meta charset="utf-8">
<style>
body{font-family:Arial}
.wrap{display:flex;gap:20px;align-items:flex-start}
.grid{
  display:grid;
  grid-template-columns: repeat(${PHYS_COLS}, ${CELL}px);
  grid-template-rows: repeat(${PHYS_ROWS}, ${CELL}px);
  gap:0;
  border:3px solid #8345ff;
  padding:4px;
  background:#8345ff
}
.gcell{box-sizing:border-box;border:1px solid #ccc;overflow:hidden;background:#fff;position:relative}
.gcell.empty{background:#efe7ff}
.stack{min-width:220px;max-width:320px;border:1px solid #ccc;border-radius:8px;padding:10px}
.stack h4{margin:0 0 8px 0}
.stack-item{display:flex;gap:10px;align-items:center;margin:6px 0}
.stack-thumb-outer{border:1px solid #ddd;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden}
</style>
</head>
<body>
<h3>${title}</h3>
<div class="wrap">
  <div class="grid">${gridHtml}</div>
  <div class="stack">
    <h4>Tiles Needed</h4>
    ${stackHtml}
  </div>
</div>
</body>
</html>`;
}

function run() {
  const args = parseArgs();
  const context = args.contextFile ? readJson(args.contextFile) : {};
  const rows = Number(context?.board?.rows || 0);
  const cols = Number(context?.board?.cols || 0);
  if (!rows || !cols) throw new Error("Missing board.rows/board.cols in card context");

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const imgMap = imageMap(context.activeTileset || "gray-backs");
  const shapes = shapeMap();
  const grid = makeGrid(PHYS_ROWS, PHYS_COLS);
  const playableMask = Array.from({ length: PHYS_ROWS }, () => Array(PHYS_COLS).fill(false));

  const offR = Math.floor((PHYS_ROWS - rows) / 2);
  const offC = Math.floor((PHYS_COLS - cols) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rr = offR + r, cc = offC + c;
      if (rr >= 0 && rr < PHYS_ROWS && cc >= 0 && cc < PHYS_COLS) playableMask[rr][cc] = true;
    }
  }

  const placements = Array.isArray(context.placements) ? context.placements : [];
  // Intentionally do NOT paint puzzle tiles on the board layer.
  // Board should only show blank-mask tiles (E2/E1). Puzzle tiles are listed in tile stack.

  let fillerPlacements = [];
  const maskPlacements = loadMaskForSize(rows, cols);
  if (maskPlacements && maskPlacements.length) {
    for (const p of maskPlacements) {
      const tile = p?.tile;
      if (!tile) continue;
      const count = Array.isArray(shapes?.[tile]?.shape) ? shapes[tile].shape.length : 2;
      const cells = targetCells(p.r | 0, p.c | 0, p.deg | 0, count);
      if (cells.length > 0) {
        const [ar, ac] = cells[0];
        if (ar >= 0 && ar < PHYS_ROWS && ac >= 0 && ac < PHYS_COLS) {
          grid[ar][ac] = { tile, deg: p.deg | 0, img: imgMap[tile] || `${tile}.png` };
        }
      }
      for (let i = 1; i < cells.length; i++) {
        const [rr, cc] = cells[i];
        if (rr < 0 || rr >= PHYS_ROWS || cc < 0 || cc >= PHYS_COLS) continue;
        grid[rr][cc] = { tile: "_FILL", deg: 0, img: null };
      }
      fillerPlacements.push({ tile, r: p.r | 0, c: p.c | 0, deg: p.deg | 0 });
    }
  } else {
    fillerPlacements = fillOutsideWithBlanks(grid, playableMask, imgMap);
  }

  const tileCounts = new Map();
  const inv = context.levelTiles || context.tiles;
  if (inv && typeof inv === "object" && Object.keys(inv).length) {
    for (const [tile, n] of Object.entries(inv)) {
      const c = Number(n) || 0;
      if (c > 0 && tile) tileCounts.set(tile, c);
    }
  } else {
    for (const p of placements) {
      const tile = p?.tile;
      if (!tile) continue;
      tileCounts.set(tile, (tileCounts.get(tile) || 0) + 1);
    }
  }
  for (const p of fillerPlacements) {
    const tile = p?.tile;
    if (!tile) continue;
    tileCounts.set(tile, (tileCounts.get(tile) || 0) + 1);
  }
  const tileStack = [...tileCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tile, count]) => {
      const cells = Array.isArray(shapes?.[tile]?.shape) ? shapes[tile].shape.length : 2;
      return { tile, count, cells, img: imgMap[tile] || `${tile}.png` };
    });

  const title = context.levelName || context.levelId || "Puzzle Card";
  const base = safeFileBase(context.levelId || title);
  let outName = `${base}.html`;
  let outPath = path.join(OUT_DIR, outName);
  if (fs.existsSync(outPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    outName = `${base}-${stamp}.html`;
    outPath = path.join(OUT_DIR, outName);
  }

  fs.writeFileSync(outPath, renderCard(title, grid, tileStack));

  const cardFiles = fs.readdirSync(OUT_DIR)
    .filter(f => f.toLowerCase().endsWith(".html") && f.toLowerCase() !== "index.html")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const links = cardFiles.map(f => `<li><a href="/cards/${f}">${f}</a></li>`).join("");
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), `<html><body><h3>Cards</h3><ul>${links}</ul></body></html>`);
  console.log(`Generated 1 card: ${outName}`);
}

run();

