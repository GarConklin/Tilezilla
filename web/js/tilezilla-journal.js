/**
 * Puzzle Journal — record + library modes on NewPuzzleJournalBlank.png.
 */

import { loadJournalLayout, applyJournalLayout, applyJournalOverlays } from './journal-layout.js';
import { getJournalRecord, getJournalLibraryIndex } from './journal-data.js';
import { initJournalListScroller } from './journal-scroller.js';

let getApp = () => null;
let menuApi = null;
let listScroller = null;
let journalLayoutCache = null;
let state = {
  mode: 'record',
  levelId: null,
  selectedSolutionIndex: null,
  libraryFilters: { boardSize: '', puzzleType: '', status: 'all' },
  libraryPuzzles: [],
  activeTab: 'puzzle',
};

function $(id) {
  return document.getElementById(id);
}

async function applyLayoutFromDisk() {
  try {
    journalLayoutCache = await loadJournalLayout();
    applyJournalLayout(journalLayoutCache);
    syncJournalOverlays();
  } catch (err) {
    console.warn('Journal layout:', err);
  }
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

function closeJournal() {
  const root = $('journalRoot');
  if (!root) return;
  root.hidden = true;
  $('journalLoadConfirm')?.setAttribute('hidden', '');
  if (
    $('menuRoot')?.hidden !== false
    && $('menuPanelRoot')?.hidden !== false
    && $('settingsRoot')?.hidden !== false
    && $('puzzleInfoRoot')?.hidden !== false
    && $('hintRulesRoot')?.hidden !== false
    && $('stuckPopupRoot')?.hidden !== false
  ) {
    setModalOpen(false);
  }
}

function showLoadConfirm(show) {
  const el = $('journalLoadConfirm');
  if (!el) return;
  if (show) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

function setModeUi(mode) {
  const recordTop = $('journalRecordTop');
  const libraryTop = $('journalLibraryTop');
  const titleFound = $('journalTitleFound');
  const titleRecorded = $('journalTitleRecorded');
  if (recordTop) recordTop.hidden = mode !== 'record';
  if (libraryTop) libraryTop.hidden = mode !== 'library';
  if (titleFound) titleFound.hidden = mode !== 'record';
  if (titleRecorded) titleRecorded.hidden = mode !== 'library';
  syncJournalOverlays();
}

function renderProgressBar(record) {
  const bar = $('journalProgressBar');
  const fill = $('journalProgressFill');
  const label = $('journalProgressLabel');
  if (!bar || !fill || !label || !record) return;
  const pct = Math.max(0, Math.min(100, record.progressPct || 0));
  fill.style.width = `${pct}%`;
  label.textContent = record.totalKnown > 0
    ? `${record.progressLabel} (${pct}%)`
    : record.progressLabel;
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
    if (entry.index != null && entry.index === state.selectedSolutionIndex) {
      btn.classList.add('tz-journal-list__row--active');
    }
    if (entry.levelId === state.levelId && mode === 'puzzles') {
      btn.classList.add('tz-journal-list__row--active');
    }

    const main = document.createElement('span');
    main.className = 'tz-journal-list__row-main';
    main.textContent = entry.label;

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
        void openJournal({ mode: 'record', levelId: entry.levelId });
      }
    });

    list.appendChild(btn);
  }

  listScroller?.sync?.();
}

async function renderSolutionPreview(record, entry) {
  const canvas = $('journalPreviewCanvas');
  const wrap = $('journalPreviewWrap');
  const app = getApp();
  if (!canvas || !wrap || !app?.renderSolutionPreview) return;

  if (!entry?.placements?.length) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('role', 'button');
  canvas.setAttribute('aria-label', 'Load this solution on the board');
  await app.renderSolutionPreview(canvas, entry.placements, {
    level: record?.level,
  });
}

async function selectSolution(entry) {
  const app = getApp();
  if (!app || !state.levelId) return;
  state.selectedSolutionIndex = entry.index;
  const record = await getJournalRecord(app, state.levelId);
  renderSolutionList(record?.entries || [], { mode: 'solutions' });
  await renderSolutionPreview(record, entry);
}

async function refreshRecordView() {
  const app = getApp();
  if (!app || !state.levelId) return;
  const record = await getJournalRecord(app, state.levelId);
  if (!record) return;

  renderRecordFields(record);
  const entries = record.entries || [];
  if (state.selectedSolutionIndex == null && entries.length) {
    state.selectedSolutionIndex = entries[0].index;
  }
  const selected = entries.find((e) => e.index === state.selectedSolutionIndex) || entries[0];
  renderSolutionList(entries, { mode: 'solutions' });
  await renderSolutionPreview(record, selected);
}

function renderLibrarySelectors(data) {
  const sizeWrap = $('journalSizeFilters');
  const typeWrap = $('journalTypeFilters');
  const statusWrap = $('journalStatusFilters');
  if (!sizeWrap || !typeWrap || !statusWrap) return;

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

  const statuses = [
    { key: 'all', label: 'All' },
    { key: 'started', label: 'Started' },
    { key: 'solved', label: 'Solved' },
    { key: 'complete', label: 'Complete' },
  ];
  statusWrap.replaceChildren();
  for (const s of statuses) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-journal-filter-btn';
    btn.classList.toggle('is-active', state.libraryFilters.status === s.key);
    btn.textContent = s.label;
    btn.addEventListener('click', () => {
      state.libraryFilters.status = s.key;
      void refreshLibraryView();
    });
    statusWrap.appendChild(btn);
  }
}

async function refreshLibraryView() {
  const app = getApp();
  if (!app) return;
  const data = await getJournalLibraryIndex(app, {
    boardSize: state.libraryFilters.boardSize || undefined,
    puzzleType: state.libraryFilters.puzzleType || undefined,
    status: state.libraryFilters.status === 'all' ? undefined : state.libraryFilters.status,
  });
  state.libraryPuzzles = data.puzzles || [];
  renderLibrarySelectors(data);
  renderSolutionList(
    state.libraryPuzzles.map((p) => ({ ...p, label: p.label })),
    { mode: 'puzzles' },
  );
  const previewWrap = $('journalPreviewWrap');
  if (previewWrap) previewWrap.hidden = true;
}

async function loadSelectedSolutionToBoard() {
  const app = getApp();
  if (!app || state.selectedSolutionIndex == null || !state.levelId) return;
  const record = await getJournalRecord(app, state.levelId);
  const entry = record?.entries?.find((e) => e.index === state.selectedSolutionIndex);
  if (!entry?.placements?.length) return;

  window.__discoveryRecord?.hide?.();
  const ok = await app.applyPlacementsToBoard(entry.placements, {
    message: `Loaded ${entry.label} onto the board (review only).`,
  });
  if (ok) {
    showLoadConfirm(false);
    closeJournal();
    menuApi?.closeAll?.();
  }
}

export async function openJournal({ mode = 'record', levelId } = {}) {
  const root = $('journalRoot');
  const app = getApp();
  if (!root || !app) return;

  await applyLayoutFromDisk();

  menuApi?.closeMenu?.();
  menuApi?.closePanel?.();
  const pinfo = $('puzzleInfoRoot');
  if (pinfo) pinfo.hidden = true;

  state.mode = mode;
  if (levelId) state.levelId = levelId;
  if (mode === 'record' && !state.levelId) {
    state.levelId = app.state?.currentLevel?.id || null;
  }

  state.selectedSolutionIndex = null;
  showLoadConfirm(false);
  setModeUi(mode);
  root.hidden = false;
  setModalOpen(true);

  const scroll = $('journalListScroll');
  if (scroll) scroll.scrollTop = 0;

  if (mode === 'library') {
    await refreshLibraryView();
  } else {
    await refreshRecordView();
  }

  listScroller?.sync?.();
}

export function initJournalUi({ getApp: getAppFn, menuApi: menu } = {}) {
  getApp = getAppFn || (() => null);
  menuApi = menu || null;

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

  $('journalPreviewCanvas')?.addEventListener('click', () => {
    if (state.mode !== 'record' || state.selectedSolutionIndex == null) return;
    showLoadConfirm(true);
  });
  $('journalPreviewCanvas')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    showLoadConfirm(true);
  });

  $('journalLoadCancel')?.addEventListener('click', () => showLoadConfirm(false));
  $('journalLoadConfirmBtn')?.addEventListener('click', () => {
    void loadSelectedSolutionToBoard();
  });

  $('journalShowPuzzlesBtn')?.addEventListener('click', () => {
    void refreshLibraryView();
  });

  const tabMap = {
    journalTabPuzzle: 'puzzle',
    journalTabStats: 'stats',
    journalTabFilter: 'filter',
    journalTabRecords: 'records',
  };
  for (const [id, tab] of Object.entries(tabMap)) {
    $(id)?.addEventListener('click', () => {
      state.activeTab = tab;
      syncJournalOverlays();
      if (tab === 'filter' && state.mode === 'record') {
        void openJournal({ mode: 'library' });
        return;
      }
      if (tab === 'puzzle' && state.mode === 'library') {
        void openJournal({
          mode: 'record',
          levelId: state.levelId || getApp()?.state?.currentLevel?.id,
        });
        return;
      }
      if (tab === 'stats' || tab === 'records') {
        console.info(`Journal tab "${tab}" — full screen content deferred to follow-up pass`);
      }
    });
  }

  $('journalBtnFilter')?.addEventListener('click', () => {
    void openJournal({ mode: 'library' });
  });

  $('journalBtnStats')?.addEventListener('click', () => {
    console.info('Journal bottom Stats — full screen content deferred to follow-up pass');
  });

  $('journalBtnPrev')?.addEventListener('click', () => {
    const list = state.mode === 'library' ? state.libraryPuzzles : [];
    if (!list.length || !state.levelId) return;
    const idx = list.findIndex((p) => p.levelId === state.levelId);
    const prev = idx > 0 ? list[idx - 1] : list[list.length - 1];
    if (prev) void openJournal({ mode: state.mode, levelId: prev.levelId });
  });

  $('journalBtnNext')?.addEventListener('click', () => {
    const list = state.mode === 'library' ? state.libraryPuzzles : [];
    if (!list.length || !state.levelId) return;
    const idx = list.findIndex((p) => p.levelId === state.levelId);
    const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : list[0];
    if (next) void openJournal({ mode: state.mode, levelId: next.levelId });
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
    void applyLayoutFromDisk();
  });

  return { openJournal, closeJournal };
}
