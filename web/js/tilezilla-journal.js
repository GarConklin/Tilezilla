/**
 * Puzzle Journal — record + library modes on NewPuzzleJournalBlank.png.
 */

import {
  loadJournalLayout,
  reloadJournalLayout,
  applyJournalLayout,
  applyJournalLayoutEverywhere,
  applyJournalLayoutHits,
  applyJournalOverlays,
} from './journal-layout.js';
import { getJournalRecord, getJournalLibraryIndex } from './journal-data.js';
import { applyRevisitLayout, loadRevisitLayout, reloadRevisitLayout } from './revisit-layout.js';
import { initJournalListScroller } from './journal-scroller.js';
import { closePuzzleInfoPopup } from './tilezilla-puzzle-info.js';

let getApp = () => null;
let menuApi = null;
let loadPuzzleLevel = async () => false;
let onResumeGame = null;
let listScroller = null;
let journalLayoutCache = null;
let previewRenderToken = 0;
let previewContext = null;
let previewResizeObserver = null;
let previewResizeTimer = null;
let state = {
  mode: 'record',
  levelId: null,
  selectedSolutionIndex: null,
  libraryFilters: { boardSize: '', puzzleType: '' },
  libraryPuzzles: [],
  activeTab: 'puzzle',
  resumeGameOnClose: false,
  resumeLevelId: null,
  resumeScreen: null,
  returnToLibrary: false,
  challengeDate: null,
};

function $(id) {
  return document.getElementById(id);
}

function effectiveJournalLayout() {
  return journalLayoutCache;
}

function applyEffectiveJournalLayout() {
  const layout = effectiveJournalLayout();
  if (!layout) return;
  applyJournalLayout(layout, document.documentElement);
  const frame = $('journalRoot')?.querySelector('.tz-journal-dialog__frame');
  if (frame) applyJournalLayout(layout, frame);
  applyJournalLayoutHits(layout);
}

async function applyLayoutFromDisk({ force = false } = {}) {
  try {
    const root = $('journalRoot');
    const journalOpen = root && !root.hidden;
    journalLayoutCache = force
      ? await reloadJournalLayout()
      : await loadJournalLayout();
    if (journalOpen) {
      applyEffectiveJournalLayout();
    } else {
      applyJournalLayoutEverywhere(journalLayoutCache);
    }
    syncJournalOverlays();
    syncJournalDialogTop();
    if (journalOpen) {
      listScroller?.sync?.();
      await rerenderSelectedPreview();
    }
  } catch (err) {
    console.warn('Journal layout:', err);
  }
}

/** Pin journal shell just under the centered title (12px gap). */
export function syncJournalDialogTop() {
  const journalRoot = $('journalRoot');
  if (!journalRoot) return;

  const padTop = parseFloat(getComputedStyle(journalRoot).paddingTop) || 0;
  const rootTop = journalRoot.getBoundingClientRect().top;
  const titleGap = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--tz-journal-title-gap'),
  ) || 12;

  const titleEl = document.querySelector('.tz-title-img');
  let anchorBottom = 0;
  if (titleEl) {
    anchorBottom = titleEl.getBoundingClientRect().bottom;
  } else {
    const header = document.querySelector('.tz-header');
    if (header) {
      anchorBottom = header.getBoundingClientRect().bottom;
    } else {
      const scale = parseFloat(document.documentElement.dataset.uiScale) || 1;
      anchorBottom = rootTop + 48 * scale;
    }
  }

  const marginTop = Math.max(0, anchorBottom - rootTop - padTop + titleGap);
  journalRoot.style.setProperty('--tz-journal-dialog-top', `${marginTop}px`);
}

function syncJournalLayoutHits() {
  const layout = effectiveJournalLayout();
  if (layout) applyJournalLayoutHits(layout);
}

function syncJournalOverlays() {
  const frame = $('journalRoot')?.querySelector('.tz-journal-dialog__frame');
  if (!frame || !journalLayoutCache) return;
  applyJournalOverlays(journalLayoutCache, frame, {
    mode: state.mode,
    activeTab: state.activeTab,
  });
}

function setModalOpen(on) {
  document.body.classList.toggle('tz-modal-open', on);
}

function isOverlayOpen(id) {
  const el = $(id);
  return !!el && !el.hidden;
}

function syncModalOpenState() {
  const anyOpen = [
    'menuRoot',
    'menuPanelRoot',
    'settingsRoot',
    'puzzleInfoRoot',
    'journalRoot',
    'profileOverlayRoot',
    'hintMenuRoot',
    'hintRulesRoot',
    'cartographersJournalRoot',
    'stuckPopupRoot',
    'randomPopupRoot',
    'tilesetPickerRoot',
  ].some(isOverlayOpen);
  setModalOpen(anyOpen);
}

function clearJournalResumeState() {
  state.resumeGameOnClose = false;
  state.resumeLevelId = null;
  state.resumeScreen = null;
}

function closeJournal() {
  const root = $('journalRoot');
  if (!root) return;
  const resumeGame = state.resumeGameOnClose;
  const resumeLevelId = state.resumeLevelId;
  const resumeScreen = state.resumeScreen;
  clearJournalResumeState();
  state.returnToLibrary = false;

  root.hidden = true;
  $('journalLoadConfirm')?.setAttribute('hidden', '');

  closePuzzleInfoPopup();
  syncModalOpenState();

  if (resumeGame) {
    onResumeGame?.({ levelId: resumeLevelId, resumeScreen });
  }
}

async function showLoadConfirm(show) {
  const el = $('journalLoadConfirm');
  if (!el) return;
  if (!show) {
    el.setAttribute('hidden', '');
    return;
  }

  const app = getApp();
  let puzzleId = state.levelId || '—';
  let solutions = '—';
  let solved = '—';

  if (app && state.levelId) {
    const record = await getJournalRecord(app, state.levelId);
    if (record) {
      puzzleId = record.puzzleId || record.levelId || puzzleId;
      solutions = record.totalKnown > 0
        ? `${record.solutionsFound} / ${record.totalKnown}`
        : String(record.solutionsFound ?? 0);
      const entry = Number.isFinite(state.selectedSolutionIndex)
        ? (record.entries || []).find((e) => e.index === state.selectedSolutionIndex)
        : null;
      solved = entry?.foundDate || record.firstSolvedDate || '—';
    }
  }

  const set = (id, text) => {
    const node = $(id);
    if (node) node.textContent = text ?? '—';
  };
  set('journalRevisitPuzzleId', puzzleId);
  set('journalRevisitSolutions', solutions);
  set('journalRevisitSolved', solved);

  el.removeAttribute('hidden');
}

function isJournalArtTab() {
  return state.activeTab === 'stats' || state.activeTab === 'records';
}

function syncJournalTabContent() {
  const artTab = isJournalArtTab();
  const frame = $('journalRoot')?.querySelector('.tz-journal-dialog__frame');

  $('journalRecordTop')?.toggleAttribute('hidden', artTab || state.mode !== 'record');
  $('journalLibraryTop')?.toggleAttribute('hidden', artTab || state.mode !== 'library');
  $('journalListTitleBar')?.toggleAttribute('hidden', artTab);
  $('journalTitleFound')?.toggleAttribute('hidden', artTab || state.mode !== 'record');
  $('journalTitleRecorded')?.toggleAttribute('hidden', artTab || state.mode !== 'library');

  for (const sel of ['.tz-journal-pane--top', '.tz-journal-pane--bl', '.tz-journal-pane--br']) {
    frame?.querySelector(sel)?.toggleAttribute('hidden', artTab);
  }

  if (artTab) {
    $('journalPreviewWrap')?.setAttribute('hidden', '');
    $('journalBeginSearchBtn')?.setAttribute('hidden', '');
    $('journalLoadConfirm')?.setAttribute('hidden', '');
  }
}

function syncBackButtonVisibility() {
  const btn = $('journalBtnLibraryBack');
  if (!btn) return;
  const show = state.mode === 'record' && state.returnToLibrary && !isJournalArtTab();
  btn.toggleAttribute('hidden', !show);
}

function setModeUi(mode) {
  const root = $('journalRoot');
  if (root) root.dataset.journalMode = mode;
  applyEffectiveJournalLayout();
  syncJournalTabContent();
  syncJournalOverlays();
  syncBackButtonVisibility();
}

async function activateJournalTab(tab) {
  state.activeTab = tab;
  syncJournalTabContent();
  syncJournalOverlays();
  syncBackButtonVisibility();

  if (tab === 'stats' || tab === 'records') return;

  if (state.mode === 'record') {
    await refreshRecordView();
  } else if (state.mode === 'library') {
    await refreshLibraryView();
  }
  listScroller?.sync?.();
}

function renderProgressBar(record) {
  const bar = $('journalProgressBar');
  const fill = $('journalProgressFill');
  const label = $('journalProgressLabel');
  if (!bar || !fill || !label || !record) return;
  const pct = Math.max(0, Math.min(100, record.progressPct || 0));
  fill.style.width = `${pct}%`;
  label.textContent = '';
  label.setAttribute('aria-hidden', 'true');
  bar.hidden = false;
}

function renderRecordFields(record) {
  if (!record) return;
  const set = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text ?? '—';
  };
  set('journalFieldId', record.puzzleId);
  set('journalFieldType', record.puzzleType);
  set('journalFieldSize', record.boardSize);
  set('journalFieldTotal', record.totalKnown > 0 ? String(record.totalKnown) : '—');
  set(
    'journalFieldFound',
    record.totalKnown > 0
      ? `${record.solutionsFound} / ${record.totalKnown}`
      : String(record.solutionsFound ?? 0),
  );
  set('journalFieldFirst', record.firstSolvedDate);
  set('journalFieldLast', record.lastPlayedDate);
  renderProgressBar(record);
}

function renderSolutionList(entries, { mode = 'solutions' } = {}) {
  const list = $('journalList');
  if (!list) return;
  list.replaceChildren();

  if (!entries?.length) {
    const empty = document.createElement('p');
    empty.className = 'tz-journal-list__empty';
    empty.textContent = mode === 'solutions'
      ? 'No solutions found yet.'
      : 'No recorded puzzles match your filters.';
    list.appendChild(empty);
    listScroller?.sync?.();
    return;
  }

  for (const entry of entries) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-journal-list__row';
    if (entry.progressState) {
      btn.classList.add(`tz-journal-list__row--${entry.progressState}`);
    }
    if (mode === 'solutions' && entry.index != null) {
      btn.dataset.solutionIndex = String(entry.index);
    }
    if (mode === 'puzzles' && entry.levelId) {
      btn.dataset.levelId = entry.levelId;
    }

    const main = document.createElement('span');
    main.className = 'tz-journal-list__row-main';
    if (mode === 'puzzles') {
      const idSpan = document.createElement('span');
      idSpan.className = 'tz-journal-list__row-id';
      idSpan.textContent = entry.label;
      main.appendChild(idSpan);
      if (entry.detailLabel) {
        const detail = document.createElement('span');
        detail.className = 'tz-journal-list__row-detail';
        detail.textContent = entry.detailLabel;
        main.appendChild(detail);
      }
    } else {
      main.textContent = entry.label;
    }

    const sub = document.createElement('span');
    sub.className = 'tz-journal-list__row-sub';
    if (mode === 'solutions') {
      sub.textContent = [entry.foundDate, entry.solveTime].filter((x) => x && x !== '—').join(' · ') || '';
    } else {
      sub.textContent = entry.progressLabel;
    }

    btn.appendChild(main);
    if (sub.textContent) btn.appendChild(sub);

    if (entry.progressState && mode === 'puzzles') {
      const bar = document.createElement('span');
      bar.className = 'tz-journal-list__row-bar';
      bar.style.setProperty('--tz-journal-row-pct', `${entry.progressPct || 0}%`);
      btn.appendChild(bar);
    }

    btn.addEventListener('click', () => {
      if (mode === 'solutions') {
        void selectSolution(entry);
      } else {
        void openJournal({
          mode: 'record',
          levelId: entry.levelId,
          fromLibrary: true,
          challengeDate: entry.challengeDateIso || null,
        });
      }
    });

    list.appendChild(btn);
  }

  syncActiveSolutionRowHighlight();
  listScroller?.sync?.();
}

function syncActiveSolutionRowHighlight({ pulse = false } = {}) {
  const list = $('journalList');
  if (!list) return;

  let activeRow = null;
  for (const row of list.querySelectorAll('.tz-journal-list__row')) {
    const solutionIndex = row.dataset.solutionIndex != null
      ? Number(row.dataset.solutionIndex)
      : null;
    const levelId = row.dataset.levelId || null;
    const isActive = (state.mode === 'record'
      && solutionIndex != null
      && solutionIndex === state.selectedSolutionIndex)
      || (state.mode === 'library' && levelId && levelId === state.levelId);

    row.classList.toggle('tz-journal-list__row--active', isActive);
    row.toggleAttribute('aria-current', isActive);
    if (isActive) activeRow = row;
  }

  if (activeRow && pulse) {
    activeRow.classList.remove('tz-journal-list__row--nav-pulse');
    // Force reflow so repeated prev/next replays the pulse.
    void activeRow.offsetWidth;
    activeRow.classList.add('tz-journal-list__row--nav-pulse');
    activeRow.addEventListener(
      'animationend',
      () => activeRow.classList.remove('tz-journal-list__row--nav-pulse'),
      { once: true },
    );
  }

  if (activeRow) scrollActiveListRowIntoView();
}

function syncPreviewSolutionHighlight(entry) {
  const wrap = $('journalPreviewWrap');
  if (!wrap) return;
  const hasSolution = !!entry?.placements?.length;
  wrap.classList.toggle('tz-journal-preview-wrap--active-solution', hasSolution);
  if (hasSolution && entry.index != null) {
    wrap.dataset.solutionIndex = String(entry.index);
  } else {
    delete wrap.dataset.solutionIndex;
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function clearSolutionPreview() {
  const canvas = $('journalPreviewCanvas');
  const wrap = $('journalPreviewWrap');
  if (!canvas || !wrap) return;

  previewRenderToken += 1;
  previewContext = null;
  wrap.hidden = true;
  wrap.classList.remove('tz-journal-preview-wrap--active-solution');
  delete wrap.dataset.solutionIndex;
  showLoadConfirm(false);

  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
  canvas.removeAttribute('tabindex');
  canvas.removeAttribute('role');
  canvas.removeAttribute('aria-label');
}

function syncBeginSearchButton(show) {
  const btn = $('journalBeginSearchBtn');
  if (!btn) return;
  const visible = !!show
    && state.mode === 'record'
    && !isJournalArtTab()
    && !!state.levelId;
  if (visible) {
    btn.removeAttribute('hidden');
    syncJournalLayoutHits();
  } else {
    btn.setAttribute('hidden', '');
  }
}

async function renderSolutionPreview(record, entry) {
  const canvas = $('journalPreviewCanvas');
  const wrap = $('journalPreviewWrap');
  const app = getApp();
  if (!canvas || !wrap || !app?.renderSolutionPreview) return;

  if (!entry?.placements?.length) {
    clearSolutionPreview();
    const allFound = (record?.totalKnown || 0) > 0
      && (record?.solutionsFound || 0) >= record.totalKnown;
    syncBeginSearchButton(!allFound);
    return;
  }

  syncBeginSearchButton(false);
  syncPreviewSolutionHighlight(entry);

  previewContext = { record, entry };
  const token = ++previewRenderToken;

  wrap.hidden = false;
  syncJournalLayoutHits();
  await nextFrame();
  await nextFrame();
  if (token !== previewRenderToken) return;

  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('role', 'button');
  canvas.setAttribute('aria-label', 'Revisit this solution on the board');

  const rect = wrap.getBoundingClientRect();
  const cssW = Math.max(1, rect.width || wrap.clientWidth);
  const cssH = Math.max(1, rect.height || wrap.clientHeight);
  const dpr = window.devicePixelRatio || 1;
  const maxPx = Math.max(40, Math.round(Math.min(cssW, cssH) * dpr));

  await app.renderSolutionPreview(canvas, entry.placements, {
    level: record?.level,
    maxPx,
  });
  if (token !== previewRenderToken) return;

  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

async function rerenderSelectedPreview() {
  if (!previewContext) return;
  await renderSolutionPreview(previewContext.record, previewContext.entry);
}

function installPreviewResizeObserver() {
  const wrap = $('journalPreviewWrap');
  if (!wrap || previewResizeObserver) return;
  previewResizeObserver = new ResizeObserver(() => {
    if (wrap.hidden || !previewContext) return;
    clearTimeout(previewResizeTimer);
    previewResizeTimer = setTimeout(() => {
      void rerenderSelectedPreview();
    }, 80);
  });
  previewResizeObserver.observe(wrap);
}

async function selectSolution(entry, { pulse = false } = {}) {
  const app = getApp();
  if (!app || !state.levelId) return;
  state.selectedSolutionIndex = entry.index;
  const record = await getJournalRecord(app, state.levelId);
  const list = $('journalList');
  const hasSolutionRows = list?.querySelector('[data-solution-index]');
  if (!hasSolutionRows) {
    renderSolutionList(record?.entries || [], { mode: 'solutions' });
  } else {
    syncActiveSolutionRowHighlight({ pulse });
  }
  await renderSolutionPreview(record, entry);
  listScroller?.sync?.();
}

async function navigateRecordSolution(delta) {
  const app = getApp();
  if (!app || !state.levelId || state.mode !== 'record') return;
  const record = await getJournalRecord(app, state.levelId);
  const entries = record?.entries || [];
  if (!entries.length) return;

  const curPos = entries.findIndex((e) => e.index === state.selectedSolutionIndex);
  const from = curPos >= 0 ? curPos : 0;
  const nextPos = (from + delta + entries.length) % entries.length;
  await selectSolution(entries[nextPos], { pulse: true });
}

function navigateLibraryPuzzle(delta) {
  const puzzles = state.libraryPuzzles || [];
  if (!puzzles.length || state.mode !== 'library') return;

  let idx = puzzles.findIndex((p) => p.levelId === state.levelId);
  if (idx < 0) idx = delta > 0 ? -1 : 0;
  const nextIdx = (idx + delta + puzzles.length) % puzzles.length;
  state.levelId = puzzles[nextIdx].levelId;
  state.challengeDate = puzzles[nextIdx].challengeDateIso || null;
  const hasPuzzleRows = $('journalList')?.querySelector('[data-level-id]');
  if (!hasPuzzleRows) {
    renderSolutionList(
      puzzles.map((p) => ({ ...p, label: p.label })),
      { mode: 'puzzles' },
    );
  } else {
    syncActiveSolutionRowHighlight({ pulse: true });
  }
  clearSolutionPreview();
  syncBeginSearchButton(false);
  listScroller?.sync?.();
}

function scrollActiveListRowIntoView() {
  const active = $('journalList')?.querySelector('.tz-journal-list__row--active');
  active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function loadBeginSearchToBoard() {
  const app = getApp();
  if (!app || !state.levelId || state.mode !== 'record') return;

  const levelReady = await loadPuzzleLevel(state.levelId, {
    challengeDate: state.challengeDate || null,
  });
  if (!levelReady) return;

  window.__discoveryRecord?.hide?.();
  showLoadConfirm(false);
  clearJournalResumeState();
  closeJournal();
  menuApi?.closeAll?.();
}

async function refreshRecordView() {
  const app = getApp();
  if (!app || !state.levelId) return;
  const record = await getJournalRecord(app, state.levelId);
  if (!record) return;

  renderRecordFields(record);
  const entries = record.entries || [];
  if (!entries.length) {
    state.selectedSolutionIndex = null;
  } else if (state.selectedSolutionIndex == null) {
    state.selectedSolutionIndex = entries[0].index;
  }
  const selected = entries.find((e) => e.index === state.selectedSolutionIndex) || entries[0] || null;
  renderSolutionList(entries, { mode: 'solutions' });
  if (selected) {
    await renderSolutionPreview(record, selected);
  } else {
    clearSolutionPreview();
    const allFound = (record.totalKnown || 0) > 0
      && (record.solutionsFound || 0) >= record.totalKnown;
    syncBeginSearchButton(!allFound);
  }
}

function renderLibrarySelectors(data) {
  const sizeWrap = $('journalSizeFilters');
  const typeWrap = $('journalTypeFilters');
  if (!sizeWrap || !typeWrap) return;

  sizeWrap.replaceChildren();
  for (const s of data.sizeCounts || []) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-journal-filter-btn';
    btn.classList.toggle('is-active', state.libraryFilters.boardSize === s.key);
    btn.textContent = `${s.label} (${s.count})`;
    btn.addEventListener('click', () => {
      state.libraryFilters.boardSize = state.libraryFilters.boardSize === s.key ? '' : s.key;
      void refreshLibraryView();
    });
    sizeWrap.appendChild(btn);
  }

  const types = [
    { key: 'adventure', label: 'Adventure' },
    { key: 'daily-challenge', label: 'Daily Challenge' },
    { key: 'random', label: 'Random Puzzle' },
  ];
  typeWrap.replaceChildren();
  for (const t of types) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-journal-filter-btn';
    btn.classList.toggle('is-active', state.libraryFilters.puzzleType === t.key);
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      state.libraryFilters.puzzleType = state.libraryFilters.puzzleType === t.key ? '' : t.key;
      void refreshLibraryView();
    });
    typeWrap.appendChild(btn);
  }
}

async function refreshLibraryView() {
  const app = getApp();
  if (!app) return;
  const data = await getJournalLibraryIndex(app, {
    boardSize: state.libraryFilters.boardSize || undefined,
    puzzleType: state.libraryFilters.puzzleType || undefined,
  });
  state.libraryPuzzles = data.puzzles || [];
  renderLibrarySelectors(data);
  if (!state.levelId && state.libraryPuzzles.length) {
    state.levelId = state.libraryPuzzles[0].levelId;
    state.challengeDate = state.libraryPuzzles[0].challengeDateIso || null;
  }
  renderSolutionList(
    state.libraryPuzzles.map((p) => ({ ...p, label: p.label })),
    { mode: 'puzzles' },
  );
  clearSolutionPreview();
  syncBeginSearchButton(false);
}

async function loadSelectedSolutionToBoard() {
  const app = getApp();
  if (!app || !state.levelId) return;

  const record = await getJournalRecord(app, state.levelId);
  const entries = record?.entries || [];
  const entry = Number.isFinite(state.selectedSolutionIndex)
    ? entries.find((e) => e.index === state.selectedSolutionIndex)
    : null;
  if (!entry?.placements?.length) return;

  const levelReady = await loadPuzzleLevel(state.levelId, {
    challengeDate: state.challengeDate || null,
  });
  if (!levelReady) return;

  window.__discoveryRecord?.hide?.();
  const ok = await app.applyPlacementsToBoard(entry.placements, {
    message: `Loaded ${entry.label} onto the board (review only).`,
  });
  if (ok) {
    showLoadConfirm(false);
    clearJournalResumeState();
    closeJournal();
    menuApi?.closeAll?.();
  }
}

export async function openJournal({
  mode = 'record',
  levelId,
  solutionIndex,
  resumeGameOnClose,
  resumeLevelId = null,
  resumeScreen = null,
  fromLibrary = false,
  challengeDate = null,
} = {}) {
  const root = $('journalRoot');
  const app = getApp();
  if (!root || !app) return;

  await applyLayoutFromDisk({ force: true });

  menuApi?.closeMenu?.();
  menuApi?.closePanel?.();
  closePuzzleInfoPopup();

  state.mode = mode;
  if (typeof resumeGameOnClose === 'boolean') {
    state.resumeGameOnClose = resumeGameOnClose;
    state.resumeLevelId = resumeLevelId || app.state?.currentLevel?.id || null;
    state.resumeScreen = resumeScreen || null;
  }
  state.activeTab = mode === 'library' ? 'filter' : 'puzzle';
  if (fromLibrary) {
    state.returnToLibrary = true;
  } else if (mode === 'library') {
    state.returnToLibrary = false;
  } else if (mode === 'record') {
    state.returnToLibrary = false;
  }
  if (levelId) state.levelId = levelId;
  state.challengeDate = challengeDate || null;
  if (mode === 'record' && !state.levelId) {
    state.levelId = app.state?.currentLevel?.id || null;
  }

  state.selectedSolutionIndex = Number.isFinite(solutionIndex) ? solutionIndex : null;
  showLoadConfirm(false);
  setModeUi(mode);
  root.hidden = false;
  setModalOpen(true);
  syncJournalDialogTop();

  const scroll = $('journalListScroll');
  if (scroll) scroll.scrollTop = 0;

  if (mode === 'library') {
    await refreshLibraryView();
  } else {
    await refreshRecordView();
    if (Number.isFinite(state.selectedSolutionIndex)) {
      scrollActiveListRowIntoView();
    }
  }

  listScroller?.sync?.();
  requestAnimationFrame(() => {
    syncJournalDialogTop();
    syncJournalLayoutHits();
    syncJournalOverlays();
    listScroller?.sync?.();
    void nextFrame().then(() => rerenderSelectedPreview());
  });
}

export function initJournalUi({
  getApp: getAppFn,
  menuApi: menu,
  loadPuzzleLevel: loadPuzzleLevelFn,
  onResumeGame: onResumeGameFn,
} = {}) {
  getApp = getAppFn || (() => null);
  menuApi = menu || null;
  loadPuzzleLevel = loadPuzzleLevelFn || (async () => false);
  onResumeGame = onResumeGameFn || null;

  const root = $('journalRoot');
  if (!root) return null;

  listScroller = initJournalListScroller({
    scrollEl: $('journalListScroll'),
    scrollerRoot: $('journalListScroller'),
    trackEl: $('journalListScrollerTrack'),
    pinEl: $('journalListScrollerPin'),
  });

  $('journalBackdrop')?.addEventListener('click', closeJournal);
  $('journalBtnExit')?.addEventListener('click', closeJournal);
  $('journalBtnLibraryBack')?.addEventListener('click', () => {
    void openJournal({ mode: 'library' });
  });

  $('journalPreviewCanvas')?.addEventListener('click', () => {
    if (state.mode !== 'record' || state.selectedSolutionIndex == null) return;
    void showLoadConfirm(true);
  });
  $('journalPreviewCanvas')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    void showLoadConfirm(true);
  });

  $('journalRevisitBackdrop')?.addEventListener('click', () => showLoadConfirm(false));
  $('journalLoadCancel')?.addEventListener('click', () => showLoadConfirm(false));
  $('journalLoadConfirmBtn')?.addEventListener('click', () => {
    void loadSelectedSolutionToBoard();
  });

  $('journalBeginSearchBtn')?.addEventListener('click', () => {
    void loadBeginSearchToBoard();
  });

  const tabMap = {
    journalTabPuzzle: 'puzzle',
    journalTabStats: 'stats',
    journalTabFilter: 'filter',
    journalTabRecords: 'records',
  };
  for (const [id, tab] of Object.entries(tabMap)) {
    $(id)?.addEventListener('click', () => {
      if (tab === 'filter' && state.mode === 'record') {
        void openJournal({ mode: 'library' });
        return;
      }
      if (tab === 'puzzle' && state.mode === 'library') {
        void openJournal({
          mode: 'record',
          levelId: state.levelId || getApp()?.state?.currentLevel?.id,
          fromLibrary: true,
        });
        return;
      }
      void activateJournalTab(tab);
    });
  }

  $('journalBtnFilter')?.addEventListener('click', () => {
    void openJournal({ mode: 'library' });
  });

  $('journalBtnStats')?.addEventListener('click', () => {
    void activateJournalTab('stats');
  });

  $('journalBtnPrev')?.addEventListener('click', () => {
    if (state.mode === 'library') navigateLibraryPuzzle(-1);
    else void navigateRecordSolution(-1);
  });

  $('journalBtnNext')?.addEventListener('click', () => {
    if (state.mode === 'library') navigateLibraryPuzzle(1);
    else void navigateRecordSolution(1);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    if (!$('journalLoadConfirm')?.hasAttribute('hidden')) {
      showLoadConfirm(false);
      return;
    }
    closeJournal();
  });

  window.addEventListener('tilezilla:journal-layout-saved', () => {
    void applyLayoutFromDisk({ force: true });
  });

  window.addEventListener('tilezilla:revisit-layout-saved', () => {
    void reloadRevisitLayout()
      .then((layout) => applyRevisitLayout(layout))
      .catch((err) => console.warn('Revisit layout reload:', err));
  });

  window.addEventListener('storage', (e) => {
    if (
      e.key === 'tilezilla:layouts:revisit'
      || e.key === 'tilezilla:layouts:revisit:pending'
      || e.key === 'tilezilla:revisit-layout-version'
    ) {
      void reloadRevisitLayout()
        .then((layout) => applyRevisitLayout(layout))
        .catch((err) => console.warn('Revisit layout reload:', err));
    }
  });

  window.addEventListener('focus', () => {
    if (root.hidden) return;
    void applyLayoutFromDisk({ force: true });
  });

  window.addEventListener('resize', () => {
    if (root.hidden) return;
    syncJournalDialogTop();
    syncJournalLayoutHits();
    listScroller?.sync?.();
  });

  void applyLayoutFromDisk();

  installPreviewResizeObserver();

  void loadRevisitLayout()
    .then((layout) => applyRevisitLayout(layout))
    .catch((err) => console.warn('Revisit layout:', err));

  return {
    openJournal,
    closeJournal,
    applyLayoutFromDisk,
    syncJournalDialogTop,
    syncJournalLayoutHits,
    syncJournalTabHits: syncJournalLayoutHits,
  };
}
