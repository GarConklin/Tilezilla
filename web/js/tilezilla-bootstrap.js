/**
 * Tilezilla production shell — bridges UI chrome to app_v16 game engine.
 */

import { loadGameplaySettings, initSettingsUi } from './tilezilla-settings.js';

const $ = (id) => document.getElementById(id);

/**
 * Canonical CSS viewport: 390×844 (iPhone 13/14/15 portrait).
 * Small phone (360): shrink. Tablet/desktop (≥780): 2×.
 */
const TZ_DESIGN_WIDTH = 390;
const TZ_DESIGN_HEIGHT = 844;
const TZ_DESKTOP_SCALE = 2;
const TZ_DESKTOP_MIN_WIDTH = TZ_DESIGN_WIDTH * TZ_DESKTOP_SCALE; // 780

/** Fixed cell size; largest board 5×6 → 275×330. Frame size is in tilezilla-shell.css. */
const TZ_CELL_PX = 55;
const TZ_MAX_BOARD_COLS = 5;
const TZ_MAX_BOARD_ROWS = 6;

function applyUiScale() {
  const vw = window.innerWidth;
  let scale = 1;
  if (vw >= TZ_DESKTOP_MIN_WIDTH) {
    scale = TZ_DESKTOP_SCALE;
  } else if (vw < TZ_DESIGN_WIDTH) {
    scale = vw / TZ_DESIGN_WIDTH;
  }

  const stage = document.querySelector('.tz-stage');
  if (stage) {
    stage.style.zoom = String(scale);
    if (!('zoom' in stage.style)) {
      stage.style.transform = scale === 1 ? '' : `scale(${scale})`;
      stage.style.transformOrigin = 'top center';
    }
  }

  document.documentElement.dataset.uiScale = String(scale);
  document.documentElement.style.setProperty('--tz-ui-scale', String(scale));
  return scale;
}

function designCanvasWidth() {
  return TZ_DESIGN_WIDTH;
}

async function waitForApp() {
  while (!window.__app) {
    await new Promise((r) => setTimeout(r, 40));
  }
  return window.__app;
}

function formatDateLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDailyCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [challenge_date, level_id, total_solutions] = line.split(',');
    rows.push({
      date: challenge_date?.trim(),
      levelId: (level_id || '').trim().replace(/\.json$/i, ''),
      totalSolutions: Number(total_solutions) || 0,
    });
  }
  return rows;
}

async function resolveDailyChallenge(app) {
  const today = todayIso();
  let row = null;
  try {
    const csv = await fetch('/data/daily_challenges_import.csv').then((r) => r.text());
    const rows = parseDailyCsv(csv);
    row = rows.find((r) => r.date === today) || rows[0] || null;
  } catch (e) {
    console.warn('Daily challenge CSV unavailable', e);
  }

  if (row?.levelId) {
    const level = app.state.allLevels?.find((l) => l.id === row.levelId);
    if (level) return { level, meta: row };
  }

  const fallback = app.state.allLevels?.find((l) => l.id === '5x6-0B-AAC')
    || app.state.allLevels?.[0];
  return {
    level: fallback || null,
    meta: { date: today, levelId: fallback?.id, totalSolutions: fallback?.totalUniqueSolutions || 0 },
  };
}

function boardRenderSize(cols, rows) {
  return { w: cols * TZ_CELL_PX, h: rows * TZ_CELL_PX };
}

/** Center any cols×rows grid inside the 360×360 frame (flex + published grid size). */
function applyBoardFrameLayout(app) {
  const cols = app.CONFIG.cols || TZ_MAX_BOARD_COLS;
  const rows = app.CONFIG.rows || TZ_MAX_BOARD_ROWS;
  const { w, h } = boardRenderSize(cols, rows);
  document.documentElement.style.setProperty('--tz-grid-w', `${w}px`);
  document.documentElement.style.setProperty('--tz-grid-h', `${h}px`);
}

function applyResponsiveBoard(app) {
  app.CONFIG.cellPx = TZ_CELL_PX;
  document.documentElement.style.setProperty('--cell', `${TZ_CELL_PX}px`);
  document.documentElement.style.setProperty('--tz-cell-size', `${TZ_CELL_PX}px`);
  app.setCssCell();
  app.buildGrid();
  applyBoardFrameLayout(app);
}

async function refreshPaletteIfReady(app) {
  if (!app.state.paletteInstances?.length || typeof app.buildPalette !== 'function') return;
  await app.buildPalette();
  app.renderActivePreview?.();
}

function updateTileBagCount(app) {
  const el = $('tileBagCount');
  if (!el) return;
  const total = (app.state.paletteInstances || []).length;
  const used = app.state.used?.size || 0;
  const remaining = total - used;
  el.textContent = `${remaining}/${total}`;
}

function updateChallengePanel(level, meta) {
  const dateEl = $('challengeDate');
  const codeEl = $('puzzleCode');
  const countEl = $('solutionCount');
  if (dateEl) {
    dateEl.dateTime = meta?.date || '';
    dateEl.textContent = meta?.date ? formatDateLabel(meta.date) : '—';
  }
  if (codeEl) codeEl.textContent = level?.id || meta?.levelId || '—';
  if (countEl) {
    const n = meta?.totalSolutions || level?.totalUniqueSolutions;
    countEl.textContent = Number.isFinite(n) && n > 0 ? String(n) : '?';
  }
}

function updatePreviewDir() {
  const rotHud = $('rotHud');
  const previewDir = $('previewDir');
  if (rotHud && previewDir) previewDir.textContent = `${rotHud.textContent || '0'}°`;
}

function updateValidationState(app) {
  const root = document.querySelector('.tz-app');
  const title = $('previewTitle');
  const solutionsBtn = $('solutionsBtn');
  const checkBtn = $('checkSolBtn');
  const checkPanel = $('previewCheckSolve');
  if (!root || !app.state.currentLevel) return;

  const mismatch = app.getInventoryMismatch(app.state.levelTileCounts, app.state.tiles);
  const allPlaced = !mismatch;
  root.dataset.validation = allPlaced ? 'ready' : '';
  if (checkPanel) checkPanel.setAttribute('aria-hidden', allPlaced ? 'false' : 'true');
  if (title) {
    title.textContent = allPlaced ? 'All Tiles Placed' : 'Preview Tile';
  }
  if (solutionsBtn) {
    solutionsBtn.disabled = false;
    solutionsBtn.setAttribute('aria-disabled', allPlaced ? 'false' : 'true');
  }
  if (checkBtn) checkBtn.disabled = !allPlaced;
}

function showGameMessage(msg, kind = '') {
  const el = $('gameMessage');
  if (!el) return;
  el.textContent = msg || '';
  el.className = `tz-game-message${kind ? ` tz-game-message--${kind}` : ''}`;
}

function wireBagScroll() {
  const track = $('tileBagTrack');
  const prev = $('bagPrev');
  const next = $('bagNext');
  const container = $('tileBagContainer');
  if (!track) return;

  const sync = () => {
    if (container?.classList.contains('is-expanded')) {
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }
    const max = track.scrollWidth - track.clientWidth;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max - 2;
  };

  track.addEventListener('scroll', sync, { passive: true });
  prev?.addEventListener('click', () => track.scrollBy({ left: -90, behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: 90, behavior: 'smooth' }));
  new MutationObserver(sync).observe(track, { childList: true, subtree: true });
  sync();
  return sync;
}

const TILE_BAG = {
  frameCollapsedH: 94,
  trackCollapsedH: 70,
  frameHeaderH: 12,
  frameBottomPad: 12,
  handleH: 14,
  trackPad: 4,
  minRows: 2,
  maxRows: 4,
  dragThreshold: 18,
};

function getTileRowHeightPx() {
  const root = getComputedStyle(document.documentElement);
  const thumb = parseFloat(root.getPropertyValue('--tz-tile-thumb')) || 44;
  const gap = parseFloat(root.getPropertyValue('--tz-tile-gap')) || 5;
  return thumb + gap;
}

function measureTileBagExpansion(container) {
  const preview = document.querySelector('.tz-preview-section');
  const frame = container?.querySelector('.tz-tilebag-frame');
  if (!preview || !frame) {
    return {
      rows: TILE_BAG.minRows,
      trackHeight: TILE_BAG.trackCollapsedH + getTileRowHeightPx(),
      frameHeight: TILE_BAG.frameCollapsedH + getTileRowHeightPx(),
    };
  }

  const previewRect = preview.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const rowH = getTileRowHeightPx();
  const margin = 8;
  const roomAbove = Math.max(0, frameRect.top - previewRect.top - margin);
  const maxTrackH = Math.max(
    TILE_BAG.trackCollapsedH,
    roomAbove - TILE_BAG.frameHeaderH,
  );
  const rows = Math.min(
    TILE_BAG.maxRows,
    Math.max(TILE_BAG.minRows, Math.floor((maxTrackH - TILE_BAG.trackPad) / rowH)),
  );
  const trackHeight = Math.min(maxTrackH, rows * rowH + TILE_BAG.trackPad);
  const frameHeight = TILE_BAG.frameHeaderH + trackHeight + TILE_BAG.frameBottomPad;

  return { rows, trackHeight, frameHeight };
}

function applyTileBagExpandedLayout(container, expanded) {
  const frame = container.querySelector('.tz-tilebag-frame');
  const track = $('tileBagTrack');
  if (!frame || !track) return;

  if (!expanded) {
    container.classList.remove('is-expanded');
    container.style.removeProperty('--tz-tilebag-frame-h');
    container.style.removeProperty('--tz-tilebag-track-h');
    container.style.removeProperty('top');
    track.scrollTop = 0;
    return;
  }

  const { trackHeight, frameHeight } = measureTileBagExpansion(container);
  const growBy = frameHeight - TILE_BAG.frameCollapsedH;
  container.classList.add('is-expanded');
  container.style.setProperty('--tz-tilebag-frame-h', `${frameHeight}px`);
  container.style.setProperty('--tz-tilebag-track-h', `${trackHeight}px`);
  container.style.top = `calc(var(--tz-y-tilebag) + var(--tz-y-tilebag-nudge) - ${growBy}px)`;
  track.scrollLeft = 0;
}

function setTileBagExpanded(container, expanded, syncBagScroll) {
  const handle = $('tileBagExpandHandle');
  const icon = $('tileBagExpandIcon');
  const label = $('tileBagExpandLabel');
  if (!container || !handle) return;

  applyTileBagExpandedLayout(container, expanded);
  handle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (label) label.textContent = expanded ? 'Collapse tile bag' : 'Expand tile bag';
  syncBagScroll?.();
}

function wireTileBagExpand(syncBagScroll) {
  const container = $('tileBagContainer');
  const handle = $('tileBagExpandHandle');
  if (!container || !handle) return;

  let expanded = false;
  let dragStartY = 0;
  let dragActive = false;
  let dragMoved = false;

  const toggle = () => {
    expanded = !expanded;
    setTileBagExpanded(container, expanded, syncBagScroll);
  };

  handle.addEventListener('click', (e) => {
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    toggle();
  });

  handle.addEventListener('pointerdown', (e) => {
    dragActive = true;
    dragMoved = false;
    dragStartY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragActive) return;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dy) < TILE_BAG.dragThreshold) return;
    dragMoved = true;
    if (dy < 0 && !expanded) {
      expanded = true;
      setTileBagExpanded(container, expanded, syncBagScroll);
    } else if (dy > 0 && expanded) {
      expanded = false;
      setTileBagExpanded(container, expanded, syncBagScroll);
    }
    dragActive = false;
    handle.releasePointerCapture(e.pointerId);
  });

  const endDrag = (e) => {
    if (!dragActive) return;
    dragActive = false;
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', () => {
    if (expanded) applyTileBagExpandedLayout(container, true);
  });
}

function wireBottomNav() {
  const appRoot = document.querySelector('.tz-app');
  document.querySelectorAll('.tz-nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const screen = item.dataset.nav;
      document.querySelectorAll('.tz-nav-item').forEach((i) => {
        i.classList.toggle('tz-nav-item--active', i === item);
        i.toggleAttribute('aria-current', i === item ? 'page' : false);
      });
      appRoot?.setAttribute('data-screen', screen);
      if (screen !== 'daily-challenge') {
        showGameMessage(`${item.querySelector('.tz-nav-item__label')?.textContent || screen} — coming soon`, 'info');
      }
    });
  });
}

function wireActions(app) {
  $('resetBtn')?.addEventListener('click', async () => {
    await app.clearBoard();
    updateTileBagCount(app);
    updateValidationState(app);
    showGameMessage('Board reset.', 'info');
  });

  $('undoBtn')?.addEventListener('click', async () => {
    const tiles = app.state.tiles || [];
    if (!tiles.length) {
      showGameMessage('Nothing to undo.', 'info');
      return;
    }
    const last = tiles[tiles.length - 1];
    app.removeTileById(last.id);
    app.state.selectedTileId = null;
    app.rebuildOccFromTiles();
    await app.renderTiles();
    updateTileBagCount(app);
    updateValidationState(app);
    showGameMessage('Last tile removed.', 'info');
  });

  $('hintBtn')?.addEventListener('click', () => {
    showGameMessage('Hints — coming soon.', 'info');
  });
}

function wireCheckMessageMirror() {
  const checkMsg = $('checkMsg');
  if (!checkMsg) return;
  const kindMap = {
    checkSuccess: 'success',
    checkError: 'error',
    checkWarn: 'info',
    checkBonus: 'success',
  };
  const sync = () => {
    const kind = [...checkMsg.classList].find((c) => kindMap[c]);
    showGameMessage(checkMsg.textContent, kind ? kindMap[kind] : '');
  };
  new MutationObserver(sync).observe(checkMsg, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
}

function wirePreviewSync() {
  const rotHud = $('rotHud');
  if (!rotHud) return;
  new MutationObserver(updatePreviewDir).observe(rotHud, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  updatePreviewDir();
}

function wirePaletteHooks(app) {
  const palette = $('palette');
  if (!palette) return;
  const refresh = () => {
    updateTileBagCount(app);
    updateValidationState(app);
    updatePreviewDir();
  };
  palette.addEventListener('click', () => setTimeout(refresh, 0));
  new MutationObserver(refresh).observe(palette, { childList: true, subtree: true, attributes: true });
}

function wireBoardHooks(app) {
  const board = $('board');
  if (!board) return;
  board.addEventListener('click', () => setTimeout(() => {
    updateTileBagCount(app);
    updateValidationState(app);
    updatePreviewDir();
  }, 0));
}

function startTimer() {
  const el = $('timerCurrent');
  if (!el) return;
  const start = Date.now();
  const tick = () => {
    const sec = Math.floor((Date.now() - start) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  };
  tick();
  setInterval(tick, 1000);
}

async function loadDailyPuzzle(app) {
  const loading = $('loadingHud');
  const appRoot = document.querySelector('.tz-app');
  if (loading) loading.hidden = false;
  appRoot?.classList.add('is-loading-puzzle');

  try {
    while (!app.state.allLevels?.length) {
      await new Promise((r) => setTimeout(r, 50));
    }

    const { level, meta } = await resolveDailyChallenge(app);
    if (!level) throw new Error('No puzzle level available');

    applyResponsiveBoard(app);
    await app.applyLevel(level);
    await refreshPaletteIfReady(app);
    updateChallengePanel(level, meta);
    updateTileBagCount(app);
    updateValidationState(app);
    showGameMessage(`Daily challenge loaded: ${level.id}`, 'info');
  } catch (e) {
    console.error(e);
    showGameMessage(`Failed to load puzzle: ${e.message}`, 'error');
  } finally {
    appRoot?.classList.remove('is-loading-puzzle');
    if (loading) loading.hidden = true;
  }
}

async function init() {
  applyUiScale();
  const syncBagScroll = wireBagScroll();
  wireTileBagExpand(syncBagScroll);
  wireBottomNav();
  startTimer();

  const app = await waitForApp();
  applyResponsiveBoard(app);
  const settings = loadGameplaySettings();
  app.applyGameplaySettings(settings);
  initSettingsUi({
    onChange: (next) => {
      app.applyGameplaySettings(next);
      app.renderTiles();
      updateTileBagCount(app);
    },
  });

  $('solutionsBtn')?.addEventListener('click', () => {
    $('checkSolBtn')?.click();
  });

  $('previewCheckSolBtn')?.addEventListener('click', () => {
    $('checkSolBtn')?.click();
  });

  wireActions(app);
  wireCheckMessageMirror();
  wirePreviewSync();
  wirePaletteHooks(app);
  wireBoardHooks(app);

  window.addEventListener('resize', () => {
    applyUiScale();
    applyResponsiveBoard(app);
  });

  await loadDailyPuzzle(app);
}

init().catch((err) => {
  console.error(err);
  showGameMessage(err.message, 'error');
});
