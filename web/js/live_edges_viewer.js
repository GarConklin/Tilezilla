/* Live Edge Viewer
   - Loads /data/tiles/tiles-live-edges.json
   - Draws a 2-cell tile (A/B) and shows hotspot dots for live edges
   - Rotations are clockwise: N->E->S->W->N
*/

const ROT_ORDER = ['N', 'E', 'S', 'W'];

function rotateDir(dir, timesCW) {
  const i = ROT_ORDER.indexOf(dir);
  if (i < 0) return dir;
  return ROT_ORDER[(i + timesCW) % 4];
}

function rotName(rot) {
  const r = ((rot % 360) + 360) % 360;
  return r === 0 ? '0°' : r === 90 ? '90°' : r === 180 ? '180°' : '270°';
}

// Tile is 2 squares (A and B) adjacent. At rot 0: A is left, B is right.
// Rotations are clockwise and reposition A/B accordingly.
function squaresForRot(rot) {
  const r = ((rot % 360) + 360) % 360;
  // return squares in board coords: { id:'A'|'B', x, y } where each cell is 1x1
  if (r === 0)   return [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 1, y: 0 }];
  if (r === 90)  return [{ id: 'A', x: 0, y: 1 }, { id: 'B', x: 0, y: 0 }];
  if (r === 180) return [{ id: 'A', x: 1, y: 0 }, { id: 'B', x: 0, y: 0 }];
  // 270
  return [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 0, y: 1 }];
}

function parseLiveEdges(tileDef) {
  // Expected: tileDef.liveEdges like {A:["N","E"], B:["W"]} or {"A":{...}}
  // We'll normalize into {A:Set, B:Set}
  const out = { A: new Set(), B: new Set() };
  if (!tileDef) return out;

  // Common shapes in your project:
  // liveEdges: {A:["N"...], B:[...]}
  // or live: {A:[...],B:[...]}
  // or edges: {A:{N:true},B:{E:true}}
  const src = tileDef.liveEdges || tileDef.live || tileDef.edges || {};

  for (const sq of ['A','B']) {
    const v = src[sq];
    if (!v) continue;

    if (Array.isArray(v)) {
      for (const d of v) out[sq].add(String(d).toUpperCase());
    } else if (typeof v === 'object') {
      for (const [k,val] of Object.entries(v)) {
        if (val) out[sq].add(String(k).toUpperCase());
      }
    }
  }

  return out;
}

function rotateLiveEdges(liveEdges, rot) {
  const timesCW = (((rot % 360) + 360) % 360) / 90;
  return {
    A: new Set([...liveEdges.A].map(d => rotateDir(d, timesCW))),
    B: new Set([...liveEdges.B].map(d => rotateDir(d, timesCW))),
  };
}

function draw(canvas, tileDef, rot) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Layout
  const pad = 18;
  const cell = Math.floor((Math.min(W, H) - pad*2) / 2); // each square
  const originX = Math.floor((W - cell*2) / 2);
  const originY = Math.floor((H - cell*2) / 2);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Grid (2x2 area)
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  ctx.strokeRect(originX, originY, cell*2, cell*2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(originX + cell, originY);
  ctx.lineTo(originX + cell, originY + cell*2);
  ctx.moveTo(originX, originY + cell);
  ctx.lineTo(originX + cell*2, originY + cell);
  ctx.stroke();

  // Draw A/B positions
  const squares = squaresForRot(rot);
  const byId = new Map(squares.map(s => [s.id, s]));

  function cellRect(x, y) {
    return {
      x: originX + x * cell,
      y: originY + y * cell,
      w: cell,
      h: cell,
    };
  }

  // Colors
  function fillSquare(id, r) {
    const {x, y, w, h} = r;
    ctx.fillStyle = id === 'A' ? '#f3f7ff' : '#f7fff3';
    ctx.fillRect(x+1, y+1, w-2, h-2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x+1, y+1, w-2, h-2);

    ctx.fillStyle = '#111';
    ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id, x + w/2, y + h/2);
  }

  fillSquare('A', cellRect(byId.get('A').x, byId.get('A').y));
  fillSquare('B', cellRect(byId.get('B').x, byId.get('B').y));

  // Hotspots
  const baseLive = parseLiveEdges(tileDef);
  const rotatedLive = rotateLiveEdges(baseLive, rot);

  function drawHotspot(id, dir, r) {
    const cx = r.x + r.w/2;
    const cy = r.y + r.h/2;
    const offset = Math.floor(r.w * 0.42);
    let hx = cx, hy = cy;
    if (dir === 'N') hy = r.y + 6;
    if (dir === 'S') hy = r.y + r.h - 6;
    if (dir === 'W') hx = r.x + 6;
    if (dir === 'E') hx = r.x + r.w - 6;

    // little dot
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI*2);
    ctx.fillStyle = id === 'A' ? '#1e64ff' : '#1f8a2b';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (const id of ['A','B']) {
    const pos = byId.get(id);
    const r = cellRect(pos.x, pos.y);
    for (const dir of rotatedLive[id]) drawHotspot(id, dir, r);
  }

  return { baseLive, rotatedLive };
}

async function loadTiles() {
  const res = await fetch('/data/tiles/tiles-live-edges.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load tiles-live-edges.json (${res.status})`);
  const data = await res.json();
  return data;
}

function normalizeTileList(data) {
  // Accept either array of tiles or {tiles:[...]}
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.tiles)) return data.tiles;
  // If it's a dict keyed by id
  if (data && typeof data === 'object') {
    const vals = Object.values(data);
    if (vals.length && typeof vals[0] === 'object') return vals;
  }
  return [];
}

function tileLabel(t) {
  const id = t.id || t.code || t.name || '(unknown)';
  return id;
}

function fmtEdges(set) {
  return [...set].sort().join(',') || '(none)';
}

(async function main() {
  const tileSel = document.getElementById('tileSel');
  const rotSel = document.getElementById('rotSel');
  const canvas = document.getElementById('tileCanvas');
  const debugPre = document.getElementById('debugPre');

  let tiles = [];
  try {
    tiles = normalizeTileList(await loadTiles());
  } catch (e) {
    debugPre.textContent = `ERROR: ${e.message}`;
    return;
  }

  // Populate tile list
  tiles.sort((a,b) => tileLabel(a).localeCompare(tileLabel(b)));
  for (const t of tiles) {
    const opt = document.createElement('option');
    opt.value = tileLabel(t);
    opt.textContent = tileLabel(t);
    tileSel.appendChild(opt);
  }

  if (!tiles.length) {
    debugPre.textContent = 'No tiles found in tiles-live-edges.json';
    return;
  }

  function getSelectedTile() {
    const id = tileSel.value;
    return tiles.find(t => tileLabel(t) === id) || tiles[0];
  }

  function redraw() {
    const t = getSelectedTile();
    const rot = parseInt(rotSel.value, 10) || 0;
    const { baseLive, rotatedLive } = draw(canvas, t, rot);

    const lines = [];
    lines.push(`Tile: ${tileLabel(t)}`);
    lines.push(`Rotation: ${rotName(rot)} (${rot})`);
    lines.push('');
    lines.push('Base live edges (rotation 0°; A left, B right):');
    lines.push(`  A: ${fmtEdges(baseLive.A)}`);
    lines.push(`  B: ${fmtEdges(baseLive.B)}`);
    lines.push('');
    lines.push('Rotated live edges:');
    lines.push(`  A: ${fmtEdges(rotatedLive.A)}`);
    lines.push(`  B: ${fmtEdges(rotatedLive.B)}`);
    debugPre.textContent = lines.join('\n');
  }

  tileSel.value = tileLabel(tiles[0]);
  tileSel.addEventListener('change', redraw);
  rotSel.addEventListener('change', redraw);
  redraw();
})();
