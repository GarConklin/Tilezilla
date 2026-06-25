import {
  PREVIEW_V2_DATA_SECTIONS,
  applyPreviewV2DataSublayout,
  buildPreviewV2DataSublayoutReport,
  clearPreviewV2DataSublayoutCache,
  clearPreviewV2DataSublayoutDraft,
  getPreviewV2DataSublayoutItem,
  getPreviewV2DataSublayoutSaveApi,
  loadPreviewV2DataSublayout,
  mergePreviewV2DataSublayout,
  stashPreviewV2DataSublayoutDraft,
  syncDataSublayoutFrameFromPreviewZone,
} from './preview-v2-data-sublayout.js';
import { applyPreviewV2Layout, getPreviewV2ItemLayout, loadPreviewV2Layout } from './preview-v2-layout.js';
import { applyUiScale, wireUiScaleListeners } from './tilezilla-ui-scale.js';

const POS_STEP = 1;
const SIZE_STEP = 1;
const FONT_STEP = 0.05;
const JUSTIFY_CYCLE = ['flex-start', 'center', 'flex-end'];
const ALIGN_CYCLE = ['flex-start', 'center', 'flex-end'];

function justifyLabel(value) {
  if (value === 'flex-start') return 'left';
  if (value === 'flex-end') return 'right';
  return 'center';
}

function alignLabel(value) {
  if (value === 'flex-start') return 'top';
  if (value === 'flex-end') return 'bottom';
  return 'center';
}

export function initPreviewDataV2ZoneTuner(sectionKey, root = document) {
  const def = PREVIEW_V2_DATA_SECTIONS[sectionKey];
  if (!def) throw new Error(`Unknown preview data section: ${sectionKey}`);

  const zoneClass = `tz-preview-v2-${def.cssPrefix}`;
  const itemKeys = Object.keys(def.items);
  const hasTextLayout = Boolean(def.textLayout);

  let previewLayout = null;
  let previewZone = null;
  let currentItem = itemKeys[0];
  let workingLayout = mergePreviewV2DataSublayout(sectionKey, null);
  let saveTimer = null;
  let saveInFlight = false;
  let saveQueued = false;

  const els = {
    fieldGrid: root.getElementById('fieldGrid'),
    readout: root.getElementById('readout'),
    status: root.getElementById('status'),
    jsonOut: root.getElementById('jsonOut'),
    reportOut: root.getElementById('reportOut'),
    zoneReadout: root.getElementById('zoneReadout'),
    mockStage: root.getElementById('mockStage'),
    alignRow: root.getElementById('alignRow'),
    nudgeGrid: root.getElementById('nudgeGrid'),
    fontNudgeRow: root.getElementById('fontNudgeRow'),
  };

  function patchItem(key, patch) {
    if (!workingLayout.items[key]) workingLayout.items[key] = {};
    Object.assign(workingLayout.items[key], patch);
    refresh();
  }

  function exportJson() {
    return JSON.stringify(workingLayout, null, 2);
  }

  async function saveToFile({ quiet = false } = {}) {
    const api = getPreviewV2DataSublayoutSaveApi(sectionKey);
    if (saveInFlight) {
      saveQueued = true;
      return false;
    }
    saveInFlight = true;
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: exportJson(),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearPreviewV2DataSublayoutCache(sectionKey);
      clearPreviewV2DataSublayoutDraft(sectionKey);
      localStorage.setItem(`tilezilla:${sectionKey}-v2-layout-version`, String(Date.now()));
      window.dispatchEvent(new CustomEvent(`tilezilla:${sectionKey}-v2-layout-saved`));
      els.status.textContent = quiet ? 'Auto-saved' : `Saved ${def.file}`;
      return true;
    } catch (err) {
      els.status.textContent = `Save failed — ${err.message || err}`;
      return false;
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        void saveToFile({ quiet: true });
      }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveToFile({ quiet: true }), 600);
  }

  function selectItem(itemKey) {
    currentItem = itemKey;
    refresh();
  }

  function cycleJustify() {
    const box = getPreviewV2DataSublayoutItem(sectionKey, currentItem, workingLayout);
    const idx = JUSTIFY_CYCLE.indexOf(box.justify);
    patchItem(currentItem, { justify: JUSTIFY_CYCLE[(idx + 1) % JUSTIFY_CYCLE.length] });
  }

  function cycleAlign() {
    const box = getPreviewV2DataSublayoutItem(sectionKey, currentItem, workingLayout);
    const idx = ALIGN_CYCLE.indexOf(box.align);
    patchItem(currentItem, { align: ALIGN_CYCLE[(idx + 1) % ALIGN_CYCLE.length] });
  }

  function nudge(action) {
    const box = getPreviewV2DataSublayoutItem(sectionKey, currentItem, workingLayout);
    switch (action) {
      case 'left':
        patchItem(currentItem, { x: Math.max(0, box.x - POS_STEP) });
        break;
      case 'right':
        patchItem(currentItem, { x: box.x + POS_STEP });
        break;
      case 'up':
        patchItem(currentItem, { y: Math.max(0, box.y - POS_STEP) });
        break;
      case 'down':
        patchItem(currentItem, { y: box.y + POS_STEP });
        break;
      case 'wider':
        patchItem(currentItem, { w: box.w + SIZE_STEP });
        break;
      case 'narrower':
        patchItem(currentItem, { w: Math.max(4, box.w - SIZE_STEP) });
        break;
      case 'taller':
        patchItem(currentItem, { h: box.h + SIZE_STEP });
        break;
      case 'shorter':
        patchItem(currentItem, { h: Math.max(4, box.h - SIZE_STEP) });
        break;
      case 'fontUp':
        patchItem(currentItem, { fontScale: Math.round((box.fontScale + FONT_STEP) * 100) / 100 });
        break;
      case 'fontDown':
        patchItem(currentItem, { fontScale: Math.max(0.25, Math.round((box.fontScale - FONT_STEP) * 100) / 100) });
        break;
      default:
        break;
    }
  }

  function refreshFieldGrid() {
    els.fieldGrid.innerHTML = '';
    for (const key of itemKeys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'field-btn';
      btn.dataset.item = key;
      btn.textContent = def.items[key].label;
      btn.classList.toggle('is-active', key === currentItem);
      btn.addEventListener('click', () => selectItem(key));
      els.fieldGrid.appendChild(btn);
    }
    for (const box of root.querySelectorAll(`.${zoneClass} .tuner-box[data-item]`)) {
      box.classList.toggle('is-tuner-active', box.dataset.item === currentItem);
    }
  }

  function refreshZoneReadout() {
    const frame = workingLayout.frame || def.frame;
    if (!previewZone) {
      els.zoneReadout.textContent = `${def.label} zone: load preview layout`;
      return;
    }
    const frameMatch = frame.w === previewZone.w && frame.h === previewZone.h;
    els.zoneReadout.innerHTML = `
      ${def.label} on preview plaque: x ${previewZone.x} · y ${previewZone.y} · w ${previewZone.w} · h ${previewZone.h}<br />
      Local artboard: ${frame.w}×${frame.h}px${frameMatch ? '' : ' (mismatch — reload preview layout)'} · tune zone in <a href="/preview-v2-tuner.html">preview-v2-tuner</a>
    `;
  }

  function syncFrameToPreviewZone({ quiet = false } = {}) {
    if (!previewLayout || !previewZone) return;
    const synced = syncDataSublayoutFrameFromPreviewZone(sectionKey, previewLayout, workingLayout);
    if (JSON.stringify(synced.frame) === JSON.stringify(workingLayout.frame)
      && JSON.stringify(synced.items) === JSON.stringify(workingLayout.items)) {
      return;
    }
    workingLayout = synced;
    if (!quiet) {
      els.status.textContent = `Synced artboard to zone ${previewZone.w}×${previewZone.h}px`;
    }
  }

  function refresh() {
    applyUiScale();
    if (previewLayout) applyPreviewV2Layout(previewLayout, document.documentElement);
    applyPreviewV2DataSublayout(sectionKey, workingLayout, document.documentElement);
    const box = getPreviewV2DataSublayoutItem(sectionKey, currentItem, workingLayout);
    const frame = workingLayout.frame || def.frame;
    let readout = `
      <strong>${def.items[currentItem]?.label || currentItem}</strong><br />
      x: ${box.x} · y: ${box.y} · w: ${box.w} · h: ${box.h} (local px in ${frame.w}×${frame.h})
    `;
    if (hasTextLayout) {
      readout += `<br />fontScale: ${box.fontScale} · justify: ${justifyLabel(box.justify)} · align: ${alignLabel(box.align)}`;
    }
    els.readout.innerHTML = readout;
    els.jsonOut.value = exportJson();
    els.reportOut.value = buildPreviewV2DataSublayoutReport(sectionKey, workingLayout);
    refreshZoneReadout();
    refreshFieldGrid();
    stashPreviewV2DataSublayoutDraft(sectionKey, workingLayout);
    scheduleSave();
  }

  function onWheel(e) {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    if (hasTextLayout && e.ctrlKey && e.shiftKey) {
      const box = getPreviewV2DataSublayoutItem(sectionKey, currentItem, workingLayout);
      patchItem(currentItem, {
        fontScale: Math.max(0.25, Math.round((box.fontScale + dir * FONT_STEP) * 100) / 100),
      });
      return;
    }
    const box = getPreviewV2DataSublayoutItem(sectionKey, currentItem, workingLayout);
    if (e.altKey && e.ctrlKey) patchItem(currentItem, { h: Math.max(4, box.h + dir * SIZE_STEP) });
    else if (e.ctrlKey) patchItem(currentItem, { w: Math.max(4, box.w + dir * SIZE_STEP) });
    else if (e.shiftKey) patchItem(currentItem, { y: Math.max(0, box.y + dir * POS_STEP) });
    else patchItem(currentItem, { x: Math.max(0, box.x + dir * POS_STEP) });
  }

  async function init() {
    wireUiScaleListeners();

    for (const btn of els.nudgeGrid.querySelectorAll('[data-nudge]')) {
      btn.addEventListener('click', () => nudge(btn.dataset.nudge));
    }
    if (els.fontNudgeRow) {
      for (const btn of els.fontNudgeRow.querySelectorAll('[data-nudge]')) {
        btn.addEventListener('click', () => nudge(btn.dataset.nudge));
      }
    }
    if (els.alignRow) {
      els.alignRow.querySelector('[data-action="cycleJustify"]')?.addEventListener('click', cycleJustify);
      els.alignRow.querySelector('[data-action="cycleAlign"]')?.addEventListener('click', cycleAlign);
    }

    root.querySelectorAll(`.${zoneClass} .tuner-box[data-item]`).forEach((box) => {
      box.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        selectItem(box.dataset.item);
        els.mockStage.focus();
      });
    });

    els.mockStage.addEventListener('wheel', onWheel, { passive: false });

    root.getElementById('reloadBtn').addEventListener('click', async () => {
      clearPreviewV2DataSublayoutCache(sectionKey);
      clearPreviewV2DataSublayoutDraft(sectionKey);
      workingLayout = await loadPreviewV2DataSublayout(sectionKey, { force: true });
      syncFrameToPreviewZone({ quiet: true });
      refresh();
      els.status.textContent = `Reloaded ${def.file}`;
    });

    root.getElementById('clearDraftBtn').addEventListener('click', () => {
      clearPreviewV2DataSublayoutDraft(sectionKey);
      els.status.textContent = 'Draft cleared — Reload file';
    });

    root.getElementById('saveBtn').addEventListener('click', () => void saveToFile());

    root.addEventListener('keydown', (e) => {
      if (!els.mockStage.contains(document.activeElement) && document.activeElement !== els.mockStage) return;
      const map = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      };
      if (map[e.key]) {
        e.preventDefault();
        nudge(map[e.key]);
      }
      if (e.key === 'Tab' && itemKeys.length > 1) {
        e.preventDefault();
        const idx = itemKeys.indexOf(currentItem);
        selectItem(itemKeys[(idx + 1) % itemKeys.length]);
      }
    });

    try {
      previewLayout = await loadPreviewV2Layout();
      previewZone = previewLayout ? getPreviewV2ItemLayout(def.previewZoneKey, previewLayout) : null;
    } catch {
      previewLayout = null;
      previewZone = null;
    }

    workingLayout = await loadPreviewV2DataSublayout(sectionKey);
    syncFrameToPreviewZone({ quiet: true });
    refresh();
    els.mockStage.focus();
  }

  void init();
  return { refresh, selectItem };
}
