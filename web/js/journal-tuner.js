import {
  JOURNAL_ITEM_DEFS,
  JOURNAL_OVERLAY_DEFS,
  applyJournalLayout,
  applyJournalOverlays,
  buildJournalLayoutReport,
  clearJournalLayoutCache,
  clearJournalLayoutDraft,
  getJournalItemLayout,
  loadJournalLayout,
  mergeJournalLayout,
  stashJournalLayoutDraft,
} from './journal-layout.js';
import { initFancyScroller } from './fancy-scroller.js';

const POS_STEP = 0.4;
const SIZE_STEP = 0.4;
const NUDGE_STEP = 1;
const PCT_STEP = 0.5;
const SCALE_STEP = 0.02;
const DIALOG_ITEM = '__dialog__';

let workingLayout = mergeJournalLayout(null);
let currentItem = 'fieldPuzzleId';
let previewMode = 'record';
let previewTab = 'puzzle';
let hideMockLabels = false;
let dragState = null;
let listScroller = null;

const MOCK_SOLUTIONS = [
  { label: 'Solution #1', sub: 'Jun 1, 2026 · 4:32', active: false },
  { label: 'Solution #2', sub: 'Jun 3, 2026 · 3:18', active: true },
  { label: 'Solution #3', sub: 'Jun 7, 2026 · 5:01', active: false },
  { label: 'Solution #4', sub: '', active: false },
  { label: 'Solution #5', sub: '', active: false },
  { label: 'Solution #6', sub: '', active: false },
];

const MOCK_PUZZLES = [
  { label: '5×6-0A-AUA', sub: '0 / 12', state: 'unstarted', pct: 0 },
  { label: '5×6-1B-BVB', sub: '3 / 12', state: 'inProgress', pct: 25 },
  { label: '5×6-2C-CVC', sub: '12 / 12', state: 'complete', pct: 100 },
  { label: '6×6-0D-DWD', sub: '1 / 8', state: 'inProgress', pct: 12 },
  { label: '6×6-1E-EWE', sub: '8 / 8', state: 'complete', pct: 100 },
  { label: '6×6-2F-FXF', sub: '2 / 8', state: 'inProgress', pct: 25 },
];

const RECORD_ONLY_ITEMS = new Set([
  'fieldPuzzleId', 'fieldPuzzleType', 'fieldBoardSize', 'fieldTotalKnown',
  'fieldSolutionsFound', 'fieldFirstSolved', 'fieldLastPlayed', 'progressBar',
  'titleFoundSolutions', 'solutionPreview',
]);

const LIBRARY_ONLY_ITEMS = new Set([
  'selectorBoardSize', 'selectorPuzzleType', 'selectorStatus', 'titleRecordedPuzzles',
]);

function isItemVisibleInPreview(key) {
  if (RECORD_ONLY_ITEMS.has(key) && previewMode !== 'record') return false;
  if (LIBRARY_ONLY_ITEMS.has(key) && previewMode !== 'library') return false;
  return true;
}

function previewModeLabel(mode = previewMode) {
  return mode === 'record'
    ? 'Record — view puzzle & found solutions'
    : 'Library — puzzle selector & filters';
}

function syncPreviewModeUi() {
  const isRecord = previewMode === 'record';
  if (els.modeSelect) els.modeSelect.value = previewMode;

  const badge = document.getElementById('previewModeBadge');
  if (badge) {
    badge.textContent = `Tuning: ${previewModeLabel()}`;
    badge.classList.toggle('is-library', !isRecord);
  }
  const banner = document.getElementById('previewModeBanner');
  if (banner) {
    banner.textContent = previewModeLabel();
    banner.classList.toggle('is-library', !isRecord);
  }

  document.getElementById('modeRecordBtn')?.classList.toggle('is-active', isRecord);
  document.getElementById('modeLibraryBtn')?.classList.toggle('is-active', !isRecord);
}

function itemSupportsHeight(meta) {
  return meta && meta.kind !== 'label' && meta.kind !== 'scroller';
}

function updateKeysHelp() {
  const ul = document.getElementById('keysList');
  if (!ul) return;

  if (currentItem === DIALOG_ITEM) {
    ul.innerHTML = [
      '<li><strong>Dialog</strong> — shared by Record &amp; Library</li>',
      '<li>Alt+scroll — max width px · Alt+Shift+scroll — display pad px</li>',
      '<li>Scroll on preview only (click preview first)</li>',
    ].join('');
    return;
  }

  const meta = JOURNAL_ITEM_DEFS[currentItem];
  if (meta?.kind === 'scroller') {
    ul.innerHTML = [
      '<li><strong>List scroll bar</strong> — <em>one item</em>: the narrow PNG track + pin (no separate yellow box)</li>',
      '<li>Blue outline on other fields; scroll bar gets gold outline when selected</li>',
      '<li>Drag the bar to move · bottom handle or Ctrl+scroll — height · Alt — track width · Alt+Shift — pin size</li>',
      '<li>Scroll on preview: top/right% · Shift+scroll — right%</li>',
      '<li>Pin drag is disabled while tuning — scroll the list area on the left to preview scrolling</li>',
    ].join('');
    return;
  }

  const sizeLine = itemSupportsHeight(meta)
    ? '<li><strong>Size:</strong> Ctrl+scroll — width% · Alt+scroll — height%</li>'
    : '<li><strong>Size:</strong> Ctrl+scroll — width%</li>';

  ul.innerHTML = [
    '<li><strong>Position</strong> — click preview, then scroll (not the left field list)</li>',
    '<li>Scroll ↑↓ — nudge Y px · Shift+scroll — nudge X px</li>',
    '<li>Arrows — move X/Y% · Shift+↑↓ — nudge px · [ ] — width% · , . — height%</li>',
    sizeLine,
    '<li>Drag yellow box to move · drag right/bottom/corner handles to resize W, H, or both</li>',
  ].join('');
}

function ensureCurrentItemInMode() {
  if (currentItem === DIALOG_ITEM) return;
  if (isItemVisibleInPreview(currentItem)) return;
  if (previewMode === 'record') currentItem = 'fieldPuzzleId';
  else currentItem = 'selectorBoardSize';
}

const els = {};

function wireFieldGrid() {
  if (!els.fieldGrid) return;
  for (const btn of els.fieldGrid.querySelectorAll('.field-btn[data-item]')) {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    btn.addEventListener('click', () => {
      currentItem = btn.dataset.item;
      refresh();
      updateKeysHelp();
      els.mockStage?.focus({ preventScroll: true });
    });
  }
}

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

function patchItem(key, patch, { live = false } = {}) {
  workingLayout.items[key] = {
    ...(workingLayout.items[key] || {}),
    ...patch,
  };
  if (live) {
    applyJournalLayout(workingLayout, document.documentElement);
    els.readout.innerHTML = formatItemReadout(currentItem);
    const ov = document.querySelector(`.tuner-overlay[data-item="${key}"]`);
    if (ov) Object.assign(ov.style, overlayStyleForItem(key));
    refreshFieldGrid();
    stashJournalLayoutDraft(workingLayout);
    scheduleSave();
    return;
  }
  refresh();
}

function patchDialog(patch) {
  workingLayout.dialog = { ...workingLayout.dialog, ...patch };
  refresh();
}

function exportJson() {
  return JSON.stringify(workingLayout, null, 2);
}

let saveTimer = null;
let saveInFlight = false;
let saveQueued = false;

async function saveToFile({ quiet = false } = {}) {
  if (saveInFlight) { saveQueued = true; return false; }
  saveInFlight = true;
  try {
    const res = await fetch('/api/dev/save-journal-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: exportJson(),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 404 || res.status === 501) {
        throw new Error('Stale dev server — restart: python scripts/server.py');
      }
      throw new Error(errText || `HTTP ${res.status}`);
    }
    clearJournalLayoutCache();
    clearJournalLayoutDraft();
    localStorage.setItem('tilezilla:journal-layout-version', String(Date.now()));
    window.dispatchEvent(new CustomEvent('tilezilla:journal-layout-saved'));
    els.status.textContent = quiet
      ? 'Auto-saved to data/journal_layout.json'
      : 'Saved to data/journal_layout.json';
    return true;
  } catch (err) {
    els.status.textContent = `Save failed — ${err.message || err} · draft kept in browser`;
    return false;
  } finally {
    saveInFlight = false;
    if (saveQueued) { saveQueued = false; void saveToFile({ quiet: true }); }
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveToFile({ quiet: true }), 600);
}

function overlayStyleForItem(key) {
  const item = getJournalItemLayout(key, workingLayout);
  const meta = JOURNAL_ITEM_DEFS[key];
  if (meta?.kind === 'scroller') {
    return {
      right: `calc(${item.right ?? 2}% + ${item.nudgeX ?? 0}px)`,
      top: `calc(${item.top ?? 8}% + ${item.nudgeY ?? 0}px)`,
      width: `${Math.max(4, (item.trackScale ?? 1) * 5)}%`,
      height: `${item.height ?? 84}%`,
      left: 'auto',
    };
  }
  return {
    left: `calc(${item.x ?? 0}% + ${item.nudgeX ?? 0}px)`,
    top: `calc(${item.y ?? 0}% + ${item.nudgeY ?? 0}px)`,
    width: `${item.w ?? 10}%`,
    height: `${item.h ?? 5}%`,
  };
}

function renderOverlays() {
  const layer = document.getElementById('tunerOverlayLayer');
  if (!layer) return;
  layer.replaceChildren();
  for (const [key, def] of Object.entries(JOURNAL_ITEM_DEFS)) {
    if (!isItemVisibleInPreview(key)) continue;
    // Scroll bar is tuned on the real PNG element — no duplicate yellow overlay.
    if (def.kind === 'scroller') continue;
    const ov = document.createElement('div');
    ov.className = 'tuner-overlay';
    ov.dataset.item = key;
    ov.classList.toggle('is-active', key === currentItem);
    Object.assign(ov.style, overlayStyleForItem(key));

    const label = document.createElement('span');
    label.className = 'tuner-overlay__label';
    label.textContent = def.label;
    ov.appendChild(label);

    if (def.kind !== 'label') {
      const handleE = document.createElement('span');
      handleE.className = 'tuner-overlay__resize-e';
      handleE.dataset.resize = 'w';
      handleE.title = 'Drag to change width';
      ov.appendChild(handleE);

      const handleS = document.createElement('span');
      handleS.className = 'tuner-overlay__resize-s';
      handleS.dataset.resize = 'h';
      handleS.title = 'Drag to change height';
      ov.appendChild(handleS);

      const handleSE = document.createElement('span');
      handleSE.className = 'tuner-overlay__resize-se';
      handleSE.dataset.resize = 'wh';
      handleSE.title = 'Drag to change width and height';
      ov.appendChild(handleSE);
    }

    ov.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      currentItem = key;
      refreshFieldGrid();
      updateKeysHelp();
      const resizeMode = e.target?.dataset?.resize || null;
      onOverlayPointerDown(e, key, resizeMode);
    });
    layer.appendChild(ov);
  }
}

function onOverlayPointerDown(e, key, resizeMode = null) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const frame = document.getElementById('mockJournalFrame');
  const rect = frame.getBoundingClientRect();
  const item = getJournalItemLayout(key, workingLayout);

  dragState = {
    key,
    resizeMode,
    startX: e.clientX,
    startY: e.clientY,
    frameW: rect.width,
    frameH: rect.height,
    item: { ...item },
  };
  e.currentTarget.setPointerCapture(e.pointerId);
}

function onOverlayPointerMove(e) {
  if (!dragState) return;
  const { key, resizeMode, startX, startY, frameW, frameH, item } = dragState;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const meta = JOURNAL_ITEM_DEFS[key];

  if (meta?.kind === 'scroller') {
    if (resizeMode === 'h') {
      patchItem(key, {
        height: Math.round(Math.max(10, (item.height ?? 84) + (dy / frameH) * 100) * 10) / 10,
      }, { live: true });
    } else if (!resizeMode) {
      patchItem(key, {
        top: Math.round(Math.max(0, (item.top ?? 8) + (dy / frameH) * 100) * 10) / 10,
        right: Math.round(Math.max(0, (item.right ?? 2) - (dx / frameW) * 100) * 10) / 10,
      }, { live: true });
    }
    dragState.item = getJournalItemLayout(key, workingLayout);
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    return;
  }

  if (resizeMode === 'w' || resizeMode === 'wh') {
    patchItem(key, {
      w: Math.round(Math.max(2, (item.w ?? 10) + (dx / frameW) * 100) * 10) / 10,
    }, { live: true });
  }
  if (resizeMode === 'h' || resizeMode === 'wh') {
    patchItem(key, {
      h: Math.round(Math.max(2, (item.h ?? 5) + (dy / frameH) * 100) * 10) / 10,
    }, { live: true });
  }
  if (!resizeMode) {
    patchItem(key, {
      x: Math.round(((item.x ?? 0) + (dx / frameW) * 100) * 10) / 10,
      y: Math.round(((item.y ?? 0) + (dy / frameH) * 100) * 10) / 10,
    }, { live: true });
  }
  dragState.item = getJournalItemLayout(key, workingLayout);
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
}

function onOverlayPointerUp() {
  if (dragState) {
    dragState = null;
    renderOverlays();
  }
}

function renderMockList() {
  const list = document.getElementById('mockList');
  if (!list) return;
  list.replaceChildren();

  const rows = previewMode === 'record' ? MOCK_SOLUTIONS : MOCK_PUZZLES;
  for (const row of rows) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-journal-list__row';
    if (row.state) btn.classList.add(`tz-journal-list__row--${row.state}`);
    if (row.active) btn.classList.add('tz-journal-list__row--active');

    const main = document.createElement('span');
    main.className = 'tz-journal-list__row-main';
    main.textContent = row.label;
    btn.appendChild(main);

    if (row.sub) {
      const sub = document.createElement('span');
      sub.className = 'tz-journal-list__row-sub';
      sub.textContent = row.sub;
      btn.appendChild(sub);
    }

    if (row.pct != null && previewMode === 'library') {
      const bar = document.createElement('span');
      bar.className = 'tz-journal-list__row-bar';
      bar.style.setProperty('--tz-journal-row-pct', `${row.pct}%`);
      btn.appendChild(bar);
    }

    list.appendChild(btn);
  }

  listScroller?.sync?.();
}

function patchOverlay(key, src) {
  if (!workingLayout.overlays) workingLayout.overlays = {};
  workingLayout.overlays[key] = src;
  refresh();
}

function renderOverlayPathGrid() {
  const grid = document.getElementById('overlayPathGrid');
  if (!grid) return;
  grid.replaceChildren();
  for (const [key, def] of Object.entries(JOURNAL_OVERLAY_DEFS)) {
    if (def.isBase) continue;
    const row = document.createElement('div');
    row.className = 'overlay-path-row';
    const label = document.createElement('label');
    label.textContent = def.label.replace(/^Overlay — /, '');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '/img/YourOverlay.png';
    input.value = workingLayout.overlays?.[key] || '';
    input.dataset.overlayKey = key;
    input.addEventListener('change', () => patchOverlay(key, input.value.trim()));
    row.appendChild(label);
    row.appendChild(input);
    grid.appendChild(row);
  }
}

function syncPreviewOverlays() {
  const frame = document.getElementById('mockJournalFrame');
  if (!frame) return;
  applyJournalOverlays(workingLayout, frame, {
    mode: previewMode,
    activeTab: previewTab,
  });
}

function setPreviewMode(mode) {
  previewMode = mode;
  const isRecord = mode === 'record';

  document.getElementById('mockRecordTop').hidden = !isRecord;
  document.getElementById('mockLibraryTop').hidden = isRecord;
  document.getElementById('mockTitleFound').hidden = !isRecord;
  document.getElementById('mockTitleRecorded').hidden = isRecord;
  document.getElementById('mockPreviewWrap').hidden = !isRecord;

  if (mode === 'library') previewTab = 'filter';
  else if (previewTab === 'filter') previewTab = 'puzzle';

  syncPreviewModeUi();
  ensureCurrentItemInMode();
  syncTabToggleUi();
  renderMockList();
  syncPreviewOverlays();
  renderOverlays();
  refreshFieldGrid();
  els.readout.innerHTML = formatItemReadout(currentItem);
}

function setPreviewTab(tab) {
  previewTab = tab;
  if (tab === 'filter') setPreviewMode('library');
  else if (previewMode === 'library' && tab === 'puzzle') setPreviewMode('record');
  else {
    syncTabToggleUi();
    syncPreviewOverlays();
  }
}

function syncTabToggleUi() {
  document.querySelectorAll('#tabToggle .btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === previewTab);
  });
}

function applyArtOnlyPreview() {
  const artOnly = hideMockLabels;
  document.getElementById('mockJournalContent')?.classList.toggle('is-art-only', artOnly);
  document.getElementById('mockRecordTop')?.classList.toggle('is-art-only', artOnly);
}

function syncScrollerTuningUi() {
  const el = document.getElementById('mockListScroller');
  if (!el) return;
  el.classList.toggle('is-scroller-tuning', currentItem === 'listScroller');
}

function wireScrollerTuning() {
  const el = document.getElementById('mockListScroller');
  if (!el || el.dataset.scrollerTunerWired) return;
  el.dataset.scrollerTunerWired = '1';

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.tz-journal-list-scroller__pin')) return;

    if (currentItem !== 'listScroller') {
      currentItem = 'listScroller';
      refreshFieldGrid();
      updateKeysHelp();
    }

    e.preventDefault();
    e.stopPropagation();
    const resizeMode = e.target?.dataset?.resize || null;
    onOverlayPointerDown(e, 'listScroller', resizeMode);
  });
}

function wireTunerItemClicks() {
  document.querySelectorAll('[data-tuner-item]').forEach((node) => {
    node.addEventListener('click', (e) => {
      if (e.target.closest('.tuner-overlay')) return;
      const key = node.dataset.tunerItem;
      if (!JOURNAL_ITEM_DEFS[key]) return;
      currentItem = key;
      refresh();
    });
  });
}

function refreshFieldGrid() {
  for (const btn of els.fieldGrid.querySelectorAll('.field-btn')) {
    const key = btn.dataset.item;
    btn.classList.toggle('is-active', key === currentItem);
    const inMode = !key || key === DIALOG_ITEM || isItemVisibleInPreview(key);
    btn.classList.toggle('is-in-mode', inMode);
    btn.classList.toggle('is-hidden-mode', key && key !== DIALOG_ITEM && !inMode);
  }
  for (const sec of els.fieldGrid.querySelectorAll('.field-grid-section[data-mode]')) {
    const m = sec.dataset.mode;
    sec.classList.toggle('is-hidden-mode', m !== 'shared' && m !== previewMode);
  }
  document.querySelectorAll('[data-tuner-item]').forEach((node) => {
    node.classList.toggle('is-tuner-active', node.dataset.tunerItem === currentItem);
  });
  for (const ov of document.querySelectorAll('.tuner-overlay')) {
    ov.classList.toggle('is-active', ov.dataset.item === currentItem);
  }
  syncScrollerTuningUi();
}

function formatItemReadout(key) {
  const modeLine = `<br />Preview mode: <strong>${previewModeLabel()}</strong>`;
  const modeWarn = key && key !== DIALOG_ITEM && !isItemVisibleInPreview(key)
    ? '<br /><span style="color:#e8b923">Not visible in this preview — switch mode above</span>'
    : '';

  if (key === DIALOG_ITEM) {
    const d = workingLayout.dialog;
    return `<strong>Dialog</strong><br />maxDesignWidth ${d.maxDesignWidth ?? 390}px · displayPad ${d.displayPad ?? 16}px`
      + `${modeLine} · shared by Record &amp; Library`;
  }
  const item = getJournalItemLayout(key, workingLayout);
  const meta = JOURNAL_ITEM_DEFS[key];
  if (meta?.kind === 'scroller') {
    return `<strong>${meta.label}</strong><br />`
      + `right ${item.right}% · top ${item.top}% · height ${item.height}%<br />`
      + `trackScale ${item.trackScale} · pinScale ${item.pinScale}`
      + `<br /><em>One item — tune the PNG bar directly (gold outline). List area left is separate content scroll.</em>`
      + modeLine + modeWarn;
  }
  const parts = [`x:${item.x}%`, `y:${item.y}%`, `w:${item.w}%`];
  if (item.h != null) parts.push(`h:${item.h}%`);
  if (item.nudgeX) parts.push(`nudgeX:${item.nudgeX}px`);
  if (item.nudgeY) parts.push(`nudgeY:${item.nudgeY}px`);
  return `<strong>${meta?.label || key}</strong><br />${parts.join(' · ')}${modeLine}${modeWarn}`;
}

function refresh() {
  applyJournalLayout(workingLayout, document.documentElement);
  syncPreviewModeUi();
  els.readout.innerHTML = formatItemReadout(currentItem);
  els.jsonOut.value = exportJson();
  els.reportOut.value = buildJournalLayoutReport(workingLayout);
  stashJournalLayoutDraft(workingLayout);
  refreshFieldGrid();
  renderOverlays();
  renderOverlayPathGrid();
  syncPreviewOverlays();
  applyArtOnlyPreview();
  updateKeysHelp();
  listScroller?.sync?.();
  scheduleSave();
}

function tuningInputBlocked(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest('textarea, input, select, .overlay-path-grid');
}

function wheelShouldTune(e) {
  if (tuningInputBlocked(e.target)) return false;
  if (!e.target.closest('#mockStage')) return false;
  if (currentItem !== 'listScroller' && e.target.closest('.tz-journal-list-scroll')) return false;
  return true;
}

function onWheel(e) {
  if (!wheelShouldTune(e)) return;

  const dir = e.deltaY < 0 ? 1 : -1;
  const live = { live: true };

  if (currentItem === DIALOG_ITEM) {
    e.preventDefault();
    const d = workingLayout.dialog;
    if (e.altKey && e.shiftKey) {
      patchDialog({ displayPad: Math.max(0, (d.displayPad ?? 16) + dir * 2) });
      return;
    }
    if (e.altKey) {
      patchDialog({ maxDesignWidth: Math.max(280, (d.maxDesignWidth ?? 390) + dir * 4) });
    }
    return;
  }

  const item = getJournalItemLayout(currentItem, workingLayout);
  const meta = JOURNAL_ITEM_DEFS[currentItem];
  if (!meta) return;

  e.preventDefault();

  if (meta.kind === 'scroller') {
    if (e.ctrlKey && e.altKey && e.shiftKey) {
      patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) + dir * NUDGE_STEP }, live);
      return;
    }
    if (e.ctrlKey && e.altKey) {
      patchItem(currentItem, { nudgeX: (item.nudgeX ?? 0) + dir * NUDGE_STEP }, live);
      return;
    }
    if (e.altKey && e.shiftKey) {
      patchItem(currentItem, {
        pinScale: Math.round(Math.max(0.4, (item.pinScale ?? 1) + dir * SCALE_STEP) * 100) / 100,
      }, live);
      return;
    }
    if (e.altKey) {
      patchItem(currentItem, {
        trackScale: Math.round(Math.max(0.4, (item.trackScale ?? 1) + dir * SCALE_STEP) * 100) / 100,
      }, live);
      return;
    }
    if (e.ctrlKey) {
      patchItem(currentItem, {
        height: Math.round(Math.max(10, (item.height ?? 84) + dir * PCT_STEP) * 10) / 10,
      }, live);
      return;
    }
    if (e.shiftKey) {
      patchItem(currentItem, {
        right: Math.round(Math.max(0, (item.right ?? 2) + dir * PCT_STEP) * 10) / 10,
      }, live);
      return;
    }
    patchItem(currentItem, {
      top: Math.round(Math.max(0, (item.top ?? 8) + dir * PCT_STEP) * 10) / 10,
    }, live);
    return;
  }

  if (e.ctrlKey && !e.shiftKey) {
    patchItem(currentItem, {
      w: Math.round(Math.max(2, (item.w ?? 10) + dir * SIZE_STEP) * 10) / 10,
    }, live);
    return;
  }

  if (e.altKey && !e.shiftKey && itemSupportsHeight(meta)) {
    patchItem(currentItem, {
      h: Math.round(Math.max(2, (item.h ?? 5) + dir * SIZE_STEP) * 10) / 10,
    }, live);
    return;
  }

  // Scroll = pixel nudge (discovery tuner); arrows = position %
  if (e.shiftKey) {
    patchItem(currentItem, {
      nudgeX: (item.nudgeX ?? 0) + (e.deltaY < 0 ? NUDGE_STEP : -NUDGE_STEP),
    }, live);
    return;
  }

  patchItem(currentItem, {
    nudgeY: (item.nudgeY ?? 0) + (e.deltaY > 0 ? NUDGE_STEP : -NUDGE_STEP),
  }, live);
}

function onKeyDown(e) {
  if (tuningInputBlocked(e.target)) return;

  const live = { live: true };

  if (currentItem === DIALOG_ITEM) return;

  const item = getJournalItemLayout(currentItem, workingLayout);
  const meta = JOURNAL_ITEM_DEFS[currentItem];
  if (!meta) return;

  if (meta.kind === 'scroller') {
    if (e.key === 'ArrowLeft') {
      patchItem(currentItem, { right: Math.round(((item.right ?? 2) + POS_STEP) * 10) / 10 }, live);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      patchItem(currentItem, { right: Math.round(Math.max(0, (item.right ?? 2) - POS_STEP) * 10) / 10 }, live);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      patchItem(currentItem, {
        top: Math.round(Math.max(0, (item.top ?? 8) - (e.shiftKey ? 0 : POS_STEP)) * 10) / 10,
        ...(e.shiftKey ? { nudgeY: (item.nudgeY ?? 0) - NUDGE_STEP } : {}),
      }, live);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      patchItem(currentItem, {
        top: Math.round(((item.top ?? 8) + (e.shiftKey ? 0 : POS_STEP)) * 10) / 10,
        ...(e.shiftKey ? { nudgeY: (item.nudgeY ?? 0) + NUDGE_STEP } : {}),
      }, live);
      e.preventDefault();
    }
    return;
  }

  if (e.key === 'ArrowLeft') {
    patchItem(currentItem, { x: Math.round(((item.x ?? 0) - POS_STEP) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    patchItem(currentItem, { x: Math.round(((item.x ?? 0) + POS_STEP) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    if (e.shiftKey) patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) - NUDGE_STEP }, live);
    else patchItem(currentItem, { y: Math.round(((item.y ?? 0) - POS_STEP) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (e.shiftKey) patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) + NUDGE_STEP }, live);
    else patchItem(currentItem, { y: Math.round(((item.y ?? 0) + POS_STEP) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === '[') {
    patchItem(currentItem, { w: Math.round(Math.max(2, (item.w ?? 10) - SIZE_STEP) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === ']') {
    patchItem(currentItem, { w: Math.round(((item.w ?? 10) + SIZE_STEP) * 10) / 10 }, live);
    e.preventDefault();
  } else if (itemSupportsHeight(meta) && e.key === ',') {
    patchItem(currentItem, { h: Math.round(Math.max(2, (item.h ?? 5) - SIZE_STEP) * 10) / 10 }, live);
    e.preventDefault();
  } else if (itemSupportsHeight(meta) && e.key === '.') {
    patchItem(currentItem, { h: Math.round(((item.h ?? 5) + SIZE_STEP) * 10) / 10 }, live);
    e.preventDefault();
  }
}

async function init() {
  els.fieldGrid = document.getElementById('fieldGrid');
  els.readout = document.getElementById('readout');
  els.status = document.getElementById('status');
  els.jsonOut = document.getElementById('jsonOut');
  els.reportOut = document.getElementById('reportOut');
  els.mockStage = document.getElementById('mockStage');
  els.modeSelect = document.getElementById('modeSelect');

  if (!els.fieldGrid || !els.readout || !els.mockStage) {
    throw new Error('Tuner markup missing — hard refresh journal-tuner.html');
  }

  wireFieldGrid();

  els.modeSelect?.addEventListener('change', () => setPreviewMode(els.modeSelect.value));
  document.getElementById('modeRecordBtn')?.addEventListener('click', () => setPreviewMode('record'));
  document.getElementById('modeLibraryBtn')?.addEventListener('click', () => setPreviewMode('library'));
  document.querySelectorAll('#tabToggle .btn').forEach((btn) => {
    btn.addEventListener('click', () => setPreviewTab(btn.dataset.tab));
  });
  document.getElementById('hideMockLabelsChk')?.addEventListener('change', (e) => {
    hideMockLabels = e.target.checked;
    applyArtOnlyPreview();
  });

  wireTunerItemClicks();
  wireScrollerTuning();

  listScroller = initFancyScroller({
    scrollEl: document.getElementById('mockListScroll'),
    scrollerRoot: document.getElementById('mockListScroller'),
    trackEl: document.querySelector('#mockListScroller .tz-journal-list-scroller__track'),
    pinEl: document.querySelector('#mockListScroller .tz-journal-list-scroller__pin'),
  });

  document.addEventListener('keydown', onKeyDown, { capture: true });
  els.mockStage.addEventListener('wheel', onWheel, { passive: false });
  els.mockStage.addEventListener('click', () => els.mockStage.focus({ preventScroll: true }));
  document.getElementById('tunerOverlayLayer')?.addEventListener('pointermove', onOverlayPointerMove);
  document.getElementById('tunerOverlayLayer')?.addEventListener('pointerup', onOverlayPointerUp);
  document.getElementById('tunerOverlayLayer')?.addEventListener('pointercancel', onOverlayPointerUp);
  document.addEventListener('pointermove', onOverlayPointerMove);
  document.addEventListener('pointerup', onOverlayPointerUp);
  document.addEventListener('pointercancel', onOverlayPointerUp);

  els.jsonOut.addEventListener('change', () => {
    try {
      workingLayout = cloneLayout(mergeJournalLayout(JSON.parse(els.jsonOut.value)));
      refresh();
    } catch {
      els.status.textContent = 'Invalid JSON in editor';
    }
  });

  document.getElementById('reloadBtn')?.addEventListener('click', async () => {
    clearJournalLayoutCache();
    clearJournalLayoutDraft();
    workingLayout = cloneLayout(await loadJournalLayout({ force: true }));
    els.status.textContent = 'Reloaded from file';
    refresh();
  });

  document.getElementById('saveBtn')?.addEventListener('click', () => void saveToFile());
  document.getElementById('copyReportBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.reportOut.value);
      els.status.textContent = 'Report copied to clipboard';
    } catch {
      els.reportOut.select();
      els.status.textContent = 'Select report text and copy manually';
    }
  });

  try {
    workingLayout = cloneLayout(await loadJournalLayout());
  } catch {
    workingLayout = mergeJournalLayout(null);
  }
  setPreviewMode('record');
  refresh();
  els.mockStage.focus();
  if (els.status) els.status.textContent = 'Ready — select a layout item above';
}

init().catch((err) => {
  const status = document.getElementById('status');
  if (status) status.textContent = `Init failed — ${err?.message || err}`;
  console.error(err);
});
