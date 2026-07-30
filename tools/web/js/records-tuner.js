import {
  RECORDS_ITEM_DEFS,
  applyRecordsLayoutEverywhere,
  applyRecordsTabArt,
  buildRecordsLayoutReport,
  clearRecordsLayoutCache,
  clearRecordsLayoutDraft,
  getRecordsItemLayout,
  isRecordsModeItem,
  loadRecordsLayout,
  mergeRecordsLayout,
  stashRecordsLayoutDraft,
  syncRecordsItemVisibility,
} from '/js/records-layout.js';
import { initFancyScroller } from '/js/fancy-scroller.js';
import { renderMockLeaderboardLists, renderMockPersonalBestLists, renderMockAdventureLeaderboardLists, setRecordsHeaderFields, MOCK_RECORDS_HEADER, MOCK_PERSONAL_HEADER } from '/js/records-data.js';

const POS_STEP = 0.5;
const SIZE_STEP = 0.5;
const ARROW_STEP = 0.25;
const DIALOG_ITEM = '__dialog__';
const TUNABLE_ITEMS = Object.keys(RECORDS_ITEM_DEFS).filter((k) => {
  const kind = RECORDS_ITEM_DEFS[k].kind;
  const screens = RECORDS_ITEM_DEFS[k].screens;
  if (!screens?.length) return false;
  return kind === 'pane' || kind === 'btn' || kind === 'tab' || kind === 'list'
    || kind === 'scroller' || kind === 'text' || kind === 'col' || kind === 'listRow';
});

const PANEL_GROUPS = [
  {
    id: 'top',
    title: '0-hint panel',
    keys: ['paneTop', 'listTop', 'scrollerTop', 'listRowTop'],
  },
  {
    id: 'bl',
    title: '1-hint panel',
    keys: ['paneBl', 'listBl', 'scrollerBl', 'listRowBl'],
  },
  {
    id: 'br',
    title: '2-hint panel',
    keys: ['paneBr', 'listBr', 'scrollerBr', 'listRowBr'],
  },
];

const PREVIEW_MODES = {
  leaderboard: {
    tabKey: 'leaderboard',
    title: 'Daily Leaderboard',
    detail: "Header: today's daily challenge (puzzle ID · date). Lists: rank · user · time.",
    mockStageClass: 'preview-mode-leaderboard',
    btnId: 'previewLeaderboardBtn',
    badge: 'DAILY LB',
  },
  adventure: {
    tabKey: 'adventure',
    title: 'Adventure Leaderboard',
    detail: 'Top 10 + 11+ scroller. Columns: rank · user · paths · level · avg time/puzzle · total hints.',
    mockStageClass: 'preview-mode-adventure',
    btnId: 'previewAdventureBtn',
    badge: 'ADVENTURE LB',
  },
  personalBest: {
    tabKey: 'personal',
    title: 'Personal Best',
    detail: 'Header: your last daily completion (puzzle ID · date · time). Lists: size · puzzle ID · time.',
    mockStageClass: 'preview-mode-personal',
    btnId: 'previewPersonalBtn',
    badge: 'PERSONAL BEST',
  },
};

const PANE_HIT_LABELS = {
  leaderboard: {
    paneTop: 'Daily · 0 hints',
    paneBl: 'Daily · 1 hint',
    paneBr: 'Daily · 2 hints',
  },
  adventure: {
    paneTop: 'Adv · Top 10',
    paneBl: 'Adv · 11+',
    paneBr: 'Adv · (hidden)',
  },
  personalBest: {
    paneTop: 'PB · 0 hints',
    paneBl: 'PB · 1 hint',
    paneBr: 'PB · 2 hints',
  },
};

const MOCK_ADVENTURE_HEADER = {
  date: 'Adventure',
  puzzleId: 'Paths · Avg · Hints',
};

function previewModeKey() {
  if (previewSubTab === 'adventure') return 'adventure';
  if (previewSubTab === 'personalBest') return 'personal';
  return 'leaderboard';
}

let workingLayout = mergeRecordsLayout(null);
let currentItem = 'paneTop';
let previewSubTab = 'leaderboard';
let dragState = null;
let scrollers = {};

const els = {};

function $(id) {
  return document.getElementById(id);
}

function itemScreens(key) {
  return RECORDS_ITEM_DEFS[key]?.screens || [];
}

function ensureModeBucket(mode) {
  if (!workingLayout.byMode || typeof workingLayout.byMode !== 'object') {
    workingLayout.byMode = {};
  }
  if (!workingLayout.byMode[mode] || typeof workingLayout.byMode[mode] !== 'object') {
    workingLayout.byMode[mode] = {};
  }
  return workingLayout.byMode[mode];
}

function patchItem(key, patch) {
  if (isRecordsModeItem(key)) {
    const mode = previewModeKey();
    const bucket = ensureModeBucket(mode);
    bucket[key] = { ...(bucket[key] || {}), ...patch };
  } else {
    if (!workingLayout.items[key]) workingLayout.items[key] = {};
    Object.assign(workingLayout.items[key], patch);
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

function itemBox(key) {
  return getRecordsItemLayout(key, workingLayout, previewModeKey());
}

function getFrameRect() {
  return $('mockFrame')?.getBoundingClientRect();
}

function applyMoveDelta(dxPx, dyPx) {
  if (currentItem === DIALOG_ITEM) return;
  const rect = getFrameRect();
  if (!rect?.width || !rect?.height) return;
  const box = itemBox(currentItem);
  // List areas are positioned inside their pane — use the pane box as % basis.
  let basisW = rect.width;
  let basisH = rect.height;
  const panel = RECORDS_ITEM_DEFS[currentItem]?.panel;
  if (RECORDS_ITEM_DEFS[currentItem]?.kind === 'list' && panel) {
    const paneKey = panel === 'top' ? 'paneTop' : panel === 'bl' ? 'paneBl' : 'paneBr';
    const paneEl = document.querySelector(`[data-records-item="${paneKey}"]`);
    const paneRect = paneEl?.getBoundingClientRect();
    if (paneRect?.width && paneRect?.height) {
      basisW = paneRect.width;
      basisH = paneRect.height;
    }
  }
  patchItem(currentItem, {
    x: Math.max(0, Math.round((box.x + (dxPx / basisW) * 100) * 10) / 10),
    y: Math.max(0, Math.round((box.y + (dyPx / basisH) * 100) * 10) / 10),
  });
}

function applyResizeDelta(dxPx, dyPx, edges) {
  if (currentItem === DIALOG_ITEM) return;
  const rect = getFrameRect();
  if (!rect?.width || !rect?.height) return;
  const box = itemBox(currentItem);
  let basisW = rect.width;
  let basisH = rect.height;
  const panel = RECORDS_ITEM_DEFS[currentItem]?.panel;
  if (RECORDS_ITEM_DEFS[currentItem]?.kind === 'list' && panel) {
    const paneKey = panel === 'top' ? 'paneTop' : panel === 'bl' ? 'paneBl' : 'paneBr';
    const paneEl = document.querySelector(`[data-records-item="${paneKey}"]`);
    const paneRect = paneEl?.getBoundingClientRect();
    if (paneRect?.width && paneRect?.height) {
      basisW = paneRect.width;
      basisH = paneRect.height;
    }
  }
  const patch = {};
  if (edges.e || edges.se) {
    patch.w = Math.max(1, Math.round((box.w + (dxPx / basisW) * 100) * 10) / 10);
  }
  if (edges.s || edges.se) {
    patch.h = Math.max(1, Math.round((box.h + (dyPx / basisH) * 100) * 10) / 10);
  }
  if (Object.keys(patch).length) patchItem(currentItem, patch);
}

function hideCurrentInGame() {
  if (currentItem === DIALOG_ITEM) return;
  patchItem(currentItem, { hidden: true });
  els.status.textContent = `${RECORDS_ITEM_DEFS[currentItem]?.label || currentItem} hidden in game`;
}

function restoreCurrentInGame() {
  if (currentItem === DIALOG_ITEM) return;
  patchItem(currentItem, { hidden: false });
  els.status.textContent = `${RECORDS_ITEM_DEFS[currentItem]?.label || currentItem} restored in game`;
}

function cycleItem(backward = false) {
  const visible = getVisibleTunableItems();
  const order = [DIALOG_ITEM, ...visible];
  const idx = order.indexOf(currentItem);
  const next = backward
    ? (idx - 1 + order.length) % order.length
    : (idx + 1) % order.length;
  currentItem = order[next];
  refresh();
}

function getVisibleTunableItems() {
  const modeKey = previewModeKey();
  return TUNABLE_ITEMS.filter((k) => itemScreens(k).includes(modeKey));
}

function getModeColumnItems(modeKey) {
  return TUNABLE_ITEMS.filter((k) => {
    const meta = RECORDS_ITEM_DEFS[k];
    if (meta?.kind !== 'col') return false;
    return itemScreens(k).includes(modeKey);
  });
}

function getSharedChromeItems() {
  return TUNABLE_ITEMS.filter((k) => {
    if (isRecordsModeItem(k)) return false;
    if (RECORDS_ITEM_DEFS[k]?.kind === 'col') return false;
    const s = itemScreens(k);
    return s.includes('leaderboard') || s.includes('adventure') || s.includes('personal');
  });
}

let saveTimer = null;
let saveInFlight = false;
let saveQueued = false;

async function saveToFile({ quiet = false } = {}) {
  if (saveInFlight) { saveQueued = true; return false; }
  saveInFlight = true;
  try {
    const res = await fetch('/api/dev/save-records-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: exportJson(),
    });
    if (!res.ok) {
      const errText = await res.text();
      let detail = errText || `HTTP ${res.status}`;
      try {
        const payload = JSON.parse(errText);
        if (payload?.error) detail = String(payload.error);
      } catch {
        const htmlMsg = /Message:\s*([^.<]+)/i.exec(errText);
        if (htmlMsg) detail = htmlMsg[1].trim();
      }
      if (res.status === 404 || res.status === 501) {
        throw new Error('Stale dev server — use http://localhost:3000 and run: docker compose restart web');
      }
      if (res.status === 400 && /Unknown (item|tab) key/i.test(detail)) {
        throw new Error('Stale dev server (records layout API) — run: docker compose restart web');
      }
      throw new Error(detail);
    }
    clearRecordsLayoutCache();
    clearRecordsLayoutDraft();
    localStorage.setItem('tilezilla:records-layout-version', String(Date.now()));
    window.dispatchEvent(new CustomEvent('tilezilla:records-layout-saved'));
    els.status.textContent = quiet
      ? 'Auto-saved to data/records_layout.json'
      : 'Saved to data/records_layout.json';
    return true;
  } catch (err) {
    els.status.textContent = `Save failed — ${err.message || err} · draft kept in browser`;
    stashRecordsLayoutDraft(workingLayout);
    return false;
  } finally {
    saveInFlight = false;
    if (saveQueued) { saveQueued = false; void saveToFile({ quiet: true }); }
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  stashRecordsLayoutDraft(workingLayout);
  saveTimer = setTimeout(() => void saveToFile({ quiet: true }), 600);
}

function addFieldGridSection(title) {
  const h = document.createElement('p');
  h.className = 'field-section-title';
  h.textContent = title;
  els.fieldGrid.appendChild(h);
}

function addFieldGridButton(key) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'field-btn';
  btn.dataset.item = key;
  btn.textContent = key === DIALOG_ITEM
    ? 'Dialog frame'
    : (RECORDS_ITEM_DEFS[key]?.label || key);
  btn.addEventListener('click', () => { currentItem = key; refresh(); });
  els.fieldGrid.appendChild(btn);
}

function rebuildFieldGrid() {
  els.fieldGrid.replaceChildren('');
  addFieldGridButton(DIALOG_ITEM);

  const modeKey = previewModeKey();
  const tabLabel = {
    leaderboard: 'Daily Leaderboard',
    adventure: 'Adventure Leaderboard',
    personal: 'Personal Best',
  }[modeKey] || 'This tab';

  addFieldGridSection(`${tabLabel} — panels (this tab only)`);
  for (const group of PANEL_GROUPS) {
    addFieldGridSection(group.title);
    for (const key of group.keys) {
      if (TUNABLE_ITEMS.includes(key)) addFieldGridButton(key);
    }
  }

  const cols = getModeColumnItems(modeKey);
  if (cols.length) {
    addFieldGridSection(`${tabLabel} — columns`);
    for (const key of cols) addFieldGridButton(key);
  }

  const chrome = getSharedChromeItems().filter((k) => itemScreens(k).includes(modeKey));
  if (chrome.length) {
    addFieldGridSection('Shared chrome (all tabs)');
    for (const key of chrome) addFieldGridButton(key);
  }
}

function updatePaneHitLabels() {
  const labels = PANE_HIT_LABELS[previewSubTab] || PANE_HIT_LABELS.leaderboard;
  for (const [key, text] of Object.entries(labels)) {
    const box = document.querySelector(`.tuner-box[data-item="${key}"] .hit-label`);
    if (box) box.textContent = text;
  }
}

function updatePreviewBanner() {
  const mode = PREVIEW_MODES[previewSubTab] || PREVIEW_MODES.leaderboard;
  if (els.previewTitle) els.previewTitle.textContent = mode.title;
  if (els.previewDetail) els.previewDetail.textContent = mode.detail;
  if (els.previewModeBadge) {
    els.previewModeBadge.textContent = mode.badge;
    els.previewModeBadge.dataset.mode = previewSubTab;
  }
  if (els.controlsModeHint) {
    els.controlsModeHint.textContent = {
      leaderboard: 'Daily — each panel has its own pane / list / scroller / row spacing (saved for this tab)',
      adventure: 'Adventure — each panel has its own pane / list / scroller / row spacing (saved for this tab)',
      personalBest: 'Personal Best — each panel has its own pane / list / scroller / row spacing (saved for this tab)',
    }[previewSubTab] || mode.detail;
  }
  for (const [key, cfg] of Object.entries(PREVIEW_MODES)) {
    $(cfg.btnId)?.classList.toggle('is-active', previewSubTab === key);
  }
  els.mockStage?.classList.remove('preview-mode-leaderboard', 'preview-mode-adventure', 'preview-mode-personal');
  els.mockStage?.classList.add(mode.mockStageClass);
  document.body.classList.remove('preview-mode-leaderboard', 'preview-mode-adventure', 'preview-mode-personal');
  document.body.classList.add(mode.mockStageClass);
  const bg = document.querySelector('#mockFrame .tz-journal-dialog__bg');
  if (bg) {
    bg.src = previewSubTab === 'adventure'
      ? '/img/NewRecordsPuzzleJournalBlankwbtm.png?v=20260730f'
      : '/img/PuzzleJournal-Records.png';
  }
}

function syncPreviewSubTab() {
  const panel = $('journalRecordsPanel');
  if (!panel) return;
  panel.dataset.recordsMode = previewModeKey();
  applyRecordsTabArt(workingLayout, document, previewSubTab);
  updatePaneHitLabels();
  updatePreviewBanner();
}

function refreshFieldGrid() {
  for (const btn of els.fieldGrid.querySelectorAll('.field-btn')) {
    const key = btn.dataset.item;
    btn.classList.toggle('is-active', key === currentItem);
    if (key && key !== DIALOG_ITEM) {
      btn.classList.toggle('is-game-hidden', Boolean(itemBox(key).hidden));
    }
  }
  const visibleKeys = new Set([DIALOG_ITEM, ...getVisibleTunableItems()]);
  for (const box of document.querySelectorAll('.tuner-box[data-item]')) {
    const key = box.dataset.item;
    const visible = visibleKeys.has(key);
    box.classList.toggle('is-wrong-preview-mode', !visible && key !== DIALOG_ITEM);
    box.classList.toggle('is-tuner-active', key === currentItem);
    if (key && key !== DIALOG_ITEM) {
      box.classList.toggle('is-game-hidden', Boolean(itemBox(key).hidden));
    }
  }
  const hitHidden = currentItem !== DIALOG_ITEM
    && Boolean(itemBox(currentItem).hidden);
  els.hideHitBtn.disabled = currentItem === DIALOG_ITEM || hitHidden;
  els.restoreHitBtn.disabled = currentItem === DIALOG_ITEM || !hitHidden;
}

function refreshReadout() {
  if (currentItem === DIALOG_ITEM) {
    const d = workingLayout.dialog;
    els.readout.textContent = `Dialog maxWidth=${d.maxDesignWidth}px pad=${d.displayPad}px topNudge=${d.topNudge}px`;
    return;
  }
  const box = itemBox(currentItem);
  const meta = RECORDS_ITEM_DEFS[currentItem];
  const modeTag = {
    leaderboard: '[Daily]',
    adventure: '[Adv]',
    personalBest: '[PB]',
  }[previewSubTab] || '[?]';
  const perTab = isRecordsModeItem(currentItem) ? ' · this tab' : '';
  if (meta?.kind === 'scroller') {
    els.readout.textContent = `${modeTag} ${meta.label}${perTab}: x=${box.x}% y=${box.y}% h=${box.h}% track=${box.trackScale} pin=${box.pinScale}`;
  } else if (meta?.kind === 'col') {
    els.readout.textContent = `${modeTag} ${meta.label}: w=${box.w}%`;
  } else if (meta?.kind === 'listRow') {
    els.readout.textContent = `${modeTag} ${meta.label}${perTab}: fontScale=${box.fontScale} pad=${box.padY}/${box.padX}px gap=${box.gap}px`;
  } else if (meta?.kind === 'list') {
    els.readout.textContent = `${modeTag} ${meta.label}${perTab}: inset x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%`;
  } else {
    els.readout.textContent = `${modeTag} ${meta?.label || currentItem}${perTab}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%`;
  }
}

function refresh() {
  const mode = previewModeKey();
  applyRecordsLayoutEverywhere(workingLayout, document, mode);
  syncRecordsItemVisibility(workingLayout, document, mode);
  syncPreviewSubTab();
  refreshFieldGrid();
  refreshReadout();
  els.jsonOut.value = exportJson();
  els.reportOut.value = buildRecordsLayoutReport(workingLayout, mode);
  if (previewSubTab === 'personalBest') {
    renderMockPersonalBestLists();
    setRecordsHeaderFields(document, { ...MOCK_PERSONAL_HEADER, showTime: true });
  } else if (previewSubTab === 'adventure') {
    renderMockAdventureLeaderboardLists();
    setRecordsHeaderFields(document, { ...MOCK_ADVENTURE_HEADER, showTime: false });
  } else {
    renderMockLeaderboardLists();
    setRecordsHeaderFields(document, { ...MOCK_RECORDS_HEADER, showTime: false });
  }
  for (const scroller of Object.values(scrollers)) scroller?.sync?.();
  scheduleSave();
}

function setPreviewSubTab(tab) {
  previewSubTab = tab;
  const visible = getVisibleTunableItems();
  if (currentItem !== DIALOG_ITEM && !visible.includes(currentItem)) {
    currentItem = visible[0] || 'paneTop';
  }
  rebuildFieldGrid();
  refresh();
}

function wireScroller(key, scrollId, scrollerId, trackId, pinId) {
  scrollers[key] = initFancyScroller({
    scrollEl: $(scrollId),
    scrollerRoot: $(scrollerId),
    trackEl: $(trackId),
    pinEl: $(pinId),
    alwaysVisible: true,
  });
}

export async function initRecordsTuner() {
  els.fieldGrid = $('fieldGrid');
  els.readout = $('readout');
  els.status = $('status');
  els.jsonOut = $('jsonOut');
  els.reportOut = $('reportOut');
  els.hideHitBtn = $('hideHitBtn');
  els.restoreHitBtn = $('restoreHitBtn');
  els.saveBtn = $('saveBtn');
  els.reloadBtn = $('reloadBtn');
  els.nudgeGrid = $('nudgeGrid');
  els.mockStage = $('mockStage');
  els.previewTitle = $('previewTitle');
  els.previewDetail = $('previewDetail');
  els.previewModeBadge = $('previewModeBadge');
  els.controlsModeHint = $('controlsModeHint');

  rebuildFieldGrid();

  $('previewLeaderboardBtn')?.addEventListener('click', () => setPreviewSubTab('leaderboard'));
  $('previewAdventureBtn')?.addEventListener('click', () => setPreviewSubTab('adventure'));
  $('previewPersonalBtn')?.addEventListener('click', () => setPreviewSubTab('personalBest'));

  wireScroller('top', 'recordsListTop', 'recordsScrollerTop', 'recordsScrollerTopTrack', 'recordsScrollerTopPin');
  wireScroller('bl', 'recordsListBl', 'recordsScrollerBl', 'recordsScrollerBlTrack', 'recordsScrollerBlPin');
  wireScroller('br', 'recordsListBr', 'recordsScrollerBr', 'recordsScrollerBrTrack', 'recordsScrollerBrPin');

  els.hideHitBtn.addEventListener('click', hideCurrentInGame);
  els.restoreHitBtn.addEventListener('click', restoreCurrentInGame);
  els.saveBtn.addEventListener('click', () => void saveToFile());
  els.reloadBtn.addEventListener('click', async () => {
    clearRecordsLayoutCache();
    workingLayout = await loadRecordsLayout({ force: true, fromDisk: true });
    refresh();
    els.status.textContent = 'Reloaded from data/records_layout.json';
  });

  for (const btn of els.nudgeGrid.querySelectorAll('[data-nudge]')) {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.nudge;
      const box = currentItem === DIALOG_ITEM
        ? workingLayout.dialog
        : itemBox(currentItem);
      if (currentItem === DIALOG_ITEM) {
        if (dir === 'wider') patchDialog({ maxDesignWidth: (box.maxDesignWidth || 394) + 4 });
        else if (dir === 'narrower') patchDialog({ maxDesignWidth: Math.max(280, (box.maxDesignWidth || 394) - 4) });
        return;
      }
      const meta = RECORDS_ITEM_DEFS[currentItem];
      if (meta?.kind === 'listRow') {
        const patch = {};
        if (dir === 'wider' || dir === 'taller') {
          patch.fontScale = Math.round(((box.fontScale || 1) + 0.05) * 100) / 100;
        } else if (dir === 'narrower' || dir === 'shorter') {
          patch.fontScale = Math.max(0.4, Math.round(((box.fontScale || 1) - 0.05) * 100) / 100);
        } else if (dir === 'up') patch.padY = Math.max(0, (box.padY || 0) - 1);
        else if (dir === 'down') patch.padY = (box.padY || 0) + 1;
        else if (dir === 'left') patch.padX = Math.max(0, (box.padX || 0) - 1);
        else if (dir === 'right') patch.padX = (box.padX || 0) + 1;
        if (Object.keys(patch).length) patchItem(currentItem, patch);
        return;
      }
      if (meta?.kind === 'col') {
        if (dir === 'wider' || dir === 'right') patchItem(currentItem, { w: (box.w || 10) + ARROW_STEP });
        else if (dir === 'narrower' || dir === 'left') patchItem(currentItem, { w: Math.max(1, (box.w || 10) - ARROW_STEP) });
        return;
      }
      const patch = {};
      if (dir === 'up') patch.y = box.y - ARROW_STEP;
      if (dir === 'down') patch.y = box.y + ARROW_STEP;
      if (dir === 'left') patch.x = box.x - ARROW_STEP;
      if (dir === 'right') patch.x = box.x + ARROW_STEP;
      if (dir === 'wider') patch.w = box.w + ARROW_STEP;
      if (dir === 'narrower') patch.w = Math.max(1, box.w - ARROW_STEP);
      if (dir === 'taller') patch.h = box.h + ARROW_STEP;
      if (dir === 'shorter') patch.h = Math.max(1, box.h - ARROW_STEP);
      patchItem(currentItem, patch);
    });
  }

  els.mockStage?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    if (currentItem === DIALOG_ITEM) {
      if (e.shiftKey) patchDialog({ displayPad: Math.max(0, (workingLayout.dialog.displayPad || 16) + dir * 2) });
      else patchDialog({ maxDesignWidth: Math.max(280, (workingLayout.dialog.maxDesignWidth || 394) + dir * 4) });
      return;
    }
    const box = itemBox(currentItem);
    const meta = RECORDS_ITEM_DEFS[currentItem];
    if (meta?.kind === 'scroller') {
      if (e.ctrlKey) patchItem(currentItem, { trackScale: Math.max(0.1, box.trackScale + dir * 0.02) });
      else if (e.altKey) patchItem(currentItem, { pinScale: Math.max(0.1, box.pinScale + dir * 0.02) });
      else patchItem(currentItem, { h: Math.max(1, box.h + dir * SIZE_STEP) });
      return;
    }
    if (meta?.kind === 'listRow') {
      if (e.shiftKey) patchItem(currentItem, { padY: Math.max(0, box.padY + dir) });
      else if (e.ctrlKey) patchItem(currentItem, { padX: Math.max(0, box.padX + dir) });
      else if (e.altKey) patchItem(currentItem, { gap: Math.max(0, box.gap + dir) });
      else {
        patchItem(currentItem, {
          fontScale: Math.max(0.4, Math.round((box.fontScale + dir * 0.05) * 100) / 100),
        });
      }
      return;
    }
    if (meta?.kind === 'col') {
      patchItem(currentItem, { w: Math.max(1, box.w + dir * SIZE_STEP) });
      return;
    }
    if (meta?.kind === 'text' && e.ctrlKey && e.altKey) {
      patchItem(currentItem, {
        fontScale: Math.max(0.4, Math.round(((box.fontScale || 1) + dir * 0.05) * 100) / 100),
      });
      return;
    }
    if (e.shiftKey) patchItem(currentItem, { y: Math.max(0, box.y + dir * POS_STEP) });
    else if (e.ctrlKey) patchItem(currentItem, { w: Math.max(1, box.w + dir * SIZE_STEP) });
    else if (e.altKey) patchItem(currentItem, { h: Math.max(1, box.h + dir * SIZE_STEP) });
    else patchItem(currentItem, { x: Math.max(0, box.x + dir * POS_STEP) });
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.target?.matches?.('textarea, input')) return;
    if (e.key === 'Tab') { e.preventDefault(); cycleItem(e.shiftKey); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { hideCurrentInGame(); return; }
    if (e.key === 'r' || e.key === 'R') { restoreCurrentInGame(); return; }
  });

  document.querySelectorAll('.tuner-box[data-item]').forEach((box) => {
    box.addEventListener('pointerdown', (e) => {
      if (box.classList.contains('is-wrong-preview-mode')) return;
      const handle = e.target.closest('.tuner-handle');
      if (handle) {
        currentItem = box.dataset.item;
        dragState = {
          el: box,
          mode: 'resize',
          edges: {
            e: handle.classList.contains('tuner-handle--e') || handle.classList.contains('tuner-handle--se'),
            s: handle.classList.contains('tuner-handle--s') || handle.classList.contains('tuner-handle--se'),
          },
          startX: e.clientX,
          startY: e.clientY,
        };
        handle.setPointerCapture?.(e.pointerId);
        refresh();
        return;
      }
      currentItem = box.dataset.item;
      dragState = { el: box, mode: 'move', startX: e.clientX, startY: e.clientY };
      box.setPointerCapture?.(e.pointerId);
      refresh();
    });
    box.addEventListener('pointermove', (e) => {
      if (!dragState || dragState.el !== box) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (dragState.mode === 'resize') {
        applyResizeDelta(dx, dy, dragState.edges);
      } else {
        applyMoveDelta(dx, dy);
      }
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
    });
    box.addEventListener('pointerup', () => { dragState = null; });
    box.addEventListener('click', () => {
      if (box.classList.contains('is-wrong-preview-mode')) return;
      currentItem = box.dataset.item;
      refresh();
    });
  });

  workingLayout = await loadRecordsLayout({ force: true });
  refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void initRecordsTuner());
} else {
  void initRecordsTuner();
}
