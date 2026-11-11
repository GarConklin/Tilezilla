/**
 * TileZilla solution viewer: steps through a puzzle's solutions (and optional loop boards)
 * drawn with the game's tile art and footprint rules.
 *
 * URL params (paths are URLs on the viewer server, see serve.js):
 *   spec=/inputs/spec.json  solutions=/inputs/solutions.json  [loops=/inputs/loops.json]
 *   [tileset=rainbow-catapiller] [cell=104] [n=1] [mode=loops] [title=...]
 *
 * Tile drawing mirrors web/js/app_v16.js loadImage() -> rotatedDataURL() -> drawTileCanvas()
 * and renderTiles() positioning; validation uses tools/scripts/lib/web-validate-board-node.js.
 */
import {
  applyTileBoardBackground,
  drawBgTileUnderlay,
  getTilesetBgSetup,
  isEnhancedTileBgSetup,
  toTileImgUrl,
} from '/js/tile-bg-setup.js';

const { strictCheck, cellsForTile, tileId } = window.TZStrict;
const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const S = {
  spec: null, rows: 0, cols: 0, cellPx: Number(qs.get('cell')) || 0,
  liveEdges: null, tileSets: null, tileset: null, blockers: new Set(),
  lists: { solutions: [], loops: [] }, mode: 'solutions', idx: 0, showPath: qs.get('path') === '1',
  imgCache: new Map(), rotCache: new Map(), renderSeq: 0,
};

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function loadCommonJs(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', await r.text())(mod, mod.exports, (name) => {
    throw new Error(`${url} needs ${name}`);
  });
  return mod.exports;
}

// ---- Tile art (same steps as the game) ----
function tileCellCount(tile) {
  const shape = S.liveEdges?.[tileId(tile) || tile]?.shape;
  return Array.isArray(shape) && shape.length ? shape.length : 2;
}

function resolveTileAsset(tile, setKey) {
  const id = tileId(tile);
  return S.tileSets?.tilesets?.[setKey]?.[id] || tile;
}

function decode(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img, () => { throw new Error(`Image failed to load: ${src}`); });
}

function loadImage(tile, setKey) {
  const k = `${setKey}|${tile}`;
  if (!S.imgCache.has(k)) S.imgCache.set(k, decode('/img/' + resolveTileAsset(tile, setKey)));
  return S.imgCache.get(k);
}

function loadBgTileImage(setKey) {
  const k = `bg-tile|${setKey}`;
  if (!S.imgCache.has(k)) S.imgCache.set(k, decode(toTileImgUrl(getTilesetBgSetup(S.tileSets, setKey).bgTile)));
  return S.imgCache.get(k);
}

/** Port of rotatedDataURL(): rotated tile art (plus BG-Tile underlay on Enhanced tilesets). */
function rotatedImage(tile, deg, setKey) {
  const r = ((deg % 360) + 360) % 360;
  const k = `${setKey}|${tile}|${r}`;
  if (S.rotCache.has(k)) return S.rotCache.get(k);
  const p = (async () => {
    const img = await loadImage(tile, setKey);
    const srcW = img.naturalWidth, srcH = img.naturalHeight;
    const dstW = r === 90 || r === 270 ? srcH : srcW;
    const dstH = r === 90 || r === 270 ? srcW : srcH;
    const c = document.createElement('canvas');
    c.width = dstW; c.height = dstH;
    const g = c.getContext('2d');
    if (isEnhancedTileBgSetup(S.tileSets, setKey)) {
      drawBgTileUnderlay(g, await loadBgTileImage(setKey), dstW, dstH, r, tileCellCount(tile));
    }
    g.save();
    g.translate(dstW / 2, dstH / 2);
    g.rotate((r * Math.PI) / 180);
    g.drawImage(img, -srcW / 2, -srcH / 2);
    g.restore();
    return decode(c.toDataURL('image/png'));
  })();
  S.rotCache.set(k, p);
  return p;
}

/** Port of boardTilePixelSize(). */
function boardTilePixelSize(tile, deg) {
  const rot = ((deg % 360) + 360) % 360;
  const cell = S.cellPx;
  if (tileCellCount(tile) === 1) return { w: cell, h: cell };
  if (rot === 90 || rot === 270) return { w: cell, h: 2 * cell };
  return { w: 2 * cell, h: cell };
}

// ---- Checks ----
function analyse(placements) {
  const strict = strictCheck({ rows: S.rows, cols: S.cols, liveEdges: S.liveEdges, placements, blockers: S.blockers });
  let game;
  try {
    const level = { pathMode: S.spec.pathMode || 'single', pathCount: S.spec.pathCount };
    game = S.validator.makeCtx(S.rows, S.cols, S.liveEdges, S.spec.tiles, level, S.blockers).validatePlacements(placements);
  } catch (e) {
    game = { ok: false, msg: 'validator error: ' + e.message };
  }
  return { strict, game };
}

function buildRoutes(list) {
  const groups = new Map();
  list.forEach((b, i) => {
    if (!b.strict.ok) return;
    const k = b.strict.order.map(([r, c]) => r + ',' + c).join(';');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  let n = 0;
  for (const members of groups.values()) {
    n++;
    members.forEach((i, j) => Object.assign(list[i], { routeNo: n, variant: j + 1, variants: members.length }));
  }
  return groups.size;
}

// ---- Board ----
function buildBoard() {
  const board = $('board');
  board.style.gridTemplateColumns = `repeat(${S.cols}, var(--cell))`;
  document.documentElement.style.setProperty('--cell', S.cellPx + 'px');
  board.innerHTML = '';
  for (let r = 0; r < S.rows; r++)
    for (let c = 0; c < S.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (S.blockers.has(`${r},${c}`)) cell.style.visibility = 'hidden';
      board.appendChild(cell);
    }
  const ov = $('overlay');
  const dpr = window.devicePixelRatio || 1;
  ov.width = S.cols * S.cellPx * dpr;
  ov.height = S.rows * S.cellPx * dpr;
  ov.style.width = S.cols * S.cellPx + 'px';
  ov.style.height = S.rows * S.cellPx + 'px';
  ov.style.left = ov.style.top = '10px';
}

async function renderBoard(b) {
  const seq = ++S.renderSeq;
  const set = S.tileset;
  const imgs = await Promise.all(b.placements.map((p) => rotatedImage(p.tile, p.deg, set)));
  if (seq !== S.renderSeq) return;
  const board = $('board');
  for (const el of [...board.querySelectorAll('.tile')]) el.remove();
  b.placements.forEach((p, i) => {
    const rot = ((p.deg % 360) + 360) % 360;
    const cells = cellsForTile(S.liveEdges, p.tile, p.r, p.c, rot);
    const rows = cells.map((x) => x[0]), cols = cells.map((x) => x[1]);
    const rMin = Math.min(...rows), rMax = Math.max(...rows), cMin = Math.min(...cols), cMax = Math.max(...cols);
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.tile = p.tile;
    el.style.left = cMin * S.cellPx + 'px';
    el.style.top = rMin * S.cellPx + 'px';
    el.style.width = (cMax - cMin + 1) * S.cellPx + 'px';
    el.style.height = (rMax - rMin + 1) * S.cellPx + 'px';
    const cv = document.createElement('canvas');
    cv.className = 'tileCanvas';
    const { w, h } = boardTilePixelSize(p.tile, rot);
    cv.width = w; cv.height = h;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.getContext('2d').drawImage(imgs[i], 0, 0, w, h);
    el.appendChild(cv);
    board.appendChild(el);
  });
  drawOverlay(b);
}

function drawOverlay(b) {
  const ov = $('overlay');
  const g = ov.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, ov.width, ov.height);
  const cp = S.cellPx;
  const ctr = ([r, c]) => [c * cp + cp / 2, r * cp + cp / 2];

  for (const [r, c] of b.strict.offRoute || []) {
    g.fillStyle = 'rgba(230, 40, 30, 0.38)';
    g.strokeStyle = 'rgba(255, 60, 40, 0.95)';
    g.lineWidth = 4;
    g.fillRect(c * cp + 3, r * cp + 3, cp - 6, cp - 6);
    g.strokeRect(c * cp + 3, r * cp + 3, cp - 6, cp - 6);
  }
  for (const [r, c] of b.strict.badCells || []) {
    g.strokeStyle = 'rgba(255, 200, 0, 0.95)';
    g.lineWidth = 4;
    g.strokeRect(c * cp + 3, r * cp + 3, cp - 6, cp - 6);
  }

  const order = b.strict.order;
  if (!S.showPath || !order) return;
  g.lineJoin = g.lineCap = 'round';
  g.strokeStyle = 'rgba(20, 20, 20, 0.55)';
  g.lineWidth = 7;
  g.beginPath();
  order.forEach((rc, i) => { const [x, y] = ctr(rc); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  g.strokeStyle = 'rgba(255, 230, 120, 0.95)';
  g.lineWidth = 3;
  g.stroke();
  const rad = Math.max(11, cp * 0.17);
  order.forEach((rc, i) => {
    const [x, y] = ctr(rc);
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = i === 0 ? '#2e9d4f' : i === order.length - 1 ? '#b8322a' : 'rgba(15, 15, 15, 0.82)';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#fff3c4';
    g.stroke();
    g.fillStyle = '#fff';
    g.font = `bold ${Math.round(rad * 1.05)}px Segoe UI, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(i + 1), x, y + 1);
  });
}

// ---- Panels ----
function badge(el, ok) {
  el.textContent = ok ? 'PASS' : 'FAIL';
  el.className = 'badge ' + (ok ? 'pass' : 'fail');
}

function renderPanels(b) {
  const list = S.lists[S.mode];
  const loops = S.mode === 'loops';
  $('counter').innerHTML = `${loops ? 'Loop board' : 'Solution'} ${S.idx + 1} <span class="of">/ ${list.length}</span>`;
  badge($('strictBadge'), b.strict.ok);
  $('strictMsg').textContent = '— ' + b.strict.msg;
  badge($('gameBadge'), b.game.ok);
  $('gameMsg').textContent = '— ' + b.game.msg;
  $('route').textContent = b.routeNo
    ? `Same snake: route ${b.routeNo} of ${S.routeCount}, variant ${b.variant} of ${b.variants}` +
      (b.variants > 1 ? ' (same SH→ET cell order, different tiles)' : ' (only board with this snake)')
    : '';
  $('loopNote').textContent = loops
    ? 'Excluded: the game validator accepts this board, but no single SH→ET snake passes through every path cell. ' +
      'Red cells are path cells left off the longest SH→ET route — they close a loop instead of lying on the snake.'
    : '';
  $('bMode').classList.toggle('on', loops);
  $('bPath').classList.toggle('on', S.showPath);

  const placed = {};
  for (const p of b.placements) placed[tileId(p.tile)] = (placed[tileId(p.tile)] || 0) + 1;
  $('bag').innerHTML = '';
  const ids = [...new Set([...Object.keys(S.spec.tiles), ...Object.keys(placed)])].sort();
  for (const id of ids) {
    const need = Number(S.spec.tiles[id] || 0), got = placed[id] || 0;
    const div = document.createElement('div');
    div.className = 'bagItem' + (need !== got ? ' bad' : '');
    const img = document.createElement('img');
    img.src = '/img/' + resolveTileAsset(id, S.tileset);
    img.alt = id;
    const cap = document.createElement('span');
    cap.textContent = `${id} ${got}/${need}`;
    div.append(img, cap);
    $('bag').appendChild(div);
  }

  const rows = b.placements
    .map((p, i) => {
      const cells = cellsForTile(S.liveEdges, p.tile, p.r, p.c, p.deg).map(([r, c]) => `${r},${c}`).join(' ');
      return `<tr><td>${i + 1}. ${p.tile}</td><td>r${p.r}</td><td>c${p.c}</td><td>${p.deg}°</td><td>${cells}</td></tr>`;
    })
    .join('');
  $('placements').innerHTML = `<tr><th>tile</th><th>r</th><th>c</th><th>deg</th><th>cells</th></tr>${rows}`;
}

function renderTotals() {
  const sol = S.lists.solutions, lp = S.lists.loops;
  const cnt = (l, f) => l.filter(f).length;
  const declared = S.solFile.totalUniqueSolutions;
  let html =
    `<b>${S.id}</b> · board ${S.cols}×${S.rows} · tileset ${S.tileset}<br>` +
    `Solutions file: <b>${sol.length}</b> boards` + (declared != null ? ` (file says totalUniqueSolutions = ${declared})` : '') +
    ` · distinct layouts (half-turn fold): <b>${S.distinct}</b><br>` +
    `Game validator PASS <b>${cnt(sol, (b) => b.game.ok)}</b> / ${sol.length} · ` +
    `Strict PASS <b>${cnt(sol, (b) => b.strict.ok)}</b> / ${sol.length} · distinct SH→ET snakes <b>${S.routeCount}</b>`;
  if (S.loopsUrl) {
    html += lp.length
      ? `<br>Loop boards (excluded): <b>${lp.length}</b> · game PASS ${cnt(lp, (b) => b.game.ok)} · strict FAIL ${cnt(lp, (b) => !b.strict.ok)}`
      : '<br>Loop boards file has no boards.';
  } else {
    html += '<br>No loop-boards file given (loops=…), so loop mode is off.';
  }
  $('totals').innerHTML = html;
}

function preloadArt() {
  const combos = new Set();
  for (const list of Object.values(S.lists))
    for (const b of list) for (const p of b.placements) combos.add(`${p.tile}|${((p.deg % 360) + 360) % 360}`);
  return Promise.all([...combos].map((k) => {
    const [tile, deg] = k.split('|');
    return rotatedImage(tile, Number(deg), S.tileset);
  }));
}

function show() {
  const list = S.lists[S.mode];
  if (!list.length) return;
  S.idx = Math.max(0, Math.min(list.length - 1, S.idx));
  const b = list[S.idx];
  renderPanels(b);
  renderBoard(b).catch(fail);
  const u = new URL(location.href);
  u.searchParams.set('n', S.idx + 1);
  u.searchParams.set('mode', S.mode);
  history.replaceState(null, '', u);
}

function go(delta, absolute) {
  const list = S.lists[S.mode];
  S.idx = absolute != null ? absolute : S.idx + delta;
  S.idx = Math.max(0, Math.min(list.length - 1, S.idx));
  show();
}

function toggleMode() {
  if (!S.lists.loops.length) return;
  S.savedIdx = S.savedIdx || { solutions: 0, loops: 0 };
  S.savedIdx[S.mode] = S.idx;
  S.mode = S.mode === 'solutions' ? 'loops' : 'solutions';
  S.idx = S.savedIdx[S.mode] || 0;
  show();
}

function askGo() {
  const list = S.lists[S.mode];
  const v = prompt(`Go to ${S.mode === 'loops' ? 'loop board' : 'solution'} number (1–${list.length}):`, String(S.idx + 1));
  const n = parseInt(v, 10);
  if (Number.isFinite(n)) go(0, n - 1);
}

function togglePath() {
  S.showPath = !S.showPath;
  show();
}

function fail(e) {
  console.error(e);
  $('err').textContent = 'Error: ' + (e?.stack || e);
}

function wire() {
  $('bFirst').onclick = () => go(0, 0);
  $('bLast').onclick = () => go(0, S.lists[S.mode].length - 1);
  $('bPrev').onclick = () => go(-1);
  $('bNext').onclick = () => go(1);
  $('bBack100').onclick = () => go(-100);
  $('bFwd100').onclick = () => go(100);
  $('bGo').onclick = askGo;
  $('bPath').onclick = togglePath;
  $('bMode').onclick = toggleMode;
  $('bMode').disabled = !S.lists.loops.length;
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key;
    if (k === 'ArrowRight') go(1);
    else if (k === 'ArrowLeft') go(-1);
    else if (k === 'PageDown') go(100);
    else if (k === 'PageUp') go(-100);
    else if (k === 'Home') go(0, 0);
    else if (k === 'End') go(0, S.lists[S.mode].length - 1);
    else if (k === 'g' || k === 'G') askGo();
    else if (k === 'p' || k === 'P') togglePath();
    else if (k === 'l' || k === 'L') toggleMode();
    else return;
    e.preventDefault();
  });
  const sel = $('tileset');
  for (const name of Object.keys(S.tileSets.tilesets || {})) {
    const o = document.createElement('option');
    o.value = o.textContent = name;
    sel.appendChild(o);
  }
  sel.value = S.tileset;
  sel.onchange = async () => {
    S.tileset = sel.value;
    sel.blur();
    applyTileBoardBackground(S.tileSets, S.tileset);
    await preloadArt().catch(fail);
    renderTotals();
    show();
  };
}

async function main() {
  const specUrl = qs.get('spec'), solUrl = qs.get('solutions');
  S.loopsUrl = qs.get('loops');
  if (!specUrl || !solUrl) throw new Error('Missing ?spec=...&solutions=... (see tools/viewer/README.md)');
  $('counter').textContent = 'Loading and checking boards…';
  S.spec = await fetchJson(specUrl);
  S.solFile = await fetchJson(solUrl);
  S.rows = S.spec.board.rows;
  S.cols = S.spec.board.cols;
  if (!S.cellPx) {
    const fit = Math.min((window.innerHeight - 150) / S.rows, (window.innerWidth * 0.55 - 30) / S.cols);
    S.cellPx = Math.max(56, Math.min(150, Math.floor(fit)));
  }
  S.id = qs.get('title') || S.spec.id || S.spec.levelId || specUrl;
  document.title = `${S.id} — TileZilla solution viewer`;
  $('title').textContent = `TileZilla solution viewer — ${S.id}`;
  for (const b of S.spec.board.blockers || S.spec.blockers || []) {
    const [r, c] = Array.isArray(b) ? b : [b.r, b.c];
    S.blockers.add(`${r},${c}`);
  }
  [S.liveEdges, S.tileSets, S.validator, S.layoutKey] = await Promise.all([
    fetchJson('/data/tiles/' + (S.spec.tileSet || 'tiles-live-edges.json')),
    fetchJson('/data/tiles/tilesets.json'),
    loadCommonJs('/lib/web-validate-board-node.js'),
    loadCommonJs('/lib/layout-equivalence-key.js'),
  ]);
  const wanted = qs.get('tileset');
  S.tileset = wanted && S.tileSets.tilesets?.[wanted] ? wanted : S.tileSets.activeTileset || Object.keys(S.tileSets.tilesets)[0];
  applyTileBoardBackground(S.tileSets, S.tileset);

  S.lists.solutions = (S.solFile.solutions || []).map((s) => ({ placements: s.placements, id: s.id, ...analyse(s.placements) }));
  if (S.loopsUrl) {
    const lf = await fetchJson(S.loopsUrl);
    S.lists.loops = (lf.solutions || []).map((s) => ({ placements: s.placements, ...analyse(s.placements) }));
  }
  S.routeCount = buildRoutes(S.lists.solutions);
  S.distinct = new Set(S.lists.solutions.map((b) => S.layoutKey.uniqueLayoutKey(b.placements, S.rows, S.cols, S.liveEdges))).size;

  await preloadArt();
  buildBoard();
  wire();
  renderTotals();
  if (qs.get('mode') === 'loops' && S.lists.loops.length) S.mode = 'loops';
  S.idx = (parseInt(qs.get('n'), 10) || 1) - 1;
  show();
  window.__viewer = S;
}

main().catch(fail);
