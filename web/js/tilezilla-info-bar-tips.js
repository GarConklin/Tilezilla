/**
 * Puzzle intro tips — shown when a puzzle bag includes a tile type not yet encountered.
 */

const SKIP_BAG_TILES = new Set(['B1', 'B2', 'E1', 'E2', 'OB', 'SB', '_comment']);
/** Always in every bag — do not trigger the "new tile" message. */
const TIP_IGNORE_TILES = new Set(['SH', 'ET']);

const NEW_TILE_INTRO = 'New tile type added to tilebag';
const TIP_AUTO_HIDE_MS = 30_000;

let tipHideTimer = null;

function clearTipHideTimer() {
  if (tipHideTimer != null) {
    clearTimeout(tipHideTimer);
    tipHideTimer = null;
  }
}

function scheduleTipHide() {
  clearTipHideTimer();
  tipHideTimer = setTimeout(() => {
    tipHideTimer = null;
    setInfoBarTipText('');
  }, TIP_AUTO_HIDE_MS);
}

export function formatInfoBarSolutions(level, meta) {
  const n = meta?.totalSolutions || level?.totalUniqueSolutions;
  const label = Number.isFinite(n) && n > 0 ? String(n) : '?';
  return label === '?' ? '— solutions' : `${label} Possible Solutions`;
}

export function setInfoBarSolutionsText(text) {
  const infoBar = document.getElementById('infoBarText');
  if (!infoBar) return;
  infoBar.textContent = text || '';
}

export function setInfoBarTipText(text) {
  const tipEl = document.getElementById('infoBarTip');
  if (!tipEl) return;
  const show = Boolean(text);
  tipEl.textContent = show ? text : '';
  tipEl.hidden = !show;
}

export function clearInfoBarTip() {
  clearTipHideTimer();
  setInfoBarTipText('');
}

function tilesInLevel(level) {
  const bag = level?.tiles;
  if (!bag || typeof bag !== 'object') return [];
  return Object.entries(bag)
    .filter(([id, count]) => !SKIP_BAG_TILES.has(id) && (Number(count) || 0) > 0)
    .map(([id]) => id);
}

export function isTwoSnakeLevel(level) {
  if (!level) return false;
  const tiles = level.tiles || {};
  const sh = Number(tiles.SH) || 0;
  const et = Number(tiles.ET) || 0;
  if (sh >= 2 && et >= 2) return true;
  const pathCount = Number(level.pathCount) || 0;
  if (pathCount >= 2 && (level.pathMode === 'multi' || level.pathMode === 'multi-flex')) {
    return true;
  }
  return false;
}

function tipWorthyNewTiles(newlyEncountered) {
  return (newlyEncountered || []).filter((id) => !TIP_IGNORE_TILES.has(id));
}

/** Update solutions line + optional intro tip (auto-hides after 30s). */
export function maybeShowInfoBarIntro(app, level, meta) {
  clearInfoBarTip();
  setInfoBarSolutionsText(formatInfoBarSolutions(level, meta));

  const progress = app?.progress;
  if (!progress || !level) return;

  if (isTwoSnakeLevel(level) && !progress.hasSeenTwoSnakeIntro?.()) {
    progress.markTwoSnakeIntroSeen?.();
  }

  const bagTiles = tilesInLevel(level);
  const newlyEncountered = progress.recordTilesEncountered?.(bagTiles) || [];
  const tipTiles = tipWorthyNewTiles(newlyEncountered);
  if (!tipTiles.length) return;

  setInfoBarTipText(NEW_TILE_INTRO);
  scheduleTipHide();
}
