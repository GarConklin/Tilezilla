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
  const vh = window.innerHeight;
  let scale = 1;
  if (vw >= TZ_DESKTOP_MIN_WIDTH) {
    scale = TZ_DESKTOP_SCALE;
  } else if (vw < TZ_DESIGN_WIDTH) {
    scale = vw / TZ_DESIGN_WIDTH;
  }
  // Keep the full 844px artboard on screen (2× desktop scale can clip bottom nav).
  scale = Math.min(scale, vh / TZ_DESIGN_HEIGHT);

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

function getRemainingBagTileCount(app) {
  if (app?.state?.paletteInstances?.length) {
    const total = app.state.paletteInstances.length;
    const used = app.state.used?.size || 0;
    return Math.max(0, total - used);
  }
  return $('tileBagTrack')?.querySelectorAll('.palItem:not(.used):not(.palItem--removed)').length ?? 0;
}

let syncTileBagExpandAvailability = () => {};

function updateTileBagCount(app) {
  const el = $('tileBagCount');
  if (!el) return;
  const total = (app.state.paletteInstances || []).length;
  const used = app.state.used?.size || 0;
  const remaining = total - used;
  el.textContent = `${remaining}/${total}`;
  syncTileBagExpandAvailability(app);
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

const HINT_BOARD_TOOLTIP =
  'Hints may only be used on an empty board or a board containing only hint tiles.';
const HINT_LOCKED_LABEL = 'Reset To Use';

/** Dev adventure rank display — maps to DB player_progress + adventure_rank later. */
const DEV_PLAYER_ADVENTURE = {
  gar: { rankId: 1, subLevel: 1, stepProgress: 0, stepTotal: 1000 },
  Arn: { rankId: 4, subLevel: 1, stepProgress: 0, stepTotal: 1000 },
};

let adventureRanksCache = null;

async function loadAdventureRanks() {
  if (!adventureRanksCache) {
    const res = await fetch('/data/adventure_ranks.json');
    if (!res.ok) throw new Error('Failed to load adventure ranks');
    adventureRanksCache = await res.json();
  }
  return adventureRanksCache;
}

function romanForSubLevel(subLevel) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return numerals[subLevel - 1] || String(subLevel);
}

function resolveDevAdventureProfile(userId) {
  const key = userId || 'gar';
  return DEV_PLAYER_ADVENTURE[key] || DEV_PLAYER_ADVENTURE.gar;
}

async function updateRankPanel(app) {
  const profile = resolveDevAdventureProfile(app?.state?.userId);
  const ranks = await loadAdventureRanks();
  const rank = ranks.find((r) => r.rank_id === profile.rankId) || ranks[0];
  const total = Math.max(1, profile.stepTotal || 1000);
  const current = Math.max(0, Math.min(profile.stepProgress || 0, total));
  const pct = (current / total) * 100;

  const badge = $('rankBadgeImg');
  const subLevelEl = $('rankSubLevel');
  const glyph = $('rankRomanGlyph');
  const fill = $('rankProgressFill');
  const text = $('rankProgressText');
  const roman = romanForSubLevel(profile.subLevel);

  if (badge) {
    badge.src = rank.badge_image;
    badge.alt = `${rank.rank_name} rank`;
  }
  if (glyph) glyph.textContent = roman;
  if (subLevelEl) subLevelEl.setAttribute('aria-label', `Sublevel ${roman}`);
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = `${current} / ${total}`;
}

function formatHintTokenLabel(app) {
  const max = app.CONFIG?.hintsPerPuzzle ?? 2;
  const remaining = app.hintsRemainingThisPuzzle?.() ?? max;
  return `${remaining} of ${max}`;
}

let selectedHintType = null;

function updateGlobalHintCount(app) {
  const el = $('hintCount');
  if (el) el.textContent = String(app.getGlobalHintTokens?.() ?? 0);
}

function updateHintMenuAvailable(app) {
  const el = $('hintMenuAvailable');
  if (el) el.textContent = formatHintTokenLabel(app);
}

function updateHintMenuControls(app) {
  document.querySelectorAll('.tz-hint-menu__token').forEach((btn) => {
    const type = btn.dataset.hintType;
    const cost = app.getHintCost?.(type) ?? 1;
    const afford = app.canAffordHint?.(cost) ?? false;
    btn.disabled = !afford;
    btn.setAttribute('aria-disabled', afford ? 'false' : 'true');
    if (!afford) {
      btn.classList.remove('is-selected');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
  if (selectedHintType) {
    const selectedBtn = document.querySelector(`.tz-hint-menu__token[data-hint-type="${selectedHintType}"]`);
    if (selectedBtn?.disabled) selectedHintType = null;
  }
  const useBtn = $('hintMenuUseBtn');
  if (useBtn) {
    const cost = selectedHintType ? (app.getHintCost?.(selectedHintType) ?? 0) : 0;
    useBtn.disabled = !selectedHintType || !(app.canAffordHint?.(cost));
  }
}

function resetHintMenuSelection() {
  selectedHintType = null;
  document.querySelectorAll('.tz-hint-menu__token').forEach((btn) => {
    btn.classList.remove('is-selected');
    btn.setAttribute('aria-pressed', 'false');
  });
  const useBtn = $('hintMenuUseBtn');
  if (useBtn) useBtn.disabled = true;
}

function openHintMenu(app) {
  const root = $('hintMenuRoot');
  if (!root) return;
  resetHintMenuSelection();
  updateHintMenuAvailable(app);
  updateHintMenuControls(app);
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  $('hintMenuCloseBtn')?.focus();
}

function closeHintMenu() {
  const root = $('hintMenuRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove('tz-modal-open');
  resetHintMenuSelection();
  $('hintBtn')?.focus();
}

function wireHintMenu(app) {
  $('hintBtn')?.addEventListener('click', () => {
    const btn = $('hintBtn');
    if (btn?.getAttribute('aria-disabled') === 'true') return;
    openHintMenu(app);
  });

  $('hintMenuCloseBtn')?.addEventListener('click', closeHintMenu);
  $('hintMenuBackdrop')?.addEventListener('click', closeHintMenu);
  $('hintMenuCancelBtn')?.addEventListener('click', closeHintMenu);

  document.querySelectorAll('.tz-hint-menu__token').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      const type = btn.dataset.hintType;
      if (!type) return;
      selectedHintType = type;
      document.querySelectorAll('.tz-hint-menu__token').forEach((other) => {
        const on = other === btn;
        other.classList.toggle('is-selected', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      updateHintMenuControls(app);
    });
  });

  $('hintMenuUseBtn')?.addEventListener('click', async () => {
    if (!selectedHintType) return;
    const cost = app.getHintCost?.(selectedHintType) ?? 0;
    if (!(app.canAffordHint?.(cost))) {
      showGameMessage('Not enough hint tokens for this hint.', 'error');
      return;
    }
    const useBtn = $('hintMenuUseBtn');
    if (useBtn) useBtn.disabled = true;
    const res = await app.applyHint?.(selectedHintType);
    if (!res?.ok) {
      showGameMessage(res?.msg || 'Hint could not be applied.', 'error');
      updateHintMenuControls(app);
      return;
    }
    updateTileBagCount(app);
    updateGlobalHintCount(app);
    updateValidationState(app);
    showGameMessage(res.msg, 'success');
    closeHintMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('hintMenuRoot')?.hidden) return;
    closeHintMenu();
  });
}

function updateHintButtonState(app) {
  const btn = $('hintBtn');
  const label = $('hintBtnLabel');
  if (!btn) return;

  const boardAllowed = app.boardAllowsHints?.(app.state.tiles) ?? true;
  const remaining = app.hintsRemainingThisPuzzle?.() ?? 0;
  const tokenLabel = formatHintTokenLabel(app);
  const exhausted = remaining <= 0;
  const locked = !boardAllowed || exhausted;

  btn.classList.toggle('is-locked', locked);
  btn.setAttribute('aria-disabled', locked ? 'true' : 'false');

  if (!boardAllowed) {
    btn.title = HINT_BOARD_TOOLTIP;
    btn.setAttribute('aria-label', `Hint locked — ${HINT_LOCKED_LABEL}. ${HINT_BOARD_TOOLTIP}`);
    if (label) label.textContent = HINT_LOCKED_LABEL;
    return;
  }

  if (exhausted) {
    btn.title = 'No hint tokens remaining for this puzzle.';
    btn.setAttribute('aria-label', `Hint — ${tokenLabel}. No hints remaining.`);
    if (label) label.textContent = tokenLabel;
    return;
  }

  btn.title = HINT_BOARD_TOOLTIP;
  btn.setAttribute('aria-label', `Hint — ${tokenLabel}`);
  if (label) label.textContent = tokenLabel;
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
  updateHintButtonState(app);
  updateGlobalHintCount(app);
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
  frameBottomPad: 8,
  handleH: 14,
  trackPad: 4,
  minRows: 2,
  maxRows: 3,
  dragThreshold: 18,
};

function readCssPx(varName, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(varName));
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function readCssFloat(varName, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(varName));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function readCssInt(varName, fallback) {
  const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue(varName), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function getTileRowHeightPx() {
  const root = getComputedStyle(document.documentElement);
  const gap = parseFloat(root.getPropertyValue('--tz-tile-gap')) || 5;
  const thumbs = document.querySelectorAll('.tz-palette-h .palItem:not(.palItem--removed) .palThumb');
  if (thumbs.length) {
    let maxH = 0;
    for (const thumb of thumbs) {
      maxH = Math.max(maxH, thumb.getBoundingClientRect().height);
    }
    if (maxH > 0) return maxH + gap;
  }
  const cell = parseFloat(root.getPropertyValue('--tz-tilebag-cell')) || 34;
  const hScale = parseFloat(root.getPropertyValue('--tz-tilebag-thumb-h-scale')) || 0.8;
  return Math.ceil(cell * hScale) + gap;
}

function measureTileBagExpansion(container) {
  const preview = document.querySelector('.tz-preview-section');
  const frame = container?.querySelector('.tz-tilebag-frame');
  const maxRows = readCssInt('--tz-tilebag-expanded-max-rows', TILE_BAG.maxRows);
  const capTop = readCssPx('--tz-tilebag-expanded-cap-top', 26);
  const capBottom = readCssPx('--tz-tilebag-expanded-cap-bottom', 24);
  const rowH = getTileRowHeightPx();
  const rows = maxRows;

  let trackHeight = rows * rowH + TILE_BAG.trackPad;
  let frameHeight = capTop + trackHeight + capBottom;

  if (preview && frame) {
    const previewRect = preview.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const margin = 8;
    const gapAbove = frameRect.top - previewRect.bottom;
    const maxUpwardGrow = readCssPx('--tz-tilebag-expanded-max-overlap', 72);
    const maxFrameHeight =
      TILE_BAG.frameCollapsedH + Math.max(0, gapAbove - margin) + maxUpwardGrow;
    if (frameHeight > maxFrameHeight) {
      frameHeight = Math.max(TILE_BAG.frameCollapsedH, maxFrameHeight);
      trackHeight = Math.max(
        TILE_BAG.trackCollapsedH,
        frameHeight - capTop - capBottom,
      );
    }
  }

  const growScale = readCssFloat('--tz-tilebag-expanded-grow-scale', 1);
  if (growScale !== 1) {
    frameHeight = Math.max(
      TILE_BAG.frameCollapsedH,
      Math.round(frameHeight * growScale),
    );
    trackHeight = Math.max(
      TILE_BAG.trackCollapsedH,
      frameHeight - capTop - capBottom,
    );
  }

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
    frame.style.removeProperty('--tz-tilebag-frame-h');
    track.style.removeProperty('--tz-tilebag-track-h');
    track.scrollTop = 0;
    return;
  }

  const { trackHeight, frameHeight } = measureTileBagExpansion(container);
  container.classList.add('is-expanded');
  container.style.setProperty('--tz-tilebag-frame-h', `${frameHeight}px`);
  container.style.setProperty('--tz-tilebag-track-h', `${trackHeight}px`);
  frame.style.setProperty('--tz-tilebag-frame-h', `${frameHeight}px`);
  track.style.setProperty('--tz-tilebag-track-h', `${trackHeight}px`);
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

function wireTileBagExpand(syncBagScroll, getApp) {
  const container = $('tileBagContainer');
  const handle = $('tileBagExpandHandle');
  if (!container || !handle) return;

  let expanded = false;
  let dragStartY = 0;
  let dragActive = false;
  let dragMoved = false;

  const resolveApp = () => (typeof getApp === 'function' ? getApp() : null);

  const canExpandBag = (app) => getRemainingBagTileCount(app) > 0;

  const setExpanded = (next, app) => {
    if (next && !canExpandBag(app)) return;
    expanded = next;
    setTileBagExpanded(container, expanded, syncBagScroll);
  };

  syncTileBagExpandAvailability = (app) => {
    const resolvedApp = app || resolveApp();
    const allowed = canExpandBag(resolvedApp);
    container.classList.toggle('is-expand-disabled', !allowed);
    handle.disabled = !allowed;
    handle.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    if (!allowed && expanded) {
      setExpanded(false, resolvedApp);
    }
  };

  const toggle = () => {
    const app = resolveApp();
    if (!expanded && !canExpandBag(app)) return;
    setExpanded(!expanded, app);
  };

  handle.addEventListener('click', (e) => {
    if (handle.disabled) return;
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    toggle();
  });

  handle.addEventListener('pointerdown', (e) => {
    if (handle.disabled) return;
    dragActive = true;
    dragMoved = false;
    dragStartY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragActive || handle.disabled) return;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dy) < TILE_BAG.dragThreshold) return;
    dragMoved = true;
    const app = resolveApp();
    if (dy < 0 && !expanded) {
      if (!canExpandBag(app)) return;
      setExpanded(true, app);
    } else if (dy > 0 && expanded) {
      setExpanded(false, app);
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
    if (app.boardHasHintTiles?.() && !confirm('Remove hint tiles from the board?')) return;
    await app.clearBoard();
    resetPuzzleTimer();
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
    let last = null;
    for (let i = tiles.length - 1; i >= 0; i--) {
      if (!app.isHintTile?.(tiles[i])) {
        last = tiles[i];
        break;
      }
    }
    if (!last) {
      showGameMessage('Nothing to undo (hint tiles cannot be removed).', 'info');
      return;
    }
    app.removeTileById(last.id);
    app.state.selectedTileId = null;
    app.rebuildOccFromTiles();
    await app.renderTiles();
    if (!(app.state.tiles || []).length) resetPuzzleTimer();
    updateTileBagCount(app);
    updateValidationState(app);
    showGameMessage('Last tile removed.', 'info');
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

function formatPuzzleTimer(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

let puzzleTimerInterval = null;
let puzzleTimerStartedAt = null;
let puzzleTimerRunning = false;

function updatePuzzleTimerDisplay(sec = 0) {
  const el = $('timerCurrent');
  if (el) el.textContent = formatPuzzleTimer(sec);
}

function resetPuzzleTimer() {
  puzzleTimerRunning = false;
  puzzleTimerStartedAt = null;
  if (puzzleTimerInterval) {
    clearInterval(puzzleTimerInterval);
    puzzleTimerInterval = null;
  }
  updatePuzzleTimerDisplay(0);
}

/** Starts on first manual placement from preview/bag — not on load or hints. */
function startPuzzleTimerOnFirstPlacement() {
  if (puzzleTimerRunning) return;
  puzzleTimerRunning = true;
  puzzleTimerStartedAt = Date.now();
  const tick = () => {
    if (!puzzleTimerStartedAt) return;
    updatePuzzleTimerDisplay(Math.floor((Date.now() - puzzleTimerStartedAt) / 1000));
  };
  tick();
  puzzleTimerInterval = setInterval(tick, 1000);
}

function wirePuzzleTimer(app) {
  resetPuzzleTimer();
  app.onManualTilePlaced = (tile) => {
    if (tile?.fromHint) return;
    startPuzzleTimerOnFirstPlacement();
  };
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
    resetPuzzleTimer();
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
  let appRef = null;
  wireTileBagExpand(syncBagScroll, () => appRef);
  wireBottomNav();
  resetPuzzleTimer();

  const app = await waitForApp();
  appRef = app;
  updateGlobalHintCount(app);
  wirePuzzleTimer(app);
  await updateRankPanel(app);
  syncTileBagExpandAvailability(app);
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
  wireHintMenu(app);
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
