import { Solver } from './solver.js';
import { Solutions } from './solutions.js';
import { Progress } from './progress.js';
import { isDevUser, syncDevUserUi } from './tilezilla-dev-user.js';

const CONFIG = {
  rows: 6,
  cols: 5,
  cellPx: 80,
  liveEdgesUrl: '/data/tiles/tiles-live-edges.json',
  tileSetsUrl: '/data/tiles/tilesets.json',
  /** Red live-edge overlay on tiles (visual debug). Validation still uses edge data. */
  showLiveEdges: false,
  hintsPerPuzzle: 2,
};


// Debug: known completion for solution #3 (includes missing VL)
const DEBUG_SOLVE_WITH_VL = [
  {
    "tile": "ET-Snake-G-Tile.png",
    "r": 0,
    "c": 4,
    "deg": 90
  },
  {
    "tile": "SH-Snake-G-Tile.png",
    "r": 0,
    "c": 0,
    "deg": 0
  },
  {
    "tile": "UT-Snake-G-Tile.png",
    "r": 2,
    "c": 4,
    "deg": 90
  },
  {
    "tile": "LC-Snake-G-Tile.png",
    "r": 2,
    "c": 2,
    "deg": 0
  },
  {
    "tile": "LC-Snake-G-Tile.png",
    "r": 0,
    "c": 3,
    "deg": 90
  },
  {
    "tile": "UT-Snake-G-Tile.png",
    "r": 4,
    "c": 4,
    "deg": 90
  },
  {
    "tile": "UT-Snake-G-Tile.png",
    "r": 4,
    "c": 3,
    "deg": 270
  },
  {
    "tile": "HL-Snake-G-Tile.png",
    "r": 5,
    "c": 2,
    "deg": 0
  },
  {
    "tile": "DB-Snake-G-Tile.png",
    "r": 4,
    "c": 1,
    "deg": 90
  },
  {
    "tile": "UT-Snake-G-Tile.png",
    "r": 3,
    "c": 2,
    "deg": 90
  },
  {
    "tile": "UT-Snake-G-Tile.png",
    "r": 5,
    "c": 0,
    "deg": 270
  },
  {
    "tile": "LL-Snake-G-Tile.png",
    "r": 1,
    "c": 0,
    "deg": 0
  },
  {
    "tile": "LR-Snake-G-Tile.png",
    "r": 3,
    "c": 0,
    "deg": 0
  },
  {
    "tile": "UT-Snake-G-Tile.png",
    "r": 0,
    "c": 2,
    "deg": 90
  },
  {
    "tile": "VL-Snake-G-Tile.png",
    "r": 2,
    "c": 0,
    "deg": 0
  }
];

const OPP = { N:'S', S:'N', E:'W', W:'E' };
const boardEl = document.getElementById('board');
const paletteEl = document.getElementById('palette');
const hoverCanvas = document.getElementById('hoverOverlay');
const liveValidationCanvas = document.getElementById('liveValidationOverlay');
const rotHud = document.getElementById('rotHud');
const sizeHud = document.getElementById('sizeHud');
const cellHud = document.getElementById('cellHud');
const progressHud = document.getElementById('progressHud');
const userSelect = document.getElementById('userSelect');
const boardSizeSelect = document.getElementById('boardSizeSelect');
const tierSelect = document.getElementById('tierSelect');
const levelSelect = document.getElementById('levelSelect');
const levelHud = document.getElementById('levelHud');
const loadingHud = document.getElementById('loadingHud');
const blockerHud = document.getElementById('blockerHud');
const toggleBlockerBtn = document.getElementById('toggleBlockerBtn');
const checkSolBtn = document.getElementById('checkSolBtn');
const checkMsg = document.getElementById('checkMsg');
const foundStatus = document.getElementById('foundStatus');
const foundList = document.getElementById('foundList');
const viewFoundBtn = document.getElementById('viewFoundBtn');
const approveReviewBtn = document.getElementById('approveReviewBtn');
const boardToolsPanel = document.getElementById('boardToolsPanel');
const loadSolveDocBtn = document.getElementById('loadSolveDocBtn');
const resetLevelBtn = document.getElementById('resetLevelBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const exportProgressBtn = document.getElementById('exportProgressBtn');
const importProgressBtn = document.getElementById('importProgressBtn');
const importProgressFile = document.getElementById('importProgressFile');

const activePad = document.getElementById('activePad');
const activeImg = document.getElementById('activeImg');
const activeEmpty = document.getElementById('activeEmpty');
const keepPreviewChk = document.getElementById('keepPreviewChk');
const deleteBtn = document.getElementById('deleteBtn');
const debugSection = document.getElementById('debugSection');
const debugToggle = document.getElementById('debugToggle');

// Some older zips/layouts placed the Active Tile Preview panel inside the right sidebar.
// Guarantee the visual order is: Palette/Tools | Active Preview | Board.
function ensurePreviewColumn(){
  const layout = document.querySelector('main.layout');
  if(!layout || !activePad) return;

  // Find the preview panel (the .panel that contains #activePad)
  const previewPanel = activePad.closest('.panel');
  if(!previewPanel) return;

  // Find the right sidebar (palette/tools column)
  const sidePane = layout.querySelector('.sidePane');
  if(!sidePane) return;

  // Ensure there is a dedicated preview column node between side and board panes
  let previewPane = layout.querySelector('.previewPane');
  if(!previewPane){
    previewPane = document.createElement('aside');
    previewPane.className = 'previewPane';

    // Insert after the side pane so it becomes the middle column
    layout.insertBefore(previewPane, sidePane.nextSibling);
  }

  // If the preview panel currently lives inside the sidebar, move it.
  if(previewPanel.parentElement !== previewPane){
    previewPane.appendChild(previewPanel);
  }

  // Make sure the layout is 3 columns even if older CSS was 2 columns.
  // Sidebar | Preview | Board
  layout.style.gridTemplateColumns = '360px 240px 1fr';
}

ensurePreviewColumn();

const state = {
  tiles: [],            // placed tile objects: {id,tile,r,c,deg}
  occ: [],              // occupancy per cell boolean
  used: new Set(),      // instanceIds used on board (tileName#n)
  selectedPal: null,    // tile name selected from palette (placement-ready)
  previewTile: null,     // tile name shown in Active Tile Preview
  keepPreview: false,    // keep preview after placement
  selectedTileId: null, // id of placed tile selected
  deg: 0,               // current rotation for placement / selected tile
  showEdges: false,
  liveEdgeValidation: false,
  showTileBorders: true,
  usedTileBehavior: 'REMOVE',
  tileList: [],
  liveEdges: {},
  tileSets: null,
  activeTileset: 'gray-backs',
  tileAssetById: {},
  allLevels: null,
  levelBuckets: null, // [{size,tier,file,count}]
  currentLevel: null,
  levelTileCounts: null,
  imgCache: new Map(),  // key: tileName -> HTMLImageElement
  rotatedCache: new Map(), // key: tileName|deg -> dataURL
  blockerCells: new Set(), // keys: 'r,c'
  blockerTypeByCell: new Map(), // key: 'r,c' -> tile id (B1/B2)
  /** Fixed blockers as placements — anchor r,c,deg like playable tiles. */
  blockerPlacements: [],
  blockerEditMode: false, // toolbar: click cells to place/remove blockers (sandbox only)
  foundListEntries: [], // [{label, placements, kind}]
  hintsUsedThisPuzzle: 0,
  hintTokens: 18,
  userId: 'gar',
  lastLoadedSolveDoc: null,
  /** levelId -> count from loaded solve file (authoritative vs level.totalUniqueSolutions) */
  solutionCountByLevelId: {},
};

function getFoundCountForLevel(level){
  if(!progress || !level?.id) return 0;
  return progress.getFoundForLevel(level.id).length;
}

/** Same denominator rules as the level dropdown (solve-file cache, else level.totalUniqueSolutions). */
function levelHasKnownTotal(lev){
  if(!lev?.id) return false;
  const c = state.solutionCountByLevelId[lev.id];
  if(Number.isFinite(c) && c >= 0) return true;
  const lib = Number(lev.totalUniqueSolutions);
  if(Number.isFinite(lib) && lib > 0) return true;
  return false;
}

function updateProgressHud(level){
  if(!progressHud) return;
  const lv = level || state.currentLevel;
  if(!lv){
    progressHud.textContent = '0 / ?';
    return;
  }
  const found = getFoundCountForLevel(lv);
  if(!levelHasKnownTotal(lv)){
    progressHud.textContent = `${found} / ?`;
    return;
  }
  const total = totalKnownForLevel(lv);
  progressHud.textContent = `${Math.min(found, total)} / ${total}`;
}

function setCheckMessage(msg, kind='checkWarn'){
  if(!checkMsg) return;
  checkMsg.textContent = msg || '';
  checkMsg.className = `checkMsg ${kind}`;
}

function currentPortablePlacements(){
  return (state.tiles || []).map(t => ({
    tile: tileId(t.tile) || t.tile,
    r: t.r|0,
    c: t.c|0,
    deg: t.deg|0,
  }));
}

function isAdminUser() {
  return isDevUser(state.userId);
}

function syncAdminUi() {
  const admin = isAdminUser();
  if(approveReviewBtn){
    approveReviewBtn.style.display = admin ? '' : 'none';
    approveReviewBtn.disabled = !admin;
  }
  if(boardToolsPanel){
    boardToolsPanel.style.display = admin ? '' : 'none';
  }
}

const APPROVED_REVIEW_IDS_KEY = 'snake_review_approved_ids_v1';
function getApprovedReviewIds(){
  try{
    const raw = localStorage.getItem(APPROVED_REVIEW_IDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(x => typeof x === 'string' && x) : [];
  }catch(_e){
    return [];
  }
}

function setApprovedReviewIds(ids){
  try{
    localStorage.setItem(APPROVED_REVIEW_IDS_KEY, JSON.stringify(ids || []));
  }catch(_e){}
}

function renderFoundList(levelId, knownSolutions=[]){
  if(!progress || !foundList || !foundStatus) return;
  const found = progress.getFoundForLevel(levelId);
  foundList.innerHTML = '';
  state.foundListEntries = [];

  // Admin can see all known solves; regular users only see what they found.
  if(isAdminUser()){
    for(let i=0;i<knownSolutions.length;i++){
      const k = knownSolutions[i];
      const opt = document.createElement('option');
      opt.value = String(state.foundListEntries.length);
      opt.textContent = `Known #${i+1}`;
      foundList.appendChild(opt);
      state.foundListEntries.push({
        label: `Known #${i+1}`,
        kind: 'known',
        placements: Array.isArray(k?.placements) ? k.placements : [],
      });
    }
  }

  for(let i=0;i<found.length;i++){
    const f = found[i];
    const opt = document.createElement('option');
    const label = f.bonus ? `Found Bonus ${i+1}` : `Found #${(Number.isFinite(f.index) ? f.index + 1 : '?')}`;
    opt.value = String(state.foundListEntries.length);
    opt.textContent = label;
    foundList.appendChild(opt);
    state.foundListEntries.push({
      label,
      kind: f.bonus ? 'bonus' : 'found',
      placements: Array.isArray(f?.placements) ? f.placements : [],
    });
  }

  if(state.foundListEntries.length){
    foundList.value = '0';
  }

  if(!state.foundListEntries.length){
    foundStatus.textContent = isAdminUser()
      ? 'No known/found solutions for this level yet.'
      : 'No found solutions for this user yet.';
  }else{
    const known = knownSolutions.length;
    const bonus = found.filter(x => x?.bonus).length;
    foundStatus.textContent = isAdminUser()
      ? `Known ${known} • Found ${found.length}${bonus ? ` (${bonus} bonus)` : ''}`
      : `Found ${found.length}${bonus ? ` (${bonus} bonus)` : ''}`;
  }
  updateProgressHud(state.currentLevel);
}



function idx(r,c){ return r*CONFIG.cols + c; }
function inBounds(r,c){ return r>=0 && r<CONFIG.rows && c>=0 && c<CONFIG.cols; }
function cellKey(r,c){ return `${r},${c}`; }

function tileId(tileRef){
  if(!tileRef || typeof tileRef !== 'string') return '';
  const head = tileRef.split('#')[0].split('-')[0];
  return /^[A-Z0-9]{2,3}$/.test(head) ? head : '';
}

function resolveTileKey(tileRef){
  const id = tileId(tileRef);
  if(id && state.liveEdges?.[id]) return id;
  const raw = (typeof tileRef === 'string') ? tileRef.split('#')[0] : tileRef;
  if(raw && state.liveEdges?.[raw]) return raw;
  return id || raw || tileRef;
}

function isBlockerTile(tileRef){
  const id = tileId(tileRef);
  return id === 'B1' || id === 'B2' || id === 'SB';
}

function parseBlockerEntry(raw, defaultType = 'B1') {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const r = Number(raw[0]);
  const c = Number(raw[1]);
  if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
  const tile = (typeof raw[2] === 'string' && raw[2]) ? raw[2] : defaultType;
  const deg = raw.length >= 4 ? (Number(raw[3]) || 0) : 0;
  return {
    tile,
    r: r | 0,
    c: c | 0,
    deg: ((deg % 360) + 360) % 360,
  };
}

function resetBlockerState() {
  state.blockerCells = new Set();
  state.blockerTypeByCell = new Map();
  state.blockerPlacements = [];
}

function addBlockerPlacement({ tile, r, c, deg = 0 }) {
  const bt = tile || 'B1';
  const rot = ((deg % 360) + 360) % 360;
  const cells = cellsForTile(bt, r, c, rot);
  if (!cells.length) return;
  for (const [rr, cc] of cells) {
    const ck = cellKey(rr, cc);
    state.blockerCells.add(ck);
    state.blockerTypeByCell.set(ck, bt);
  }
  state.blockerPlacements.push({ tile: bt, r, c, deg: rot });
}

function blockerAtAnchor(r, c) {
  return (state.blockerPlacements || []).find((bp) => bp.r === r && bp.c === c) || null;
}

function isSandboxLevel(){
  const id = state.currentLevel?.id || '';
  const name = state.currentLevel?.name || '';
  return (
    /sandbox/i.test(id) ||
    /sandbox/i.test(name) ||
    /-ZZZ$/i.test(id)
  );
}

function syncBlockerToolbar(){
  const sandbox = isSandboxLevel();
  if(toggleBlockerBtn){
    toggleBlockerBtn.hidden = !sandbox;
    toggleBlockerBtn.disabled = !sandbox;
    if(!sandbox){
      state.blockerEditMode = false;
      toggleBlockerBtn.classList.remove('active');
    }
  }
}

if(toggleBlockerBtn) toggleBlockerBtn.hidden = true;

function setBlockerEditMode(on){
  state.blockerEditMode = !!on;
  if(toggleBlockerBtn){
    toggleBlockerBtn.classList.toggle('active', state.blockerEditMode);
  }
}

function toggleBlockerAtCell(r, c){
  const ck = cellKey(r, c);
  if(occ && occ[idx(r, c)] != null){
    status(`Cannot set blocker on occupied cell (${r},${c})`);
    return false;
  }
  if(state.blockerCells.has(ck)){
    const anchor = blockerAtAnchor(r, c)
      || (state.blockerPlacements || []).find((bp) =>
        cellsForTile(bp.tile, bp.r, bp.c, bp.deg).some(([rr, cc]) => cellKey(rr, cc) === ck));
    if (anchor) {
      for (const [rr, cc] of cellsForTile(anchor.tile, anchor.r, anchor.c, anchor.deg)) {
        const k = cellKey(rr, cc);
        state.blockerCells.delete(k);
        state.blockerTypeByCell.delete(k);
      }
      state.blockerPlacements = (state.blockerPlacements || []).filter((bp) => bp !== anchor);
    } else {
      state.blockerCells.delete(ck);
      state.blockerTypeByCell.delete(ck);
    }
    status(`Removed blocker at (${r},${c})`);
  }else{
    addBlockerPlacement({ tile: 'B1', r, c, deg: 0 });
    status(`Blocker at (${r},${c})`);
  }
  return true;
}

function resolveTileAsset(tileRef, tilesetName){
  if(!tileRef || typeof tileRef !== 'string') return tileRef;
  const raw = tileRef.split('#')[0];
  const id = tileId(raw);
  if(id){
    const setKey = tilesetName || state.activeTileset;
    const bySet = state.tileSets?.tilesets?.[setKey]?.[id];
    if(bySet) return bySet;
  }
  // If already an image filename, keep it as-is.
  if(raw.includes('.png')) return raw;
  return raw;
}

function normalizeLevelTiles(tilesObj){
  const out = {};
  if(!tilesObj || typeof tilesObj !== 'object') return out;
  for(const [name, count] of Object.entries(tilesObj)){
    const id = resolveTileKey(name);
    out[id] = (out[id] || 0) + (Number(count) || 0);
  }
  return out;
}

// ===== Occupancy (single source of truth) =====
// occ[k] = null OR tileId
let occ = Array(CONFIG.rows * CONFIG.cols).fill(null);
function occIdx(r, c) { return r * CONFIG.cols + c; }

function claimCells(tileId, cells) {
  for (const [r, c] of cells) occ[occIdx(r, c)] = tileId;
}

function clearTileFromOcc(tileId) {
  for (let k = 0; k < occ.length; k++) if (occ[k] === tileId) occ[k] = null;
}

// For a brand new tile (not yet in state.tiles)
function canPlaceNew(newR, newC, newDeg, tileRef=null) {
  const cells = cellsForTile(tileRef || state.previewTile || state.selectedPal, newR, newC, newDeg);
  for (const [r, c] of cells) {
    if (!inBounds(r, c)) return false;
    if (state.blockerCells.has(cellKey(r,c))) return false;
    if (occ[occIdx(r, c)] !== null) return false;
  }
  return true;
}

// Update an existing tile atomically. Returns true if committed.
function updateTilePlacement(tileId, newR, newC, newDeg) {
  const t = state.tiles.find(x => x.id === tileId);
  if (!t) return false;

  const oldCells = cellsForTile(t.tile, t.r, t.c, t.deg);
  const newCells = cellsForTile(t.tile, newR, newC, newDeg);

  // Free old claim
  for (const [r, c] of oldCells) {
    if (inBounds(r, c)) occ[occIdx(r, c)] = null;
  }

  // Validate new
  for (const [r, c] of newCells) {
    if (!inBounds(r, c)) {
      for (const [rr, cc] of oldCells) if (inBounds(rr, cc)) occ[occIdx(rr, cc)] = tileId;
      return false;
    }
    const k = occIdx(r, c);
    if (occ[k] !== null && occ[k] !== tileId) {
      for (const [rr, cc] of oldCells) if (inBounds(rr, cc)) occ[occIdx(rr, cc)] = tileId;
      return false;
    }
  }

  // Commit new
  claimCells(tileId, newCells);
  t.r = newR; t.c = newC; t.deg = newDeg;
  return true;
}

function removeTileById(tileId) {
  const i = state.tiles.findIndex(t => t.id === tileId);
  if (i === -1) return null;
  const t = state.tiles[i];
  if (isHintTile(t)) return null;
  state.tiles.splice(i, 1);
  clearTileFromOcc(tileId);

  state.used.delete(t.instanceId);
  setPaletteUsed(t.instanceId, false);
  return t;
}

function rebuildOccFromTiles() {
  const dbg = window.__OCC_DEBUG;
  if (dbg?.enabled) console.groupCollapsed(`rebuildOccFromTiles(${state.tiles.length})`);
  occ = Array(CONFIG.rows * CONFIG.cols).fill(null);
  for (const t of state.tiles) {
    if (dbg?.enabled) console.log('tile', t.id, t.tile, { r:t.r, c:t.c, deg:t.deg });
    if (dbg?.enabled && dbg.breakOnTile) debugger;
    for (const [r, c] of cellsForTile(t.tile, t.r, t.c, t.deg)) {
      if (!inBounds(r, c)) continue;
      const k = occIdx(r, c);
      if (occ[k] !== null) console.warn("Overlap in state.tiles at", r, c);
      occ[k] = t.id;
      if (dbg?.enabled) console.log('  cell', { r, c, idx:k }, '=>', t.id);
      if (dbg?.enabled && dbg.breakOnCell) debugger;
    }
  }
  if (dbg?.enabled) console.groupEnd();
}

function setCssCell(){
  document.documentElement.style.setProperty('--cell', CONFIG.cellPx + 'px');
  if(sizeHud) sizeHud.textContent = displayDimsForBoard(CONFIG.rows, CONFIG.cols);
  if(cellHud) cellHud.textContent = `${CONFIG.cellPx}px`;
}
if (document.querySelector('.tz-app')) {
  CONFIG.cellPx = 55;
}
setCssCell();

// UI defaults
if(keepPreviewChk) {
  keepPreviewChk.checked = false; // default OFF
  keepPreviewChk.addEventListener('change', () => { state.keepPreview = !!keepPreviewChk.checked; });
}

if(debugSection && debugToggle){
  debugToggle.addEventListener('click', () => {
    const open = debugSection.classList.toggle('expanded');
    debugSection.classList.toggle('collapsed', !open);
    debugToggle.textContent = open ? ' Debug Tools' : ' Debug Tools';
  });
}


function buildGrid(){
  boardEl.innerHTML='';
  boardEl.style.gridTemplateColumns = `repeat(${CONFIG.cols}, var(--cell))`;
  boardEl.style.gridTemplateRows = `repeat(${CONFIG.rows}, var(--cell))`;
  for(let r=0;r<CONFIG.rows;r++){
    for(let c=0;c<CONFIG.cols;c++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.r=r; cell.dataset.c=c;
      const ck = cellKey(r,c);
      if(state.blockerCells.has(ck)){
        cell.classList.add('blocked');
        const anchor = blockerAtAnchor(r, c);
        if (anchor && tileCellCount(anchor.tile) === 1) {
          const blockerAsset = resolveTileAsset(anchor.tile);
          cell.style.backgroundImage = `url('/img/${blockerAsset}')`;
        }
      }
      boardEl.appendChild(cell);
    }
  }
  // overlay size
  hoverCanvas.width = CONFIG.cols*CONFIG.cellPx;
  hoverCanvas.height = CONFIG.rows*CONFIG.cellPx;
  hoverCanvas.style.width = hoverCanvas.width+'px';
  hoverCanvas.style.height = hoverCanvas.height+'px';
  if (liveValidationCanvas) {
    liveValidationCanvas.width = CONFIG.cols * CONFIG.cellPx;
    liveValidationCanvas.height = CONFIG.rows * CONFIG.cellPx;
    liveValidationCanvas.style.width = liveValidationCanvas.width + 'px';
    liveValidationCanvas.style.height = liveValidationCanvas.height + 'px';
  }
}
if (boardEl && hoverCanvas) buildGrid();

function fatal(err){
  console.error(err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;padding:10px 12px;background:#fff;border:2px solid #c00;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.15);z-index:9999;font-family:system-ui;';
  el.innerHTML = '<b style="color:#c00">App error:</b> <span style="white-space:pre-wrap"></span>';
  el.querySelector('span').textContent = (err && err.stack) ? err.stack : String(err);
  document.body.appendChild(el);
}


function logSolver(msg){ solver.log(msg); } // wired after solver init

// ---- Image rotation (canvas) ----
async function loadImage(tileName, tilesetName){
  const cacheKey = tilesetName ? `${tilesetName}|${tileName}` : tileName;
  if(state.imgCache.has(cacheKey)) return state.imgCache.get(cacheKey);
  const img = new Image();
  img.src = 'img/' + resolveTileAsset(tileName, tilesetName);
  try {
    await img.decode();
  } catch (e) {
    throw new Error(`Tile image failed to load: ${tileName} (${img.src})`);
  }
  state.imgCache.set(cacheKey, img);
  return img;
}

async function rotatedDataURL(tileName, deg, tilesetName){
  const key = tilesetName ? `${tilesetName}|${tileName}|${deg}` : `${tileName}|${deg}`;
  if(state.rotatedCache.has(key)) return state.rotatedCache.get(key);
  const img = await loadImage(tileName, tilesetName);

  // Source is a 2x1 image. Normalize to that ratio.
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const r = ((deg%360)+360)%360;
  const dstW = (r===90||r===270) ? srcH : srcW;
  const dstH = (r===90||r===270) ? srcW : srcH;

  const c = document.createElement('canvas');
  c.width = dstW; c.height = dstH;
  const g = c.getContext('2d');

  g.translate(dstW/2, dstH/2);
  g.rotate(r*Math.PI/180);
  g.drawImage(img, -srcW/2, -srcH/2);

  const url = c.toDataURL('image/png');
  state.rotatedCache.set(key, url);
  return url;
}

function rotName(deg){
  const r=((deg%360)+360)%360;
  return r===0?'r0':r===90?'r90':r===180?'r180':'r270';
}

// ---- Live edges overlay ----
function edgesFor(tileName, deg, which){
  const rn = rotName(deg);
  const tk = resolveTileKey(tileName);
  return state.liveEdges?.[tk]?.[rn]?.[which] || [];
}

function pathSpecsForPlacement(tileName, deg){
  const rn = rotName(deg);
  const tk = resolveTileKey(tileName);
  return state.liveEdges?.[tk]?.[rn]?.paths;
}

// One paths[] entry connects exactly two boundary ports: ends = [[cell,dir],[cell,dir]].
function parsePathEnds(pathObj){
  const ends = pathObj?.ends;
  if(!Array.isArray(ends) || ends.length !== 2) return null;
  const p0 = ends[0];
  const p1 = ends[1];
  if(!Array.isArray(p0) || !Array.isArray(p1) || p0.length < 2 || p1.length < 2) return null;
  const want = { A: new Set(), B: new Set() };
  const c0 = p0[0], d0 = p0[1];
  const c1 = p1[0], d1 = p1[1];
  if((c0 === 'A' || c0 === 'B') && typeof d0 === 'string') want[c0].add(d0);
  if((c1 === 'A' || c1 === 'B') && typeof d1 === 'string') want[c1].add(d1);
  return want;
}

// Tile-internal A<->B adjacency is used when a route jumps between halves (e.g. CT/CQ), not for CR-style intra-cell ports.
function pathUsesBothHalves(pathObj){
  const ends = pathObj?.ends;
  if(!Array.isArray(ends) || ends.length !== 2) return false;
  const p0 = ends[0];
  const p1 = ends[1];
  if(!Array.isArray(p0) || !Array.isArray(p1) || !p0.length || !p1.length) return false;
  return (p0[0] === 'A' && p1[0] === 'B') || (p0[0] === 'B' && p1[0] === 'A');
}

function tileInternallyLinksHalves(tileRef, specs, pathPick, placedId, expectedPathCount, placed){
  const id = tileId(tileRef);
  const ctLike = id === 'CT' || id === 'CQ';

  if(expectedPathCount > 1){
    if(!ctLike) return true;
    const t = placed.find(x => x.id === placedId);
    if(!t) return true;
    const rot = ((t.deg % 360) + 360) % 360;
    const cells = cellsForTile(t.tile, t.r, t.c, rot);
    if(cells.length < 2) return true;
    const i0 = idx(cells[0][0], cells[0][1]);
    const i1 = idx(cells[1][0], cells[1][1]);
    const e0 = edgesFor(t.tile, rot, 'A').length;
    const e1 = edgesFor(t.tile, rot, 'B').length;
    // CT/CQ crossovers bridge both halves whenever both sides expose live edges.
    return e0 > 0 && e1 > 0;
  }

  if(Array.isArray(specs) && specs.length){
    const pi = pathPick.has(placedId) ? pathPick.get(placedId) : 0;
    const crosses = pathUsesBothHalves(specs[pi]);
    if(ctLike) return crosses;
  }
  return true;
}

function isFullCrossroads(tileName, deg){
  const specs = pathSpecsForPlacement(tileName, deg);
  if(!Array.isArray(specs) || specs.length < 2) return false;
  for(const pathObj of specs){
    if(!pathUsesBothHalves(pathObj)) return false;
  }
  return true;
}

function resolvePlacementPathChoices(cellInfo, placed){
  const expectedPaths = computeExpectedPathCount(placed);

  // Multi-snake boards can place two different CT/CQ/CR wirings on the same tile at once
  // (one routing per snake). Neighbor matching uses full external edge lists; routing is
  // validated per-component below — there is no single global paths[] pick for the tile.
  if(expectedPaths > 1){
    return new Map();
  }

  const ambig = [];
  const fixed = new Map();
  for(const t of placed){
    const specs = pathSpecsForPlacement(t.tile, t.deg);
    if(!Array.isArray(specs) || !specs.length) continue;
    if(specs.length === 1 || isFullCrossroads(t.tile, t.deg)){
      fixed.set(t.id, 0);
      continue;
    }
    ambig.push(t.id);
  }

  function resolvedEdgesForPick(pathPick){
    const key = (r,c)=> r+','+c;
    const nodes = [];
    for(let r=0;r<CONFIG.rows;r++){
      for(let c=0;c<CONFIG.cols;c++){
        const info = cellInfo[idx(r,c)];
        if(!info) continue;
        const base = edgesFor(info.tile, info.deg, info.which);
        if(!base.length) continue;
        nodes.push({r,c,info,edges:base});
      }
    }
    if(!nodes.length) return true;
    const nodeMap = new Map(nodes.map(n => [key(n.r,n.c), n]));
    const adj = new Map();
    for(const n of nodes) adj.set(key(n.r,n.c), []);
    for(const n of nodes){
      const k = key(n.r,n.c);
      for(const e of n.edges){
        const rr = n.r + (e==='N'?-1:e==='S'?1:0);
        const cc = n.c + (e==='W'?-1:e==='E'?1:0);
        const nk = key(rr,cc);
        if(nodeMap.has(nk)){
          const nbrs = adj.get(k);
          if(!nbrs.includes(nk)) nbrs.push(nk);
        }
      }
    }
    const byTile = new Map();
    for(const n of nodes){
      if(!byTile.has(n.info.placedId)) byTile.set(n.info.placedId, []);
      byTile.get(n.info.placedId).push(key(n.r,n.c));
    }
    for(const [pid, cells] of byTile){
      if(cells.length < 2) continue;
      const t = placed.find(x => x.id === pid);
      const specs = t ? pathSpecsForPlacement(t.tile, t.deg) : null;
      const link = t ? tileInternallyLinksHalves(t.tile, specs, pathPick, pid, 1, placed) : true;
      if(!link) continue;
      const [a, b] = cells;
      if(!adj.get(a).includes(b)) adj.get(a).push(b);
      if(!adj.get(b).includes(a)) adj.get(b).push(a);
    }
    const start = adj.keys().next().value;
    const seen = new Set([start]);
    const queue = [start];
    while(queue.length){
      const cur = queue.shift();
      for(const nb of (adj.get(cur) || [])){
        if(!seen.has(nb)){
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    if(seen.size !== nodes.length) return false;
    let deg1 = 0;
    for(const [,nbrs] of adj) if(nbrs.length === 1) deg1++;
    return deg1 === expectedPaths * 2;
  }

  function dfs(i, pathPick){
    if(i >= ambig.length){
      return resolvedEdgesForPick(pathPick) ? pathPick : null;
    }
    const pid = ambig[i];
    const t = placed.find(x => x.id === pid);
    const specs = pathSpecsForPlacement(t.tile, t.deg);
    for(let pi = 0; pi < specs.length; pi++){
      pathPick.set(pid, pi);
      const res = dfs(i + 1, pathPick);
      if(res) return res;
    }
    pathPick.delete(pid);
    return null;
  }

  const initial = new Map(fixed);
  if(!ambig.length){
    return resolvedEdgesForPick(initial) ? initial : null;
  }
  return dfs(0, initial);
}

function buildResolvedEdgeGetter(pathPick, cellInfo, placed, expectedPathCount){
  const cache = new Map();
  return function resolvedEdgesAt(info){
    const key = `${info.placedId}|${info.which}`;
    if(cache.has(key)) return cache.get(key);
    const base = edgesFor(info.tile, info.deg, info.which);
    cache.set(key, base);
    return base;
  };
}

function buildCellInfoFromPlaced(placed){
  const cellInfo = Array(CONFIG.rows * CONFIG.cols).fill(null);
  for (const t of placed) {
    const rot = ((t.deg % 360) + 360) % 360;
    const cells = cellsForTile(t.tile, t.r, t.c, rot);
    for (let i = 0; i < cells.length; i++) {
      const [rr, cc] = cells[i];
      if (!inBounds(rr, cc)) continue;
      const which = i === 0 ? 'A' : 'B';
      cellInfo[idx(rr, cc)] = { tile: t.tile, deg: rot, which, placedId: t.id };
    }
  }
  return cellInfo;
}

/** Presentation-only hints while building (live edge validation ON). */
function analyzeLiveValidation(){
  const invalidCells = new Set();
  const openCells = new Set();
  const floatingTileIds = new Set();
  const deadEndCells = new Set();
  const placed = state.tiles;
  if (!placed.length) {
    return { invalidCells, openCells, floatingTileIds, deadEndCells };
  }

  const cellInfo = buildCellInfoFromPlaced(placed);
  const resolvedEdgesAt = (info) => edgesFor(info.tile, info.deg, info.which);

  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      if (state.blockerCells.has(cellKey(r, c))) continue;
      const info = cellInfo[idx(r, c)];
      if (!info) continue;
      const edges = resolvedEdgesAt(info);
      let matchedNeighbors = 0;
      for (const e of edges) {
        const rr = r + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
        const cc = c + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
        if (!inBounds(rr, cc)) {
          invalidCells.add(`${r},${c}`);
          continue;
        }
        if (state.blockerCells.has(cellKey(rr, cc))) {
          invalidCells.add(`${r},${c}`);
          continue;
        }
        const nb = cellInfo[idx(rr, cc)];
        if (!nb) {
          openCells.add(`${r},${c}`);
          openCells.add(`${rr},${cc}`);
          continue;
        }
        const nbEdges = resolvedEdgesAt(nb);
        if (!nbEdges.includes(OPP[e])) {
          invalidCells.add(`${r},${c}`);
          invalidCells.add(`${rr},${cc}`);
        } else if (nb.placedId !== info.placedId) {
          matchedNeighbors++;
        }
      }
      const tileKey = tileId(info.tile);
      if (placed.length > 1 && matchedNeighbors <= 1 && tileKey !== 'SH' && tileKey !== 'ET') {
        deadEndCells.add(`${r},${c}`);
      }
    }
  }

  if (placed.length > 1) {
    for (const t of placed) {
      const rot = ((t.deg % 360) + 360) % 360;
      const cells = cellsForTile(t.tile, t.r, t.c, rot);
      let connected = false;
      for (let ci = 0; ci < cells.length && !connected; ci++) {
        const [cr, cc] = cells[ci];
        const which = ci === 0 ? 'A' : 'B';
        const edges = edgesFor(t.tile, rot, which);
        for (const e of edges) {
          const nr = cr + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const nc = cc + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (!inBounds(nr, nc)) continue;
          const nbInfo = cellInfo[idx(nr, nc)];
          if (nbInfo && nbInfo.placedId !== t.id) {
            connected = true;
            break;
          }
        }
      }
      if (!connected) floatingTileIds.add(t.id);
    }
  }

  return { invalidCells, openCells, floatingTileIds, deadEndCells };
}

function drawLiveValidationOverlay(){
  if (!liveValidationCanvas) return;
  const g = liveValidationCanvas.getContext('2d');
  g.clearRect(0, 0, liveValidationCanvas.width, liveValidationCanvas.height);
  if (!state.liveEdgeValidation) return;

  const { invalidCells, openCells, deadEndCells } = analyzeLiveValidation();
  const cellPx = CONFIG.cellPx;

  function fillCell(key, color) {
    const [r, c] = key.split(',').map(Number);
    if (!inBounds(r, c)) return;
    g.fillStyle = color;
    g.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
  }

  g.save();
  for (const key of openCells) fillCell(key, 'rgba(80, 190, 255, 0.28)');
  for (const key of deadEndCells) fillCell(key, 'rgba(255, 190, 60, 0.32)');
  for (const key of invalidCells) fillCell(key, 'rgba(255, 70, 70, 0.38)');
  g.restore();
}

function applyGameplaySettings(settings = {}){
  state.liveEdgeValidation = settings.liveEdgeValidation === 'ON';
  state.showEdges = state.liveEdgeValidation;
  state.showTileBorders = settings.showTileBorders !== 'OFF';
  state.usedTileBehavior = settings.usedTileBehavior === 'GREY_OUT' ? 'GREY_OUT' : 'REMOVE';
  if (boardEl) boardEl.classList.toggle('show-outlines', state.showTileBorders);
  if (paletteEl) {
    for (const inst of (state.paletteInstances || [])) syncPaletteItemPresentation(inst.instanceId);
  }
}

function syncPaletteItemPresentation(instanceId){
  if (!paletteEl) return;
  const item = paletteEl.querySelector(`[data-tile="${CSS.escape(instanceId)}"]`);
  if (!item) return;
  const used = state.used.has(instanceId);
  const greyOut = state.usedTileBehavior === 'GREY_OUT';
  item.classList.toggle('used', used && greyOut);
  item.classList.toggle('palItem--removed', used && !greyOut);
  item.hidden = used && !greyOut;
  if (used) item.classList.remove('selected');
}

function drawEdgesOnTile(ctx, tileName, deg){
  if(!state.showEdges) return;
  const r=((deg%360)+360)%360;
  // cell mapping: anchor cell is (r,c). For drawing, we need A and B rects in tile canvas space.
  // We'll compute based on canvas pixel dims for this tile.
  const cw = (r===90||r===270) ? CONFIG.cellPx : 2*CONFIG.cellPx;
  const ch = (r===90||r===270) ? 2*CONFIG.cellPx : CONFIG.cellPx;

  const rectA = (r===0)   ? {x:0,y:0,w:CONFIG.cellPx,h:CONFIG.cellPx} :
                (r===90)  ? {x:0,y:0,w:CONFIG.cellPx,h:CONFIG.cellPx} :
                (r===180) ? {x:CONFIG.cellPx,y:0,w:CONFIG.cellPx,h:CONFIG.cellPx} :
                            {x:0,y:CONFIG.cellPx,w:CONFIG.cellPx,h:CONFIG.cellPx};
  const rectB = (r===0)   ? {x:CONFIG.cellPx,y:0,w:CONFIG.cellPx,h:CONFIG.cellPx} :
                (r===90)  ? {x:0,y:CONFIG.cellPx,w:CONFIG.cellPx,h:CONFIG.cellPx} :
                (r===180) ? {x:0,y:0,w:CONFIG.cellPx,h:CONFIG.cellPx} :
                            {x:0,y:0,w:CONFIG.cellPx,h:CONFIG.cellPx};

  function edgeLine(rect, e){
    const pad=6;
    if(e==='N') return {x1:rect.x+pad,y1:rect.y+2,x2:rect.x+rect.w-pad,y2:rect.y+2};
    if(e==='S') return {x1:rect.x+pad,y1:rect.y+rect.h-2,x2:rect.x+rect.w-pad,y2:rect.y+rect.h-2};
    if(e==='W') return {x1:rect.x+2,y1:rect.y+pad,x2:rect.x+2,y2:rect.y+rect.h-pad};
    return {x1:rect.x+rect.w-2,y1:rect.y+pad,x2:rect.x+rect.w-2,y2:rect.y+rect.h-pad}; // E
  }

  ctx.save();
  ctx.strokeStyle='red';
  ctx.lineWidth=3;

  for(const e of edgesFor(tileName, deg, 'A')){
    const L=edgeLine(rectA,e);
    ctx.beginPath(); ctx.moveTo(L.x1,L.y1); ctx.lineTo(L.x2,L.y2); ctx.stroke();
  }
  for(const e of edgesFor(tileName, deg, 'B')){
    const L=edgeLine(rectB,e);
    ctx.beginPath(); ctx.moveTo(L.x1,L.y1); ctx.lineTo(L.x2,L.y2); ctx.stroke();
  }
  ctx.restore();
}

// ---- Placement rules ----
function targetCells(r,c,deg){
  const rot=((deg%360)+360)%360;
  if(rot===0) return [[r,c],[r,c+1]];
  if(rot===90) return [[r,c],[r+1,c]];
  if(rot===180) return [[r,c],[r,c-1]];
  return [[r,c],[r-1,c]]; // 270
}

function tileCellCount(tileRef){
  const k = resolveTileKey(tileRef);
  const shape = state.liveEdges?.[k]?.shape;
  return Array.isArray(shape) && shape.length ? shape.length : 2;
}

function tileFootprint(tileRef){
  const k = resolveTileKey(tileRef);
  const shape = state.liveEdges?.[k]?.shape;
  if(!Array.isArray(shape) || !shape.length) return { w: 2, h: 1 };
  const dr = shape.map(c => Number(c.dr) || 0);
  const dc = shape.map(c => Number(c.dc) || 0);
  const h = Math.max(...dr) - Math.min(...dr) + 1;
  const w = Math.max(...dc) - Math.min(...dc) + 1;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function cellsForTile(tileRef, r, c, deg){
  if(tileCellCount(tileRef) === 1) return [[r,c]];
  return targetCells(r,c,deg);
}

function rotateCell(dr, dc, deg){
  const rot=((deg%360)+360)%360;
  if(rot===0) return [dr, dc];
  if(rot===90) return [dc, -dr];
  if(rot===180) return [-dr, -dc];
  return [-dc, dr];
}

function anchorCellInFootprint(tileRef, deg){
  const k = resolveTileKey(tileRef);
  const shape = state.liveEdges?.[k]?.shape;
  const cells = (Array.isArray(shape) && shape.length) ? shape : [{ id:'A', dr:0, dc:0 }, { id:'B', dr:0, dc:1 }];
  const anchorDef = cells.find(c => c?.id === 'A') || cells[0] || { dr:0, dc:0 };
  const baseDr = Math.min(...cells.map(c => Number(c?.dr) || 0));
  const baseDc = Math.min(...cells.map(c => Number(c?.dc) || 0));
  const rotCells = cells.map(c => {
    const dr0 = (Number(c?.dr) || 0) - baseDr;
    const dc0 = (Number(c?.dc) || 0) - baseDc;
    return rotateCell(dr0, dc0, deg);
  });
  const minR = Math.min(...rotCells.map(x => x[0]));
  const maxR = Math.max(...rotCells.map(x => x[0]));
  const minC = Math.min(...rotCells.map(x => x[1]));
  const maxC = Math.max(...rotCells.map(x => x[1]));
  const [ar0, ac0] = rotateCell((Number(anchorDef?.dr) || 0) - baseDr, (Number(anchorDef?.dc) || 0) - baseDc, deg);
  return {
    r: ar0 - minR,
    c: ac0 - minC,
    h: (maxR - minR + 1),
    w: (maxC - minC + 1),
  };
}

function drawAnchorHalo(ctx, cx, cy, radius){
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(100,190,255,0.35)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(70,165,255,0.95)';
  ctx.stroke();
  ctx.restore();
}

function canPlace(r,c,deg, ignoreTileId=null, tileRef=null){
  const inferredTile = tileRef || (ignoreTileId ? (state.tiles.find(t => t.id===ignoreTileId)?.tile || null) : (getSelectedInstance()?.tile || state.previewTile));
  const cells = cellsForTile(inferredTile, r,c,deg);

  // HARD bounds: all footprint cells must be on-board
  for(const [rr,cc] of cells){
    if(rr < 0 || rr >= CONFIG.rows || cc < 0 || cc >= CONFIG.cols) return false;
    if(state.blockerCells.has(cellKey(rr,cc))) return false;
  }

  // If there is ANY illegal tile already on the board (out of bounds), block further ops
  for(const t of state.tiles){
    for(const [tr,tc] of cellsForTile(t.tile, t.r,t.c,t.deg)){
      if(tr < 0 || tr >= CONFIG.rows || tc < 0 || tc >= CONFIG.cols) return false;
    }
  }

  // Overlap: compare footprints (fast enough for small boards)
  for(const t of state.tiles){
    if(ignoreTileId && t.id===ignoreTileId) continue;
    const tcells = cellsForTile(t.tile, t.r,t.c,t.deg);
    for(const [rr,cc] of cells){
      for(const [tr,tc] of tcells){
        if(rr===tr && cc===tc) return false;
      }
    }
  }
  return true;
}

function rebuildOcc(){
  state.occ = Array(CONFIG.rows*CONFIG.cols).fill(false);
  for(const t of state.tiles){
    for(const [rr,cc] of cellsForTile(t.tile, t.r,t.c,t.deg)){
      if(inBounds(rr,cc)) state.occ[idx(rr,cc)]=true;
    }
  }
}

function renderHover(r,c){
  const g=hoverCanvas.getContext('2d');
  g.clearRect(0,0,hoverCanvas.width,hoverCanvas.height);
  if(!state.selectedPal && !state.selectedTileId) return;
  const deg=state.deg;
  const selectedTile = state.selectedTileId ? (state.tiles.find(t => t.id===state.selectedTileId)?.tile || null) : (getSelectedInstance()?.tile || state.previewTile);
  if (!selectedTile) return;
  const ok = canPlace(r,c,deg, state.selectedTileId, selectedTile);
  const cells = cellsForTile(selectedTile, r,c,deg);
  g.save();
  g.globalAlpha=0.25;
  g.fillStyle = ok ? 'green' : 'red';
  for(const [rr,cc] of cells){
    if(!inBounds(rr,cc)) continue;
    g.fillRect(cc*CONFIG.cellPx, rr*CONFIG.cellPx, CONFIG.cellPx, CONFIG.cellPx);
  }
  // Anchor marker: always show the exact anchor cell (r,c).
  if(inBounds(r,c)){
    drawAnchorHalo(g, c*CONFIG.cellPx + CONFIG.cellPx/2, r*CONFIG.cellPx + CONFIG.cellPx/2, Math.max(8, CONFIG.cellPx*0.16));
  }
  g.restore();
}

function clearHover(){
  const g=hoverCanvas.getContext('2d');
  g.clearRect(0,0,hoverCanvas.width,hoverCanvas.height);
}

// ---- Tile DOM ----
let nextId=1;

/** Board canvas pixel size for a tile at a given rotation (matches drawTileCanvas). */
function boardTilePixelSize(tileName, deg) {
  const rot = ((deg % 360) + 360) % 360;
  const cell = CONFIG.cellPx;
  if (tileCellCount(tileName) === 1) {
    return { w: cell, h: cell };
  }
  if (rot === 90 || rot === 270) {
    return { w: cell, h: 2 * cell };
  }
  return { w: 2 * cell, h: cell };
}

async function drawTileCanvas(tileName, deg, canvas){
  const rot=((deg%360)+360)%360;
  const { w, h } = boardTilePixelSize(tileName, rot);
  canvas.width=w; canvas.height=h;
  canvas.style.width=w+'px'; canvas.style.height=h+'px';

  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  const url = await rotatedDataURL(tileName, rot);
  const img = new Image();
  img.src = url;
  await img.decode();
  ctx.drawImage(img, 0,0, w,h);
  drawEdgesOnTile(ctx, tileName, rot);
}

async function renderBlockers() {
  for (const el of [...boardEl.querySelectorAll('.tile--blocker')]) el.remove();
  for (const bp of state.blockerPlacements || []) {
    if (tileCellCount(bp.tile) <= 1) continue;

    const tileEl = document.createElement('div');
    tileEl.className = 'tile tile--blocker';
    tileEl.dataset.tile = bp.tile;
    tileEl.setAttribute('aria-hidden', 'true');

    const canvas = document.createElement('canvas');
    canvas.className = 'tileCanvas';
    tileEl.appendChild(canvas);
    boardEl.appendChild(tileEl);

    const cells = cellsForTile(bp.tile, bp.r, bp.c, bp.deg);
    const rows = cells.map((x) => x[0]);
    const cols = cells.map((x) => x[1]);
    const rMin = Math.min(...rows);
    const cMin = Math.min(...cols);
    const rMax = Math.max(...rows);
    const cMax = Math.max(...cols);

    tileEl.style.left = `${cMin * CONFIG.cellPx}px`;
    tileEl.style.top = `${rMin * CONFIG.cellPx}px`;
    tileEl.style.width = `${(cMax - cMin + 1) * CONFIG.cellPx}px`;
    tileEl.style.height = `${(rMax - rMin + 1) * CONFIG.cellPx}px`;

    await drawTileCanvas(bp.tile, bp.deg, canvas);
  }
}

async function renderTiles(){
  // Remove existing tile elements
  for(const el of [...boardEl.querySelectorAll('.tile')]) el.remove();

  await renderBlockers();

  for(const t of state.tiles){
    const tileEl=document.createElement('div');
    tileEl.className='tile';
    tileEl.dataset.id=t.id;
    tileEl.dataset.tile=t.tile;

    const canvas=document.createElement('canvas');
    canvas.className='tileCanvas';
    tileEl.appendChild(canvas);

    boardEl.appendChild(tileEl);

    // position (grid-first): derive bounding box from occupied cells
    const cells = cellsForTile(t.tile, t.r, t.c, t.deg);
    const rows = cells.map(x => x[0]);
    const cols = cells.map(x => x[1]);
    const rMin = Math.min(...rows), rMax = Math.max(...rows);
    const cMin = Math.min(...cols), cMax = Math.max(...cols);

    tileEl.style.left = (cMin * CONFIG.cellPx) + 'px';
    tileEl.style.top  = (rMin * CONFIG.cellPx) + 'px';
    tileEl.style.width  = ((cMax - cMin + 1) * CONFIG.cellPx) + 'px';
    tileEl.style.height = ((rMax - rMin + 1) * CONFIG.cellPx) + 'px';

    if(state.selectedTileId===t.id) tileEl.classList.add('selected');
    if(isHintTile(t)) tileEl.classList.add('tile--hint');

    tileEl.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if(!isSandboxLevel() && isBlockerTile(t.tile)) return;
      if(isHintTile(t)) {
        status('Hint tiles cannot be moved or removed.');
        return;
      }
      const removed = removeTileById(t.id);
      if(!removed) return;
      window.__discoveryRecord?.resumeForBoardEdit?.();
      state.selectedTileId = null;
      syncActionButtons();
      state.selectedPal = removed.instanceId || null;
      state.previewTile = removed.tile;
      state.deg = removed.deg || 0;
      rotHud.textContent = state.deg + '';
      markPaletteSelected(state.selectedPal);
      renderActivePreview();
      rebuildOccFromTiles();
      await renderTiles();
      clearHover();
      window.__app?.onBoardStateChanged?.();
      status(`Picked up ${removed.tile}`);
    });
	await drawTileCanvas(t.tile, t.deg, canvas);
  }

  for (const el of boardEl.querySelectorAll('.tile')) {
    el.classList.remove('tile--live-float');
  }
  if (state.liveEdgeValidation) {
    const { floatingTileIds } = analyzeLiveValidation();
    for (const id of floatingTileIds) {
      const el = boardEl.querySelector(`.tile[data-id="${CSS.escape(String(id))}"]`);
      if (el) el.classList.add('tile--live-float');
    }
  }
  drawLiveValidationOverlay();
}


function setPaletteUsed(instanceId, used){
  syncPaletteItemPresentation(instanceId);
}

function markPaletteSelected(instanceId){
  for(const el of paletteEl.querySelectorAll('.palItem')) el.classList.remove('selected');
  if(!instanceId) return;
  const item = paletteEl.querySelector(`[data-tile="${CSS.escape(instanceId)}"]`);
  if(item) item.classList.add('selected');
}

function getSelectedInstance(){
  return state.selectedPal ? getInstance(state.selectedPal) : null;
}

/** Show a placed tile in the preview (board unchanged) — e.g. after Continue Search. */
function syncPreviewFromBoardSelection({ preferLastPlaced = false } = {}) {
  const tiles = state.tiles || [];
  if (!tiles.length) return false;

  let t = state.selectedTileId
    ? tiles.find((x) => x.id === state.selectedTileId)
    : null;
  if (!t && preferLastPlaced) {
    t = [...tiles].reverse().find((x) => !isHintTile(x)) || tiles[tiles.length - 1];
  }
  if (!t) return false;

  state.previewTile = t.tile;
  state.deg = t.deg || 0;
  state.selectedTileId = t.id;
  state.selectedPal = null;
  markPaletteSelected(null);
  if (rotHud) rotHud.textContent = String(state.deg);
  return true;
}

/** Empty preview slot — no palette or board tile selected. */
function clearActivePreviewSelection() {
  state.selectedPal = null;
  state.previewTile = null;
  state.selectedTileId = null;
  state.deg = 0;
  markPaletteSelected(null);
  syncActionButtons();
  if (rotHud) rotHud.textContent = '0';
}

async function renderActivePreview(){
  if(!activePad) return;
  const tileName = state.previewTile || state.selectedPal;
  const has = !!tileName;
  let anchor = activePad.querySelector('.activeAnchor');
  if(!anchor){
    anchor = document.createElement('div');
    anchor.className = 'activeAnchor';
    activePad.appendChild(anchor);
  }

  if(!has){
    if(activeImg) {
      activeImg.style.display = 'none';
      activeImg.src = '';
      activeImg.alt = '';
      activeImg.style.width = '';
      activeImg.style.height = '';
      activeImg.style.transform = '';
    }
    if(activeEmpty) activeEmpty.style.display='block';
    anchor.style.display='none';
    return;
  }

  if(activeEmpty) activeEmpty.style.display='none';
  const padW = activePad.clientWidth || 153;
  const padH = activePad.clientHeight || 91;
  const rootStyle = getComputedStyle(document.documentElement);
  const fitInsetX = parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-fit-inset-x')) || 4;
  const fitInsetY = parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-fit-inset-y')) || 8;
  const fitW = Math.max(1, padW - fitInsetX * 2);
  const fitH = Math.max(1, padH - fitInsetY * 2);
  const a = anchorCellInFootprint(tileName, state.deg);
  const size = boardTilePixelSize(tileName, state.deg);
  let drawW = size.w;
  let drawH = size.h;
  let cell = CONFIG.cellPx;

  const rot = ((state.deg % 360) + 360) % 360;
  const boardScale = parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-board-scale')) || 1;
  const rotScale = (rot === 90 || rot === 270)
    ? (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-rot90-scale')) || 1)
    : (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-rot0-scale')) || 1);
  const clampToSlot = parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-clamp-to-slot')) || 0;

  const scale = boardScale * rotScale;
  drawW *= scale;
  drawH *= scale;
  cell *= scale;

  // Default: true board pixels (may extend past slot — overflow is visible). Set clamp-to-slot to 1 to shrink.
  if (clampToSlot > 0 && (drawW > fitW || drawH > fitH)) {
    const shrink = Math.min(fitW / drawW, fitH / drawH);
    drawW *= shrink;
    drawH *= shrink;
    cell *= shrink;
  }

  const tileOffsetX = parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-offset-x')) || 0;
  const tileOffsetY = parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-offset-y')) || 0;

  if(activeImg){
    activeImg.style.display = 'block';
    activeImg.style.width = `${drawW}px`;
    activeImg.style.height = `${drawH}px`;
    activeImg.alt = tileName;
    try {
      activeImg.src = await rotatedDataURL(tileName, state.deg);
    } catch (err) {
      console.error(err);
      activeImg.src = 'img/' + resolveTileAsset(tileName);
    }
  }

  const offX = (padW - drawW) / 2;
  const offY = (padH - drawH) / 2;
  const cx = offX + (a.c + 0.5) * cell + tileOffsetX;
  const cy = offY + (a.r + 0.5) * cell + tileOffsetY;
  anchor.style.display = 'block';
  anchor.style.left = `${cx}px`;
  anchor.style.top = `${cy}px`;
}

function buildPaletteInstances(){
  const instances = [];
  if (state.levelTileCounts && Object.keys(state.levelTileCounts).length) {
    for (const [tileName, c] of Object.entries(state.levelTileCounts)) {
      const count = Math.max(0, Number(c) || 0);
      for (let i = 1; i <= count; i++) {
        instances.push({ instanceId: `${tileName}#${i}`, tile: tileName, deg: 0 });
      }
    }
    return sortPaletteInstances(instances);
  }
  for (const tileName of (state.tileCatalog || [])) {
    const def = state.liveEdges?.[tileName] || {};
    const count = Math.max(1, Number(def.count || 1));
    for (let i = 1; i <= count; i++) {
      instances.push({
        instanceId: `${tileName}#${i}`,
        tile: tileName,
        deg: 0
      });
    }
  }
  return sortPaletteInstances(instances);
}

/** SH (start) first, ET (end) second, then all other tiles. */
function paletteInstanceSortRank(tileRef) {
  const id = tileId(tileRef);
  if (id === 'SH') return 0;
  if (id === 'ET') return 1;
  return 2;
}

function sortPaletteInstances(instances) {
  return [...instances].sort((a, b) => {
    const rankDiff = paletteInstanceSortRank(a.tile) - paletteInstanceSortRank(b.tile);
    if (rankDiff !== 0) return rankDiff;
    return a.instanceId.localeCompare(b.instanceId, undefined, { numeric: true });
  });
}

function getInstance(instanceId){
  return (state.paletteInstances || []).find(x => x.instanceId === instanceId) || null;
}

function paletteThumbCellPx(){
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-tilebag-cell'));
  return Number.isFinite(v) && v > 0 ? v : 36;
}

function paletteThumbHeightScale(tileName){
  if (tileCellCount(tileName) <= 1) return 1;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-tilebag-thumb-h-scale'));
  return Number.isFinite(v) && v > 0 ? v : 0.8;
}

function paletteThumbPixelSize(tileName, deg = 0){
  const cell = paletteThumbCellPx();
  const scale = cell / CONFIG.cellPx;
  const size = boardTilePixelSize(tileName, deg);
  const w = Math.round(size.w * scale);
  let h = Math.round(size.h * scale);
  const hScale = paletteThumbHeightScale(tileName);
  if (hScale !== 1) h = Math.max(1, Math.round(h * hScale));
  return { w, h };
}

function selectPaletteInstance(instanceId) {
  const inst = getInstance(instanceId);
  if (!inst) return;
  const tileName = inst.tile;
  if (!isSandboxLevel() && isBlockerTile(tileName)) return;
  if (state.used.has(instanceId)) return;
  state.selectedPal = instanceId;
  state.previewTile = tileName;
  state.selectedTileId = null;
  syncActionButtons();
  state.deg = inst.deg || 0;
  rotHud.textContent = state.deg + '';
  markPaletteSelected(instanceId);
  void renderActivePreview();
  void renderTiles();
}

async function buildPalette(){
  paletteEl.innerHTML='';
  for(const inst of (state.paletteInstances || [])){
    const tileName = inst.tile;
    const instanceId = inst.instanceId;
    const deg = inst.deg || 0;

    const item=document.createElement('div');
    item.className='palItem';
    item.dataset.tile=instanceId;

    const thumb=document.createElement('div');
    thumb.className = 'palThumb' + (tileCellCount(tileName) <= 1 ? ' palThumb--single' : '');
    const { w, h } = paletteThumbPixelSize(tileName, deg);
    thumb.style.width = w + 'px';
    thumb.style.height = h + 'px';
    const img=document.createElement('img');
    img.alt=tileName;
    try {
      img.src = await rotatedDataURL(tileName, deg);
    } catch (err) {
      console.error(err);
      img.src = 'img/' + resolveTileAsset(tileName);
    }
    thumb.appendChild(img);

    const meta=document.createElement('div');
    meta.className='palMeta';
    const name=document.createElement('div');
    name.className='palName';
    // show "TileName #n"
    const parts = instanceId.split('#');
    name.textContent = parts[0] + ' #' + (parts[1] || '');
    const used=document.createElement('div');
    used.className='palUsed';
    used.textContent='USED';
    meta.appendChild(name);
    meta.appendChild(used);

    item.appendChild(thumb);
    item.appendChild(meta);

    if(!isSandboxLevel() && isBlockerTile(tileName)) item.classList.add('locked');
    item.addEventListener('click', () => {
      selectPaletteInstance(instanceId);
    });
    paletteEl.appendChild(item);
  }
  for (const inst of (state.paletteInstances || [])) syncPaletteItemPresentation(inst.instanceId);
}


// ---- Validate ----
function status(msg){
  const el=document.getElementById('valOut');
  if(el) el.textContent = msg;
  try{ solver?.log?.(msg); }catch(e){}
  console.log(msg);
}


function syncActionButtons(){
  if (!deleteBtn) return;
  const hasSel = !!state.selectedTileId;
  deleteBtn.disabled = !hasSel;
  deleteBtn.title = hasSel ? 'Delete selected placed tile' : 'Select a tile on the board to delete';
}

function computeExpectedPathCount(placed){
  const cfgMode = state.currentLevel?.pathMode;
  const cfgCount = Number(state.currentLevel?.pathCount || 0);
  const shPlaced = placed.filter(t => tileId(t.tile) === 'SH').length;
  const etPlaced = placed.filter(t => tileId(t.tile) === 'ET').length;
  const shLevel = Number(state.levelTileCounts?.SH || 0);
  const etLevel = Number(state.levelTileCounts?.ET || 0);
  const levelPaths = (shLevel > 0 && etLevel > 0) ? Math.min(shLevel, etLevel) : 0;
  const fallbackPaths = (shPlaced === 2 && etPlaced === 2) ? 2 : 1;
  return (levelPaths > 0)
    ? levelPaths
    : (((cfgMode === 'multi' || cfgMode === 'multi-flex') && cfgCount > 0)
      ? cfgCount
      : (cfgMode === 'single' ? 1 : fallbackPaths));
}
// Uses state.tiles, cellInfo from placements, edgesFor(state.liveEdges), OPP.
// Start/End detected from placed tile names (SH-/ET-). No global tile-definition table.
function validateBoard(){
  const placed = state.tiles;
  let traceSummary = '';

  // illegal tile footprint (off-board)
  for(const t of placed){
    for(const [rr,cc] of cellsForTile(t.tile, t.r,t.c,t.deg)){
      if(!inBounds(rr,cc)) return {ok:false, msg:`Tile ${t.tile} off-board at (${rr},${cc})`};
    }
  }
  // overlap check
  const seenCells = new Set();
  for(const t of placed){
    for(const [rr,cc] of cellsForTile(t.tile, t.r,t.c,t.deg)){
      const k = rr+','+cc;
      if(seenCells.has(k)) return {ok:false, msg:`Overlap at (${rr},${cc})`};
      seenCells.add(k);
    }
  }

  // boundary + matching

  // build per-cell edges
  const cellInfo = Array(CONFIG.rows*CONFIG.cols).fill(null);
  for (const t of placed) {
    const rot=((t.deg%360)+360)%360;
    const cells=cellsForTile(t.tile, t.r,t.c,rot);
    if(!Array.isArray(cells) || !cells.length){
      return {ok:false, msg:`Tile ${t.tile} has invalid footprint`};
    }

    // HARD off-board check (no partial tiles allowed)
    for (const [rr,cc] of cells) {
      if (!inBounds(rr,cc)) return {ok:false, msg:`Tile ${t.tile} goes off-board at (${rr},${cc})`};
    }

    // HARD overlap check + per-cell metadata (supports 1-cell and 2-cell tiles)
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if(!Array.isArray(cell) || cell.length < 2){
        return {ok:false, msg:`Tile ${t.tile} has invalid cell at index ${i}`};
      }
      const [rr, cc] = cell;
      const ii = idx(rr, cc);
      if (cellInfo[ii]) return {ok:false, msg:`Overlap at (${rr},${cc})`};
      const which = (i === 0) ? 'A' : 'B';
      cellInfo[ii] = { tile: t.tile, deg: rot, which, placedId: t.id };
    }
  }

  const totalPlayable = CONFIG.rows * CONFIG.cols - state.blockerCells.size;
  const filledCells = cellInfo.filter(Boolean).length;
  const boardComplete = filledCells >= totalPlayable;

  const expectedPaths = computeExpectedPathCount(placed);

  let pathPick = null;
  let resolvedEdgesAt;
  if(boardComplete){
    pathPick = resolvePlacementPathChoices(cellInfo, placed);
    if(expectedPaths <= 1 && !pathPick){
      return {ok:false, msg:'Cannot resolve path routing on path-aware tiles (ambiguous fork wiring vs neighbors).'};
    }
    resolvedEdgesAt = buildResolvedEdgeGetter(pathPick, cellInfo, placed, expectedPaths);
  } else {
    resolvedEdgesAt = function(info){
      return edgesFor(info.tile, info.deg, info.which);
    };
  }

  // off-board
  for(let r=0;r<CONFIG.rows;r++){
    for(let c=0;c<CONFIG.cols;c++){
      if(state.blockerCells.has(cellKey(r,c))) continue;
      const info=cellInfo[idx(r,c)];
      if(!info) continue;
      const edges=resolvedEdgesAt(info);
      for(const e of edges){
        const rr=r + (e==='N'?-1:e==='S'?1:0);
        const cc=c + (e==='W'?-1:e==='E'?1:0);
        if(!inBounds(rr,cc)) return {ok:false, msg:`Edge ${e} at (${r},${c}) goes off-board`};
      }
    }
  }

  // matching (only between placed tiles; skip empty neighbors on partial boards)
  for(let r=0;r<CONFIG.rows;r++){
    for(let c=0;c<CONFIG.cols;c++){
      const info=cellInfo[idx(r,c)];
      if(!info) continue;
      const edges=resolvedEdgesAt(info);
      for(const e of edges){
        const rr=r + (e==='N'?-1:e==='S'?1:0);
        const cc=c + (e==='W'?-1:e==='E'?1:0);
        if(!inBounds(rr,cc)) continue;
        if(state.blockerCells.has(cellKey(rr,cc))) return {ok:false, msg:`Mismatch: (${r},${c}) has ${e} into blocker at (${rr},${cc})`};
        const nb=cellInfo[idx(rr,cc)];
        if(!nb){
          if(boardComplete) return {ok:false, msg:`Mismatch: (${r},${c}) has ${e} but neighbor empty`};
          continue;
        }
        const nbEdges=resolvedEdgesAt(nb);
        if(!nbEdges.includes(OPP[e])) return {ok:false, msg:`Mismatch: (${r},${c}) has ${e} but neighbor lacks ${OPP[e]}`};
      }
    }
  }

  if(!boardComplete){
    // Reject floating islands: every placed tile must connect to at least one
    // other placed tile via live edges (except the very first tile).
    if(placed.length > 1){
      for(const t of placed){
        const cells = cellsForTile(t.tile, t.r, t.c, ((t.deg%360)+360)%360);
        let connected = false;
        for(let ci = 0; ci < cells.length && !connected; ci++){
          const [cr, cc] = cells[ci];
          const which = ci === 0 ? 'A' : 'B';
          const edges = edgesFor(t.tile, ((t.deg%360)+360)%360, which);
          for(const e of edges){
            const nr = cr + (e==='N'?-1:e==='S'?1:0);
            const nc = cc + (e==='W'?-1:e==='E'?1:0);
            if(!inBounds(nr,nc)) continue;
            const nbInfo = cellInfo[idx(nr,nc)];
            if(nbInfo && nbInfo.placedId !== t.id){ connected = true; break; }
          }
        }
        if(!connected) return {ok:false, msg:`Floating tile ${t.tile} at (${t.r},${t.c})`};
      }
    }
    return {ok:true, msg:'Partial board OK'};
  }

  // Path connectivity rules:
  // - Every live edge must connect to a matching live edge (already enforced above).
  // - All live-edge cells must belong to ONE connected component.
  // - Exactly two endpoints (degree 1) total: Start (SH) and End (ET).
  // - All other live-edge cells must have degree 2 or 4.
  const expectedEndpoints = expectedPaths * 2;
  const isMultiFlex = state.currentLevel?.pathMode === 'multi-flex';
  const isNeutralPathTile = (tileName) => {
    const id = tileId(tileName);
    return id === 'E1' || id === 'E2' || id === 'B1' || id === 'B2';
  };

  const liveNodes = []; // {r,c,deg,which,tile,edges}
  for(let r=0;r<CONFIG.rows;r++){
    for(let c=0;c<CONFIG.cols;c++){
      const info = cellInfo[idx(r,c)];
      if(!info) continue;
      if(isNeutralPathTile(info.tile)) continue;
      const edges = resolvedEdgesAt(info);
      if(edges.length>0){
        liveNodes.push({r,c,tile:info.tile,deg:info.deg,which:info.which,placedId:info.placedId,edges});
}
      }
    }

  const skipMergedConnectivity = expectedPaths > 1;

  if(liveNodes.length && !skipMergedConnectivity){
    // Build adjacency for live-edge cells (only along live edges)
    const key = (r,c)=> r+','+c;
    const nodeMap = new Map(liveNodes.map(n => [key(n.r,n.c), n]));
    const adj = new Map();
    const degMap = new Map();

    for(const n of liveNodes){
      const k = key(n.r,n.c);
      const nbrs = [];
      for(const e of n.edges){
        const rr=n.r + (e==='N'?-1:e==='S'?1:0);
        const cc=n.c + (e==='W'?-1:e==='E'?1:0);
        const nk = key(rr,cc);
        if(nodeMap.has(nk)) nbrs.push(nk);
        // If neighbor cell has 0 live edges, the earlier mismatch check would have failed.
      }
      adj.set(k, nbrs);
      degMap.set(k, nbrs.length);
    }

    // Tile-internal link: A<->B cells within the same placed tile are connected.
    // The solver traverses through both cells of a tile as one piece, so validator should too.
    const byTile = new Map();
    for(const n of liveNodes){
      if(!byTile.has(n.placedId)) byTile.set(n.placedId, []);
      byTile.get(n.placedId).push(key(n.r, n.c));
    }
    for(const cells of byTile.values()){
      if(cells.length < 2) continue;
      const a = cells[0], b = cells[1];
      const infoA = nodeMap.get(a);
      const pid = infoA?.placedId;
      const t = placed.find(x => x.id === pid);
      const specs = t ? pathSpecsForPlacement(t.tile, t.deg) : null;
      const linkCells = t ? tileInternallyLinksHalves(t.tile, specs, pathPick, pid, expectedPaths, placed) : true;
      if(!linkCells) continue;
      const aNbrs = adj.get(a) || [];
      const bNbrs = adj.get(b) || [];
      if(!aNbrs.includes(b)) aNbrs.push(b);
      if(!bNbrs.includes(a)) bNbrs.push(a);
      adj.set(a, aNbrs);
      adj.set(b, bNbrs);
    }
    for(const [k, nbrs] of adj.entries()){
      degMap.set(k, nbrs.length);
    }

    // Connected component check (over live-edge nodes)
    const components = [];
    const seen2 = new Set();
    for (const k0 of adj.keys()) {
      if (seen2.has(k0)) continue;
      const comp = [];
      const q = [k0];
      seen2.add(k0);
      while (q.length) {
        const cur = q.shift();
        comp.push(cur);
        for (const nb of (adj.get(cur) || [])) {
          if (!seen2.has(nb)) {
            seen2.add(nb);
            q.push(nb);
          }
        }
      }
      components.push(comp);
    }
    if((!isMultiFlex && components.length !== expectedPaths) || (isMultiFlex && components.length < expectedPaths)){
      return {ok:false, msg:`Path disconnected (${components.length} components, expected ${isMultiFlex ? '>=' : ''}${expectedPaths})`};
    }

    // Endpoint rules
    const endpoints = [];
    for(const [k,d] of degMap.entries()){
      if(d===1) endpoints.push(k);
    }
    if((!isMultiFlex && endpoints.length !== expectedEndpoints) || (isMultiFlex && endpoints.length < expectedEndpoints)){
      return {ok:false, msg:`Path must have ${isMultiFlex ? 'at least' : 'exactly'} ${expectedEndpoints} endpoints (has ${endpoints.length})`};
    }

    const endTiles = endpoints.map(k => nodeMap.get(k).tile);
    const shEnds = endTiles.filter(t => tileId(t) === 'SH').length;
    const etEnds = endTiles.filter(t => tileId(t) === 'ET').length;
    if((!isMultiFlex && (shEnds !== expectedPaths || etEnds !== expectedPaths)) || (isMultiFlex && (shEnds < expectedPaths || etEnds < expectedPaths))){
      return {ok:false, msg:`Endpoints must be ${isMultiFlex ? 'at least' : ''} ${expectedPaths}x SH and ${expectedPaths}x ET (got SH=${shEnds}, ET=${etEnds})`};
    }

    // Build component endpoint traces so checker output can be audited.
    const traceParts = [];
    const compIndexByKey = new Map();
    components.forEach((comp, i) => { for(const k of comp) compIndexByKey.set(k, i); });
    for(let i = 0; i < components.length; i++){
      const comp = components[i];
      const compEndpoints = comp.filter(k => (degMap.get(k) || 0) === 1);
      if(compEndpoints.length !== 2){
        traceParts.push(`C${i + 1}: endpoints=${compEndpoints.length}`);
        continue;
      }
      const start = compEndpoints[0];
      const goal = compEndpoints[1];
      const q = [start];
      const seen = new Set([start]);
      const prev = new Map();
      while(q.length){
        const cur = q.shift();
        if(cur === goal) break;
        for(const nb of (adj.get(cur) || [])){
          if(seen.has(nb)) continue;
          if(compIndexByKey.get(nb) !== i) continue;
          seen.add(nb);
          prev.set(nb, cur);
          q.push(nb);
        }
      }
      const path = [goal];
      let cur = goal;
      while(cur !== start && prev.has(cur)){
        cur = prev.get(cur);
        path.push(cur);
      }
      path.reverse();
      const sNode = nodeMap.get(start);
      const eNode = nodeMap.get(goal);
      const sId = tileId(sNode?.tile) || '?';
      const eId = tileId(eNode?.tile) || '?';
      traceParts.push(`C${i + 1}: ${sId}(${sNode?.r},${sNode?.c})->${eId}(${eNode?.r},${eNode?.c}), hops=${Math.max(0, path.length - 1)}`);
    }
    if(traceParts.length) traceSummary = traceParts.join(' | ');
  }



  // ---- Extra rules: SH and ET cannot connect directly; no loops (acyclic); single connected component ----
  // Build adjacency graph of live-edge connections between occupied cells
  const nodes = [];
  const nodeId = new Map(); // key "r,c" -> id
  function key(r,c){ return r+','+c; }

  for (let r=0;r<CONFIG.rows;r++){
    for (let c=0;c<CONFIG.cols;c++){
      const info = cellInfo[idx(r,c)];
      if(!info) continue;
      if(isNeutralPathTile(info.tile)) continue;
      const edges = resolvedEdgesAt(info);
      if(edges.length===0) continue;
      const k = key(r,c);
      if(!nodeId.has(k)){ nodeId.set(k, nodes.length); nodes.push({r,c}); }
    }
  }

  const adj = Array(nodes.length).fill(0).map(()=>[]);
  const addEdge = (r1,c1,r2,c2) => {
    const a = nodeId.get(key(r1,c1));
    const b = nodeId.get(key(r2,c2));
    if(a==null || b==null) return;
    adj[a].push(b);
    adj[b].push(a);
  };

  // Tile-internal link: connect A<->B cells of each placed tile in graph checks.
  const tileLiveCells = new Map();
  for(let r=0;r<CONFIG.rows;r++){
    for(let c=0;c<CONFIG.cols;c++){
      const info = cellInfo[idx(r,c)];
      if(!info) continue;
      const edges = resolvedEdgesAt(info);
      if(edges.length===0) continue;
      if(!tileLiveCells.has(info.placedId)) tileLiveCells.set(info.placedId, []);
      tileLiveCells.get(info.placedId).push([r,c]);
    }
  }
  for(const cells of tileLiveCells.values()){
    if(cells.length < 2) continue;
    const [a, b] = cells;
    const pid = cellInfo[idx(a[0], a[1])]?.placedId;
    const t = placed.find(x => x.id === pid);
    const specs = t ? pathSpecsForPlacement(t.tile, t.deg) : null;
    const linkCells = t ? tileInternallyLinksHalves(t.tile, specs, pathPick, pid, expectedPaths, placed) : true;
    if(!linkCells) continue;
    addEdge(a[0], a[1], b[0], b[1]);
  }

  // Add edges + enforce SH-ET direct connection ban
  for(let r=0;r<CONFIG.rows;r++){
    for(let c=0;c<CONFIG.cols;c++){
      const info=cellInfo[idx(r,c)];
      if(!info) continue;
      const edges=resolvedEdgesAt(info);
      for(const e of edges){
        const rr=r + (e==='N'?-1:e==='S'?1:0);
        const cc=c + (e==='W'?-1:e==='E'?1:0);
        if(!inBounds(rr,cc)) continue;
        const nb=cellInfo[idx(rr,cc)];
        if(!nb) continue;
        if(isNeutralPathTile(info.tile) || isNeutralPathTile(nb.tile)) continue;

        // Ban SH <-> ET direct connection (adjacent live-edge match)
        const isSH = tileId(info.tile) === 'SH';
        const isET = tileId(info.tile) === 'ET';
        const nbIsSH = tileId(nb.tile) === 'SH';
        const nbIsET = tileId(nb.tile) === 'ET';
        if ((isSH && nbIsET) || (isET && nbIsSH)) {
          return {ok:false, msg:`Invalid: SH and ET connect directly at (${r},${c}) <-> (${rr},${cc})`};
        }

        // Only add each undirected edge once (E/S directions)
        if(e==='E' || e==='S'){
          addEdge(r,c,rr,cc);
        }
      }
    }
  }

  // Legacy cycle detection removed: it operates on a cell-projection graph and
  // produced false negatives for valid boards in modern tile sets. Connectivity
  // and endpoint constraints below are authoritative for solution validity.

  // Connectivity: allow 1 component for standard mode, 2 for double mode
  if(nodes.length>0 && !skipMergedConnectivity){
    const vis=Array(nodes.length).fill(false);
    let compCount = 0;
    for(let i=0;i<nodes.length;i++){
      if(vis[i]) continue;
      compCount++;
      const q=[i];
      vis[i]=true;
      while(q.length){
        const u=q.pop();
        for(const v of adj[u]){
          if(!vis[v]){ vis[v]=true; q.push(v); }
        }
      }
    }
    if((!isMultiFlex && compCount !== expectedPaths) || (isMultiFlex && compCount < expectedPaths)) {
      return {ok:false, msg:`Invalid: disconnected path fragments (${compCount} components, expected ${isMultiFlex ? '>=' : ''}${expectedPaths})`};
    }
  }

  return {ok:true, msg: traceSummary ? `OK ${traceSummary}` : 'OK'};
}

function getInventoryMismatch(levelTileCounts, placedTiles){
  if(!levelTileCounts || typeof levelTileCounts !== 'object') return null;
  const placedCounts = {};
  for (const t of (placedTiles || [])) {
    const id = tileId(t?.tile);
    if (!id) continue;
    placedCounts[id] = (placedCounts[id] || 0) + 1;
  }
  for (const [id, needRaw] of Object.entries(levelTileCounts)) {
    const need = Number(needRaw || 0);
    const got = Number(placedCounts[id] || 0);
    if (got !== need) return { id, got, need };
  }
  for (const [id, gotRaw] of Object.entries(placedCounts)) {
    const got = Number(gotRaw || 0);
    const need = Number(levelTileCounts[id] || 0);
    if (got !== need) return { id, got, need };
  }
  return null;
}

// ---- Hints ----
const HINT_COSTS = { random: 1, start: 2, end: 2 };
const EXAMPLE_ROUTE_TOKEN_COST = 1;
const DEFAULT_GLOBAL_HINT_TOKENS = 18;
const PUZZLE_TIME_BONUS_SECONDS = 30 * 60;

function hintTokensStorageKey() {
  return `snake_hint_tokens_v1_${state.userId || 'gar'}`;
}

function loadGlobalHintTokens() {
  try {
    const raw = localStorage.getItem(hintTokensStorageKey());
    if (raw != null) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
  } catch (e) { /* ignore */ }
  return DEFAULT_GLOBAL_HINT_TOKENS;
}

function saveGlobalHintTokens() {
  try {
    localStorage.setItem(hintTokensStorageKey(), String(state.hintTokens));
  } catch (e) { /* ignore */ }
}

function getGlobalHintTokens() {
  return Math.max(0, Number(state.hintTokens) || 0);
}

function grantHintTokens(amount, reason = '') {
  const n = Math.max(0, Number(amount) || 0);
  if (!n) return 0;
  state.hintTokens = getGlobalHintTokens() + n;
  saveGlobalHintTokens();
  window.dispatchEvent(new CustomEvent('tilezilla:hint-balance', {
    detail: { amount: n, reason },
  }));
  return n;
}

function formatCompletionTime(sec) {
  const total = Math.max(0, Number(sec) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function puzzleAttemptUsedHints() {
  return (Number(state.hintsUsedThisPuzzle) || 0) > 0 || boardHasHintTiles();
}

function todayChallengeDate() {
  return window.__dailyChallengeMeta?.date
    || new Date().toISOString().slice(0, 10);
}

function isGuestDailySession() {
  return window.__tilezillaGuest?.isGuestUser?.()
    && document.querySelector('.tz-app')?.dataset?.screen === 'daily-challenge';
}

function showGuestDailySolveUi(lv, catalogRes, placements) {
  window.__invalidSolve?.hide?.();
  const outcome = processSolutionFound(lv, catalogRes, placements);
  setCheckMessage(outcome.msg, 'checkSuccess');
  window.__tilezillaGuest?.showGuestDailyComplete?.(window.__tilezillaGuest?.getGuestCode?.());
}

function processSolutionFound(lv, res, placements) {
  const guestSession = window.__tilezillaGuest?.isGuestUser?.();
  const timer = window.__puzzleTimer;
  const elapsedSec = timer?.stop?.() ?? 0;
  const hintsUsed = puzzleAttemptUsedHints();

  if (guestSession) {
    const n = Number.isFinite(res?.index) ? res.index + 1 : '★';
    let msg = `Solution #${n} found!`;
    if (res?.bonus) msg = 'Bonus solution discovered!';
    if (res?.duplicate) msg = 'You already found this solution!';
    return {
      msg,
      elapsedSec,
      tokensEarned: 0,
      bonusNotes: [],
      leaderboardSubmitted: false,
    };
  }

  const exampleRouteViewed = hasViewedExampleRoute(lv.id);
  const leaderboardEligible = !hasLeaderboardForfeit(lv.id);
  const hintRewardEligible = !hasHintCompletionRewardForfeit(lv.id);

  let leaderboardSubmitted = false;
  if (leaderboardEligible) {
    const lb = progress?.recordLeaderboardResult?.({
      challengeDate: todayChallengeDate(),
      userId: state.userId || 'gar',
      levelId: lv.id,
      solutionIndex: res.index,
      solutionBonus: !!res.bonus,
      completionTimeSeconds: elapsedSec,
      hintsUsed,
      exampleRouteViewed,
      completedAt: new Date().toISOString(),
    });
    leaderboardSubmitted = !!lb?.saved;
    if (leaderboardSubmitted && elapsedSec > 0) {
      timer?.updateBest?.(elapsedSec, lv.id);
    }
  }

  progress.recordFound(lv.id, res.index, placements, !!res.bonus, elapsedSec * 1000, {
    completionTimeSeconds: elapsedSec,
    hintsUsed,
    exampleRouteViewed,
    leaderboardSubmitted,
  });

  const bonusNotes = [];
  let tokensEarned = 0;
  if (hintRewardEligible && !hintsUsed) {
    grantHintTokens(1, 'Puzzle Completion');
    tokensEarned += 1;
    bonusNotes.push('+1 hint (no hints used)');
    if (elapsedSec > 0 && elapsedSec <= PUZZLE_TIME_BONUS_SECONDS) {
      grantHintTokens(1, 'Time Bonus');
      tokensEarned += 1;
      bonusNotes.push('+1 hint (under 30 min)');
    }
  }

  let msg = res.msg || 'Solution found!';
  if (elapsedSec > 0) {
    msg += ` Time: ${formatCompletionTime(elapsedSec)}.`;
  }
  if (leaderboardSubmitted) {
    msg += ' Recorded for leaderboard.';
  } else if (!leaderboardEligible && exampleRouteViewed) {
    msg += ' Leaderboard ineligible (example route viewed).';
  }
  if (hintsUsed) {
    const n = Number(state.hintsUsedThisPuzzle) || 0;
    if (n > 0) {
      msg += ` ${n} hint${n === 1 ? '' : 's'} used — no hint bonus.`;
    } else {
      msg += ' Hints used — no hint bonus.';
    }
  } else if (bonusNotes.length) {
    msg += ` ${bonusNotes.join(' · ')}.`;
  }

  return { msg, elapsedSec, hintsUsed, leaderboardSubmitted, bonusNotes, tokensEarned };
}

function getHintCost(hintType) {
  return HINT_COSTS[hintType] || 0;
}

function isHintTile(tile) {
  return !!tile?.fromHint;
}

function isStartTileType(typeId) {
  return typeId === 'SH' || typeId === 'ST';
}

function boardAllowsHints(tiles = state.tiles) {
  const placed = tiles || [];
  if (!placed.length) return true;
  return placed.every((t) => t.fromHint === true);
}

function hintsRemainingThisPuzzle() {
  const max = Number(CONFIG.hintsPerPuzzle) || 2;
  const used = Number(state.hintsUsedThisPuzzle) || 0;
  return Math.max(0, max - used);
}

function canAffordHint(cost) {
  const c = Number(cost) || 0;
  if (c <= 0) return false;
  return hintsRemainingThisPuzzle() >= c && getGlobalHintTokens() >= c;
}

function consumeHintTokens(cost) {
  const c = Number(cost) || 0;
  if (!canAffordHint(c)) return false;
  state.hintsUsedThisPuzzle = (Number(state.hintsUsedThisPuzzle) || 0) + c;
  state.hintTokens = Math.max(0, getGlobalHintTokens() - c);
  saveGlobalHintTokens();
  return true;
}

function canAffordExampleRoute() {
  return getGlobalHintTokens() >= EXAMPLE_ROUTE_TOKEN_COST;
}

function consumeGlobalHintTokens(amount) {
  const c = Number(amount) || 0;
  if (c <= 0 || getGlobalHintTokens() < c) return false;
  state.hintTokens = Math.max(0, getGlobalHintTokens() - c);
  saveGlobalHintTokens();
  return true;
}

function getExampleRouteTokenCost() {
  return EXAMPLE_ROUTE_TOKEN_COST;
}

/** @deprecated Use consumeHintTokens(cost) */
function consumeHintToken() {
  return consumeHintTokens(1);
}

function findFreeInstanceForTileType(typeId) {
  return (state.paletteInstances || []).find((inst) => {
    if (state.used.has(inst.instanceId)) return false;
    return tileId(inst.tile) === typeId;
  }) || null;
}

function placementFitsOnBoard(placement) {
  const typeId = tileId(placement?.tile) || placement?.tile;
  if (!typeId) return false;
  const inst = findFreeInstanceForTileType(typeId);
  if (!inst) return false;
  return canPlaceNew(placement.r, placement.c, placement.deg, inst.tile);
}

/**
 * Solution used for hints and route previews:
 * first known solution not yet discovered by the player; if all are found, Solution #1.
 */
async function selectSolutionForReveal() {
  const lv = state.currentLevel;
  if (!lv?.id) return null;
  const knownSolutions = await loadKnownSolutionsForLevel(lv);
  if (!knownSolutions.length) return null;

  const found = progress?.getFoundForLevel(lv.id) || [];
  const foundIndices = new Set(
    found
      .filter((f) => !f.bonus && Number.isFinite(f.index))
      .map((f) => f.index)
  );

  for (let i = 0; i < knownSolutions.length; i++) {
    if (foundIndices.has(i)) continue;
    const placements = knownSolutions[i]?.placements;
    if (!Array.isArray(placements) || !placements.length) continue;
    return { index: i, solution: knownSolutions[i], placements };
  }

  const firstPlacements = knownSolutions[0]?.placements;
  if (!Array.isArray(firstPlacements) || !firstPlacements.length) return null;
  return { index: 0, solution: knownSolutions[0], placements: firstPlacements };
}

function pickHintPlacement(hintType, placements) {
  const list = Array.isArray(placements) ? placements : [];
  if (hintType === 'random') {
    const candidates = list.filter((p) => {
      const id = tileId(p?.tile);
      if (!id || isStartTileType(id) || id === 'ET') return false;
      return placementFitsOnBoard(p);
    });
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  if (hintType === 'start') {
    return list.find((p) => isStartTileType(tileId(p?.tile)) && placementFitsOnBoard(p)) || null;
  }
  if (hintType === 'end') {
    return list.find((p) => tileId(p?.tile) === 'ET' && placementFitsOnBoard(p)) || null;
  }
  return null;
}

async function placeHintTile(placement) {
  const typeId = tileId(placement?.tile) || placement?.tile;
  const inst = findFreeInstanceForTileType(typeId);
  if (!inst) {
    return { ok: false, msg: `No available ${typeId} tile in the bag.` };
  }
  const r = placement.r | 0;
  const c = placement.c | 0;
  const deg = ((placement.deg | 0) % 360 + 360) % 360;
  if (!canPlaceNew(r, c, deg, inst.tile)) {
    return { ok: false, msg: `Cannot place ${typeId} hint at (${r},${c}).` };
  }
  const t = {
    id: nextId++,
    instanceId: inst.instanceId,
    tile: inst.tile,
    r,
    c,
    deg,
    fromHint: true,
  };
  state.tiles.push(t);
  claimCells(t.id, cellsForTile(t.tile, r, c, deg));
  state.used.add(inst.instanceId);
  setPaletteUsed(inst.instanceId, true);
  state.selectedTileId = null;
  state.selectedPal = null;
  syncActionButtons();
  rebuildOccFromTiles();
  await renderTiles();
  clearHover();
  return { ok: true, tile: t };
}

async function applyHint(hintType) {
  const cost = getHintCost(hintType);
  if (!cost) return { ok: false, msg: 'Unknown hint type.' };
  if (!state.currentLevel) return { ok: false, msg: 'No puzzle loaded.' };
  if (!boardAllowsHints()) {
    return { ok: false, msg: 'Hints may only be used on an empty board or a board containing only hint tiles.' };
  }
  if (!canAffordHint(cost)) {
    return { ok: false, msg: 'Not enough hint tokens for this hint.' };
  }

  const selected = await selectSolutionForReveal();
  if (!selected) {
    return { ok: false, msg: 'No solutions are available for this puzzle.' };
  }

  const placement = pickHintPlacement(hintType, selected.placements);
  if (!placement) {
    const labels = { random: 'random tile', start: 'start tile', end: 'end tile' };
    return { ok: false, msg: `Could not place ${labels[hintType] || 'hint'} from solution ${selected.index + 1}.` };
  }

  const placed = await placeHintTile(placement);
  if (!placed.ok) return placed;

  consumeHintTokens(cost);
  const typeId = tileId(placement.tile) || placement.tile;
  const labels = { random: 'Random tile', start: 'Start tile', end: 'End tile' };
  return {
    ok: true,
    msg: `${labels[hintType] || 'Hint'} placed (${typeId}) from solution ${selected.index + 1}.`,
    tile: placed.tile,
    solutionIndex: selected.index,
    cost,
  };
}

function boardHasHintTiles(tiles = state.tiles) {
  return (tiles || []).some((t) => t.fromHint);
}

// ---- Board interaction ----

async function placeSelectedPaletteTileAt(r, c) {
  if (!state.selectedPal) return false;
  const inst = getSelectedInstance();
  if (!inst) return false;
  const tileRef = inst.tile || state.previewTile;
  if (!canPlaceNew(r, c, state.deg, tileRef)) {
    status(`Place blocked @ (${r},${c}) ${state.deg} (out of bounds or overlap)`);
    return false;
  }
  const t = { id: nextId++, instanceId: inst.instanceId, tile: inst.tile, r, c, deg: state.deg, fromHint: false };
  state.tiles.push(t);
  claimCells(t.id, cellsForTile(t.tile, r, c, t.deg));
  state.used.add(inst.instanceId);
  setPaletteUsed(inst.instanceId, true);
  inst.deg = state.deg;
  state.selectedTileId = t.id;
  syncActionButtons();
  state.selectedPal = null;
  markPaletteSelected(null);
  state.keepPreview = !!keepPreviewChk?.checked;
  if (state.keepPreview) {
    state.previewTile = t.tile;
    state.deg = t.deg;
  } else {
    state.previewTile = null;
    state.deg = 0;
  }
  rotHud.textContent = state.deg + '';
  renderActivePreview();
  rebuildOccFromTiles();
  await renderTiles();
  clearHover();
  if (typeof window.__app?.onManualTilePlaced === 'function') {
    window.__app.onManualTilePlaced(t);
  }
  window.__app?.onBoardStateChanged?.();
  return true;
}

if (boardEl) boardEl.addEventListener('click', async (e) => {
  const cell=e.target.closest('.cell');
  if(!cell) return;
  const r=+cell.dataset.r, c=+cell.dataset.c;

  if(state.blockerEditMode && isSandboxLevel()){
    if(toggleBlockerAtCell(r, c)){
      buildGrid();
      rebuildOccFromTiles();
      await renderTiles();
      clearHover();
    }
    return;
  }

  // place from palette
  if(state.selectedPal){
    await placeSelectedPaletteTileAt(r, c);
    return;
  }

  // move selected tile
  if(state.selectedTileId){
    const t = state.tiles.find(x=>x.id===state.selectedTileId);
    if(!t) return;
    if(isHintTile(t)) {
      status('Hint tiles cannot be moved.');
      return;
    }
    if(!updateTilePlacement(t.id, r, c, t.deg)) { status(`Move blocked @ (${r},${c}) ${t.deg} (out of bounds or overlap)`); return; }
    
    await renderTiles();
    clearHover();
  }
});

if (boardEl) boardEl.addEventListener('mousemove', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) {
    clearHover();
    return;
  }
  renderHover(+cell.dataset.r, +cell.dataset.c);
});

if (boardEl) boardEl.addEventListener('mouseleave', clearHover);

// Rotation controls (supports rotateCW/rotateCCW and legacy rotateBtn)
async function rotateBy(delta) {
  // Rotating a placed tile
  if (state.selectedTileId) {
    const t = state.tiles.find(x => x.id === state.selectedTileId);
    if (!t) return;
    if (isHintTile(t)) {
      status('Hint tiles cannot be rotated.');
      return;
    }
    const nextDeg = (t.deg + delta + 360) % 360;
    if (updateTilePlacement(t.id, t.r, t.c, nextDeg)) {
      state.deg = nextDeg;
      rotHud.textContent = nextDeg + '';
      await renderTiles();
      return;
    }
    status(`Rotate blocked @ (${t.r},${t.c}) ${nextDeg}°`);
    return;
  }

  // Rotating preview tile (Active Tile Preview)
  if (state.selectedPal || state.previewTile) {
    const inst = getSelectedInstance();
    const nextDeg = (state.deg + delta + 360) % 360;
    state.deg = nextDeg;
    if(inst) inst.deg = nextDeg;
    rotHud.textContent = nextDeg + '';
    renderActivePreview();
  }
}

const rotateBtn = document.getElementById('rotateBtn');
if (rotateBtn) rotateBtn.addEventListener('click', async () => rotateBy(90));

const rotateCW = document.getElementById('rotateCW');
if (rotateCW) rotateCW.addEventListener('click', async () => rotateBy(90));

const rotateCCW = document.getElementById('rotateCCW');
if (rotateCCW) rotateCCW.addEventListener('click', async () => rotateBy(-90));

// Delete selected placed tile (board only)
if (deleteBtn) deleteBtn.addEventListener('click', async () => {
  if (!state.selectedTileId) { status('No placed tile selected to delete'); return; }
  const sel = state.tiles.find((t) => t.id === state.selectedTileId);
  if (sel && isHintTile(sel)) {
    status('Hint tiles cannot be removed individually. Reset the puzzle to remove them.');
    return;
  }
  const removed = removeTileById(state.selectedTileId);
  state.selectedTileId = null;
  syncActionButtons();
  if (!removed) { status('Nothing deleted'); return; }
  rotHud.textContent = state.deg + '';
  rebuildOccFromTiles();
  await renderTiles();
  clearHover();
  status(`Deleted ${removed.tile}`);
});

const toggleEdgesBtn = document.getElementById('toggleEdgesBtn');
if (toggleEdgesBtn) toggleEdgesBtn.addEventListener('click', async () => {
  state.showEdges = !state.showEdges;
  await renderTiles();
});

if (toggleBlockerBtn) toggleBlockerBtn.addEventListener('click', () => {
  if(!isSandboxLevel()) return;
  setBlockerEditMode(!state.blockerEditMode);
  status(state.blockerEditMode ? 'Blocker mode: click cells to place/remove B1' : 'Blocker mode off');
});


async function clearBoard(){
  state.tiles=[];
  state.used.clear();
  state.hintsUsedThisPuzzle = 0;
  state.selectedTileId = null;
  syncActionButtons();
  state.selectedPal = null;
  state.previewTile = null;
  state.deg = 0;
  if(rotHud) rotHud.textContent = '0';
  markPaletteSelected(null);
  renderActivePreview();
  occ = Array(CONFIG.rows * CONFIG.cols).fill(null);
  state.selectedPal=null;
  state.selectedTileId=null;
  syncActionButtons();
  state.deg=0;
  if(rotHud) rotHud.textContent='0';
  for(const inst of (state.paletteInstances || [])) setPaletteUsed(inst.instanceId,false);
  rebuildOccFromTiles();
  await renderTiles();
  clearHover();
  if(solver) solver.reset();
}

const clearBtn = document.getElementById('clearBtn');
if (clearBtn) clearBtn.addEventListener('click', () => clearBoard());



// Debug helpers: inject a known solve and step rebuildOccFromTiles() tile-by-tile.
async function debugClearBoard() {
  state.tiles=[];
  state.used.clear();
  state.selectedTileId = null;
  syncActionButtons();
  state.selectedPal = null;
  state.previewTile = null;
  state.deg = 0;
  rotHud.textContent = '0';
  markPaletteSelected(null);
  renderActivePreview();
  occ = Array(CONFIG.rows * CONFIG.cols).fill(null);
  state.selectedPal=null;
  state.selectedTileId=null;
  syncActionButtons();
  state.deg=0;
  document.getElementById('rotHud').textContent='0';
  // Unmark palette
  for (const inst of (state.paletteInstances || [])) setPaletteUsed(inst.instanceId, false);
}

async function debugInjectSolveWithVL({ step=false } = {}) {
  await debugClearBoard();
  // Reset ids for consistent debug output
  nextId = 1;

  for (const p of DEBUG_SOLVE_WITH_VL) {
    const t = { id: nextId++, tile: p.tile, r: p.r, c: p.c, deg: p.deg };
    state.tiles.push(t);
    state.used.add(t.tile);
    setPaletteUsed(t.tile, true);

    if (step) {
      rebuildOccFromTiles();
      await renderTiles();
      // Let the UI paint so you can watch it lock in.
      await new Promise(r => setTimeout(r, 0));
    }
  }

  rebuildOccFromTiles();
  await renderTiles();
  const res = validateBoard();
  document.getElementById('valOut').textContent = res.ok ? 'OK' : (res.msg || 'INVALID');
}

// Expose helpers for console use
window.__debugInjectSolveWithVL = debugInjectSolveWithVL;
const validateBtn = document.getElementById('validateBtn');
if (validateBtn) validateBtn.addEventListener('click', () => {
  const v=validateBoard();
  document.getElementById('valOut').textContent = v.ok ? `OK: ${v.msg}` : `FAIL: ${v.msg}`;
  solver.log('Validate: ' + (v.ok?'OK':'FAIL') + '  ' + v.msg);
});


// ---- Load data ----
async function loadJson(url){
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

const solveDocCache = new Map();
const solveDocRawCache = new Map();
async function loadSolveDocForLevel(level){
  const file = level?.solvesFile;
  if(!file) return null;
  if(solveDocRawCache.has(file)) return solveDocRawCache.get(file);
  try{
    const doc = await loadJson(`/solves/${file}`);
    solveDocRawCache.set(file, doc);
    return doc;
  }catch(e){
    console.warn('solve file unavailable', file, e);
    // Do not cache failures; transient 404/stale-server cases should retry on next load.
    return null;
  }
}

function inferBlockersFromSolveDoc(doc, defaultType='B1'){
  const sols = Array.isArray(doc?.solutions) ? doc.solutions : [];
  const placements = Array.isArray(sols[0]?.placements) ? sols[0].placements : [];
  if(!placements.length) return [];
  const out = [];
  for(const p of placements){
    const t = tileId(p?.tile) || p?.tile;
    if(t !== 'B1' && t !== 'B2') continue;
    const r = Number(p?.r);
    const c = Number(p?.c);
    if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
    const deg = Number(p?.deg) || 0;
    out.push([r|0, c|0, t || defaultType, deg]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || String(a[2]).localeCompare(String(b[2])));
  return out;
}

/** Collapse 180° (or C4 on squares) rotation duplicates — matches progress.equivalenceKey. */
function dedupeKnownSolutionsForLevel(solutions, level){
  if(!Array.isArray(solutions) || solutions.length < 2) return solutions;
  const rows = level?.board?.rows;
  const cols = level?.board?.cols;
  if(!rows || !cols || !progress) return solutions;
  const kept = [];
  const seen = new Set();
  for(const sol of solutions){
    const pl = progress.playablePlacements(sol?.placements || []);
    const key = progress.equivalenceKey(pl, rows, cols);
    if(seen.has(key)) continue;
    seen.add(key);
    kept.push(sol);
  }
  return kept.length < solutions.length ? kept : solutions;
}

async function loadKnownSolutionsForLevel(level){
  const file = level?.solvesFile;
  if(!file){
    if(level?.id) state.solutionCountByLevelId[level.id] = 0;
    return [];
  }
  if(solveDocCache.has(file)){
    const sols = dedupeKnownSolutionsForLevel(solveDocCache.get(file), level);
    if(level?.id) state.solutionCountByLevelId[level.id] = Array.isArray(sols) ? sols.length : 0;
    return sols;
  }
  try{
    const doc = await loadJson(`/solves/${file}`);
    const raw = Array.isArray(doc?.solutions) ? doc.solutions : [];
    const sols = dedupeKnownSolutionsForLevel(raw, level);
    solveDocCache.set(file, sols);
    if(level?.id) state.solutionCountByLevelId[level.id] = sols.length;
    return sols;
  }catch(e){
    console.warn('solve file unavailable', file, e);
    return [];
  }
}

function totalKnownForLevel(lev){
  if(!lev?.id) return 0;
  const cached = state.solutionCountByLevelId[lev.id];
  if(Number.isFinite(cached) && cached >= 0) return cached;
  const lib = Number(lev.totalUniqueSolutions);
  if(Number.isFinite(lib) && lib > 0) return lib;
  return 0;
}

const CHALLENGE_LABELS = {
  'daily-challenge': 'Daily Challenge',
  adventure: 'Adventure',
  random: 'Random Puzzle',
  library: 'Puzzle Library',
  profile: 'Profile',
};

function challengeLabelForScreen(screen) {
  return CHALLENGE_LABELS[screen] || 'Puzzle';
}

async function getMenuPuzzleInfo() {
  const lv = state.currentLevel;
  if (!lv?.id) return null;
  const known = await loadKnownSolutionsForLevel(lv);
  const found = progress?.getFoundForLevel(lv.id) || [];
  const foundCount = found.filter((f) => !f.bonus && Number.isFinite(f.index)).length;
  const total = known.length || totalKnownForLevel(lv);
  const screen = document.querySelector('.tz-app')?.dataset?.screen || 'daily-challenge';
  const rows = lv.board?.rows;
  const cols = lv.board?.cols;
  const size = Number.isFinite(rows) && Number.isFinite(cols)
    ? `${cols} x ${rows}`
    : '—';
  const hintsMax = Number(CONFIG.hintsPerPuzzle) || 2;
  const hintsUsed = Math.min(hintsMax, Number(state.hintsUsedThisPuzzle) || 0);
  const bestTimeSeconds = window.__puzzleTimer?.loadBest?.(lv.id, state.userId) ?? null;
  const firstSolvedAt = progress?.getFirstSolvedAt?.(lv.id) || null;
  return {
    id: lv.id,
    name: lv.name || lv.id,
    size,
    challengeStatus: challengeLabelForScreen(screen),
    totalSolutions: total,
    solutionsFound: foundCount,
    hasKnownTotal: levelHasKnownTotal(lv),
    viewedExampleRoute: progress?.hasViewedExampleRoute?.(lv.id) || false,
    hintsUsed,
    hintsMax,
    bestTimeSeconds,
    firstSolvedAt,
  };
}

async function getMenuFoundSolutions() {
  const lv = state.currentLevel;
  if (!lv?.id) return { entries: [], total: 0, foundCount: 0, hasKnownTotal: false };
  const known = await loadKnownSolutionsForLevel(lv);
  const found = progress?.getFoundForLevel(lv.id) || [];
  const entries = found
    .filter((f) => !f.bonus && Number.isFinite(f.index))
    .map((f) => {
      const placements = Array.isArray(f.placements) && f.placements.length
        ? f.placements
        : (known[f.index]?.placements || []);
      return {
        index: f.index,
        label: `Solution #${f.index + 1}`,
        placements,
      };
    })
    .sort((a, b) => a.index - b.index);
  const total = known.length || totalKnownForLevel(lv);
  return {
    entries,
    total,
    foundCount: entries.length,
    hasKnownTotal: levelHasKnownTotal(lv),
    level: lv,
  };
}

async function getMenuDevKnownSolutions() {
  const lv = state.currentLevel;
  if (!lv?.id) return { entries: [], total: 0, level: null };
  const known = await loadKnownSolutionsForLevel(lv);
  const entries = known
    .map((k, i) => ({
      index: i,
      label: `Known #${i + 1}`,
      placements: Array.isArray(k?.placements) && k.placements.length
        ? k.placements
        : [],
    }))
    .filter((e) => e.placements.length);
  return { entries, total: entries.length, level: lv };
}

async function applyKnownSolutionToBoard(solutionIndex) {
  if (!solutions?.apply || !state.currentLevel) return false;
  const known = await loadKnownSolutionsForLevel(state.currentLevel);
  const p = known[solutionIndex]?.placements;
  if (!Array.isArray(p) || !p.length) return false;
  await solutions.apply(p);
  return true;
}

async function applyPlacementsToBoard(placements, { message } = {}) {
  if (!solutions?.apply || !Array.isArray(placements) || !placements.length) return false;
  window.__discoveryRecord?.hide?.();
  await solutions.apply(placements);
  if (message) setCheckMessage(message, 'checkSuccess');
  return true;
}

async function loadFirstValidKnownSolution() {
  if (!solutions?.apply || !state.currentLevel) return false;
  const known = await loadKnownSolutionsForLevel(state.currentLevel);
  for (let i = 0; i < known.length; i += 1) {
    const p = known[i]?.placements;
    if (!Array.isArray(p) || !p.length) continue;
    await solutions.apply(p);
    const v = validateBoard();
    if (v.ok) return true;
  }
  return false;
}

const ROUTE_PREVIEW_MAX_PX = 300;
const ROUTE_PREVIEW_BG = '#e8dcc4';

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function previewPlacementSortRank(tileRef) {
  const id = tileId(tileRef);
  if (id === 'SH') return 0;
  if (id === 'ET') return 1;
  return 2;
}

function blockersForPreviewLevel(level) {
  if (state.currentLevel?.id === level?.id && state.blockerPlacements?.length) {
    return state.blockerPlacements.map((bp) => ({
      r: bp.r,
      c: bp.c,
      bt: bp.tile,
      deg: bp.deg || 0,
    }));
  }
  const out = [];
  const defaultBlockerType = (typeof level?.blockerType === 'string' && level.blockerType) ? level.blockerType : 'B1';
  for (const b of (level?.blockers || [])) {
    const parsed = parseBlockerEntry(b, defaultBlockerType);
    if (!parsed) continue;
    out.push({ r: parsed.r, c: parsed.c, bt: parsed.tile, deg: parsed.deg });
  }
  return out;
}

async function drawPreviewTileOnBoard(ctx, tileName, deg, left, top, cellPx, tilesetName) {
  const rot = ((deg % 360) + 360) % 360;
  const { w, h } = boardTilePixelSize(tileName, rot);
  const url = await rotatedDataURL(tileName, rot, tilesetName);
  const img = await loadImageElement(url);
  ctx.drawImage(img, left, top, w, h);
}

function drawPreviewStartEndMarkers(ctx, placements, cellPx) {
  for (const p of placements || []) {
    const id = tileId(p?.tile);
    if (id !== 'SH' && id !== 'ET') continue;
    const cx = (p.c * cellPx) + (cellPx / 2);
    const cy = (p.r * cellPx) + (cellPx / 2);
    const radius = Math.max(4, cellPx * 0.18);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = id === 'SH' ? 'rgba(72, 150, 88, 0.92)' : 'rgba(176, 62, 52, 0.92)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, cellPx * 0.06);
    ctx.strokeStyle = 'rgba(255, 248, 230, 0.95)';
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Render a solution using the normal tile artwork, then scale for menu preview.
 * Preview mode hides edges, grid, outlines, and metadata — route + start/end only.
 */
async function renderSolutionPreview(targetCanvas, placements, { level, tileset, maxPx } = {}) {
  const lv = level || state.currentLevel;
  if (!targetCanvas || !lv?.board || !Array.isArray(placements) || !placements.length) return false;

  const rows = Number(lv.board.rows) || CONFIG.rows;
  const cols = Number(lv.board.cols) || CONFIG.cols;
  const cellPx = CONFIG.cellPx || 55;
  const boardW = cols * cellPx;
  const boardH = rows * cellPx;
  const previewTileset = tileset || null;

  const off = document.createElement('canvas');
  off.width = boardW;
  off.height = boardH;
  const ctx = off.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = ROUTE_PREVIEW_BG;
  ctx.fillRect(0, 0, boardW, boardH);

  const prevShowEdges = state.showEdges;
  state.showEdges = false;
  try {
    for (const blocker of blockersForPreviewLevel(lv)) {
      await drawPreviewTileOnBoard(
        ctx,
        blocker.bt,
        blocker.deg || 0,
        blocker.c * cellPx,
        blocker.r * cellPx,
        cellPx,
        previewTileset,
      );
    }

    const sorted = [...placements].sort(
      (a, b) => previewPlacementSortRank(a.tile) - previewPlacementSortRank(b.tile)
        || (a.r - b.r) || (a.c - b.c)
    );

    for (const p of sorted) {
      const cells = cellsForTile(p.tile, p.r, p.c, p.deg);
      if (!cells.length) continue;
      const rMin = Math.min(...cells.map((cell) => cell[0]));
      const cMin = Math.min(...cells.map((cell) => cell[1]));
      await drawPreviewTileOnBoard(ctx, p.tile, p.deg, cMin * cellPx, rMin * cellPx, cellPx, previewTileset);
    }

    drawPreviewStartEndMarkers(ctx, placements, cellPx);
  } finally {
    state.showEdges = prevShowEdges;
  }

  const cap = maxPx ?? ROUTE_PREVIEW_MAX_PX;
  const scale = Math.min(cap / boardW, cap / boardH);
  const outW = Math.max(1, Math.round(boardW * scale));
  const outH = Math.max(1, Math.round(boardH * scale));

  targetCanvas.width = outW;
  targetCanvas.height = outH;
  const tctx = targetCanvas.getContext('2d');
  if (!tctx) return false;
  tctx.fillStyle = ROUTE_PREVIEW_BG;
  tctx.fillRect(0, 0, outW, outH);
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(off, 0, 0, outW, outH);
  return true;
}

async function getRevealSolutionPlacements() {
  const selected = await selectSolutionForReveal();
  return selected?.placements || null;
}

/** @deprecated Use getRevealSolutionPlacements — kept for existing callers. */
async function findClosestSolutionPlacements() {
  return getRevealSolutionPlacements();
}

async function getExampleRoutePlacements() {
  const lv = state.currentLevel;
  if (!lv?.id) return null;
  const stored = progress?.getExampleRouteRecord?.(lv.id);
  if (Array.isArray(stored?.placements) && stored.placements.length) {
    return stored.placements;
  }
  return getRevealSolutionPlacements();
}

function hasViewedExampleRoute(levelId) {
  const id = levelId || state.currentLevel?.id;
  return id ? !!progress?.hasViewedExampleRoute?.(id) : false;
}

function hasLeaderboardForfeit(levelId) {
  const id = levelId || state.currentLevel?.id;
  return id ? !!progress?.hasLeaderboardForfeit?.(id) : false;
}

function hasHintCompletionRewardForfeit(levelId) {
  const id = levelId || state.currentLevel?.id;
  return id ? !!progress?.hasHintCompletionRewardForfeit?.(id) : false;
}

async function purchaseExampleRoute() {
  const lv = state.currentLevel;
  if (!lv?.id || !progress) return { ok: false, reason: 'no-level' };

  if (progress.hasViewedExampleRoute(lv.id)) {
    return { ok: true, charged: false, alreadyViewed: true };
  }

  if (!canAffordExampleRoute()) {
    return { ok: false, reason: 'insufficient-tokens' };
  }

  if (!consumeGlobalHintTokens(EXAMPLE_ROUTE_TOKEN_COST)) {
    return { ok: false, reason: 'insufficient-tokens' };
  }

  const placements = await getRevealSolutionPlacements();

  progress.markViewedExampleRoute(lv.id, {
    playerId: state.userId || 'gar',
    tokenCost: EXAMPLE_ROUTE_TOKEN_COST,
    leaderboardForfeited: true,
    hintCompletionRewardForfeited: true,
    placements: Array.isArray(placements)
      ? placements.map((p) => ({ tile: p.tile, r: p.r, c: p.c, deg: p.deg }))
      : [],
  });

  return {
    ok: true,
    charged: true,
    tokenCost: EXAMPLE_ROUTE_TOKEN_COST,
    playerId: state.userId || 'gar',
    puzzleId: lv.id,
  };
}

function formatLevelSelectLabel(lev){
  const base = lev.name || lev.id;
  if(!progress) return base;
  const total = totalKnownForLevel(lev);
  const stats = progress.getStats(lev.id, total > 0 ? total : 1);
  const knownFound = stats.found;
  if(total <= 0){
    const bon = stats.bonuses > 0 ? ` ★${stats.bonuses}` : '';
    return `${base}  (${knownFound}/?)${bon}`;
  }
  const done = knownFound >= total;
  const prefix = done ? '✓ ' : '';
  const bonusNote = stats.bonuses > 0 ? ` ★${stats.bonuses}` : '';
  return `${prefix}${base}  ${Math.min(knownFound, total)}/${total}${bonusNote}`;
}

function sortedLevelsForSelection(sizeKey, tier=''){
  const levels = levelsForSelection(sizeKey, tier);
  return [...levels].sort((a, b) =>
    (a.id || '').localeCompare(b.id || '', undefined, { numeric: true })
  );
}

function refreshLevelSelectOptionTexts(){
  if(!levelSelect || !state.allLevels) return;
  for(let i = 0; i < levelSelect.options.length; i++){
    const opt = levelSelect.options[i];
    const lev = state.allLevels.find(l => l.id === opt.value);
    if(lev) opt.textContent = formatLevelSelectLabel(lev);
  }
}

async function loadAllLevels(){
  // New sharded manifest format: /data/levels/index.json + bucket files.
  try{
    const idx = await loadJson('/data/levels/index.json');
    if(idx && Array.isArray(idx.buckets) && idx.buckets.length){
      state.levelBuckets = idx.buckets
        .filter(b => b && typeof b.size === 'string' && typeof b.tier === 'string')
        .map(b => ({ size: b.size, tier: b.tier, file: b.file, count: Number(b.count || 0) }));
      const docs = await Promise.all(idx.buckets.map(async b => {
        try{
          return await loadJson(`/data/levels/${b.file}`);
        }catch(e){
          console.warn('level bucket unavailable', b?.file, e);
          return null;
        }
      }));
      const levels = docs.flatMap(d => Array.isArray(d?.levels) ? d.levels : []);
      if(levels.length) return levels;
    }
  }catch(e){
    console.warn('levels index unavailable', e);
  }
  state.levelBuckets = [];
  return null;
}

/**
 * Canonical size key for UI/filtering. The readable "5x6" board is rows=6, cols=5 in data.
 * Legacy saves may still use size key "6x5".
 */
function sizeValueFromBoard(rows, cols){
  const r = Number(rows), c = Number(cols);
  if(r === 6 && c === 5) return '5x6';
  return `${r}x${c}`;
}

/** Resolve board dimensions from a size key (accepts legacy "6x5"). */
function rowsColsFromSizeKey(sizeKey){
  if(sizeKey === '5x6' || sizeKey === '6x5') return [6, 5];
  const [r, c] = String(sizeKey || '').split('x').map(Number);
  return [Number.isFinite(r) ? r : 0, Number.isFinite(c) ? c : 0];
}

/** Manifest buckets and levels use "5x6" for this family; alias legacy "6x5". */
function manifestSizeForBuckets(uiSizeKey){
  if(uiSizeKey === '5x6' || uiSizeKey === '6x5') return '5x6';
  return uiSizeKey;
}

/** Dropdown / HUD label for a size key */
function sizeLabelFromKey(sizeKey){
  if(sizeKey === '5x6' || sizeKey === '6x5') return '5×6';
  const [r, c] = rowsColsFromSizeKey(sizeKey);
  return `${r}×${c}`;
}

/** HUD label from live board dimensions */
function displayDimsForBoard(rows, cols){
  const r = Number(rows), c = Number(cols);
  if(r === 6 && c === 5) return '5×6';
  return `${r}×${c}`;
}

function classifyTierForLevel(level){
  const id = String(level?.id || '');
  const m = id.match(/^\d+x\d+-(\d[A-Z])-[A-Z]{3}$/);
  if(m && m[1]) return m[1];
  const tiles = level?.tiles && typeof level.tiles === 'object' ? Object.keys(level.tiles) : [];
  const hasSuperior = tiles.some(t => ['CR','CT','CQ','E1','E2','B2','2SH','2ET'].includes(t));
  if(hasSuperior) return '0C';
  const hasAdvanced = tiles.some(t => ['SZ','SS','DS','QC','QS','DC'].includes(t));
  if(hasAdvanced) return '0B';
  return '0A';
}

function getSortedLevels(){
  if(!state.allLevels || !state.allLevels.length) return [];
  return [...state.allLevels].sort((a, b) => {
    const ar = (a.board?.rows || 0) * (a.board?.cols || 0);
    const br = (b.board?.rows || 0) * (b.board?.cols || 0);
    if (ar !== br) return ar - br;
    if ((a.board?.rows || 0) !== (b.board?.rows || 0)) return (a.board?.rows || 0) - (b.board?.rows || 0);
    return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
  });
}

function availableTiersForSize(sizeKey){
  if(!sizeKey) return [];
  if(Array.isArray(state.levelBuckets) && state.levelBuckets.length){
    const manifest = manifestSizeForBuckets(sizeKey);
    const tiers = [...new Set(state.levelBuckets.filter(b => b.size === manifest).map(b => b.tier))];
    return tiers.sort((a,b)=>a.localeCompare(b));
  }
  // Fallback: derive from tile groups for selected size.
  const tiers = new Set();
  for(const lv of (state.allLevels || [])){
    const b = lv?.board;
    if(!b || sizeValueFromBoard(b.rows, b.cols) !== sizeKey) continue;
    tiers.add(classifyTierForLevel(lv));
  }
  return [...tiers].sort((a,b)=>a.localeCompare(b));
}

function levelsForSelection(sizeKey, tier){
  if(!state.allLevels) return [];
  const [rows, cols] = rowsColsFromSizeKey(sizeKey);
  return state.allLevels.filter(l => {
    if(!l.board || l.board.rows !== rows || l.board.cols !== cols) return false;
    if(!tier) return true;
    return classifyTierForLevel(l) === tier;
  });
}

function normalizeTilesForSig(tiles){
  const out = {};
  if(!tiles || typeof tiles !== 'object') return out;
  for(const [k,v] of Object.entries(tiles)){
    const id = tileId(k) || k;
    const n = Number(v) || 0;
    if(id && n > 0) out[id] = n;
  }
  return out;
}

function blockersForSig(blockers, defaultType='B1'){
  const out = [];
  const list = Array.isArray(blockers) ? blockers : [];
  for(const b of list){
    if(!Array.isArray(b) || b.length < 2) continue;
    const r = Number(b[0]);
    const c = Number(b[1]);
    if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
    const t = (typeof b[2] === 'string' && b[2]) ? b[2] : defaultType;
    out.push([r|0, c|0, t]);
  }
  out.sort((a,b) => a[0]-b[0] || a[1]-b[1] || String(a[2]).localeCompare(String(b[2])));
  return out;
}

function inferDocBlockers(doc){
  if(doc && doc.inferHoleBlockers === false) {
    return blockersForSig(doc?.blockers || [], 'B1');
  }
  const board = doc?.board || {};
  const rows = Number(board?.rows || 0);
  const cols = Number(board?.cols || 0);
  if(!rows || !cols) return [];
  const explicit = blockersForSig(doc?.blockers || [], 'B1');
  if(explicit.length) return explicit;

  const sols = Array.isArray(doc?.solutions) ? doc.solutions : [];
  const placements = Array.isArray(sols[0]?.placements) ? sols[0].placements : [];
  if(!placements.length) return [];

  const occupied = new Set();
  for(const p of placements){
    const tile = tileId(p?.tile) || p?.tile;
    if(!tile) continue;
    const r = Number(p?.r || 0);
    const c = Number(p?.c || 0);
    const deg = Number(p?.deg || 0);
    const k = resolveTileKey(tile);
    const shape = state.liveEdges?.[k]?.shape;
    if(!Array.isArray(shape) || !shape.length){
      for(const [rr,cc] of cellsForTile(tile, r, c, deg)){
        occupied.add(cellKey(rr,cc));
      }
      continue;
    }
    const baseDr = Math.min(...shape.map(x => Number(x?.dr) || 0));
    const baseDc = Math.min(...shape.map(x => Number(x?.dc) || 0));
    for(const cell of shape){
      const dr0 = (Number(cell?.dr) || 0) - baseDr;
      const dc0 = (Number(cell?.dc) || 0) - baseDc;
      const [rrOff, ccOff] = rotateCell(dr0, dc0, deg);
      occupied.add(cellKey((r|0) + rrOff, (c|0) + ccOff));
    }
  }

  const inferred = [];
  for(let rr=0; rr<rows; rr++){
    for(let cc=0; cc<cols; cc++){
      if(!occupied.has(cellKey(rr,cc))) inferred.push([rr,cc,'B1']);
    }
  }
  return inferred;
}

function levelSpecKey(rows, cols, tiles, blockers){
  const t = Object.entries(normalizeTilesForSig(tiles)).sort((a,b)=>a[0].localeCompare(b[0]));
  const b = blockersForSig(blockers, 'B1');
  return JSON.stringify({ rows:Number(rows)||0, cols:Number(cols)||0, tiles:t, blockers:b });
}

function findLevelBySolveDoc(doc){
  const rows = Number(doc?.board?.rows || 0);
  const cols = Number(doc?.board?.cols || 0);
  if(!rows || !cols) return null;
  const inferredBlockers = inferDocBlockers(doc);
  const rawTiles = normalizeTilesForSig(doc?.tiles || {});
  // Compatibility: some solve docs encode fixed blockers in tiles (B1/B2),
  // while level specs encode them in blockers[]. Try both signatures.
  const strippedTiles = { ...rawTiles };
  if(inferredBlockers.length){
    delete strippedTiles.B1;
    delete strippedTiles.B2;
  }
  const candidateKeys = [
    levelSpecKey(rows, cols, rawTiles, inferredBlockers),
    levelSpecKey(rows, cols, strippedTiles, inferredBlockers),
  ];
  const levels = state.allLevels || [];
  const matches = [];
  for(const lv of levels){
    const lvKey = levelSpecKey(lv?.board?.rows, lv?.board?.cols, lv?.tiles || {}, lv?.blockers || []);
    if(candidateKeys.includes(lvKey)) matches.push(lv);
  }
  if(!matches.length) return null;

  const isNewStyleId = (id) => typeof id === 'string' && /^\d+x\d+-0[ABC]-[A-Z]{3}$/.test(id);
  const idWeight = (id) => {
    if(!isNewStyleId(id)) return 99;
    // Prefer base tier first when both old/new duplicates exist.
    const tier = id.split('-')[1] || '0C';
    if(tier === '0A') return 0;
    if(tier === '0B') return 1;
    return 2;
  };

  matches.sort((a,b) => {
    const wa = idWeight(a?.id);
    const wb = idWeight(b?.id);
    if(wa !== wb) return wa - wb;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
  return matches[0];
}

function extractPlacementsFromFlexibleDoc(doc){
  if(!doc || typeof doc !== 'object') return null;
  if(Array.isArray(doc.placements)) return doc.placements;
  if(Array.isArray(doc.solutions) && doc.solutions[0] && Array.isArray(doc.solutions[0].placements)){
    return doc.solutions[0].placements;
  }
  return null;
}

function parseBoardDimsFromLevelId(levelId){
  const m = typeof levelId === 'string' && /^(\d+)x(\d+)-/.exec(levelId);
  if(!m) return [0, 0];
  return [Number(m[1]) || 0, Number(m[2]) || 0];
}

function splitSnakeAndBlockerPlacements(placements){
  const snake = [];
  const blk = [];
  for(const p of placements || []){
    const t = tileId(p?.tile) || p?.tile;
    if(t === 'B1' || t === 'B2'){
      blk.push([p.r | 0, p.c | 0, t, p.deg | 0]);
    }else{
      snake.push(p);
    }
  }
  return { snake, blockersFromPlacements: blockersForSig(blk, 'B1') };
}

function inferBoardBBoxSnakePlacements(snakePl){
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  for(const p of snakePl){
    for(const [rr, cc] of cellsForTile(p.tile, p.r | 0, p.c | 0, p.deg | 0)){
      minR = Math.min(minR, rr);
      maxR = Math.max(maxR, rr);
      minC = Math.min(minC, cc);
      maxC = Math.max(maxC, cc);
    }
  }
  if(!Number.isFinite(minR)) return null;
  return {
    minR,
    minC,
    maxR,
    maxC,
    rows: maxR - minR + 1,
    cols: maxC - minC + 1,
  };
}

function shiftSnakePlacements(snakePl, dR, dC){
  return snakePl.map(p => ({ ...p, r: (p.r | 0) - dR, c: (p.c | 0) - dC }));
}

function synthesizeSolveDocFromPlacements(placements, levelIdHint){
  const { snake, blockersFromPlacements } = splitSnakeAndBlockerPlacements(placements);
  if(!snake.length) return null;
  const bb = inferBoardBBoxSnakePlacements(snake);
  if(!bb) return null;
  const shiftedSnake = shiftSnakePlacements(snake, bb.minR, bb.minC);
  let blockers = (blockersFromPlacements || []).map(([r, c, t]) => [r - bb.minR, c - bb.minC, t]);
  blockers = blockersForSig(blockers, 'B1');
  const [hintR, hintC] = parseBoardDimsFromLevelId(levelIdHint);
  const rows = hintR > 0 && hintC > 0 ? hintR : bb.rows;
  const cols = hintR > 0 && hintC > 0 ? hintC : bb.cols;
  const tiles = {};
  for(const p of shiftedSnake){
    const t = tileId(p.tile) || p.tile;
    tiles[t] = (tiles[t] || 0) + 1;
  }
  return {
    board: { rows, cols },
    tiles: normalizeTilesForSig(tiles),
    blockers,
    solutions: [{ id: '1', label: 'Solve 1', placements: shiftedSnake }],
    totalUniqueSolutions: 1,
    inferHoleBlockers: false,
  };
}

async function applyFullSolveDocFromCatalog(doc){
  if(!doc || !doc.board || !doc.tiles || !Array.isArray(doc.solutions)){
    setCheckMessage('Paste a full solve doc object with board/tiles/solutions.', 'checkWarn');
    return false;
  }
  state.lastLoadedSolveDoc = doc;

  let level = findLevelBySolveDoc(doc);
  let matchedExisting = true;
  if(!level){
    matchedExisting = false;
    const rows = Number(doc?.board?.rows || 0);
    const cols = Number(doc?.board?.cols || 0);
    const blockers = inferDocBlockers(doc);
    const tiles = normalizeTilesForSig(doc?.tiles || {});
    // If blockers are explicitly represented, keep them fixed on board and out of palette inventory.
    if(Array.isArray(blockers) && blockers.length){
      delete tiles.B1;
      delete tiles.B2;
    }
    level = {
      id: `${rows}x${cols}-DOC-PREVIEW`,
      name: 'DOC PREVIEW',
      board: { rows, cols },
      tiles,
      blockers,
      pathMode: 'single',
      pathCount: 1,
      totalUniqueSolutions: Number(doc?.totalUniqueSolutions || (Array.isArray(doc?.solutions) ? doc.solutions.length : 1) || 1),
      solvesFile: '',
    };
  }

  const sizeKey = sizeValueFromBoard(level.board.rows, level.board.cols);
  if(boardSizeSelect) boardSizeSelect.value = sizeKey;
  const tier = repopulateTierSelect(sizeKey);
  repopulateLevelSelect(sizeKey, tier);
  if(levelSelect){
    const hasLevelOption = !!levelSelect.querySelector(`option[value="${CSS.escape(level.id)}"]`);
    if(hasLevelOption) levelSelect.value = level.id;
  }
  await applyLevel(level);

  const placements = Array.isArray(doc.solutions[0]?.placements) ? doc.solutions[0].placements : [];
  if(placements.length && solutions && typeof solutions.apply === 'function'){
    await solutions.apply(placements);
  }
  if(matchedExisting){
    setCheckMessage(`Matched ${level.id} and loaded solve #1 from pasted solve doc.`, 'checkSuccess');
  }else{
    setCheckMessage(`No level match found. Loaded as temporary DOC PREVIEW for review.`, 'checkWarn');
  }
  return true;
}

/**
 * Load board from a solve doc or a minimal row:
 * full {board,tiles,solutions}, or {levelId, placements} (audit / library), or {placements} / {solutions:[{placements}]} with optional levelId for grid size.
 * @returns {Promise<boolean>}
 */
async function applySolveDocObject(doc){
  if(!doc || typeof doc !== 'object' || Array.isArray(doc)){
    setCheckMessage('Paste a JSON object (solve doc, {levelId, placements}, …).', 'checkWarn');
    return false;
  }

  if(doc.board && doc.tiles && Array.isArray(doc.solutions)){
    return await applyFullSolveDocFromCatalog(doc);
  }

  const pl = extractPlacementsFromFlexibleDoc(doc);
  if(!pl?.length){
    setCheckMessage('Need placements[], or solutions[0].placements, or a full solve doc.', 'checkWarn');
    return false;
  }

  if(doc.levelId){
    const lv = (state.allLevels || []).find(l => l.id === doc.levelId);
    if(lv){
      state.lastLoadedSolveDoc = {
        board: lv.board,
        tiles: lv.tiles,
        blockers: lv.blockers || [],
        solutions: [{ id: String(doc.id || '1'), label: String(doc.label || 'Solve 1'), placements: pl }],
        totalUniqueSolutions: Number(lv.totalUniqueSolutions) || 1,
        inferHoleBlockers: false,
      };
      const sizeKey = sizeValueFromBoard(lv.board.rows, lv.board.cols);
      if(boardSizeSelect) boardSizeSelect.value = sizeKey;
      const tier = repopulateTierSelect(sizeKey);
      repopulateLevelSelect(sizeKey, tier);
      if(levelSelect?.querySelector(`option[value="${CSS.escape(lv.id)}"]`)) levelSelect.value = lv.id;
      await applyLevel(lv);
      if(solutions && typeof solutions.apply === 'function') await solutions.apply(pl);
      setCheckMessage(`Loaded catalog level ${lv.id} from pasted solution.`, 'checkSuccess');
      return true;
    }
    const synth = synthesizeSolveDocFromPlacements(pl, doc.levelId);
    if(synth){
      return await applyFullSolveDocFromCatalog(synth);
    }
    setCheckMessage(`Unknown levelId "${doc.levelId}"; could not infer board from placements.`, 'checkWarn');
    return false;
  }

  const synth2 = synthesizeSolveDocFromPlacements(pl, '');
  if(!synth2){
    setCheckMessage('Could not infer board from placements (check tile shapes in live defs).', 'checkWarn');
    return false;
  }
  return await applyFullSolveDocFromCatalog(synth2);
}

function repopulateTierSelect(sizeKey){
  if(!tierSelect) return '';
  const tiers = availableTiersForSize(sizeKey);
  tierSelect.innerHTML = '';
  if(!tiers.length){
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'All tiers';
    tierSelect.appendChild(o);
    tierSelect.value = '';
    return '';
  }
  for(const t of tiers){
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    tierSelect.appendChild(o);
  }
  const preferred = tiers.includes(tierSelect.value) ? tierSelect.value : tiers[0];
  tierSelect.value = preferred;
  return preferred;
}

function repopulateLevelSelect(sizeKey, tier=''){
  if(!levelSelect || !state.allLevels) return;
  const levels = sortedLevelsForSelection(sizeKey, tier);
  const prev = levelSelect.value;
  levelSelect.innerHTML = '';
  for (const lev of levels) {
    const o = document.createElement('option');
    o.value = lev.id;
    o.textContent = formatLevelSelectLabel(lev);
    levelSelect.appendChild(o);
  }
  if(prev && levels.some(l => l.id === prev)){
    levelSelect.value = prev;
  }
}

function populateSizeAndLevelUI(){
  if(!boardSizeSelect || !state.allLevels) return;
  const sizes = [...new Set(state.allLevels
    .filter(l => l.board && Number.isFinite(l.board.rows) && Number.isFinite(l.board.cols))
    .map(l => sizeValueFromBoard(l.board.rows, l.board.cols)))];
  // Order by rows then cols (not by cell count — otherwise 4×4 sorts before 3×6).
  sizes.sort((a, b) => {
    const [ar, ac] = rowsColsFromSizeKey(a);
    const [br, bc] = rowsColsFromSizeKey(b);
    return ar - br || ac - bc;
  });
  boardSizeSelect.innerHTML = '';
  for (const s of sizes) {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = sizeLabelFromKey(s);
    boardSizeSelect.appendChild(o);
  }
  if (sizes.length) {
    const first = getSortedLevels()[0];
    const s = first ? sizeValueFromBoard(first.board.rows, first.board.cols) : sizes[0];
    boardSizeSelect.value = s;
    const tier = repopulateTierSelect(s);
    repopulateLevelSelect(s, tier);
    if (first && levelSelect) levelSelect.value = first.id;
  }
}

async function applyLevel(level){
  if(!level || !level.board) return;
  state.currentLevel = level;
  state.levelTileCounts = (level.tiles && typeof level.tiles === 'object') ? normalizeLevelTiles(level.tiles) : null;
  resetBlockerState();
  const defaultBlockerType = (typeof level.blockerType === 'string' && level.blockerType) ? level.blockerType : 'B1';
  let blockers = Array.isArray(level.blockers) ? level.blockers : [];
  const hasBlockerTilesInInventory = !!(state.levelTileCounts?.B1 || state.levelTileCounts?.B2);
  if(!blockers.length && hasBlockerTilesInInventory){
    const doc = await loadSolveDocForLevel(level);
    const inferred = inferBlockersFromSolveDoc(doc, defaultBlockerType);
    if(inferred.length){
      blockers = inferred;
      console.info(`Inferred ${inferred.length} blocker(s) from ${level?.solvesFile} for ${level?.id || '(unknown level)'}.`);
    }
  }
  for (const b of blockers) {
    const parsed = parseBlockerEntry(b, defaultBlockerType);
    if (parsed) addBlockerPlacement(parsed);
  }
  CONFIG.rows = Number(level.board.rows);
  CONFIG.cols = Number(level.board.cols);
  state.tiles = [];
  state.used.clear();
  state.selectedTileId = null;
  state.selectedPal = null;
  state.previewTile = null;
  state.deg = 0;
  state.hintsUsedThisPuzzle = 0;
  nextId = 1;
  occ = Array(CONFIG.rows * CONFIG.cols).fill(null);

  state.tileCatalog = state.levelTileCounts ? Object.keys(state.levelTileCounts) : Object.keys(state.liveEdges).filter(k => !k.startsWith('_'));
  state.paletteInstances = buildPaletteInstances();
  if(levelHud) levelHud.textContent = level.name || level.id;
  const screen = document.querySelector('.tz-app')?.dataset?.screen;
  if (progress && level?.id) {
    progress.touchLevelPlayed(level.id, {
      journalSource: ['adventure', 'daily-challenge', 'random'].includes(screen) ? screen : null,
    });
  }
  const knownSolutions = await loadKnownSolutionsForLevel(level);
  renderFoundList(level.id, knownSolutions);
  setCheckMessage('');
  setBlockerEditMode(false);
  syncBlockerToolbar();
  if(blockerHud){
    const hasBlockers = Array.isArray(blockers) && blockers.length > 0;
    blockerHud.style.visibility = (!isSandboxLevel() && hasBlockers) ? 'visible' : 'hidden';
  }
  if(levelSelect) levelSelect.value = level.id;
  setCssCell();
  buildGrid();
  await buildPalette();
  renderActivePreview();
  rebuildOccFromTiles();
  await renderTiles();
  const previewPlacements = Array.isArray(level?.previewPlacements) ? level.previewPlacements : [];
  // Auto-loading known/preview solutions is admin-only.
  if(isAdminUser() && solutions && typeof solutions.apply === 'function'){
    let loadedValidPreview = false;
    if(previewPlacements.length){
      await solutions.apply(previewPlacements);
      const v = validateBoard();
      if(v.ok){
        loadedValidPreview = true;
        setCheckMessage('Preview solution loaded. Use Check Solution to validate, then approve/reject.', 'checkWarn');
      }
    }
    // Review safety: if preview #1 is invalid, try known solves and pick the first valid one.
    if(!loadedValidPreview && Array.isArray(knownSolutions) && knownSolutions.length){
      for(let i=0;i<knownSolutions.length;i++){
        const p = Array.isArray(knownSolutions[i]?.placements) ? knownSolutions[i].placements : [];
        if(!p.length) continue;
        await solutions.apply(p);
        const v = validateBoard();
        if(v.ok){
          loadedValidPreview = true;
          setCheckMessage(`Loaded valid known solve #${i+1}.`, 'checkWarn');
          break;
        }
      }
    }
  }
  clearHover();
  if (solver) solver.reset();
}

async function init(){
  state.showEdges = false;
  state.liveEdgeValidation = false;
  state.showTileBorders = true;
  state.usedTileBehavior = 'REMOVE';
  // tiles-live-edges.json is the single source of truth (includes counts)
  state.liveEdges = await loadJson(CONFIG.liveEdgesUrl);
  try { state.tileSets = await loadJson(CONFIG.tileSetsUrl); } catch(e) { console.warn('tilesets unavailable', e); }
  state.activeTileset = state.tileSets?.activeTileset || 'gray-backs';
  const qsTileset = new URLSearchParams(location.search).get('tileset');
  if (qsTileset && state.tileSets?.tilesets?.[qsTileset]) {
    state.activeTileset = qsTileset;
  }
  state.tileAssetById = {};
  for (const k of Object.keys(state.liveEdges || {})) {
    if (k.startsWith('_')) continue;
    const id = tileId(k);
    if (id && !state.tileAssetById[id]) state.tileAssetById[id] = k;
  }
  const isTilezillaShell = !!document.querySelector('.tz-app');
  const loadedLevels = await loadAllLevels();
  if (loadedLevels && loadedLevels.length) {
    state.allLevels = loadedLevels;
    populateSizeAndLevelUI();
    if (!isTilezillaShell) {
      const first = getSortedLevels()[0];
      if (first) await applyLevel(first);
    }
  } else {
    state.allLevels = null;
    state.levelTileCounts = null;
    state.tileCatalog = Object.keys(state.liveEdges).filter(k => !k.startsWith('_'));
    state.paletteInstances = buildPaletteInstances();
    await buildPalette();
    renderActivePreview();
    rebuildOccFromTiles();
    await renderTiles();
    if(boardSizeSelect) boardSizeSelect.innerHTML = '';
    if(levelSelect) levelSelect.innerHTML = '';
    if(levelHud) levelHud.textContent = '--';
    if(progressHud) progressHud.textContent = '0 / ?';
    if(foundStatus) foundStatus.textContent = 'No solutions found yet.';
    if(foundList) foundList.innerHTML = '';
    if(blockerHud) blockerHud.style.visibility = 'hidden';
    syncBlockerToolbar();
  }

  if (boardSizeSelect && state.allLevels) {
    boardSizeSelect.addEventListener('change', async () => {
      const sizeKey = boardSizeSelect.value;
      if(loadingHud) loadingHud.style.display = 'flex';
      const tier = repopulateTierSelect(sizeKey);
      repopulateLevelSelect(sizeKey, tier);
      const levels = sortedLevelsForSelection(sizeKey, tier);
      if (levels[0]) await applyLevel(levels[0]);
      refreshLevelSelectOptionTexts();
      updateProgressHud(state.currentLevel);
      if(loadingHud) loadingHud.style.display = 'none';
    });
  }
  if (tierSelect && state.allLevels) {
    tierSelect.addEventListener('change', async () => {
      const sizeKey = boardSizeSelect?.value || '';
      const tier = tierSelect.value || '';
      if(loadingHud) loadingHud.style.display = 'flex';
      repopulateLevelSelect(sizeKey, tier);
      const levels = sortedLevelsForSelection(sizeKey, tier);
      if (levels[0]) await applyLevel(levels[0]);
      refreshLevelSelectOptionTexts();
      updateProgressHud(state.currentLevel);
      if(loadingHud) loadingHud.style.display = 'none';
    });
  }
  if (levelSelect && state.allLevels) {
    levelSelect.addEventListener('change', async () => {
      const lev = state.allLevels.find(l => l.id === levelSelect.value);
      if(lev){
        if(loadingHud) loadingHud.style.display = 'flex';
        await applyLevel(lev);
        refreshLevelSelectOptionTexts();
        updateProgressHud(state.currentLevel);
        if(loadingHud) loadingHud.style.display = 'none';
      }
    });
  }

  if (checkSolBtn) {
    checkSolBtn.addEventListener('click', async () => {
      const lv = state.currentLevel;
      if(!lv || !progress){
        setCheckMessage('No level selected.', 'checkWarn');
        return;
      }
      const knownSolutions = await loadKnownSolutionsForLevel(lv);
      const placements = currentPortablePlacements();
      const invMismatch = getInventoryMismatch(state.levelTileCounts, state.tiles);
      if(invMismatch){
        setCheckMessage(
          `Place every tile for this puzzle (${invMismatch.id}: placed ${invMismatch.got}, expected ${invMismatch.need}).`,
          'checkWarn'
        );
        return;
      }

      // Catalog match is authoritative — compare to solutions on file before geometry rules
      // that can reject layouts the solver stored (e.g. multi-path SH/ET adjacency).
      const catalogRes = progress.checkSolution(lv.id, placements, knownSolutions);
      if(catalogRes.duplicate){
        window.__invalidSolve?.hide?.();
        if (isGuestDailySession()) {
          showGuestDailySolveUi(lv, catalogRes, placements);
          return;
        }
        renderFoundList(lv.id, knownSolutions);
        window.__discoveryRecord?.show?.(
          window.__discoveryRecord.buildDuplicatePayload(lv, catalogRes),
        );
        return;
      }
      if(Number.isFinite(catalogRes.index)){
        window.__invalidSolve?.hide?.();
        if (isGuestDailySession()) {
          showGuestDailySolveUi(lv, catalogRes, placements);
          return;
        }
        const outcome = processSolutionFound(lv, catalogRes, placements);
        setCheckMessage(outcome.msg, 'checkSuccess');
        renderFoundList(lv.id, knownSolutions);
        refreshLevelSelectOptionTexts();

        const found = progress.getFoundForLevel(lv.id) || [];
        const solutionsFoundTotal = found.filter((f) => Number.isFinite(f.index)).length;
        const totalKnown = knownSolutions.length || totalKnownForLevel(lv);

        const challengePopup = window.__challengeBeginPopup;
        if (challengePopup?.shouldShowProgress?.(lv.id)) {
          const state = challengePopup.getProgressState(lv.id, progress);
          await challengePopup.showProgressAfterSolve({
            found: state.found,
            total: state.required,
          });
          if (!state.incomplete) {
            window.__discoveryRecord?.show?.(
              window.__discoveryRecord.buildPayload(lv, catalogRes, outcome, solutionsFoundTotal, totalKnown),
            );
          }
          return;
        }

        window.__discoveryRecord?.show?.(
          window.__discoveryRecord.buildPayload(lv, catalogRes, outcome, solutionsFoundTotal, totalKnown),
        );
        return;
      }

      const v = validateBoard();
      if(!v.ok){
        window.__invalidSolve?.show?.();
        setCheckMessage(v.msg || 'Board is not valid yet.', 'checkError');
        return;
      }

      const outcome = processSolutionFound(lv, catalogRes, placements);
      if(catalogRes.bonus) setCheckMessage(outcome.msg, 'checkBonus');
      else setCheckMessage(outcome.msg, 'checkSuccess');
      renderFoundList(lv.id, knownSolutions);
      refreshLevelSelectOptionTexts();

      const found = progress.getFoundForLevel(lv.id) || [];
      const solutionsFoundTotal = found.filter((f) => Number.isFinite(f.index)).length;
      const totalKnown = knownSolutions.length || totalKnownForLevel(lv);

      const challengePopup = window.__challengeBeginPopup;
      if (challengePopup?.shouldShowProgress?.(lv.id)) {
        const state = challengePopup.getProgressState(lv.id, progress);
        await challengePopup.showProgressAfterSolve({
          found: state.found,
          total: state.required,
        });
        if (!state.incomplete) {
          window.__discoveryRecord?.show?.(
            window.__discoveryRecord.buildPayload(lv, catalogRes, outcome, solutionsFoundTotal, totalKnown),
          );
        }
        return;
      }

      window.__discoveryRecord?.show?.(
        window.__discoveryRecord.buildPayload(lv, catalogRes, outcome, solutionsFoundTotal, totalKnown),
      );
    });
  }

  if (resetLevelBtn) {
    resetLevelBtn.addEventListener('click', async () => {
      const lv = state.currentLevel;
      if(!lv || !progress) return;
      if(!confirm(`Reset found progress for ${lv.name || lv.id}?`)) return;
      progress.resetLevel(lv.id);
      const knownSolutions = await loadKnownSolutionsForLevel(lv);
      renderFoundList(lv.id, knownSolutions);
      refreshLevelSelectOptionTexts();
      setCheckMessage('Level progress reset.', 'checkWarn');
    });
  }

  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', async () => {
      if(!progress) return;
      if(!confirm('Reset found progress for ALL levels?')) return;
      progress.resetAll();
      const lv = state.currentLevel;
      const knownSolutions = lv ? await loadKnownSolutionsForLevel(lv) : [];
      if(lv) renderFoundList(lv.id, knownSolutions);
      else updateProgressHud(null);
      refreshLevelSelectOptionTexts();
      setCheckMessage('All progress reset.', 'checkWarn');
    });
  }

  if (viewFoundBtn) {
    viewFoundBtn.addEventListener('click', async () => {
      if(!foundList) return;
      const idx = Number(foundList.value);
      if(!Number.isFinite(idx) || idx < 0 || idx >= state.foundListEntries.length){
        setCheckMessage('Select a solution to view first.', 'checkWarn');
        return;
      }
      if(!solutions){
        setCheckMessage('Solutions module is not ready yet.', 'checkWarn');
        return;
      }
      const item = state.foundListEntries[idx];
      const placements = Array.isArray(item?.placements) ? item.placements : [];
      if(!placements.length){
        setCheckMessage('Selected entry has no placements.', 'checkWarn');
        return;
      }
      await solutions.apply(placements);
      setCheckMessage(`Loaded ${item.label} onto the board.`, 'checkSuccess');
    });
  }

  if (loadSolveDocBtn) {
    loadSolveDocBtn.addEventListener('click', async () => {
      const solveDocEl = document.getElementById('solveDocText');
      const textEl = document.getElementById('solutionsText');
      const rawInput = (solveDocEl?.value || '').trim() || (textEl?.value || '').trim();
      if(!rawInput){
        setCheckMessage('Paste solve doc JSON into "Load Solve JSON" box first.', 'checkWarn');
        return;
      }
      let parsed;
      const normalizePastedJson = (raw) => {
        let txt = String(raw || '').trim();
        // Accept fenced markdown blocks.
        txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        // Accept copied editor selections like "L123:..."
        txt = txt
          .split(/\r?\n/)
          .map(line => line.replace(/^\s*L\d+:\s?/, ''))
          .join('\n')
          .trim();
        return txt;
      };
      const tryParseLoose = (raw) => {
        const txt = normalizePastedJson(raw);
        if(!txt) return null;
        try { return JSON.parse(txt); } catch(_) {}
        // If user pasted extra text before/after JSON, extract the largest object/array span.
        const iObj = txt.indexOf('{');
        const jObj = txt.lastIndexOf('}');
        if(iObj >= 0 && jObj > iObj){
          const objSlice = txt.slice(iObj, jObj + 1);
          try { return JSON.parse(objSlice); } catch(_) {}
        }
        const iArr = txt.indexOf('[');
        const jArr = txt.lastIndexOf(']');
        if(iArr >= 0 && jArr > iArr){
          const arrSlice = txt.slice(iArr, jArr + 1);
          try { return JSON.parse(arrSlice); } catch(_) {}
        }
        return null;
      };
      try{
        parsed = tryParseLoose(rawInput);
      }catch(_e){
        parsed = null;
      }
      if(!parsed){
        setCheckMessage('Invalid JSON in Solutions box.', 'checkError');
        return;
      }
      let doc = Array.isArray(parsed) && parsed.length === 1 && parsed[0] && typeof parsed[0] === 'object'
        ? parsed[0]
        : parsed;
      if(!doc || typeof doc !== 'object' || Array.isArray(doc)){
        setCheckMessage('Paste a JSON object (full solve doc, {levelId, placements}, or one library row).', 'checkWarn');
        return;
      }
      const ok = await applySolveDocObject(doc);
      if(!ok){
        const keys = Object.keys(doc).slice(0, 10).join(', ');
        setCheckMessage(`Could not load board. Parsed keys: ${keys}`, 'checkWarn');
      }
    });
  }

  if (approveReviewBtn) {
    approveReviewBtn.addEventListener('click', async () => {
      if(!isAdminUser()){
        setCheckMessage('Approve Review is admin-only.', 'checkWarn');
        return;
      }
      const doc = state.lastLoadedSolveDoc;
      if(doc && doc.board && doc.tiles && Array.isArray(doc.solutions)){
        try{
          const res = await fetch('/api/levels/approve-solve-doc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc }),
          });
          const out = await res.json();
          if(!res.ok || !out?.ok){
            setCheckMessage(out?.error || 'Approve failed.', 'checkError');
            return;
          }
          if(out.duplicate){
            setCheckMessage(`Duplicate spec: already exists as ${out.levelId}. Loaded existing level.`, 'checkWarn');
            const existing = (state.allLevels || []).find(l => l.id === out.levelId);
            if(existing) await applyLevel(existing);
            return;
          }
          // Refresh level catalog and switch to the newly created level.
          const loadedLevels = await loadAllLevels();
          if(Array.isArray(loadedLevels) && loadedLevels.length){
            state.allLevels = loadedLevels;
            populateSizeAndLevelUI();
            const created = loadedLevels.find(l => l.id === out.levelId);
            if(created){
              const sizeKey = sizeValueFromBoard(created.board.rows, created.board.cols);
              if(boardSizeSelect) boardSizeSelect.value = sizeKey;
              const tier = repopulateTierSelect(sizeKey);
              repopulateLevelSelect(sizeKey, tier);
              if(levelSelect) levelSelect.value = created.id;
              await applyLevel(created);
            }
          }
          setCheckMessage(`Approved new level ${out.levelId}.`, 'checkSuccess');
          return;
        }catch(e){
          setCheckMessage(`Approve failed: ${e?.message || e}`, 'checkError');
          return;
        }
      }
      // Legacy fallback for older review IDs
      const lv = state.currentLevel;
      if(!lv?.id || !/\-RV\d+$/i.test(lv.id)){
        setCheckMessage('Load a solve doc first, or select a review level (..-RV###).', 'checkWarn');
        return;
      }
      const approved = getApprovedReviewIds();
      if(!approved.includes(lv.id)){
        approved.push(lv.id);
        approved.sort((a,b)=>a.localeCompare(b));
        setApprovedReviewIds(approved);
      }
      const idsCsv = approved.join(',');
      setCheckMessage(`Approved ${lv.id}. Total approved: ${approved.length}.`, 'checkSuccess');
    });
  }

  // Solver + Solutions modules
  window.__app = {
    CONFIG, state, targetCells, cellsForTile, validateBoard, renderTiles, setPaletteUsed,
    renderActivePreview, syncPreviewFromBoardSelection, clearActivePreviewSelection, edgesFor, logSolver, canPlaceNew,
    updateTilePlacement, removeTileById,
    claimCells, clearTileFromOcc, rebuildOccFromTiles, occ, occIdx, resolveTileAsset, tileId,
    applySolveDocObject, applyLevel, buildGrid, setCssCell, clearBoard, totalKnownForLevel,
    applyGameplaySettings, buildPalette, getInventoryMismatch, boardAllowsHints,
    hintsRemainingThisPuzzle, consumeHintToken, consumeHintTokens,
    getGlobalHintTokens, grantHintTokens, getHintCost, canAffordHint, applyHint, isHintTile,
    puzzleAttemptUsedHints, processSolutionFound, PUZZLE_TIME_BONUS_SECONDS,
    boardHasHintTiles,
    getMenuPuzzleInfo, getMenuFoundSolutions, getDevKnownSolutions: getMenuDevKnownSolutions,
    getExampleRoutePlacements, selectSolutionForReveal, getRevealSolutionPlacements,
    applyKnownSolutionToBoard, loadFirstValidKnownSolution, applyPlacementsToBoard,
    clearBoard, setCheckMessage, isDevUser,
    canAffordExampleRoute, getExampleRouteTokenCost, purchaseExampleRoute,
    hasViewedExampleRoute, hasLeaderboardForfeit, hasHintCompletionRewardForfeit,
    renderSolutionPreview, findClosestSolutionPlacements,
    loadKnownSolutionsForLevel,
    onManualTilePlaced: null,
    onBoardStateChanged: null,
    currentPortablePlacements, displayDimsForBoard,
    progress: null,
  };

  solver = new Solver(window.__app, document.getElementById('speed'));
  solver.bindUI({
    solveBtn: document.getElementById('solveBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stepBtn: document.getElementById('stepBtn'),
    outEl: document.getElementById('solverOut'),
    logEl: document.getElementById('solverLog'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    copyLogBtn: document.getElementById('copyLogBtn'),
    turboChk: document.getElementById('turboChk'),
    statsEl: document.getElementById('solverStats'),
  });

  // Debug: inject a known solve and step occupancy rebuild
  window.__OCC_DEBUG = window.__OCC_DEBUG || { enabled:false, breakOnTile:true, breakOnCell:false };

  const injectBtn = document.getElementById('injectSolveBtn');
  const occDbg = document.getElementById('occDebugChk');
  const occBreakTile = document.getElementById('occBreakTileChk');
  const occBreakCell = document.getElementById('occBreakCellChk');

  if (injectBtn) injectBtn.addEventListener('click', async () => {
  window.__OCC_DEBUG.enabled = !!occDbg?.checked;
  window.__OCC_DEBUG.breakOnTile = !!occBreakTile?.checked;
  window.__OCC_DEBUG.breakOnCell = !!occBreakCell?.checked;

  try {
    await window.__debugInjectSolveWithVL({ step:true });
    console.info('Injected solve + VL. Tip: open Sources > js/app.js and use the debugger to step.');
  } catch (e) {
    console.error('Inject debug solve failed', e);
    status('Inject failed: ' + (e?.message || e));
  }
});


  if (occDbg) occDbg.addEventListener('change', () => window.__OCC_DEBUG.enabled = occDbg.checked);
  if (occBreakTile) occBreakTile.addEventListener('change', () => window.__OCC_DEBUG.breakOnTile = occBreakTile.checked);
  if (occBreakCell) occBreakCell.addEventListener('change', () => window.__OCC_DEBUG.breakOnCell = occBreakCell.checked);

  solutions = new Solutions(window.__app);
  solutions.bindUI({
    listEl: document.getElementById('solList'),
    labelEl: document.getElementById('solLabel'),
    captureNewBtn: document.getElementById('captureNewBtn'),
    updateBtn: document.getElementById('updateSelectedBtn'),
    applyBtn: document.getElementById('applySelectedBtn'),
    deleteBtn: document.getElementById('deleteSelectedBtn'),
    clearBtn: document.getElementById('clearLibraryBtn'),
    exportBtn: document.getElementById('exportSolutionsBtn'),
    importBtn: document.getElementById('importSolutionsBtn'),
    applyJsonBtn: document.getElementById('applyJsonBtn'),
    textEl: document.getElementById('solutionsText'),
    hudEl: document.getElementById('solHud'),
  });

  progress = new Progress(window.__app);
  window.__app.progress = progress;
  const savedUser = localStorage.getItem('snake_active_user_v1');
  const authMode = localStorage.getItem('tilezilla_auth_mode');
  const guestCode = localStorage.getItem('guest_code');
  if (authMode === 'guest' || (guestCode && /^Guest-TZ-A\d{4}-[A-Z]{2}$/.test(savedUser || guestCode))) {
    state.userId = savedUser || guestCode;
    state.hintTokens = 0;
  } else {
    state.userId = (savedUser && typeof savedUser === 'string') ? savedUser : 'gar';
    state.hintTokens = loadGlobalHintTokens();
  }
  progress.storageKey = `snake_progress_v1_${state.userId}`;
  progress.data = progress.load();
  if (authMode === 'guest' || /^Guest-TZ-A\d{4}-[A-Z]{2}$/.test(state.userId || '')) {
    progress.data = {};
    progress.save = () => {};
  }
  if(userSelect){
    userSelect.value = state.userId;
    syncAdminUi();
    userSelect.addEventListener('change', async () => {
      state.userId = userSelect.value || 'gar';
      localStorage.setItem('snake_active_user_v1', state.userId);
      state.hintTokens = loadGlobalHintTokens();
      progress.storageKey = `snake_progress_v1_${state.userId}`;
      progress.data = progress.load();
      syncAdminUi();
      syncDevUserUi(state.userId);
      const lv = state.currentLevel;
      const knownSolutions = lv ? await loadKnownSolutionsForLevel(lv) : [];
      if(lv) renderFoundList(lv.id, knownSolutions);
      else updateProgressHud(null);
      refreshLevelSelectOptionTexts();
      window.__refreshAdventureChrome?.();
      setCheckMessage(`Active user: ${state.userId}`, 'checkWarn');
    });
  }
  syncAdminUi();
  syncDevUserUi(state.userId);
  if(state.currentLevel){
    const knownSolutions = await loadKnownSolutionsForLevel(state.currentLevel);
    renderFoundList(state.currentLevel.id, knownSolutions);
  }

  if(exportProgressBtn && progress){
    exportProgressBtn.addEventListener('click', () => {
      const snap = progress.exportSnapshot(state.userId);
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `snake-progress-${state.userId || 'user'}.json`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
  if(importProgressBtn && importProgressFile && progress){
    importProgressBtn.addEventListener('click', () => importProgressFile.click());
    importProgressFile.addEventListener('change', async () => {
      const f = importProgressFile.files?.[0];
      importProgressFile.value = '';
      if(!f) return;
      try{
        const text = await f.text();
        const parsed = JSON.parse(text);
        if(!progress.importSnapshot(parsed)){
          setCheckMessage('Invalid progress JSON file.', 'checkError');
          return;
        }
        const lv = state.currentLevel;
        const knownSolutions = lv ? await loadKnownSolutionsForLevel(lv) : [];
        if(lv) renderFoundList(lv.id, knownSolutions);
        else updateProgressHud(null);
        refreshLevelSelectOptionTexts();
        setCheckMessage('Progress imported.', 'checkSuccess');
      }catch(e){
        setCheckMessage(`Import failed: ${e?.message || e}`, 'checkError');
      }
    });
  }
  window.__app.ready = true;
}

let solver=null;
let solutions=null;
let progress=null;

init().catch(err => {
  console.error(err);
  alert(err.message);
});

// ===== Card Generator Button =====
// ===== Card Generator Button =====
const genBtn = document.getElementById('genCardsBtn');

if (genBtn) {
  genBtn.addEventListener('click', async () => {
    const status = document.getElementById('genCardsStatus');
    if (status) status.textContent = 'Generating...';

    try {
      const level = state.currentLevel;
      const payload = {
        levelId: level?.id || '',
        levelName: level?.name || '',
        board: {
          rows: Number(level?.board?.rows || CONFIG.rows || 0),
          cols: Number(level?.board?.cols || CONFIG.cols || 0),
        },
        activeTileset: state.activeTileset || 'gray-backs',
        placements: currentPortablePlacements(),
        // Card stack lists tiles required for the puzzle; board state may be empty or mask-only.
        levelTiles: (level?.tiles && typeof level.tiles === 'object') ? { ...level.tiles } : {},
      };
      let res = await fetch('/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Backward compatibility: older servers only support GET /generate-cards.
      if (res.status === 501 || res.status === 405) {
        res = await fetch('/generate-cards');
      }

      const text = await res.text(); // 👈 capture real response

      if (!res.ok) {
        throw new Error(text || 'Failed');
      }

      console.log('Generator response:', text);

      if (status) status.textContent = 'Done!';
      window.open('/cards', '_blank');

    } catch (e) {
      if (status) status.textContent = 'Error generating cards';
      console.error('Generator error:', e);
    }
  });
}
