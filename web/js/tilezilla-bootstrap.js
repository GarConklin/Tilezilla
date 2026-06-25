/**
 * Tilezilla production shell — bridges UI chrome to app_v16 game engine.
 */

import {
  applyBoardFrame,
  centerBoardInFrame,
} from './board-frame.js';
import { loadGameplaySettings, initSettingsUi, applyPhonePreviewMode } from './tilezilla-settings.js';
import { initTilesetPicker } from './tilezilla-tileset-picker.js';
import { formatTilesetDisplayName } from './tileset-preferences.js';
import { initMenuUi } from './tilezilla-menu.js';
import { initStuckPopup, openStuckFlow } from './tilezilla-stuck-popup.js';
import { initRandomPuzzlePopup, openRandomPuzzlePopup } from './tilezilla-random-popup.js';
import { initBuyHintsPopup, wireBuyHintsTriggers } from './tilezilla-buy-hints-popup.js';
import { initChallengeBeginPopup, gateAdventureChallengeBegin } from './tilezilla-challenge-begin-popup.js';
import {
  applyRandomPopupLayout,
  loadRandomPopupLayout,
  reloadRandomPopupLayout,
} from './random-popup-layout.js';
import {
  applyChallengeBeginLayout,
  loadChallengeBeginLayout,
} from './challenge-begin-layout.js';
import { initPuzzleInfoPopup, openPuzzleInfo } from './tilezilla-puzzle-info.js';
import { initProfileOverlay, openProfileOverlay } from './tilezilla-profile-overlay.js';
import { initHintRules } from './tilezilla-hint-rules.js';
import { initDiscoveryRecord } from './tilezilla-discovery-record.js';
import * as guestUser from './tilezilla-guest.js';
import { initInvalidSolve, isInvalidSolveShowing } from './tilezilla-invalid-solve.js';
import {
  applyDiscoveryPopupLayout,
  applyDiscoveryRecordLayout,
  applyDiscoveryButtonArt,
  getDiscoveryTexts,
  getDiscoveryVariantKey,
  loadDiscoveryRecordLayout,
  reloadDiscoveryRecordLayout,
} from './discovery-record-layout.js';
import {
  applyMenuLayout,
  clearMenuLayoutCache,
  loadMenuLayout,
} from './menu-layout.js';
import { initMenuSystemInfo } from './system-info.js';
import {
  applyBottomNavLayout,
  clearBottomNavLayoutCache,
  loadBottomNavLayout,
  reloadBottomNavLayout,
} from './bottom-nav-layout.js';
import {
  applyPreviewLayout,
  clearPreviewLayoutCache,
  loadPreviewLayout,
  reloadPreviewLayout,
} from './preview-layout.js';
import {
  applyMainScreenV2Layout,
  loadMainScreenV2Layout,
  reloadMainScreenV2Layout,
} from './main-screen-v2-layout.js';
import {
  applyPreviewV2Layout,
  loadPreviewV2Layout,
  reloadPreviewV2Layout,
} from './preview-v2-layout.js';
import {
  applyHintV2Layout,
  applyHintV2ArtImages,
  loadHintV2Layout,
  reloadHintV2Layout,
} from './hint-v2-layout.js';
import {
  PREVIEW_V2_DATA_SECTIONS,
  applyAllPreviewV2DataSublayouts,
  applyPreviewV2DataSublayout,
  clearPreviewV2DataSublayoutCache,
  loadPreviewV2DataSublayout,
} from './preview-v2-data-sublayout.js';
import {
  applyPuzzleInfoLayout,
  clearPuzzleInfoLayoutCache,
  loadPuzzleInfoLayout,
  reloadPuzzleInfoLayout,
} from './puzzle-info-layout.js';
import {
  applyHintRulesLayout,
  clearHintRulesLayoutCache,
  loadHintRulesLayout,
  reloadHintRulesLayout,
  syncHintRulesWindowGeometry,
} from './hint-rules-layout.js';
import {
  applyJournalLayoutEverywhere,
  applyJournalOverlays,
  clearJournalLayoutCache,
  loadJournalLayout,
  reloadJournalLayout,
} from './journal-layout.js';
import {
  applyTilebagLayout,
  clearTilebagLayoutCache,
  loadTilebagLayout,
  reloadTilebagLayout,
} from './tilebag-layout.js';
import {
  applyTilebagV2Layout,
  loadTilebagV2Layout,
  reloadTilebagV2Layout,
} from './tilebag-v2-layout.js';
import { initJournalUi } from './tilezilla-journal.js';
import { resetDevPlayerProgress } from './dev-player-reset.js';
import { setDiscoveryRecordTexts, setDiscoveryRecordLayout } from './tilezilla-discovery-record.js';
import { initDevTools } from './tilezilla-dev-tools.js';
import { syncDevUserUi } from './tilezilla-dev-user.js';
import {
  applySublevelIconElement,
  clearSublevelLayoutCache,
  loadSublevelIconLayout,
  romanForSubLevel,
} from './sublevel-icon.js';
import {
  adventureLevelContext,
  adventureSolveCount,
  buildAdventureMeta,
  buildAdventureMetaForLevel,
  findNextUnsolved,
  getPuzzleRequirement,
  getRankPanelState,
  isAdventurePuzzleComplete,
  isPuzzleSatisfied,
  loadAdventurePath,
  resolveAdventureResume,
} from './adventure-path.js';
import { applyUiScale, wireUiScaleListeners, TZ_DESIGN_WIDTH } from './tilezilla-ui-scale.js';

const $ = (id) => document.getElementById(id);

const MAIN_V2_SHELL = Boolean(document.querySelector('.tz-main-v2-app'));

/** Fixed cell size; largest board 5×6 → 275×330. Frame size is in tilezilla-shell.css. */
const TZ_CELL_PX = 55;
const TZ_MAX_BOARD_COLS = 5;
const TZ_MAX_BOARD_ROWS = 6;

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

async function loadAdventureLevelOrder() {
  const path = await loadAdventurePath();
  return path.flat.map((p) => p.levelId).concat(path.postgame.map((p) => p.levelId));
}

async function resolveAdventurePuzzle(app) {
  const { level, meta } = await resolveAdventureResume(app);
  return { level, meta };
}

function resetPreviewAfterSolve() {
  const root = document.querySelector('.tz-app');
  if (root) root.dataset.validation = '';
  const checkPanel = $('previewCheckSolve');
  if (checkPanel) checkPanel.setAttribute('aria-hidden', 'true');
  const title = $('previewTitle');
  if (title) title.textContent = 'Preview Tile';
  window.__invalidSolve?.hide?.();
}

async function undoLastPlacedTile(app) {
  const tiles = app.state.tiles || [];
  if (!tiles.length) return false;

  let last = null;
  for (let i = tiles.length - 1; i >= 0; i -= 1) {
    if (!app.isHintTile?.(tiles[i])) {
      last = tiles[i];
      break;
    }
  }
  if (!last) return false;

  app.removeTileById(last.id);
  app.state.selectedTileId = null;
  app.rebuildOccFromTiles();
  await app.renderTiles();
  if (!(app.state.tiles || []).length) resetPuzzleTimer();
  dismissDiscoveryForBoardEdit();
  return true;
}

async function continueDiscoverySearch(app) {
  /* Leave the solved board intact — player adjusts tiles to hunt for more solutions. */
  resetPreviewAfterSolve();
  app.syncPreviewFromBoardSelection?.({ preferLastPlaced: true });
  updateTileBagCount(app);
  updateHintButtonState(app);
  await app.renderTiles?.();
  app.renderActivePreview?.();
  updatePreviewDir();
  showGameMessage('Keep searching for another solution.', 'info');
  return true;
}

async function refreshAdventureChrome(app) {
  if (document.querySelector('.tz-app')?.dataset?.screen !== 'adventure') return;
  const path = await loadAdventurePath();
  const levelContext = adventureLevelContext(app);
  const level = app?.state?.currentLevel;
  if (level?.id) {
    const meta = buildAdventureMetaForLevel(path, level.id, app?.progress, levelContext);
    if (meta) {
      window.__adventureMeta = meta;
      updateChallengePanel(level, meta);
    }
  }
  await updateRankPanel(app);
}

async function advanceAdventurePath(app) {
  const path = await loadAdventurePath();
  const progress = app?.progress || window.__app?.progress;
  const levelContext = adventureLevelContext(app);
  const currentId = app.state.currentLevel?.id;

  if (currentId && !isAdventurePuzzleComplete(progress, path, currentId, levelContext)) {
    const required = getPuzzleRequirement(path, currentId, levelContext);
    showGameMessage(
      required > 1
        ? 'Find all solutions for this challenge before advancing.'
        : 'Record a solution before advancing.',
      'warn',
    );
    return;
  }

  const location = findNextUnsolved(progress, path, { afterLevelId: currentId, levelContext });
  if (!location?.puzzle) {
    showGameMessage('Adventure path complete!', 'success');
    return;
  }
  const level = app.state.allLevels?.find((l) => l.id === location.puzzle.levelId);
  if (!level) {
    showGameMessage(`Next adventure puzzle (${location.puzzle.levelId}) is not in the catalog yet.`, 'warn');
    return;
  }

  const meta = buildAdventureMeta(path, location, progress, levelContext);
  const loaded = await loadAdventureLevelWithChallengeGate(app, {
    level,
    meta,
    path,
    progress,
    levelContext,
    message: `Advanced to ${level.id}`,
  });
  if (!loaded) return;
}

async function applyAdventureLevelToBoard(app, level, meta, { message } = {}) {
  await loadLevelOnBoard(app, level);
  resetPuzzleTimer();
  displayPuzzleTimerBest(level.id, app.state?.userId || 'gar');
  window.__adventureMeta = meta;
  await refreshPaletteIfReady(app);
  resetPreviewAfterSolve();
  updateChallengePanel(level, meta);
  await updateRankPanel(app);
  updateTileBagCount(app);
  updateValidationState(app);
  app.renderActivePreview?.();
  if (message) showGameMessage(message, 'info');
}

async function loadAdventureLevelWithChallengeGate(app, {
  level,
  meta,
  path,
  progress,
  levelContext,
  message,
  onCancel,
} = {}) {
  if (!level || !meta) return false;

  const required = meta.requiredSolutionCount
    || getPuzzleRequirement(path, level.id, levelContext);
  const found = adventureSolveCount(progress, level.id, { isChallenge: true });

  return gateAdventureChallengeBegin({
    isChallenge: meta.isChallenge,
    found,
    required,
    onBegin: () => applyAdventureLevelToBoard(app, level, meta, { message }),
    onCancel,
  });
}

function boardRenderSize(cols, rows) {
  return { w: cols * TZ_CELL_PX, h: rows * TZ_CELL_PX };
}

/** Center cols×rows grid; select frame art for this puzzle size. */
function applyBoardFrameLayout(app) {
  const cols = app.CONFIG.cols || TZ_MAX_BOARD_COLS;
  const rows = app.CONFIG.rows || TZ_MAX_BOARD_ROWS;
  applyBoardFrame(rows, cols);
  const { w, h } = boardRenderSize(cols, rows);
  document.documentElement.style.setProperty('--tz-grid-w', `${w}px`);
  document.documentElement.style.setProperty('--tz-grid-h', `${h}px`);
  if (MAIN_V2_SHELL) {
    requestAnimationFrame(() => updateMainV2BoardFit());
  }
}

function updateMainV2BoardFit() {
  if (!MAIN_V2_SHELL) return;
  const section = document.querySelector('.tz-main-v2-app .tz-board-section');
  const frame = section?.querySelector('.tz-board-frame');
  if (!section || !frame) return;
  const slotW = section.clientWidth;
  const slotH = section.clientHeight;
  const frameW = frame.offsetWidth;
  const frameH = frame.offsetHeight;
  if (!slotW || !slotH || !frameW || !frameH) return;
  const scale = Math.min(slotW / frameW, slotH / frameH);
  document.documentElement.style.setProperty('--tz-msv2-board-fit-scale', String(scale));
}

function ensureBoardCellMetrics(app) {
  app.CONFIG.cellPx = TZ_CELL_PX;
  document.documentElement.style.setProperty('--cell', `${TZ_CELL_PX}px`);
  document.documentElement.style.setProperty('--tz-cell-size', `${TZ_CELL_PX}px`);
}

async function afterLevelApplied(app) {
  applyBoardFrameLayout(app);
  app.setCssCell?.();
  centerBoardInFrame();
}

async function loadLevelOnBoard(app, level) {
  ensureBoardCellMetrics(app);
  await app.applyLevel(level);
  await afterLevelApplied(app);
}

function applyResponsiveBoard(app) {
  ensureBoardCellMetrics(app);
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
let tileBagExpanded = false;

function updateTileBagCount(app) {
  const el = $('tileBagCount');
  if (!el) return;
  const total = (app.state.paletteInstances || []).length;
  const used = app.state.used?.size || 0;
  const remaining = total - used;
  el.textContent = `${remaining}/${total}`;
  syncTileBagExpandAvailability(app);
}

function formatStepPercent(completed, total) {
  const safeTotal = Math.max(1, total || 1);
  const safeDone = Math.max(0, Math.min(completed || 0, safeTotal));
  return Math.round((safeDone / safeTotal) * 100);
}

function updateChallengePanel(level, meta) {
  const screen = meta?.screen
    || document.querySelector('.tz-app')?.dataset?.screen
    || 'daily-challenge';
  const eyebrow = $('challengeEyebrow');
  const dateEl = $('challengeDate');
  const codeEl = $('puzzleCode');
  const countEl = $('solutionCount');

  if (eyebrow) {
    if (screen === 'adventure') {
      eyebrow.textContent = 'Adventure Path';
    } else if (screen === 'random') {
      eyebrow.textContent = 'Random Puzzle';
    } else {
      eyebrow.textContent = 'Daily Challenge';
    }
  }
  if (dateEl) {
    if (screen === 'adventure' || screen === 'random') {
      dateEl.removeAttribute('datetime');
      dateEl.textContent = '';
      dateEl.hidden = true;
    } else {
      dateEl.hidden = false;
      dateEl.dateTime = meta?.date || '';
      dateEl.textContent = meta?.date ? formatDateLabel(meta.date) : '—';
    }
  }
  if (codeEl) codeEl.textContent = level?.id || meta?.levelId || '—';
  if (countEl) {
    const n = meta?.totalSolutions || level?.totalUniqueSolutions;
    countEl.textContent = Number.isFinite(n) && n > 0 ? String(n) : '?';
  }

  if (MAIN_V2_SHELL) {
    const typeV2 = $('previewV2GameType');
    const dateV2 = $('previewV2GameDate');
    const idV2 = $('previewV2PuzzleId');
    const solutionV2 = $('previewV2SolutionCount');
    if (typeV2 && eyebrow) typeV2.textContent = eyebrow.textContent;
    if (dateV2) {
      if (screen === 'adventure' || screen === 'random') {
        dateV2.removeAttribute('datetime');
        dateV2.textContent = '';
        dateV2.hidden = true;
      } else {
        dateV2.hidden = false;
        dateV2.dateTime = meta?.date || '';
        dateV2.textContent = meta?.date ? formatDateLabel(meta.date) : '—';
      }
    }
    if (idV2) idV2.textContent = level?.id || meta?.levelId || '—';
    if (solutionV2) {
      const n = meta?.totalSolutions || level?.totalUniqueSolutions;
      solutionV2.textContent = Number.isFinite(n) && n > 0 ? String(n) : '?';
    }
    const infoBar = $('infoBarText');
    if (infoBar) {
      const n = meta?.totalSolutions || level?.totalUniqueSolutions;
      const label = Number.isFinite(n) && n > 0 ? String(n) : '?';
      infoBar.textContent = label === '?' ? '— solutions' : `${label} Possible Solutions`;
    }
  }
}

function updatePreviewDir() {
  const rotHud = $('rotHud');
  const previewDir = $('previewDir');
  if (!previewDir) return;
  const raw = rotHud?.textContent?.trim() || '0';
  const deg = raw.replace(/°/g, '');
  previewDir.textContent = `${deg}°`;
}

const HINT_BOARD_TOOLTIP =
  'Hints may only be used on an empty board or a board containing only hint tiles.';

let adventureRanksCache = null;

async function loadAdventureRanks() {
  if (!adventureRanksCache) {
    const res = await fetch('/data/adventure_ranks.json');
    if (!res.ok) throw new Error('Failed to load adventure ranks');
    adventureRanksCache = await res.json();
  }
  return adventureRanksCache;
}

async function updateRankPanel(app) {
  const path = await loadAdventurePath();
  const rankState = getRankPanelState(
    app?.progress || window.__app?.progress,
    path,
    adventureLevelContext(app),
  );
  const ranks = await loadAdventureRanks();
  const rank = ranks.find((r) => r.rank_id === rankState.rankId) || ranks[0];
  const total = Math.max(1, rankState.stepTotal || 1);
  const current = Math.max(0, Math.min(rankState.stepProgress || 0, total));
  const pct = formatStepPercent(current, total);

  const badge = $('rankBadgeImg');
  const subLevelEl = $('rankSubLevel');
  const subIcon = $('rankSubLevelIcon');
  const fill = $('rankProgressFill');
  const text = $('rankProgressText');
  const progressTrack = document.querySelector('.tz-rank-panel .tz-progress__track');
  const roman = romanForSubLevel(rankState.subLevel);

  if (badge) {
    badge.src = rank.badge_image;
    badge.alt = `${rank.rank_name} rank`;
  }
  if (subIcon) {
    try {
      const layout = await loadSublevelIconLayout();
      applySublevelIconElement(subIcon, rankState.subLevel, rank.sublevel_badge, layout);
      if (MAIN_V2_SHELL) {
        const v2Sub = $('previewV2SubLevelIcon');
        if (v2Sub) applySublevelIconElement(v2Sub, rankState.subLevel, rank.sublevel_badge, layout);
      }
    } catch (err) {
      console.warn('Sublevel icon layout:', err);
      applySublevelIconElement(subIcon, rankState.subLevel, rank.sublevel_badge, null);
      if (MAIN_V2_SHELL) {
        const v2Sub = $('previewV2SubLevelIcon');
        if (v2Sub) applySublevelIconElement(v2Sub, rankState.subLevel, rank.sublevel_badge, null);
      }
    }
    subIcon.alt = `Sublevel ${roman}`;
  }
  if (subLevelEl) subLevelEl.setAttribute('aria-label', `Sublevel ${roman}`);
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = `${pct}%`;
  if (progressTrack) {
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', '100');
    progressTrack.setAttribute('aria-valuenow', String(pct));
    progressTrack.setAttribute('aria-label', `Sublevel progress ${pct}%`);
  }

  if (MAIN_V2_SHELL) {
    const v2Badge = $('previewV2RankBadge');
    const v2Pct = $('previewV2ProgressPct');
    const v2Fill = $('previewV2RankProgressFill');
    const v2Track = document.querySelector('.tz-preview-v2-progress__track');
    const v2Sub = $('previewV2SubLevelIcon');
    const v2SubWrap = $('previewV2SubLevel');
    if (v2Badge && badge) {
      v2Badge.src = badge.src;
      v2Badge.alt = badge.alt;
    }
    if (v2Sub && subIcon) {
      v2Sub.src = subIcon.src;
      v2Sub.alt = subIcon.alt;
      v2Sub.style.cssText = subIcon.style.cssText;
    }
    if (v2SubWrap && subLevelEl) {
      v2SubWrap.setAttribute('aria-label', subLevelEl.getAttribute('aria-label') || `Sublevel ${roman}`);
    }
    if (v2Fill) v2Fill.style.width = `${pct}%`;
    if (v2Pct) v2Pct.textContent = `${pct}%`;
    if (v2Track) {
      v2Track.setAttribute('aria-valuenow', String(pct));
      v2Track.setAttribute('aria-label', `Sublevel progress ${pct}%`);
    }
  }
}

function formatHintTokenLabel(app) {
  const max = app.CONFIG?.hintsPerPuzzle ?? 2;
  const remaining = app.hintsRemainingThisPuzzle?.() ?? max;
  return `${remaining} of ${max}`;
}

let selectedHintType = null;

function updateGlobalHintCount(app) {
  const count = String(app.getGlobalHintTokens?.() ?? 0);
  const el = $('hintCount');
  if (el) el.textContent = count;
  const v2Use = $('previewV2HintCountUse');
  const v2Count = $('previewV2HintCountCount');
  if (v2Use) v2Use.textContent = count;
  if (v2Count) v2Count.textContent = count;
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

function shouldShowHintButton(app) {
  const boardAllowed = app.boardAllowsHints?.(app.state.tiles) ?? true;
  const remaining = app.hintsRemainingThisPuzzle?.() ?? 0;
  if (boardAllowed) return true;
  if (remaining <= 0) return true;
  return false;
}

function setHintV2Shown(el, show) {
  if (!el) return;
  if (show) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

function updateHintButtonState(app) {
  const btn = $('hintBtn');
  if (!btn) return;

  if (guestUser.isGuestUser()) {
    btn.hidden = true;
    if (MAIN_V2_SHELL) {
      setHintV2Shown($('hintBtn'), false);
      setHintV2Shown($('hintPlaqueUse'), false);
      setHintV2Shown($('hintPlaqueCount'), false);
      setHintV2Shown($('previewV2HintCountUse'), false);
      setHintV2Shown($('previewV2HintCountCount'), false);
      setHintV2Shown($('hintTokenAddBtnUse'), false);
      setHintV2Shown($('hintTokenAddBtnCount'), false);
    }
    return;
  }

  if (MAIN_V2_SHELL) {
    const useBtn = $('hintBtn');
    const usePlaque = $('hintPlaqueUse');
    const countPlaque = $('hintPlaqueCount');
    const tokenCountUse = $('previewV2HintCountUse');
    const addUse = $('hintTokenAddBtnUse');
    const countCount = $('previewV2HintCountCount');
    const addCount = $('hintTokenAddBtnCount');

    // Empty board → use plaque + tokens + add + use-hint btn.
    // Any tile placed → count plaque + tokens + add.
    const emptyBoard = !(app?.state?.tiles || []).length;
    const remaining = app.hintsRemainingThisPuzzle?.() ?? 0;
    const exhausted = remaining <= 0;

    if (emptyBoard) {
      setHintV2Shown(usePlaque, true);
      setHintV2Shown(useBtn, true);
      setHintV2Shown(tokenCountUse, true);
      setHintV2Shown(addUse, true);
      setHintV2Shown(countPlaque, false);
      setHintV2Shown(countCount, false);
      setHintV2Shown(addCount, false);

      useBtn?.setAttribute('aria-disabled', exhausted ? 'true' : 'false');
      useBtn.title = exhausted
        ? 'No hints remaining for this puzzle.'
        : HINT_BOARD_TOOLTIP;
      useBtn?.setAttribute(
        'aria-label',
        exhausted ? 'Use hint — no hints remaining for this puzzle' : 'Use hint',
      );
    } else {
      setHintV2Shown(usePlaque, false);
      setHintV2Shown(useBtn, false);
      setHintV2Shown(tokenCountUse, false);
      setHintV2Shown(addUse, false);
      setHintV2Shown(countPlaque, true);
      setHintV2Shown(countCount, true);
      setHintV2Shown(addCount, true);
    }
    return;
  }

  if (!shouldShowHintButton(app)) {
    btn.hidden = true;
    return;
  }

  btn.hidden = false;

  const boardAllowed = app.boardAllowsHints?.(app.state.tiles) ?? true;
  const remaining = app.hintsRemainingThisPuzzle?.() ?? 0;
  const exhausted = remaining <= 0;
  const disabled = !boardAllowed || exhausted;

  btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');

  if (exhausted) {
    btn.title = 'No hints remaining for this puzzle.';
    btn.setAttribute('aria-label', 'Use hint — no hints remaining for this puzzle');
    return;
  }

  btn.title = HINT_BOARD_TOOLTIP;
  btn.setAttribute('aria-label', 'Use hint');
}

function updateValidationState(app) {
  const root = document.querySelector('.tz-app');
  const title = $('previewTitle');
  const checkBtn = $('checkSolBtn');
  const checkPanel = $('previewCheckSolve');
  if (!root || !app.state.currentLevel) return;

  if (isInvalidSolveShowing()) {
    root.dataset.validation = 'invalid';
    if (checkPanel) checkPanel.setAttribute('aria-hidden', 'false');
    if (title) title.textContent = 'Invalid Solve';
    if (checkBtn) checkBtn.disabled = false;
    updateHintButtonState(app);
    updateGlobalHintCount(app);
    return;
  }

  const mismatch = app.getInventoryMismatch(app.state.levelTileCounts, app.state.tiles);
  const allPlaced = !mismatch;
  root.dataset.validation = allPlaced ? 'ready' : '';
  if (checkPanel) checkPanel.setAttribute('aria-hidden', allPlaced ? 'false' : 'true');
  if (title) {
    title.textContent = allPlaced ? 'All Tiles Placed' : 'Preview Tile';
  }
  if (checkBtn) checkBtn.disabled = !allPlaced;
  updateHintButtonState(app);
  updateGlobalHintCount(app);
}

function dismissDiscoveryForBoardEdit() {
  window.__discoveryRecord?.hide?.();
}

function syncBoardChrome(app) {
  if (!app) return;
  updateTileBagCount(app);
  updateValidationState(app);
  updatePreviewDir();
  if (MAIN_V2_SHELL) updateMainV2BoardFit();
  requestAnimationFrame(() => {
    $('tileBagTrack')?.dispatchEvent(new Event('scroll'));
  });
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
    if (!tileBagExpanded && container?.classList.contains('is-expanded')) {
      applyTileBagExpandedLayout(container, false);
    }

    if (tileBagExpanded || container?.classList.contains('is-expanded')) {
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }

    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    if (track.scrollLeft > max) track.scrollLeft = max;

    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = max <= 2 || track.scrollLeft >= max - 2;
  };

  track.addEventListener('scroll', sync, { passive: true });
  prev?.addEventListener('click', () => track.scrollBy({ left: -90, behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: 90, behavior: 'smooth' }));

  const observer = new MutationObserver(() => {
    requestAnimationFrame(sync);
  });
  observer.observe(track, { childList: true, subtree: true });

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => requestAnimationFrame(sync));
    ro.observe(track);
  }

  sync();
  return sync;
}

const TILE_BAG = {
  frameCollapsedH: 94,
  trackCollapsedH: 48,
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

  const heightTrim = readCssPx('--tz-tilebag-expanded-height-trim', 0);
  if (heightTrim > 0) {
    frameHeight = Math.max(
      TILE_BAG.frameCollapsedH,
      frameHeight - heightTrim,
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
    container.dataset.expanded = 'false';
    container.style.removeProperty('--tz-tilebag-frame-h');
    container.style.removeProperty('--tz-tilebag-track-h');
    frame.style.removeProperty('--tz-tilebag-frame-h');
    track.style.removeProperty('--tz-tilebag-track-h');
    track.scrollTop = 0;
    track.scrollLeft = 0;
    return;
  }

  const { trackHeight, frameHeight } = measureTileBagExpansion(container);
  container.classList.add('is-expanded');
  container.dataset.expanded = 'true';
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

  tileBagExpanded = expanded;
  applyTileBagExpandedLayout(container, expanded);
  if (expanded && MAIN_V2_SHELL) closeBottomMenuV2();
  handle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (label) label.textContent = expanded ? 'Collapse tile bag' : 'Expand tile bag';
  syncBagScroll?.();
}

function wireTileBagExpand(syncBagScroll, getApp) {
  const container = $('tileBagContainer');
  const handle = $('tileBagExpandHandle');
  if (!container || !handle) return;

  let dragStartY = 0;
  let dragActive = false;
  let dragMoved = false;

  const resolveApp = () => (typeof getApp === 'function' ? getApp() : null);

  const canExpandBag = (app) => getRemainingBagTileCount(app) > 0;

  const releaseHandleCapture = (e) => {
    dragActive = false;
    if (e?.pointerId == null) return;
    try {
      if (handle.hasPointerCapture?.(e.pointerId)) {
        handle.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* pointer already released */
    }
  };

  const setExpanded = (next, app) => {
    if (next && !canExpandBag(app)) return;
    setTileBagExpanded(container, next, syncBagScroll);
  };

  syncTileBagExpandAvailability = (app) => {
    const resolvedApp = app || resolveApp();
    const allowed = canExpandBag(resolvedApp);
    container.classList.toggle('is-expand-disabled', !allowed);
    handle.disabled = !allowed;
    handle.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    if (!allowed && tileBagExpanded) {
      setExpanded(false, resolvedApp);
    }
  };

  const toggle = () => {
    const app = resolveApp();
    if (!tileBagExpanded && !canExpandBag(app)) return;
    setExpanded(!tileBagExpanded, app);
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
    if (dy < 0 && !tileBagExpanded) {
      if (!canExpandBag(app)) return;
      setExpanded(true, app);
    } else if (dy > 0 && tileBagExpanded) {
      setExpanded(false, app);
    }
    releaseHandleCapture(e);
  });

  handle.addEventListener('pointerup', releaseHandleCapture);
  handle.addEventListener('pointercancel', releaseHandleCapture);
  handle.addEventListener('lostpointercapture', () => {
    dragActive = false;
  });

  const frame = container.querySelector('.tz-tilebag-frame');
  frame?.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'height') return;
    syncBagScroll?.();
  });

  window.addEventListener('resize', () => {
    if (tileBagExpanded) applyTileBagExpandedLayout(container, true);
    syncBagScroll?.();
  });

  container.dataset.expanded = tileBagExpanded ? 'true' : 'false';
}

const BOTTOM_NAV_LABELS = {
  adventure: 'Adventure',
  'daily-challenge': 'Daily Challenge',
  random: 'Random Puzzle',
  library: 'Puzzle Library',
  profile: 'Profile',
};

const RANDOM_VENTURE_SIZES = new Set(['4x5', '5x5', '4x6', '5x6']);

function adventureSizeFromLevelId(levelId) {
  const match = /^(\d+x\d+)-/.exec(String(levelId || ''));
  return match ? match[1] : null;
}

async function pickRandomVentureLevel(app) {
  const path = await loadAdventurePath();
  const ids = new Set();

  const consider = (puzzle) => {
    if (!puzzle || puzzle.isChallenge) return;
    const size = adventureSizeFromLevelId(puzzle.levelId);
    if (!RANDOM_VENTURE_SIZES.has(size)) return;
    ids.add(puzzle.levelId);
  };

  for (const puzzle of path.flat || []) consider(puzzle);
  for (const puzzle of path.postgame || []) consider(puzzle);

  const levels = app?.state?.allLevels || [];
  const candidates = [...ids]
    .map((id) => levels.find((l) => l.id === id))
    .filter(Boolean);

  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function switchToAdventureScreen(app) {
  const appRoot = document.querySelector('.tz-app');
  setActiveBottomNav('adventure');
  appRoot?.setAttribute('data-screen', 'adventure');
  await loadAdventurePuzzle(app);
}

async function loadRandomVenturePuzzle(app) {
  const loading = $('loadingHud');
  const appRoot = document.querySelector('.tz-app');
  if (loading) loading.hidden = false;
  appRoot?.classList.add('is-loading-puzzle');

  try {
    while (!app.state.allLevels?.length) {
      await new Promise((r) => setTimeout(r, 50));
    }

    const level = await pickRandomVentureLevel(app);
    if (!level) throw new Error('No matching random puzzles available');

    setActiveBottomNav('random');
    appRoot?.setAttribute('data-screen', 'random');

    await loadLevelOnBoard(app, level);
    resetPuzzleTimer();
    displayPuzzleTimerBest(level.id, app.state?.userId || 'gar');
    await refreshPaletteIfReady(app);
    updateChallengePanel(level, {
      screen: 'random',
      totalSolutions: level.totalUniqueSolutions,
    });
    updateTileBagCount(app);
    updateValidationState(app);
    showGameMessage(`Random puzzle: ${level.id}`, 'info');
  } catch (e) {
    console.error(e);
    showGameMessage(`Failed to load random puzzle: ${e.message}`, 'error');
  } finally {
    appRoot?.classList.remove('is-loading-puzzle');
    if (loading) loading.hidden = true;
  }
}

function applyGuestChrome(app) {
  const guest = guestUser.isGuestUser();
  document.body.classList.toggle('tz-guest-mode', guest);
  document.body.classList.toggle('tz-registered-mode', guestUser.isRegisteredUser());

  const hints = document.querySelector('.tz-hints');
  if (hints) hints.hidden = guest;

  if (MAIN_V2_SHELL) {
    if (guest) {
      for (const id of [
        'hintBtn', 'hintPlaqueUse', 'hintPlaqueCount',
        'previewV2HintCountUse', 'previewV2HintCountCount',
        'hintTokenAddBtnUse', 'hintTokenAddBtnCount',
      ]) {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      }
    } else if (app) {
      updateHintButtonState(app);
    }
  } else {
    const hintBtn = document.getElementById('hintBtn');
    if (hintBtn) hintBtn.hidden = guest;
  }

  const loginHit = document.querySelector('.tz-bottom-nav__hit--login');
  if (loginHit) loginHit.hidden = !guest;

  for (const sel of [
    '.tz-bottom-nav__hit--adventure',
    '.tz-bottom-nav__hit--random',
    '.tz-bottom-nav__hit--library',
    '.tz-bottom-nav__hit--profile',
  ]) {
    const el = document.querySelector(sel);
    if (el) el.hidden = guest;
  }

  const menuLogin = document.getElementById('menuGuestLoginBtn');
  const menuCreate = document.getElementById('menuGuestCreateBtn');
  if (menuLogin) menuLogin.hidden = !guest;
  if (menuCreate) menuCreate.hidden = !guest;

  guestUser.syncGuestBanner();
}

function closeBottomMenuV2() {
  const drawer = $('bottomMenuDrawer');
  const open = $('bottomMenuOpenBtn');
  const close = $('bottomMenuCloseBtn');
  if (!drawer || !open) return;
  drawer.hidden = true;
  open.hidden = false;
  if (close) close.hidden = true;
  open.setAttribute('aria-expanded', 'false');
  document.querySelector('.tz-app')?.classList.remove('is-bottom-menu-open');
}

function openBottomMenuV2() {
  if (tileBagExpanded) return;
  const drawer = $('bottomMenuDrawer');
  const open = $('bottomMenuOpenBtn');
  const close = $('bottomMenuCloseBtn');
  if (!drawer || !open) return;
  drawer.hidden = false;
  open.hidden = true;
  if (close) close.hidden = false;
  open.setAttribute('aria-expanded', 'true');
  document.querySelector('.tz-app')?.classList.add('is-bottom-menu-open');
}

function wireBottomMenuV2() {
  if (!MAIN_V2_SHELL) return;
  $('bottomMenuOpenBtn')?.addEventListener('click', openBottomMenuV2);
  $('bottomMenuCloseBtn')?.addEventListener('click', closeBottomMenuV2);
}

function wirePreviewV2DataClicks() {
  if (!MAIN_V2_SHELL) return;

  const userData = document.querySelector('.tz-preview-v2-user-data');
  const gameData = document.querySelector('.tz-preview-v2-game-data');

  const activate = (el, handler) => {
    if (!el || el.dataset.previewV2ClickWired === '1') return;
    el.dataset.previewV2ClickWired = '1';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', (e) => {
      e.preventDefault();
      handler();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      handler();
    });
  };

  activate(userData, () => {
    closeBottomMenuV2();
    void openProfileOverlay();
  });

  activate(gameData, () => {
    closeBottomMenuV2();
    void openPuzzleInfo();
  });
}

function wireBottomNav(getApp) {
  const appRoot = document.querySelector('.tz-app');
  document.querySelectorAll('.tz-bottom-nav__hit').forEach((item) => {
    item.addEventListener('click', async () => {
      const screen = item.dataset.nav;
      const app = getApp?.();

      if (screen === 'login') {
        guestUser.trackGuestEvent('Login Clicked', { source: 'bottom_nav' });
        window.location.href = '/login-screen.html';
        return;
      }

      if (screen === 'profile') {
        if (MAIN_V2_SHELL) {
          closeBottomMenuV2();
          void openProfileOverlay();
          return;
        }
        if (guestUser.isRegisteredUser()) {
          window.location.href = '/profile-screen.html';
          return;
        }
        guestUser.showLoginRequired();
        return;
      }

      if (guestUser.isRestrictedNav(screen)) {
        guestUser.showLoginRequired();
        return;
      }

      if (screen === 'random') {
        if (guestUser.isGuestUser()) {
          guestUser.showLoginRequired();
          return;
        }
        openRandomPuzzlePopup();
        if (MAIN_V2_SHELL) closeBottomMenuV2();
        return;
      }

      document.querySelectorAll('.tz-bottom-nav__hit').forEach((i) => {
        i.classList.toggle('tz-bottom-nav__hit--active', i === item);
        i.toggleAttribute('aria-current', i === item ? 'page' : false);
      });
      appRoot?.setAttribute('data-screen', screen);
      guestUser.syncGuestBanner();
      if (MAIN_V2_SHELL) closeBottomMenuV2();

      if (!app) return;

      if (screen === 'daily-challenge') {
        guestUser.trackGuestGameplay('Daily Challenge Started', app.state?.currentLevel?.id);
        await loadDailyPuzzle(app);
      } else if (screen === 'adventure') {
        await loadAdventurePuzzle(app);
      } else if (screen === 'library') {
        window.__journalApi?.openJournal?.({ mode: 'library' });
      } else {
        showGameMessage(`${BOTTOM_NAV_LABELS[screen] || screen} — coming soon`, 'info');
      }
    });
  });
}

function wireActions(app) {
  $('resetBtn')?.addEventListener('click', async () => {
    if (app.boardHasHintTiles?.() && !confirm('Remove hint tiles from the board?')) return;
    await app.clearBoard();
    resetPuzzleTimer();
    dismissDiscoveryForBoardEdit();
    syncBoardChrome(app);
    showGameMessage('Board reset.', 'info');
  });

  $('undoBtn')?.addEventListener('click', async () => {
    const removed = await undoLastPlacedTile(app);
    if (!removed) {
      showGameMessage(
        (app.state.tiles || []).length
          ? 'Nothing to undo (hint tiles cannot be removed).'
          : 'Nothing to undo.',
        'info',
      );
      return;
    }
    syncBoardChrome(app);
    app.syncPreviewFromBoardSelection?.({ preferLastPlaced: true });
    app.renderActivePreview?.();
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
  const refresh = () => syncBoardChrome(app);
  palette.addEventListener('click', () => setTimeout(refresh, 0));
  new MutationObserver(refresh).observe(palette, { childList: true, subtree: true, attributes: true });
}

function wireBoardHooks(app) {
  const board = $('board');
  if (!board) return;
  board.addEventListener('click', () => setTimeout(() => syncBoardChrome(app), 0));
}

function formatPuzzleTimer(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

let puzzleTimerInterval = null;
let puzzleTimerStartedAt = null;
let puzzleTimerRunning = false;
let puzzleTimerStopped = false;
let puzzleTimerElapsedSec = 0;

function updatePuzzleTimerDisplay(sec = 0) {
  const text = formatPuzzleTimer(sec);
  const el = $('timerCurrent');
  if (el) el.textContent = text;
  if (MAIN_V2_SHELL) {
    const v2 = $('previewV2TimerCurrent');
    if (v2) v2.textContent = text;
  }
}

function getPuzzleElapsedSeconds() {
  if (puzzleTimerStopped) return puzzleTimerElapsedSec;
  if (!puzzleTimerStartedAt) return 0;
  return Math.floor((Date.now() - puzzleTimerStartedAt) / 1000);
}

function stopPuzzleTimer() {
  puzzleTimerElapsedSec = getPuzzleElapsedSeconds();
  puzzleTimerRunning = false;
  puzzleTimerStopped = true;
  puzzleTimerStartedAt = null;
  if (puzzleTimerInterval) {
    clearInterval(puzzleTimerInterval);
    puzzleTimerInterval = null;
  }
  updatePuzzleTimerDisplay(puzzleTimerElapsedSec);
  return puzzleTimerElapsedSec;
}

function puzzleBestStorageKey(userId, levelId) {
  return `snake_puzzle_best_v1_${userId || 'gar'}_${levelId || ''}`;
}

function loadPuzzleTimerBest(levelId, userId = 'gar') {
  if (!levelId) return null;
  try {
    const raw = localStorage.getItem(puzzleBestStorageKey(userId, levelId));
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function updatePuzzleTimerBest(elapsedSec, levelId, userId = 'gar') {
  if (!levelId || !Number.isFinite(elapsedSec) || elapsedSec <= 0) return false;
  const key = puzzleBestStorageKey(userId, levelId);
  let prev = null;
  try {
    const raw = localStorage.getItem(key);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) prev = n;
  } catch {
    /* ignore */
  }
  if (prev != null && elapsedSec >= prev) return false;
  try {
    localStorage.setItem(key, String(elapsedSec));
  } catch {
    return false;
  }
  const el = $('timerBest');
  const text = formatPuzzleTimer(elapsedSec);
  if (el) el.textContent = text;
  if (MAIN_V2_SHELL) {
    const v2 = $('previewV2TimerBest');
    if (v2) v2.textContent = text;
  }
  return true;
}

function displayPuzzleTimerBest(levelId, userId = 'gar') {
  const el = $('timerBest');
  if (!el && !MAIN_V2_SHELL) return;
  const best = loadPuzzleTimerBest(levelId, userId);
  const text = best != null ? formatPuzzleTimer(best) : '—';
  if (el) el.textContent = text;
  if (MAIN_V2_SHELL) {
    const v2 = $('previewV2TimerBest');
    if (v2) v2.textContent = text;
  }
}

function resetPuzzleTimer() {
  puzzleTimerRunning = false;
  puzzleTimerStopped = false;
  puzzleTimerElapsedSec = 0;
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

  window.__puzzleTimer = {
    stop: stopPuzzleTimer,
    getElapsedSeconds: getPuzzleElapsedSeconds,
    reset: resetPuzzleTimer,
    loadBest: (levelId, userId) => loadPuzzleTimerBest(levelId, userId || app.state?.userId || 'gar'),
    updateBest: (elapsedSec, levelId) => updatePuzzleTimerBest(
      elapsedSec,
      levelId,
      app.state?.userId || 'gar',
    ),
    displayBest: (levelId) => displayPuzzleTimerBest(levelId, app.state?.userId || 'gar'),
  };

  window.addEventListener('tilezilla:hint-balance', () => updateGlobalHintCount(app));
}

function setActiveBottomNav(screen) {
  document.querySelectorAll('.tz-bottom-nav__hit').forEach((item) => {
    const active = item.dataset.nav === screen;
    item.classList.toggle('tz-bottom-nav__hit--active', active);
    item.toggleAttribute('aria-current', active ? 'page' : false);
  });
}

/** Load a specific catalog puzzle onto the board (journal → play/review). */
async function loadJournalPuzzleOnBoard(app, levelId) {
  if (!app || !levelId) return false;

  while (!app.state.allLevels?.length) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const level = app.state.allLevels.find((l) => l.id === levelId);
  if (!level) {
    showGameMessage(`Puzzle ${levelId} is not in the catalog.`, 'error');
    return false;
  }

  const progress = app.progress;
  const appRoot = document.querySelector('.tz-app');
  let journalSource = progress?.getLevelMeta?.(levelId)?.journalSource || null;
  if (!journalSource) {
    const path = await loadAdventurePath();
    const levelContext = adventureLevelContext(app);
    if (buildAdventureMetaForLevel(path, levelId, progress, levelContext)) {
      journalSource = 'adventure';
    }
  }

  if (journalSource === 'adventure') {
    appRoot?.setAttribute('data-screen', 'adventure');
    setActiveBottomNav('adventure');
  } else if (journalSource === 'daily-challenge') {
    appRoot?.setAttribute('data-screen', 'daily-challenge');
    setActiveBottomNav('daily-challenge');
  }

  await loadLevelOnBoard(app, level);

  if (journalSource === 'adventure') {
    const path = await loadAdventurePath();
    const levelContext = adventureLevelContext(app);
    const meta = buildAdventureMetaForLevel(path, levelId, progress, levelContext);
    if (meta) window.__adventureMeta = meta;
    updateChallengePanel(level, { ...meta, screen: 'adventure' });
    await updateRankPanel(app);
  } else if (journalSource === 'daily-challenge') {
    updateChallengePanel(level, { screen: 'daily-challenge' });
  } else {
    updateChallengePanel(level, {
      screen: journalSource || appRoot?.dataset?.screen || 'daily-challenge',
    });
  }

  resetPuzzleTimer();
  displayPuzzleTimerBest(level.id, app.state?.userId || 'gar');
  await refreshPaletteIfReady(app);
  updateTileBagCount(app);
  syncBoardChrome(app);
  updateValidationState(app);
  return true;
}

async function loadAdventurePuzzle(app) {
  const loading = $('loadingHud');
  const appRoot = document.querySelector('.tz-app');
  if (loading) loading.hidden = false;
  appRoot?.classList.add('is-loading-puzzle');

  try {
    while (!app.state.allLevels?.length) {
      await new Promise((r) => setTimeout(r, 50));
    }

    let { level, meta, location, path } = await resolveAdventureResume(app);
    const progress = app?.progress || window.__app?.progress;
    const levelContext = adventureLevelContext(app);

    while (level && location?.puzzle && isPuzzleSatisfied(progress, location.puzzle, levelContext)) {
      location = findNextUnsolved(progress, path, { afterLevelId: level.id, levelContext });
      if (!location?.puzzle) break;
      level = app.state.allLevels?.find((l) => l.id === location.puzzle.levelId);
      meta = level ? buildAdventureMeta(path, location, progress, levelContext) : null;
    }

    if (!level) throw new Error('No adventure puzzle available');

    const loaded = await loadAdventureLevelWithChallengeGate(app, {
      level,
      meta,
      path,
      progress,
      levelContext,
      message: `Adventure puzzle loaded: ${level.id}`,
    });
    if (!loaded) return;
  } catch (e) {
    console.error(e);
    showGameMessage(`Failed to load adventure puzzle: ${e.message}`, 'error');
  } finally {
    appRoot?.classList.remove('is-loading-puzzle');
    if (loading) loading.hidden = true;
  }
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

    await loadLevelOnBoard(app, level);
    resetPuzzleTimer();
    displayPuzzleTimerBest(level.id, app.state?.userId || 'gar');
    window.__dailyChallengeMeta = meta;
    await refreshPaletteIfReady(app);
    updateChallengePanel(level, { ...meta, screen: 'daily-challenge' });
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

async function applyShellLayouts() {
  if (MAIN_V2_SHELL) {
    try {
      applyMainScreenV2Layout(await loadMainScreenV2Layout());
    } catch (err) {
      console.warn('Main screen v2 layout:', err);
    }
    try {
      const previewLayout = await loadPreviewV2Layout();
      applyPreviewV2Layout(previewLayout);
      applyHintV2Layout(await loadHintV2Layout());
      applyHintV2ArtImages(document);
      await applyAllPreviewV2DataSublayouts();
    } catch (err) {
      console.warn('Preview v2 / hint layout:', err);
    }
    try {
      applyTilebagV2Layout(await loadTilebagV2Layout());
    } catch (err) {
      console.warn('Tile bag v2 layout:', err);
    }
    try {
      applyBottomNavLayout(await loadBottomNavLayout());
    } catch (err) {
      console.warn('Bottom nav layout:', err);
    }
    requestAnimationFrame(() => {
      updateMainV2BoardFit();
      syncHintRulesWindowGeometry();
    });
  } else {
    try {
      applyBottomNavLayout(await loadBottomNavLayout());
    } catch (err) {
      console.warn('Bottom nav layout:', err);
    }
    try {
      applyPreviewLayout(await loadPreviewLayout());
    } catch (err) {
      console.warn('Preview layout:', err);
    }
    try {
      applyTilebagLayout(await loadTilebagLayout());
    } catch (err) {
      console.warn('Tile bag layout:', err);
    }
  }
  try {
    applyRandomPopupLayout(await loadRandomPopupLayout());
  } catch (err) {
    console.warn('Random popup layout:', err);
  }
  try {
    applyChallengeBeginLayout(await loadChallengeBeginLayout());
  } catch (err) {
    console.warn('Challenge begin layout:', err);
  }
}

async function init() {
  window.__tilezillaGuest = guestUser;
  guestUser.wireLoginRequiredModal();
  guestUser.wireGuestCompletionModal();
  applyGuestChrome();

  const settings = loadGameplaySettings();
  applyPhonePreviewMode(settings.phonePreview === 'ON');
  applyUiScale();
  wireUiScaleListeners();
  await applyShellLayouts();
  const syncBagScroll = wireBagScroll();
  let appRef = null;
  wireTileBagExpand(syncBagScroll, () => appRef);
  resetPuzzleTimer();

  const app = await waitForApp();
  appRef = app;
  app.onBoardStateChanged = () => syncBoardChrome(app);
  wireBottomNav(() => appRef);
  wireBottomMenuV2();
  updateGlobalHintCount(app);
  wirePuzzleTimer(app);
  await updateRankPanel(app);
  syncTileBagExpandAvailability(app);
  applyResponsiveBoard(app);
  app.applyGameplaySettings(settings);
  const menuApi = initMenuUi({
    getApp: () => appRef,
    openStuckFlow,
  });
  initStuckPopup({ getApp: () => appRef, menuApi });
  initRandomPuzzlePopup({
    getApp: () => appRef,
    menuApi,
    onRemainOnPath: () => switchToAdventureScreen(appRef),
    onVentureForth: () => loadRandomVenturePuzzle(appRef),
  });
  initChallengeBeginPopup({
    menuApi,
    onContinueSearch: () => continueDiscoverySearch(appRef),
  });
  const journalApi = initJournalUi({
    getApp: () => appRef,
    menuApi,
    loadPuzzleLevel: (levelId) => loadJournalPuzzleOnBoard(appRef, levelId),
  });
  window.__journalApi = journalApi;

  initPuzzleInfoPopup({ getApp: () => appRef, menuApi, journalApi });
  initProfileOverlay({
    menuApi,
    onDaily: async () => {
      const app = appRef;
      const appRoot = document.querySelector('.tz-app');
      appRoot?.setAttribute('data-screen', 'daily-challenge');
      guestUser.syncGuestBanner();
      if (app) await loadDailyPuzzle(app);
    },
    onAdventure: async () => {
      const app = appRef;
      const appRoot = document.querySelector('.tz-app');
      appRoot?.setAttribute('data-screen', 'adventure');
      guestUser.syncGuestBanner();
      if (app) await loadAdventurePuzzle(app);
    },
    onRandom: () => openRandomPuzzlePopup(),
  });
  initHintRules({ menuApi });
  initBuyHintsPopup({ menuApi });
  wireBuyHintsTriggers();
  initDiscoveryRecord({
    getApp: () => appRef,
    onContinueSearch: () => continueDiscoverySearch(appRef),
    onAdvancePath: async () => {
      const appRoot = document.querySelector('.tz-app');
      if (appRoot?.dataset?.screen === 'daily-challenge') {
        await switchToAdventureScreen(appRef);
        return;
      }
      await advanceAdventurePath(appRef);
    },
    onAdventureProgress: () => refreshAdventureChrome(appRef),
    onViewFoundSolve: (solutionIndex) => menuApi?.openFoundSolutionAt?.(solutionIndex),
    onOpenFoundSolutions: () => {
      void journalApi?.openJournal?.({
        mode: 'record',
        levelId: appRef?.state?.currentLevel?.id,
      });
    },
    onResumeBoardEdit: () => {
      resetPreviewAfterSolve();
      if (appRef) syncBoardChrome(appRef);
    },
  });
  initInvalidSolve({
    getApp: () => appRef,
    onDismiss: async () => {
      const app = appRef;
      if (!app) return;
      const removed = await undoLastPlacedTile(app);
      app.clearActivePreviewSelection?.();
      syncBoardChrome(app);
      await app.renderActivePreview?.();
      if (removed) {
        showGameMessage('Last tile removed.', 'info');
      }
    },
  });
  let tilesetPickerApi = null;
  const settingsApi = initSettingsUi({
    menuApi,
    onChange: (next) => {
      applyPhonePreviewMode(next.phonePreview === 'ON');
      applyUiScale();
      app.applyGameplaySettings(next);
      app.renderTiles();
      updateTileBagCount(app);
    },
    getTilesetLabel: () => formatTilesetDisplayName(appRef?.state?.activeTileset),
    onOpenTileset: () => tilesetPickerApi?.openTilesetPicker?.(),
  });
  tilesetPickerApi = initTilesetPicker({
    getApp: () => appRef,
    menuApi,
    settingsApi,
    onEquipped: () => {
      updateTileBagCount(appRef);
      syncBoardChrome(appRef);
    },
  });
  if (menuApi && settingsApi?.openSettings) {
    menuApi.openSettings = settingsApi.openSettings;
  }

  const forceDiscoveryPreview = () => {
    settingsApi?.closeSettings?.();
    menuApi?.closeAll?.();
    window.__discoveryRecord?.showPreview?.();
  };

  initDevTools({
    getApp: () => appRef,
    menuApi,
    onForceDiscovery: forceDiscoveryPreview,
  });
  syncDevUserUi(app.state?.userId);
  window.__refreshAdventureChrome = () => refreshAdventureChrome(appRef);

  try {
    const discoveryLayout = await loadDiscoveryRecordLayout();
    applyDiscoveryRecordLayout(discoveryLayout);
    setDiscoveryRecordLayout(discoveryLayout);
    setDiscoveryRecordTexts(getDiscoveryTexts(discoveryLayout));
    applyDiscoveryButtonArt(discoveryLayout, document.getElementById('discoveryRecord'), 'new');
  } catch (err) {
    console.warn('Discovery record layout:', err);
  }

  try {
    applyMenuLayout(await loadMenuLayout());
  } catch (err) {
    console.warn('Menu layout:', err);
  }

  try {
    await initMenuSystemInfo();
  } catch (err) {
    console.warn('System info:', err);
  }

  try {
    applyPuzzleInfoLayout(await loadPuzzleInfoLayout());
  } catch (err) {
    console.warn('Puzzle info layout:', err);
  }

  try {
    applyHintRulesLayout(await loadHintRulesLayout());
  } catch (err) {
    console.warn('Hint rules layout:', err);
  }

  try {
    if (window.__journalApi?.applyLayoutFromDisk) {
      await window.__journalApi.applyLayoutFromDisk();
    } else {
      const layout = await loadJournalLayout();
      applyJournalLayoutEverywhere(layout);
      const frame = document.querySelector('#journalRoot .tz-journal-dialog__frame');
      if (frame) applyJournalOverlays(layout, frame);
    }
  } catch (err) {
    console.warn('Journal layout:', err);
  }

  $('previewCheckSolBtn')?.addEventListener('click', () => {
    $('checkSolBtn')?.click();
  });

  wireActions(app);
  wirePreviewV2DataClicks();
  wireHintMenu(app);
  wireCheckMessageMirror();
  wirePreviewSync();
  wirePaletteHooks(app);
  wireBoardHooks(app);

  window.addEventListener('resize', () => {
    applyUiScale();
    if (app?.CONFIG) applyBoardFrameLayout(app);
  });

  await loadDailyPuzzle(app);
  if (guestUser.isGuestUser()) {
    guestUser.trackGuestGameplay('Daily Challenge Started', app.state?.currentLevel?.id);
  }

  const startScreen = new URLSearchParams(window.location.search).get('screen');
  if (startScreen && startScreen !== 'daily-challenge' && !guestUser.isGuestUser()) {
    const hit = document.querySelector(`.tz-bottom-nav__hit[data-nav="${startScreen}"]`);
    hit?.click();
  }

  applyGuestChrome(appRef);
}

async function refreshBottomNavLayoutFromDisk() {
  try {
    applyBottomNavLayout(await reloadBottomNavLayout());
  } catch (err) {
    console.warn('Bottom nav layout reload:', err);
  }
}

window.addEventListener('tilezilla:bottom-nav-layout-saved', () => {
  void refreshBottomNavLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (
    e.key === 'tilezilla:layouts:bottom-nav'
    || e.key === 'tilezilla:layouts:bottom-nav:pending'
    || e.key === 'tilezilla:bottom-nav-layout-version'
  ) {
    void refreshBottomNavLayoutFromDisk();
  }
});

window.addEventListener('focus', () => {
  void refreshBottomNavLayoutFromDisk();
});

async function refreshRandomPopupLayoutFromDisk() {
  try {
    applyRandomPopupLayout(await reloadRandomPopupLayout());
  } catch (err) {
    console.warn('Random popup layout reload:', err);
  }
}

window.addEventListener('tilezilla:random-popup-layout-saved', () => {
  void refreshRandomPopupLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (
    e.key === 'tilezilla:layouts:random-popup'
    || e.key === 'tilezilla:layouts:random-popup:pending'
    || e.key === 'tilezilla:random-popup-layout-version'
  ) {
    void refreshRandomPopupLayoutFromDisk();
  }
});

async function refreshPreviewLayoutFromDisk() {
  try {
    if (MAIN_V2_SHELL) {
      const previewLayout = await reloadPreviewV2Layout();
      applyPreviewV2Layout(previewLayout);
      applyHintV2Layout(await loadHintV2Layout());
      applyHintV2ArtImages(document);
      await applyAllPreviewV2DataSublayouts();
    } else {
      applyPreviewLayout(await reloadPreviewLayout());
    }
  } catch (err) {
    console.warn('Preview layout reload:', err);
  }
}

async function refreshHintV2LayoutFromDisk() {
  if (!MAIN_V2_SHELL) return;
  try {
    applyPreviewV2Layout(await reloadPreviewV2Layout());
    applyHintV2Layout(await reloadHintV2Layout());
    applyHintV2ArtImages(document);
    const app = window.__tilezillaApp;
    if (app) updateHintButtonState(app);
  } catch (err) {
    console.warn('Hint v2 layout reload:', err);
  }
}

async function refreshPreviewV2DataSublayoutFromDisk(sectionKey) {
  if (!MAIN_V2_SHELL) return;
  try {
    clearPreviewV2DataSublayoutCache(sectionKey);
    const layout = await loadPreviewV2DataSublayout(sectionKey, { force: true });
    applyPreviewV2DataSublayout(sectionKey, layout);
  } catch (err) {
    console.warn(`Preview data sublayout reload (${sectionKey}):`, err);
  }
}

window.addEventListener('tilezilla:preview-layout-saved', () => {
  void refreshPreviewLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (
    e.key === 'tilezilla:layouts:preview'
    || e.key === 'tilezilla:layouts:preview:pending'
    || e.key === 'tilezilla:preview-layout-version'
  ) {
    void refreshPreviewLayoutFromDisk();
  }
});

window.addEventListener('focus', () => {
  void refreshPreviewLayoutFromDisk();
  void refreshHintV2LayoutFromDisk();
});

async function refreshMainScreenV2LayoutFromDisk() {
  if (!MAIN_V2_SHELL) return;
  try {
    applyMainScreenV2Layout(await reloadMainScreenV2Layout());
    requestAnimationFrame(() => syncHintRulesWindowGeometry());
  } catch (err) {
    console.warn('Main screen v2 layout reload:', err);
  }
}

window.addEventListener('tilezilla:main-screen-v2-layout-saved', () => {
  void refreshMainScreenV2LayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (
    e.key === 'tilezilla:layouts:main-screen-v2'
    || e.key === 'tilezilla:layouts:main-screen-v2:pending'
  ) {
    void refreshMainScreenV2LayoutFromDisk();
  }
});

window.addEventListener('tilezilla:preview-v2-layout-saved', () => {
  void refreshPreviewLayoutFromDisk();
});

window.addEventListener('tilezilla:hint-v2-layout-saved', () => {
  void refreshHintV2LayoutFromDisk();
});

for (const sectionKey of ['userData', 'gameData', 'infoData', 'timerData']) {
  window.addEventListener(`tilezilla:${sectionKey}-v2-layout-saved`, () => {
    void refreshPreviewV2DataSublayoutFromDisk(sectionKey);
  });
}

window.addEventListener('storage', (e) => {
  if (
    e.key === 'tilezilla:layouts:preview-v2'
    || e.key === 'tilezilla:layouts:preview-v2:pending'
  ) {
    void refreshPreviewLayoutFromDisk();
  }
  if (
    e.key === 'tilezilla:layouts:hint-v2'
    || e.key === 'tilezilla:layouts:hint-v2:pending'
    || e.key === 'tilezilla:hint-v2-layout-version'
  ) {
    void refreshHintV2LayoutFromDisk();
  }
  for (const sectionKey of ['userData', 'gameData', 'infoData', 'timerData']) {
    const def = PREVIEW_V2_DATA_SECTIONS[sectionKey];
    if (
      e.key === def.lsKey
      || e.key === def.lsPendingKey
      || e.key === `tilezilla:${sectionKey}-v2-layout-version`
    ) {
      void refreshPreviewV2DataSublayoutFromDisk(sectionKey);
    }
  }
});

async function refreshMenuLayoutFromDisk() {
  clearMenuLayoutCache();
  try {
    applyMenuLayout(await loadMenuLayout());
  } catch (err) {
    console.warn('Menu layout reload:', err);
  }
}

window.addEventListener('tilezilla:menu-layout-saved', () => {
  void refreshMenuLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'tilezilla:menu-layout-version') {
    void refreshMenuLayoutFromDisk();
  }
});

window.addEventListener('focus', () => {
  void refreshMenuLayoutFromDisk();
});

async function refreshDiscoveryLayoutFromDisk() {
  try {
    const layout = await reloadDiscoveryRecordLayout();
    applyDiscoveryRecordLayout(layout);
    setDiscoveryRecordLayout(layout);
    setDiscoveryRecordTexts(getDiscoveryTexts(layout));
    const root = document.getElementById('discoveryRecord');
    const mode = root?.classList.contains('tz-discovery-record--duplicate') ? 'duplicate' : 'new';
    applyDiscoveryButtonArt(layout, root, mode);

    if (root && !root.hidden) {
      const showAdvance = root.classList.contains('tz-discovery-record--with-advance');
      applyDiscoveryPopupLayout(
        layout,
        getDiscoveryVariantKey(mode, showAdvance),
        root,
      );
    }
  } catch (err) {
    console.warn('Discovery layout reload:', err);
  }
}

window.addEventListener('tilezilla:discovery-layout-saved', () => {
  void refreshDiscoveryLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'tilezilla:discovery-layout-version') {
    void refreshDiscoveryLayoutFromDisk();
  }
});

window.addEventListener('focus', () => {
  void refreshDiscoveryLayoutFromDisk();
});

async function refreshPuzzleInfoLayoutFromDisk() {
  clearPuzzleInfoLayoutCache();
  try {
    applyPuzzleInfoLayout(await reloadPuzzleInfoLayout());
  } catch (err) {
    console.warn('Puzzle info layout reload:', err);
  }
}

window.addEventListener('tilezilla:puzzle-info-layout-saved', () => {
  void refreshPuzzleInfoLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'tilezilla:puzzle-info-layout-version') {
    void refreshPuzzleInfoLayoutFromDisk();
  }
});

window.addEventListener('focus', () => {
  void refreshPuzzleInfoLayoutFromDisk();
});

async function refreshHintRulesLayoutFromDisk() {
  clearHintRulesLayoutCache();
  try {
    applyHintRulesLayout(await reloadHintRulesLayout());
  } catch (err) {
    console.warn('Hint rules layout reload:', err);
  }
}

window.addEventListener('tilezilla:hint-rules-layout-saved', () => {
  void refreshHintRulesLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'tilezilla:hint-rules-layout-version') {
    void refreshHintRulesLayoutFromDisk();
  }
});

window.addEventListener('focus', () => {
  void refreshHintRulesLayoutFromDisk();
});

async function refreshJournalLayoutFromDisk() {
  clearJournalLayoutCache();
  try {
    if (window.__journalApi?.applyLayoutFromDisk) {
      await window.__journalApi.applyLayoutFromDisk({ force: true });
      return;
    }
    const layout = await reloadJournalLayout();
    applyJournalLayoutEverywhere(layout);
    const frame = document.querySelector('#journalRoot .tz-journal-dialog__frame');
    if (frame) {
      applyJournalOverlays(layout, frame);
    }
  } catch (err) {
    console.warn('Journal layout reload:', err);
  }
}

window.addEventListener('tilezilla:journal-layout-saved', () => {
  void refreshJournalLayoutFromDisk();
});

async function refreshTilebagLayoutFromDisk() {
  try {
    if (MAIN_V2_SHELL) {
      applyTilebagV2Layout(await reloadTilebagV2Layout());
    } else {
      clearTilebagLayoutCache();
      applyTilebagLayout(await reloadTilebagLayout());
    }
    const container = $('tileBagContainer');
    if (container && tileBagExpanded) {
      applyTileBagExpandedLayout(container, true);
    }
  } catch (err) {
    console.warn('Tile bag layout reload:', err);
  }
}

window.addEventListener('tilezilla:tilebag-layout-saved', () => {
  if (!MAIN_V2_SHELL) void refreshTilebagLayoutFromDisk();
});

window.addEventListener('tilezilla:tilebag-v2-layout-saved', () => {
  if (MAIN_V2_SHELL) void refreshTilebagLayoutFromDisk();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'tilezilla:journal-layout-version') {
    void refreshJournalLayoutFromDisk();
  }
  if (e.key === 'tilezilla:tilebag-layout-version' && !MAIN_V2_SHELL) {
    void refreshTilebagLayoutFromDisk();
  }
  if (e.key === 'tilezilla:tilebag-v2-layout-version' && MAIN_V2_SHELL) {
    void refreshTilebagLayoutFromDisk();
  }
});

window.addEventListener('focus', () => {
  void refreshJournalLayoutFromDisk();
  void refreshTilebagLayoutFromDisk();
});

window.addEventListener('tilezilla:sublevel-layout-saved', () => {
  clearSublevelLayoutCache();
  if (typeof updateRankPanel === 'function') {
    const app = window.__app;
    if (app) void updateRankPanel(app);
  }
});

window.__tilezillaDev = {
  /** Clear saved solutions for a dev player. Pass reload:false to stay on the page. */
  resetPlayer(userId, { reload = true } = {}) {
    const id = userId || window.__app?.state?.userId || 'gar';
    const result = resetDevPlayerProgress(id);
    console.info(`[tilezilla] Reset ${id}:`, result);
    if (reload) window.location.reload();
    return result;
  },
};

init().catch((err) => {
  console.error(err);
  showGameMessage(err.message, 'error');
});
