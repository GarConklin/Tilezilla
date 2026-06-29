import {
  JOURNAL_ITEM_DEFS,
  JOURNAL_OVERLAY_DEFS,
  applyJournalLayoutEverywhere,
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

const POS_FINE = 0.2;
const POS_MED = 0.4;
const POS_LARGE = 1;
const SIZE_FINE = 0.2;
const SIZE_MED = 0.4;
const SIZE_LARGE = 1.5;
const NUDGE_FINE = 1;
const NUDGE_MED = 2;
const NUDGE_LARGE = 4;
const PCT_FINE = 0.25;
const PCT_MED = 0.5;
const PCT_LARGE = 1.5;
const SCALE_FINE = 0.02;
const SCALE_MED = 0.05;
const SCALE_LARGE = 0.12;
const DIALOG_FINE = 2;
const DIALOG_MED = 4;
const DIALOG_LARGE = 12;
const TRACK_BASE_PX = 22;

const EDIT_MODES = {
  move: {
    key: 'M',
    label: 'MOVE',
    hint: 'Wheel = Y% · Shift+wheel = X% · Arrows move · Shift+arrows nudge px · Drag to move',
  },
  width: {
    key: 'W',
    label: 'WIDTH',
    hint: 'Wheel = width% (fields) or trackScale (scroll bar; thin ≈ 0.15–0.25) · Drag right edge',
  },
  height: {
    key: 'H',
    label: 'HEIGHT',
    hint: 'Wheel = height% (fields + scroll bar track length) or trackScale (scroll bar width) · Drag bottom edge',
  },
  pin: {
    key: 'I',
    label: 'PIN',
    hint: 'Wheel = scroll pin size (scroll bar only) · Shift = fine step',
  },
  font: {
    key: 'F',
    label: 'FONT',
    hint: 'Wheel = value font scale (dd / title / list row) · Shift+wheel = label font scale (dt, text fields only)',
  },
  dialog: {
    key: 'P',
    label: 'DIALOG',
    hint: 'Wheel = max width px · Shift+wheel = display pad px · Select Dialog item or press P',
  },
};

const DIALOG_ITEM = '__dialog__';

let workingLayout = mergeJournalLayout(null);
let currentItem = 'fieldPuzzleId';
let previewMode = 'record';
let previewTab = 'puzzle';
let hideMockLabels = false;
let editMode = 'move';
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
  { label: '5×6-0A-AUA', detail: '· Adv 142', sub: '0 / 12', state: 'unstarted', pct: 0 },
  { label: '5×6-1B-BVB', detail: '· Adv 143', sub: '3 / 12', state: 'inProgress', pct: 25 },
  { label: '5×6-2C-CVC', detail: '· Jun 22, 2026', sub: '12 / 12', state: 'complete', pct: 100 },
  { label: '6×6-0D-DWD', detail: '· Adv 88', sub: '1 / 8', state: 'inProgress', pct: 12 },
  { label: '6×6-1E-EWE', detail: '· Jun 24, 2026', sub: '8 / 8', state: 'complete', pct: 100 },
  { label: '6×6-2F-FXF', detail: '· Adv 91', sub: '2 / 8', state: 'inProgress', pct: 25 },
];

const RECORD_ONLY_ITEMS = new Set([
  'fieldPuzzleId', 'fieldPuzzleType', 'fieldBoardSize', 'fieldTotalKnown',
  'fieldSolutionsFound', 'fieldFirstSolved', 'fieldLastPlayed', 'progressBar',
  'titleFoundSolutions', 'solutionPreview', 'btnBeginSearch', 'btnLibraryBack',
]);

const LIBRARY_ONLY_ITEMS = new Set([
  'selectorBoardSize', 'selectorPuzzleType', 'titleRecordedPuzzles',
  'listRowDetail',
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

function stepForEvent(e, fine, medium, large) {
  if (e.shiftKey) return fine;
  if (e.ctrlKey || e.metaKey) return large;
  return medium;
}

function wheelDir(e) {
  return e.deltaY < 0 ? 1 : -1;
}

function setEditMode(mode) {
  if (!EDIT_MODES[mode]) return;
  editMode = mode;
  if (els.modeBar) {
    els.mockStage?.setAttribute('data-edit-mode', mode);
    for (const btn of els.modeBar.querySelectorAll('.mode-btn')) {
      btn.classList.toggle('is-active', btn.dataset.mode === mode);
    }
  }
  if (els.modeBadge) {
    els.modeBadge.textContent = `[${EDIT_MODES[mode].label}]`;
    els.modeBadge.dataset.mode = mode;
  }
  if (els.modeHint) els.modeHint.textContent = EDIT_MODES[mode].hint;
  updateKeysHelp();
}

function tunerItemOrder() {
  const keys = [DIALOG_ITEM];
  for (const btn of els.fieldGrid?.querySelectorAll('.field-btn[data-item]') || []) {
    const key = btn.dataset.item;
    if (key && key !== DIALOG_ITEM) keys.push(key);
  }
  return keys;
}

function cycleItem(backward = false) {
  const items = tunerItemOrder().filter((key) => key === DIALOG_ITEM || isItemVisibleInPreview(key));
  const idx = items.indexOf(currentItem);
  const next = items[(idx + (backward ? -1 : 1) + items.length) % items.length];
  currentItem = next;
  if (next === DIALOG_ITEM) setEditMode('dialog');
  refresh();
  els.mockStage?.focus({ preventScroll: true });
}

function selectItem(key) {
  if (key === DIALOG_ITEM || JOURNAL_ITEM_DEFS[key]) {
    currentItem = key;
    refresh();
    els.mockStage?.focus({ preventScroll: true });
  }
}

function itemSupportsHeight(meta) {
  return meta && meta.kind !== 'label' && meta.kind !== 'scroller';
}

function itemSupportsFontTuning(meta) {
  return meta && (meta.kind === 'text' || meta.kind === 'titleBarChild' || meta.kind === 'list' || meta.kind === 'listPart');
}

function syncFontTuningPanel() {
  const panel = document.getElementById('fontTuningPanel');
  const meta = JOURNAL_ITEM_DEFS[currentItem];
  if (!panel) return;
  const show = itemSupportsFontTuning(meta);
  panel.hidden = !show;
  if (!show) return;

  const item = getJournalItemLayout(currentItem, workingLayout);
  const valueInput = document.getElementById('fontValueScaleInput');
  const labelInput = document.getElementById('fontLabelScaleInput');
  const labelWrap = document.getElementById('fontLabelScaleWrap');

  if (meta.kind === 'text') {
    if (labelWrap) labelWrap.hidden = false;
    if (valueInput && document.activeElement !== valueInput) {
      valueInput.value = String(item.valueFontScale ?? 1);
    }
    if (labelInput && document.activeElement !== labelInput) {
      labelInput.value = String(item.labelFontScale ?? 1);
    }
  } else {
    if (labelWrap) labelWrap.hidden = true;
    if (valueInput && document.activeElement !== valueInput) {
      valueInput.value = String(item.fontScale ?? 1);
    }
  }
}

function patchFontFromInputs() {
  const meta = JOURNAL_ITEM_DEFS[currentItem];
  if (!itemSupportsFontTuning(meta)) return;
  const valueInput = document.getElementById('fontValueScaleInput');
  const labelInput = document.getElementById('fontLabelScaleInput');
  const valueScale = Math.max(0.5, Math.min(2.5, parseFloat(valueInput?.value) || 1));
  if (meta.kind === 'text') {
    const labelScale = Math.max(0.5, Math.min(2.5, parseFloat(labelInput?.value) || 1));
    patchItem(currentItem, { valueFontScale: valueScale, labelFontScale: labelScale }, { live: true });
    return;
  }
  patchItem(currentItem, { fontScale: valueScale }, { live: true });
}

function updateKeysHelp() {
  const ul = document.getElementById('keysList');
  if (!ul) return;
  ul.innerHTML = [
    '<li><strong>M</strong> move · <strong>W</strong> width · <strong>H</strong> height · <strong>F</strong> font · <strong>I</strong> pin · <strong>P</strong> dialog · <strong>Esc</strong> → move</li>',
    '<li><strong>Tab</strong> cycle items · Click preview before wheel · Shift/Ctrl = fine/large step</li>',
    '<li><strong>F</strong> font — text fields: wheel = value (dd) · Shift+wheel = label (dt) · titles/list: wheel = font scale</li>',
    '<li>Or use the <strong>Font scale</strong> inputs below — saves to journal_layout.json (live game picks up on save / tab focus)</li>',
    '<li>Scroll bar: <strong>W</strong> = track width · <strong>H</strong> = track length (h%) · <strong>I</strong> = pin · <strong>M</strong> = move on art</li>',
    '<li>List content (puzzle rows): <strong>M</strong> = move in pane · <strong>W/H</strong> = box size · Shift+wheel = pixel nudge</li>',
    '<li>List rows (both modes): <strong>W</strong> = font · <strong>H</strong> = row padding · <strong>I</strong> = side padding · <strong>M</strong> + wheel = gap between rows</li>',
    '<li>Recorded puzzles Adv_ID / date: switch preview to <strong>Library</strong> · select <strong>List row — Adv_ID / release date</strong> · <strong>F</strong> = font scale</li>',
    '<li>List title bar + titles (Found Solutions / Recorded Puzzles): click text in preview — <strong>M/W/H</strong> move &amp; resize · <strong>F</strong> = font on titles</li>',
    '<li>Record top stats (Puzzle ID, etc.): yellow boxes + <strong>F</strong> for label (dt) and value (dd) font scales</li>',
    '<li>Solution preview: inside lower-right pane — <strong>M/W/H</strong> move and resize · solution centers in box</li>',
    '<li>Begin Search button: inside lower-right pane (no solutions yet) — <strong>M/W/H</strong> move and resize</li>',
  ].join('');
}

function ensureCurrentItemInMode() {
  if (currentItem === DIALOG_ITEM) return;
  if (isItemVisibleInPreview(currentItem)) return;
  if (previewMode === 'record') currentItem = 'fieldPuzzleId';
  else currentItem = 'paneBottomLeft';
}

function syncTunerMockVisibility() {
  const artTab = previewTab === 'stats' || previewTab === 'records';
  const tuningBeginSearch = currentItem === 'btnBeginSearch';
  const showPreview = !artTab && previewMode === 'record' && !tuningBeginSearch;
  document.getElementById('mockPreviewWrap')?.toggleAttribute('hidden', !showPreview);
  const showBeginSearch = !artTab && previewMode === 'record' && tuningBeginSearch;
  document.getElementById('mockBeginSearchBtn')?.toggleAttribute('hidden', !showBeginSearch);

  const showRecordTop = !artTab && (
    previewMode === 'record'
    || (currentItem !== DIALOG_ITEM && RECORD_ONLY_ITEMS.has(currentItem))
  );
  document.getElementById('mockRecordTop')?.toggleAttribute('hidden', !showRecordTop);

  const showLibraryTop = !artTab && (
    previewMode === 'library'
    || (currentItem !== DIALOG_ITEM && LIBRARY_ONLY_ITEMS.has(currentItem))
  );
  document.getElementById('mockLibraryTop')?.toggleAttribute('hidden', !showLibraryTop);

  document.getElementById('mockListTitleBar')?.toggleAttribute('hidden', artTab);

  for (const sel of ['.tz-journal-pane--top', '.tz-journal-pane--bl', '.tz-journal-pane--br']) {
    document.getElementById('mockJournalFrame')?.querySelector(sel)?.toggleAttribute('hidden', artTab);
  }

  document.getElementById('mockTitleFound')?.toggleAttribute(
    'hidden',
    artTab || (previewMode !== 'record' && currentItem !== 'titleFoundSolutions'),
  );
  document.getElementById('mockTitleRecorded')?.toggleAttribute(
    'hidden',
    artTab || (previewMode !== 'library' && currentItem !== 'titleRecordedPuzzles'),
  );
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
      if (currentItem === 'listScroller' && editMode === 'move') setEditMode('width');
      if (currentItem === 'solutionPreview' && editMode === 'dialog') setEditMode('move');
      if (currentItem === 'btnBeginSearch' && editMode === 'dialog') setEditMode('move');
      if (currentItem === 'listRow' && editMode === 'dialog') setEditMode('width');
      refresh();
      els.mockStage?.focus({ preventScroll: true });
    });
  }
}

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

function getTunerDragRect(key) {
  if (key === 'listScroller' || key === 'listContent' || key === 'listTitleBar') {
    const pane = document.querySelector('[data-tuner-item="paneBottomLeft"]');
    if (pane) return pane.getBoundingClientRect();
  }
  if (key === 'titleFoundSolutions' || key === 'titleRecordedPuzzles') {
    const titleBar = document.querySelector('[data-tuner-item="listTitleBar"]');
    if (titleBar) return titleBar.getBoundingClientRect();
  }
  if (key === 'solutionPreview' || key === 'btnBeginSearch') {
    const pane = document.querySelector('[data-tuner-item="paneBottomRight"]');
    if (pane) return pane.getBoundingClientRect();
  }
  const frame = document.getElementById('mockJournalFrame');
  return frame?.getBoundingClientRect() ?? { width: 1, height: 1 };
}

function patchItem(key, patch, { live = false } = {}) {
  workingLayout.items[key] = {
    ...(workingLayout.items[key] || {}),
    ...patch,
  };
  if (key === 'listScroller') {
    const normalized = getJournalItemLayout(key, workingLayout);
    workingLayout.items[key] = {
      space: 'pane',
      x: normalized.x,
      y: normalized.y,
      h: normalized.h,
      trackScale: normalized.trackScale,
      pinScale: normalized.pinScale,
      nudgeX: normalized.nudgeX ?? 0,
      nudgeY: normalized.nudgeY ?? 0,
    };
  }
  if (key === 'listContent') {
    const normalized = getJournalItemLayout(key, workingLayout);
    workingLayout.items[key] = {
      space: 'pane',
      x: normalized.x,
      y: normalized.y,
      w: normalized.w,
      h: normalized.h,
      nudgeX: normalized.nudgeX ?? 0,
      nudgeY: normalized.nudgeY ?? 0,
    };
  }
  if (key === 'listTitleBar') {
    const normalized = getJournalItemLayout(key, workingLayout);
    workingLayout.items[key] = {
      space: 'pane',
      x: normalized.x,
      y: normalized.y,
      w: normalized.w,
      h: normalized.h,
      nudgeX: normalized.nudgeX ?? 0,
      nudgeY: normalized.nudgeY ?? 0,
    };
  }
  if (key === 'titleFoundSolutions' || key === 'titleRecordedPuzzles') {
    const normalized = getJournalItemLayout(key, workingLayout);
    workingLayout.items[key] = {
      space: 'titleBar',
      x: normalized.x,
      y: normalized.y,
      w: normalized.w,
      h: normalized.h,
      nudgeX: normalized.nudgeX ?? 0,
      nudgeY: normalized.nudgeY ?? 0,
      fontScale: normalized.fontScale ?? 1,
    };
  }
  if (key === 'solutionPreview' || key === 'btnBeginSearch') {
    const normalized = getJournalItemLayout(key, workingLayout);
    workingLayout.items[key] = {
      space: 'pane',
      x: normalized.x,
      y: normalized.y,
      w: normalized.w,
      h: normalized.h,
      nudgeX: normalized.nudgeX ?? 0,
      nudgeY: normalized.nudgeY ?? 0,
    };
  }
  if (live) {
    applyJournalLayoutEverywhere(workingLayout);
    syncFontTuningPanel();
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
    workingLayout = cloneLayout(await loadJournalLayout({ force: true }));
    applyJournalLayoutEverywhere(workingLayout);
    syncPreviewModeUi();
    els.jsonOut.value = exportJson();
    els.reportOut.value = buildJournalLayoutReport(workingLayout);
    els.status.textContent = quiet
      ? 'Auto-saved to data/journal_layout.json — hard-refresh the game to pick up changes'
      : 'Saved to data/journal_layout.json — hard-refresh the game (Ctrl+Shift+R)';
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
    // Scroll bar, list/title areas, preview, and list rows tune the real element — no duplicate yellow overlay.
    if (def.kind === 'scroller' || def.kind === 'listArea' || def.kind === 'titleBarChild' || def.kind === 'preview' || def.kind === 'paneBtn' || def.kind === 'list') continue;
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

  const rect = getTunerDragRect(key);
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
    if (resizeMode === 'w' || resizeMode === 'wh') {
      const scale = item.trackScale ?? 1;
      const newScale = Math.max(0.04, scale + dx / TRACK_BASE_PX);
      patchItem(key, { trackScale: Math.round(newScale * 100) / 100 }, { live: true });
    }
    if (resizeMode === 'h' || resizeMode === 'wh') {
      patchItem(key, {
        h: Math.round(Math.max(2, (item.h ?? 30) + (dy / frameH) * 100) * 10) / 10,
      }, { live: true });
    } else if (!resizeMode) {
      patchItem(key, {
        x: Math.round(((item.x ?? 0) + (dx / frameW) * 100) * 10) / 10,
        y: Math.round(((item.y ?? 0) + (dy / frameH) * 100) * 10) / 10,
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
    if (previewMode === 'library') {
      const idSpan = document.createElement('span');
      idSpan.className = 'tz-journal-list__row-id';
      idSpan.textContent = row.label;
      main.appendChild(idSpan);
      if (row.detail) {
        const detail = document.createElement('span');
        detail.className = 'tz-journal-list__row-detail';
        detail.textContent = row.detail;
        main.appendChild(detail);
      }
    } else {
      main.textContent = row.label;
    }
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

  if (mode === 'library') previewTab = 'filter';
  else if (previewTab === 'filter') previewTab = 'puzzle';

  document.getElementById('mockJournalRoot')?.setAttribute('data-journal-mode', previewMode);

  syncPreviewModeUi();
  ensureCurrentItemInMode();
  syncTabToggleUi();
  renderMockList();
  syncPreviewOverlays();
  syncTunerMockVisibility();
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
    syncTunerMockVisibility();
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

function syncListContentTuningUi() {
  const el = document.getElementById('mockListScroll');
  if (!el) return;
  el.classList.toggle('is-list-content-tuning', currentItem === 'listContent');
}

function syncScrollerTuningUi() {
  const el = document.getElementById('mockListScroller');
  if (!el) return;
  el.classList.toggle('is-scroller-tuning', currentItem === 'listScroller');
}

function syncBeginSearchTuningUi() {
  const el = document.getElementById('mockBeginSearchBtn');
  if (!el) return;
  el.classList.toggle('is-begin-search-tuning', currentItem === 'btnBeginSearch');
}

function syncPreviewTuningUi() {
  const el = document.getElementById('mockPreviewWrap');
  if (!el) return;
  el.classList.toggle('is-preview-tuning', currentItem === 'solutionPreview');
}

function syncListRowPartTuningUi() {
  const el = document.getElementById('mockList');
  if (!el) return;
  el.classList.toggle('is-list-row-tuning', currentItem === 'listRow');
  el.classList.toggle('is-list-row-main-tuning', currentItem === 'listRowMain');
  el.classList.toggle('is-list-row-detail-tuning', currentItem === 'listRowDetail');
  el.classList.toggle('is-list-row-sub-tuning', currentItem === 'listRowSub');
}

function syncTitleBarTuningUi() {
  document.getElementById('mockListTitleBar')?.classList.toggle(
    'is-title-bar-tuning',
    currentItem === 'listTitleBar',
  );
  document.getElementById('mockTitleFound')?.classList.toggle(
    'is-title-child-tuning',
    currentItem === 'titleFoundSolutions',
  );
  document.getElementById('mockTitleRecorded')?.classList.toggle(
    'is-title-child-tuning',
    currentItem === 'titleRecordedPuzzles',
  );
}

function wireListContentTuning() {
  const el = document.getElementById('mockListScroll');
  if (!el || el.dataset.listContentTunerWired) return;
  el.dataset.listContentTunerWired = '1';

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.tz-journal-list__row')) return;

    if (currentItem !== 'listContent') {
      currentItem = 'listContent';
      if (editMode === 'dialog') setEditMode('move');
      refreshFieldGrid();
      updateKeysHelp();
    }

    e.preventDefault();
    e.stopPropagation();
    const resizeMode = e.target?.dataset?.resize || null;
    onOverlayPointerDown(e, 'listContent', resizeMode);
  });
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
      if (editMode === 'move') setEditMode('width');
      refreshFieldGrid();
      updateKeysHelp();
    }

    e.preventDefault();
    e.stopPropagation();
    const resizeMode = e.target?.dataset?.resize || null;
    onOverlayPointerDown(e, 'listScroller', resizeMode);
  });
}

function wireTitleBarTuning() {
  const wire = (el, key) => {
    if (!el || el.dataset.titleBarTunerWired) return;
    el.dataset.titleBarTunerWired = '1';
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (currentItem !== key) {
        currentItem = key;
        if (editMode === 'dialog') setEditMode('move');
        refreshFieldGrid();
        updateKeysHelp();
      }
      e.preventDefault();
      e.stopPropagation();
      const resizeMode = e.target?.dataset?.resize || null;
      onOverlayPointerDown(e, key, resizeMode);
    });
  };
  wire(document.getElementById('mockListTitleBar'), 'listTitleBar');
  wire(document.getElementById('mockTitleFound'), 'titleFoundSolutions');
  wire(document.getElementById('mockTitleRecorded'), 'titleRecordedPuzzles');
}

function wireBeginSearchTuning() {
  const el = document.getElementById('mockBeginSearchBtn');
  if (!el || el.dataset.beginSearchTunerWired) return;
  el.dataset.beginSearchTunerWired = '1';

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    if (currentItem !== 'btnBeginSearch') {
      currentItem = 'btnBeginSearch';
      if (editMode === 'dialog') setEditMode('move');
      syncTunerMockVisibility();
      refreshFieldGrid();
      updateKeysHelp();
    }

    e.preventDefault();
    e.stopPropagation();
    const resizeMode = e.target?.dataset?.resize || null;
    onOverlayPointerDown(e, 'btnBeginSearch', resizeMode);
  });
}

function wirePreviewTuning() {
  const el = document.getElementById('mockPreviewWrap');
  if (!el || el.dataset.previewTunerWired) return;
  el.dataset.previewTunerWired = '1';

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    if (currentItem !== 'solutionPreview') {
      currentItem = 'solutionPreview';
      if (editMode === 'dialog') setEditMode('move');
      syncTunerMockVisibility();
      refreshFieldGrid();
      updateKeysHelp();
    }

    e.preventDefault();
    e.stopPropagation();
    const resizeMode = e.target?.dataset?.resize || null;
    onOverlayPointerDown(e, 'solutionPreview', resizeMode);
  });
}

function wireTunerItemClicks() {
  document.querySelectorAll('[data-tuner-item]').forEach((node) => {
    node.addEventListener('click', (e) => {
      if (e.target.closest('.tuner-overlay')) return;
      const key = node.dataset.tunerItem;
      if (!JOURNAL_ITEM_DEFS[key]) return;
      currentItem = key;
      if (key === 'listScroller' && editMode === 'move') setEditMode('width');
      if (key === 'solutionPreview' && editMode === 'dialog') setEditMode('move');
      if (key === 'btnBeginSearch' && editMode === 'dialog') setEditMode('move');
      if (key === 'listRow' && editMode === 'dialog') setEditMode('width');
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
  syncListContentTuningUi();
  syncPreviewTuningUi();
  syncBeginSearchTuningUi();
  syncListRowPartTuningUi();
  syncTitleBarTuningUi();
}

function formatItemReadout(key) {
  const modeLine = `<br />Preview mode: <strong>${previewModeLabel()}</strong>`;
  const modeWarn = key && key !== DIALOG_ITEM && !isItemVisibleInPreview(key)
    ? '<br /><span style="color:#e8b923">Not visible in this preview — switch mode above</span>'
    : '';

  if (key === DIALOG_ITEM) {
    const d = workingLayout.dialog;
    return `<strong>Dialog</strong><br />maxDesignWidth ${d.maxDesignWidth ?? 390}px · displayPad ${d.displayPad ?? 16}px`
      + ` · topNudge ${d.topNudge ?? 0}px (aligns with main board)`
      + `<br /><em>Wheel = width · Shift+wheel = pad · Alt+wheel = top nudge</em>`
      + `${modeLine} · shared by Record &amp; Library`;
  }
  const item = getJournalItemLayout(key, workingLayout);
  const meta = JOURNAL_ITEM_DEFS[key];
  if (meta?.kind === 'listArea' || meta?.kind === 'preview' || meta?.kind === 'paneBtn') {
    return `<strong>${meta.label}</strong><br />`
      + `pane x ${item.x}% · y ${item.y}% · w ${item.w}% · h ${item.h}%`
      + (item.nudgeX ? ` · nudgeX ${item.nudgeX}px` : '')
      + (item.nudgeY ? ` · nudgeY ${item.nudgeY}px` : '')
      + `<br /><em>M = move left/right/up/down · W = width · H = height · Shift+wheel = pixel nudge</em>`
      + modeLine + modeWarn;
  }
  if (meta?.kind === 'scroller') {
    return `<strong>${meta.label}</strong><br />`
      + `pane x ${item.x}% · y ${item.y}% · h ${item.h}% (track length)<br />`
      + `trackScale ${item.trackScale} (≈${Math.round(TRACK_BASE_PX * (item.trackScale ?? 1))}px wide)`
      + ` · pinScale ${item.pinScale}`
      + `<br /><em>W = track width · thin pencil line ≈ 0.15–0.25 · H = length% · I = pin · M = move on journal art</em>`
      + modeLine + modeWarn;
  }
  if (meta?.kind === 'list') {
    return `<strong>${meta.label}</strong><br />`
      + `fontScale ${item.fontScale ?? 1} · pad ${item.padY ?? 6}px×${item.padX ?? 8}px · gap ${item.gap ?? 4}px`
      + `<br /><em>F = font scale · W = font (legacy) · H = vertical pad · I = side pad · M + wheel = gap</em>`
      + modeLine + modeWarn;
  }
  if (meta?.kind === 'listPart') {
    return `<strong>${meta.label}</strong><br />`
      + `fontScale ${item.fontScale ?? 1}`
      + `<br /><em>F = font scale · W = font (legacy) · wheel adjusts this part only</em>`
      + modeLine + modeWarn;
  }
  if (meta?.kind === 'text') {
    const parts = [`x:${item.x}%`, `y:${item.y}%`, `w:${item.w}%`];
    if (item.h != null) parts.push(`h:${item.h}%`);
    if (item.nudgeX) parts.push(`nudgeX:${item.nudgeX}px`);
    if (item.nudgeY) parts.push(`nudgeY:${item.nudgeY}px`);
    parts.push(`labelFontScale:${item.labelFontScale ?? 1}`);
    parts.push(`valueFontScale:${item.valueFontScale ?? 1}`);
    return `<strong>${meta.label}</strong><br />${parts.join(' · ')}`
      + `<br /><em>F = font — wheel value (dd) · Shift+wheel label (dt) · M/W/H = position &amp; box</em>`
      + modeLine + modeWarn;
  }
  if (meta?.kind === 'titleBarChild') {
    const parts = [`x:${item.x}%`, `y:${item.y}%`, `w:${item.w}%`, `h:${item.h}%`];
    if (item.nudgeX) parts.push(`nudgeX:${item.nudgeX}px`);
    if (item.nudgeY) parts.push(`nudgeY:${item.nudgeY}px`);
    parts.push(`fontScale:${item.fontScale ?? 1}`);
    return `<strong>${meta.label}</strong><br />${parts.join(' · ')}`
      + `<br /><em>F = font scale · M/W/H = position &amp; box</em>`
      + modeLine + modeWarn;
  }
  const parts = [`x:${item.x}%`, `y:${item.y}%`, `w:${item.w}%`];
  if (item.h != null) parts.push(`h:${item.h}%`);
  if (item.nudgeX) parts.push(`nudgeX:${item.nudgeX}px`);
  if (item.nudgeY) parts.push(`nudgeY:${item.nudgeY}px`);
  return `<strong>${meta?.label || key}</strong><br />${parts.join(' · ')}${modeLine}${modeWarn}`;
}

function refresh() {
  applyJournalLayoutEverywhere(workingLayout);
  syncPreviewModeUi();
  syncTunerMockVisibility();
  syncFontTuningPanel();
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
  if (currentItem === 'listScroller' || currentItem === 'listContent' || currentItem === 'listRow') return true;
  if (JOURNAL_ITEM_DEFS[currentItem]?.kind === 'listPart') return true;
  if (e.target.closest('.tz-journal-list-scroll')) return false;
  return true;
}

function onWheel(e) {
  if (!wheelShouldTune(e)) return;
  e.preventDefault();
  e.stopPropagation();

  const dir = wheelDir(e);
  const live = { live: true };

  if (editMode === 'dialog' || currentItem === DIALOG_ITEM) {
    const d = workingLayout.dialog;
    const step = stepForEvent(e, DIALOG_FINE, DIALOG_MED, DIALOG_LARGE);
    if (e.altKey) {
      patchDialog({ topNudge: Math.round((d.topNudge ?? 0) + dir * step) });
      return;
    }
    if (e.shiftKey) {
      patchDialog({ displayPad: Math.max(0, (d.displayPad ?? 16) + dir * step) });
      return;
    }
    patchDialog({ maxDesignWidth: Math.max(280, (d.maxDesignWidth ?? 390) + dir * step) });
    return;
  }

  const meta = JOURNAL_ITEM_DEFS[currentItem];
  if (!meta) return;

  const item = getJournalItemLayout(currentItem, workingLayout);

  if (editMode === 'font') {
    const step = stepForEvent(e, SCALE_FINE, SCALE_MED, SCALE_LARGE);
    if (meta.kind === 'text') {
      if (e.shiftKey) {
        patchItem(currentItem, {
          labelFontScale: Math.round(Math.max(0.5, (item.labelFontScale ?? 1) + dir * step) * 100) / 100,
        }, live);
      } else {
        patchItem(currentItem, {
          valueFontScale: Math.round(Math.max(0.5, (item.valueFontScale ?? 1) + dir * step) * 100) / 100,
        }, live);
      }
      return;
    }
    if (meta.kind === 'titleBarChild' || meta.kind === 'list' || meta.kind === 'listPart') {
      patchItem(currentItem, {
        fontScale: Math.round(Math.max(0.5, (item.fontScale ?? 1) + dir * step) * 100) / 100,
      }, live);
    }
    return;
  }

  if (meta.kind === 'listPart') {
    if (editMode === 'font' || editMode === 'width') {
      const step = stepForEvent(e, SCALE_FINE, SCALE_MED, SCALE_LARGE);
      patchItem(currentItem, {
        fontScale: Math.round(Math.max(0.5, (item.fontScale ?? 1) + dir * step) * 100) / 100,
      }, live);
    }
    return;
  }

  if (meta.kind === 'list') {
    if (editMode === 'width') {
      const step = stepForEvent(e, SCALE_FINE, SCALE_MED, SCALE_LARGE);
      patchItem(currentItem, {
        fontScale: Math.round(Math.max(0.5, (item.fontScale ?? 1) + dir * step) * 100) / 100,
      }, live);
      return;
    }
    if (editMode === 'height') {
      const step = stepForEvent(e, NUDGE_FINE, NUDGE_MED, NUDGE_LARGE);
      patchItem(currentItem, {
        padY: Math.max(1, Math.round((item.padY ?? 6) + dir * step)),
      }, live);
      return;
    }
    if (editMode === 'pin') {
      const step = stepForEvent(e, NUDGE_FINE, NUDGE_MED, NUDGE_LARGE);
      patchItem(currentItem, {
        padX: Math.max(1, Math.round((item.padX ?? 8) + dir * step)),
      }, live);
      return;
    }
    /* MOVE — row gap */
    const step = stepForEvent(e, NUDGE_FINE, NUDGE_MED, NUDGE_LARGE);
    patchItem(currentItem, {
      gap: Math.max(0, Math.round((item.gap ?? 4) + dir * step)),
    }, live);
    return;
  }

  if (meta.kind === 'scroller') {
    if (editMode === 'width') {
      const step = stepForEvent(e, SCALE_FINE, SCALE_MED, SCALE_LARGE);
      patchItem(currentItem, {
        trackScale: Math.round(Math.max(0.04, (item.trackScale ?? 1) + dir * step) * 100) / 100,
      }, live);
      return;
    }
    if (editMode === 'height') {
      const step = stepForEvent(e, PCT_FINE, PCT_MED, PCT_LARGE);
      patchItem(currentItem, {
        h: Math.round(Math.max(2, (item.h ?? 30) + dir * step) * 10) / 10,
      }, live);
      return;
    }
    if (editMode === 'pin') {
      const step = stepForEvent(e, SCALE_FINE, SCALE_MED, SCALE_LARGE);
      patchItem(currentItem, {
        pinScale: Math.round(Math.max(0.15, (item.pinScale ?? 1) + dir * step) * 100) / 100,
      }, live);
      return;
    }
    /* MOVE */
    const posStep = stepForEvent(e, PCT_FINE, PCT_MED, PCT_LARGE);
    if (e.shiftKey) {
      patchItem(currentItem, {
        x: Math.round(((item.x ?? 0) + dir * posStep) * 10) / 10,
      }, live);
      return;
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      patchItem(currentItem, {
        x: Math.round(((item.x ?? 0) + (e.deltaX > 0 ? posStep : -posStep)) * 10) / 10,
      }, live);
      return;
    }
    patchItem(currentItem, {
      y: Math.round(((item.y ?? 0) + dir * posStep) * 10) / 10,
    }, live);
    return;
  }

  if (editMode === 'width') {
    const step = stepForEvent(e, SIZE_FINE, SIZE_MED, SIZE_LARGE);
    patchItem(currentItem, {
      w: Math.round(Math.max(2, (item.w ?? 10) + dir * step) * 10) / 10,
    }, live);
    return;
  }

  if (editMode === 'height' && itemSupportsHeight(meta)) {
    const step = stepForEvent(e, SIZE_FINE, SIZE_MED, SIZE_LARGE);
    patchItem(currentItem, {
      h: Math.round(Math.max(2, (item.h ?? 5) + dir * step) * 10) / 10,
    }, live);
    return;
  }

  if (editMode === 'pin') return;

  /* MOVE */
  const posStep = stepForEvent(e, POS_FINE, POS_MED, POS_LARGE);
  const nudgeStep = stepForEvent(e, NUDGE_FINE, NUDGE_MED, NUDGE_LARGE);
  if (meta.kind === 'titleBarChild' && e.shiftKey) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      patchItem(currentItem, { nudgeX: (item.nudgeX ?? 0) + (e.deltaX > 0 ? nudgeStep : -nudgeStep) }, live);
    } else {
      patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) - dir * nudgeStep }, live);
    }
    return;
  }
  if (e.shiftKey) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      patchItem(currentItem, { nudgeX: (item.nudgeX ?? 0) + (e.deltaX > 0 ? nudgeStep : -nudgeStep) }, live);
    } else {
      patchItem(currentItem, {
        x: Math.round(((item.x ?? 0) + dir * posStep) * 10) / 10,
      }, live);
    }
    return;
  }
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    patchItem(currentItem, {
      x: Math.round(((item.x ?? 0) + (e.deltaX > 0 ? posStep : -posStep)) * 10) / 10,
    }, live);
    return;
  }
  patchItem(currentItem, {
    y: Math.round(((item.y ?? 0) + dir * posStep) * 10) / 10,
  }, live);
}

function onKeyDown(e) {
  if (tuningInputBlocked(e.target)) return;

  const modeKey = e.key.toLowerCase();
  if (modeKey === 'm') { setEditMode('move'); e.preventDefault(); return; }
  if (modeKey === 'w') { setEditMode('width'); e.preventDefault(); return; }
  if (modeKey === 'h') { setEditMode('height'); e.preventDefault(); return; }
  if (modeKey === 'i') { setEditMode('pin'); e.preventDefault(); return; }
  if (modeKey === 'f') { setEditMode('font'); e.preventDefault(); return; }
  if (modeKey === 'p') { setEditMode('dialog'); currentItem = DIALOG_ITEM; refresh(); e.preventDefault(); return; }
  if (e.key === 'Escape') { setEditMode('move'); e.preventDefault(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    cycleItem(e.shiftKey);
    return;
  }

  if (editMode !== 'move') return;

  const live = { live: true };
  if (currentItem === DIALOG_ITEM) return;

  const item = getJournalItemLayout(currentItem, workingLayout);
  const meta = JOURNAL_ITEM_DEFS[currentItem];
  if (!meta) return;

  const posStep = stepForEvent(e, POS_FINE, POS_MED, POS_LARGE);
  const nudgeStep = stepForEvent(e, NUDGE_FINE, NUDGE_MED, NUDGE_LARGE);

  if (meta.kind === 'scroller') {
    if (e.key === 'ArrowLeft') {
      patchItem(currentItem, { right: Math.round(((item.right ?? 2) + posStep) * 10) / 10 }, live);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      patchItem(currentItem, { right: Math.round(Math.max(0, (item.right ?? 2) - posStep) * 10) / 10 }, live);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.shiftKey) patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) - nudgeStep }, live);
      else patchItem(currentItem, { top: Math.round(Math.max(0, (item.top ?? 8) - posStep) * 10) / 10 }, live);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.shiftKey) patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) + nudgeStep }, live);
      else patchItem(currentItem, { top: Math.round(((item.top ?? 8) + posStep) * 10) / 10 }, live);
    }
    return;
  }

  if (e.key === 'ArrowLeft') {
    patchItem(currentItem, { x: Math.round(((item.x ?? 0) - posStep) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    patchItem(currentItem, { x: Math.round(((item.x ?? 0) + posStep) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    if (e.shiftKey) patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) - nudgeStep }, live);
    else patchItem(currentItem, { y: Math.round(((item.y ?? 0) - posStep) * 10) / 10 }, live);
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (e.shiftKey) patchItem(currentItem, { nudgeY: (item.nudgeY ?? 0) + nudgeStep }, live);
    else patchItem(currentItem, { y: Math.round(((item.y ?? 0) + posStep) * 10) / 10 }, live);
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
  els.modeBar = document.getElementById('modeBar');
  els.modeBadge = document.getElementById('modeBadge');
  els.modeHint = document.getElementById('modeHint');

  for (const [mode] of Object.entries(EDIT_MODES)) {
    els.modeBar?.querySelector(`.mode-btn[data-mode="${mode}"]`)?.addEventListener('click', () => {
      setEditMode(mode);
      if (mode === 'dialog') currentItem = DIALOG_ITEM;
      refresh();
      els.mockStage?.focus({ preventScroll: true });
    });
  }

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
  document.getElementById('fontValueScaleInput')?.addEventListener('change', patchFontFromInputs);
  document.getElementById('fontLabelScaleInput')?.addEventListener('change', patchFontFromInputs);

  wireTunerItemClicks();
  wireListContentTuning();
  wireScrollerTuning();
  wireTitleBarTuning();
  wirePreviewTuning();
  wireBeginSearchTuning();

  listScroller = initFancyScroller({
    scrollEl: document.getElementById('mockListScroll'),
    scrollerRoot: document.getElementById('mockListScroller'),
    trackEl: document.querySelector('#mockListScroller .tz-journal-list-scroller__track'),
    pinEl: document.querySelector('#mockListScroller .tz-journal-list-scroller__pin'),
  });

  document.addEventListener('keydown', onKeyDown, { capture: true });
  els.mockStage.addEventListener('wheel', onWheel, { passive: false, capture: true });
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
  setEditMode('move');
  updateKeysHelp();
  refresh();
  els.mockStage.focus();
  if (els.status) {
    const resumedDraft = localStorage.getItem('tilezilla:layouts:journal:pending') === '1';
    els.status.textContent = resumedDraft
      ? 'Resumed browser draft — use Reload from file to match game, or Save now after edits'
      : 'Ready — Record mode matches game layout in data/journal_layout.json';
  }
}

init().catch((err) => {
  const status = document.getElementById('status');
  if (status) status.textContent = `Init failed — ${err?.message || err}`;
  console.error(err);
});
