/** Puzzle Journal — Records screen layout (PuzzleJournal-Records.png, 933×1686). */

export const RECORDS_ART = { w: 933, h: 1686 };

export const RECORDS_TAB_KEYS = ['leaderboard', 'personalBest'];

export const DEFAULT_RECORDS_TAB_ART = {
  leaderboard: { idle: '/img/LeaderBoard-W.png', active: '/img/LeaderBoard-G.png' },
  personalBest: { idle: '/img/Personal-Best-W.png', active: '/img/Personal-Best-G.png' },
};

export const RECORDS_ITEM_DEFS = {
  tabLeaderboard: { cssKey: 'tab-leaderboard', kind: 'tab', label: 'Tab — Leaderboard', tabKey: 'leaderboard', screens: ['leaderboard', 'personal'] },
  tabPersonalBest: { cssKey: 'tab-personal', kind: 'tab', label: 'Tab — Personal Best', tabKey: 'personalBest', screens: ['leaderboard', 'personal'] },
  fieldDailyPuzzleId: { cssKey: 'daily-puzzle-id', kind: 'text', label: 'Header — puzzle ID', slot: 'dailyPuzzleId', screens: ['leaderboard', 'personal'] },
  fieldDailyDate: { cssKey: 'daily-date', kind: 'text', label: 'Header — date', slot: 'dailyDate', screens: ['leaderboard', 'personal'] },
  fieldDailyTime: { cssKey: 'daily-time', kind: 'text', label: 'Header — time', slot: 'dailyTime', screens: ['personal'] },
  paneTop: { cssKey: 'pane-top', kind: 'pane', label: 'Top pane (0 hints)', screens: ['leaderboard', 'personal'] },
  paneBl: { cssKey: 'pane-bl', kind: 'pane', label: 'Bottom-left pane (1 hint)', screens: ['leaderboard', 'personal'] },
  paneBr: { cssKey: 'pane-br', kind: 'pane', label: 'Bottom-right pane (2 hints)', screens: ['leaderboard', 'personal'] },
  listTop: { cssKey: 'list-top', kind: 'list', label: 'Top list scroll area', screens: ['leaderboard', 'personal'] },
  scrollerTop: { cssKey: 'scroller-top', kind: 'scroller', label: 'Top scroll bar', screens: ['leaderboard', 'personal'] },
  listBl: { cssKey: 'list-bl', kind: 'list', label: '1-hint list scroll area', screens: ['leaderboard', 'personal'] },
  scrollerBl: { cssKey: 'scroller-bl', kind: 'scroller', label: '1-hint scroll bar', screens: ['leaderboard', 'personal'] },
  listBr: { cssKey: 'list-br', kind: 'list', label: '2-hint list scroll area', screens: ['leaderboard', 'personal'] },
  scrollerBr: { cssKey: 'scroller-br', kind: 'scroller', label: '2-hint scroll bar', screens: ['leaderboard', 'personal'] },
  listRow: { cssKey: 'list-row', kind: 'listRow', label: 'List row spacing / font', screens: ['leaderboard', 'personal'] },
  colRank: { cssKey: 'col-rank', kind: 'col', label: 'LB column — rank', screens: ['leaderboard'] },
  colUser: { cssKey: 'col-user', kind: 'col', label: 'LB column — username', screens: ['leaderboard'] },
  colTime: { cssKey: 'col-time', kind: 'col', label: 'Column — time', screens: ['leaderboard', 'personal'] },
  colSize: { cssKey: 'col-size', kind: 'col', label: 'PB column — board size', screens: ['personal'] },
  colPuzzle: { cssKey: 'col-puzzle', kind: 'col', label: 'PB column — puzzle ID', screens: ['personal'] },
  personalPane: { cssKey: 'personal-pane', kind: 'pane', label: '(legacy) personal pane', screens: [] },
  listPersonal: { cssKey: 'list-personal', kind: 'list', label: '(legacy) personal list', screens: [] },
  scrollerPersonal: { cssKey: 'scroller-personal', kind: 'scroller', label: '(legacy) personal scroll', screens: [] },
  btnBack: { cssKey: 'btn-back', kind: 'btn', label: 'Back (gold)', screens: ['leaderboard', 'personal'] },
  btnClose: { cssKey: 'btn-close', kind: 'btn', label: 'Close (gold X)', screens: ['leaderboard', 'personal'] },
};

export const DEFAULT_RECORDS_LAYOUT = {
  dialog: {
    artW: 933,
    artH: 1686,
    displayPad: 16,
    maxDesignWidth: 394,
    topNudge: 0,
  },
  typography: {
    fieldColor: '#3d2e1a',
    fieldFont: 'calc(0.58rem + 1px)',
    headerFont: 'calc(0.52rem + 1px)',
  },
  tabs: { ...DEFAULT_RECORDS_TAB_ART },
  items: {
    tabLeaderboard: { x: 88.2, y: 8.5, w: 8.8, h: 11.2, nudgeX: 0, nudgeY: 0 },
    tabPersonalBest: { x: 88.9, y: 20.9, w: 7.8, h: 10.7, nudgeX: 0, nudgeY: 0 },
    fieldDailyPuzzleId: { x: 10, y: 13.2, w: 34, h: 3.2, fontScale: 1.15, nudgeX: 0, nudgeY: 0 },
    fieldDailyDate: { x: 44, y: 13.2, w: 32, h: 3.2, fontScale: 1.05, nudgeX: 0, nudgeY: 0 },
    fieldDailyTime: { x: 76, y: 13.2, w: 14, h: 3.2, fontScale: 1.15, nudgeX: 0, nudgeY: 0 },
    paneTop: { x: 10.6, y: 15.3, w: 74, h: 32.1, nudgeX: 0, nudgeY: 0 },
    paneBl: { x: 8.4, y: 61.4, w: 37, h: 30.2, nudgeX: 0, nudgeY: 0 },
    paneBr: { x: 49, y: 61.5, w: 36, h: 30, nudgeX: 0, nudgeY: 0 },
    listTop: { x: 10, y: 22, w: 74, h: 22, nudgeX: 0, nudgeY: 0 },
    scrollerTop: { x: 84.5, y: 22, h: 24, trackScale: 0.55, pinScale: 0.66, nudgeX: 0, nudgeY: 0 },
    listBl: { x: 10.25, y: 56, w: 33, h: 22, nudgeX: 0, nudgeY: 0 },
    scrollerBl: { x: 43.5, y: 56, h: 20, trackScale: 0.5, pinScale: 0.66, nudgeX: 0, nudgeY: 0 },
    listBr: { x: 52, y: 56, w: 33, h: 22, nudgeX: 0, nudgeY: 0 },
    scrollerBr: { x: 85.5, y: 56, h: 20, trackScale: 0.5, pinScale: 0.66, nudgeX: 0, nudgeY: 0 },
    listRow: { fontScale: 1, padY: 4, padX: 6, gap: 2 },
    colRank: { w: 18 },
    colUser: { w: 52 },
    colTime: { w: 30 },
    colSize: { w: 22 },
    colPuzzle: { w: 48 },
    personalPane: { x: 7.5, y: 16.5, w: 79, h: 64, nudgeX: 0, nudgeY: 0, hidden: true },
    listPersonal: { x: 10, y: 22, w: 74, h: 56, nudgeX: 0, nudgeY: 0, hidden: true },
    scrollerPersonal: { x: 84.5, y: 22, h: 56, trackScale: 0.55, pinScale: 0.66, nudgeX: 0, nudgeY: 0, hidden: true },
    btnBack: { x: 6.2, y: 1.9, w: 9, h: 5.2, nudgeX: 0, nudgeY: 0, hidden: false },
    btnClose: { x: 78.2, y: 1.4, w: 9, h: 5.2, nudgeX: 0, nudgeY: 0, hidden: false },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:records';
const LS_PENDING_KEY = 'tilezilla:layouts:records:pending';

let layoutCache = null;

export function isRecordsTunerPage() {
  return /records-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearRecordsLayoutCache() {
  layoutCache = null;
}

export function stashRecordsLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearRecordsLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function mergeBox(base, raw) {
  if (!raw || typeof raw !== 'object') return { ...base };
  return { ...base, ...raw };
}

export function mergeRecordsLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RECORDS_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.typography && typeof raw.typography === 'object') {
    base.typography = { ...base.typography, ...raw.typography };
  }
  if (raw.tabs && typeof raw.tabs === 'object') {
    for (const key of RECORDS_TAB_KEYS) {
      if (raw.tabs[key] && typeof raw.tabs[key] === 'object') {
        base.tabs[key] = { ...base.tabs[key], ...raw.tabs[key] };
      }
    }
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!RECORDS_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = mergeBox(base.items[key] || {}, val);
    }
  }
  return base;
}

export async function loadRecordsLayout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isRecordsTunerPage();

  if (!fromDisk && onTuner) {
    try {
      if (localStorage.getItem(LS_PENDING_KEY) === '1') {
        const draft = localStorage.getItem(LS_LAYOUT_KEY);
        if (draft) raw = JSON.parse(draft);
      }
    } catch {
      /* fall through */
    }
  }

  if (!raw || fromDisk) {
    try {
      const res = await fetch(`/data/records_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  if (!raw && onTuner) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  layoutCache = mergeRecordsLayout(raw);
  return layoutCache;
}

export function getRecordsItemLayout(itemKey, layout) {
  const merged = mergeRecordsLayout(layout);
  const def = DEFAULT_RECORDS_LAYOUT.items[itemKey] || {};
  const box = merged.items[itemKey] || {};
  return {
    x: box.x ?? def.x ?? 0,
    y: box.y ?? def.y ?? 0,
    w: box.w ?? def.w ?? 10,
    h: box.h ?? def.h ?? 10,
    nudgeX: box.nudgeX ?? def.nudgeX ?? 0,
    nudgeY: box.nudgeY ?? def.nudgeY ?? 0,
    fontScale: box.fontScale ?? def.fontScale ?? 1,
    padX: box.padX ?? def.padX ?? 6,
    padY: box.padY ?? def.padY ?? 4,
    gap: box.gap ?? def.gap ?? 2,
    trackScale: box.trackScale ?? def.trackScale ?? 0.34,
    pinScale: box.pinScale ?? def.pinScale ?? 0.66,
    hidden: Boolean(box.hidden ?? def.hidden),
  };
}

export function getRecordsTabArtSrc(tabKey, layout, { active = false } = {}) {
  const merged = mergeRecordsLayout(layout);
  const pair = merged.tabs?.[tabKey] || DEFAULT_RECORDS_TAB_ART[tabKey];
  if (!pair) return '';
  return active ? (pair.active || pair.idle || '') : (pair.idle || pair.active || '');
}

function cssVarName(itemKey, suffix) {
  return `--tz-records-${itemKey.replace(/([A-Z])/g, '-$1').toLowerCase()}-${suffix}`;
}

/** Font size in cqi so records text tracks journal frame width (tuner % coords stay valid). */
function recordsFontCqi(pxAtDesign, designW, scale = 1) {
  const w = Number(designW) || 394;
  return `${((pxAtDesign / w) * 100 * scale).toFixed(3)}cqi`;
}

function applyRecordsBoxVars(target, itemKey, box, meta) {
  if (meta.kind === 'col') {
    target.style.setProperty(cssVarName(itemKey, 'w'), `${box.w}%`);
    return;
  }
  if (meta.kind === 'listRow') {
    target.style.setProperty(cssVarName(itemKey, 'font-scale'), String(box.fontScale));
    target.style.setProperty(cssVarName(itemKey, 'pad-x'), `${box.padX}px`);
    target.style.setProperty(cssVarName(itemKey, 'pad-y'), `${box.padY}px`);
    target.style.setProperty(cssVarName(itemKey, 'gap'), `${box.gap}px`);
    return;
  }
  if (['pane', 'list', 'btn', 'tab', 'text'].includes(meta.kind)) {
    for (const dim of ['x', 'y', 'w', 'h']) {
      if (box[dim] != null) {
        target.style.setProperty(cssVarName(itemKey, dim), String(box[dim]));
      }
    }
    target.style.setProperty(cssVarName(itemKey, 'nudge-x'), `${box.nudgeX ?? 0}px`);
    target.style.setProperty(cssVarName(itemKey, 'nudge-y'), `${box.nudgeY ?? 0}px`);
    if (meta.kind === 'list' || meta.kind === 'pane' || meta.kind === 'text') {
      target.style.setProperty(cssVarName(itemKey, 'font-scale'), String(box.fontScale ?? 1));
    }
    return;
  }
  if (meta.kind === 'scroller') {
    for (const dim of ['x', 'y', 'h']) {
      if (box[dim] != null) {
        target.style.setProperty(cssVarName(itemKey, dim), String(box[dim]));
      }
    }
    target.style.setProperty(cssVarName(itemKey, 'nudge-x'), `${box.nudgeX ?? 0}px`);
    target.style.setProperty(cssVarName(itemKey, 'nudge-y'), `${box.nudgeY ?? 0}px`);
    target.style.setProperty(cssVarName(itemKey, 'track-scale'), String(box.trackScale));
    target.style.setProperty(cssVarName(itemKey, 'pin-scale'), String(box.pinScale));
  }
}

/** Push tuned box onto live DOM so layout cannot drift (tuner + in-game). */
export function applyRecordsItemPositions(layout, root = document) {
  const merged = mergeRecordsLayout(layout);
  const panel = root.getElementById?.('journalRecordsPanel') || root.querySelector?.('#journalRecordsPanel');
  if (!panel) return;

  for (const [itemKey, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    const box = getRecordsItemLayout(itemKey, merged);
    if (!['pane', 'list', 'btn', 'tab', 'scroller', 'text'].includes(meta.kind)) continue;
    const style = {
      position: 'absolute',
      left: `calc(${box.x}% + ${box.nudgeX ?? 0}px)`,
      top: `calc(${box.y}% + ${box.nudgeY ?? 0}px)`,
      margin: '0',
      boxSizing: 'border-box',
    };
    if (meta.kind === 'scroller') {
      style.width = `calc(22px * ${box.trackScale})`;
      style.height = `${box.h}%`;
      style.zIndex = '6';
    } else if (box.w != null) {
      style.width = `${box.w}%`;
    }
    if (meta.kind !== 'scroller' && box.h != null) style.height = `${box.h}%`;

    for (const el of panel.querySelectorAll(`[data-records-item="${itemKey}"]`)) {
      Object.assign(el.style, style);
    }
  }
}

export function applyRecordsLayout(layout, target = document.documentElement) {
  const merged = mergeRecordsLayout(layout);
  const d = merged.dialog || DEFAULT_RECORDS_LAYOUT.dialog;
  target.style.setProperty('--tz-records-max-width', `${d.maxDesignWidth ?? 394}px`);
  target.style.setProperty('--tz-records-display-pad', `${d.displayPad ?? 16}px`);
  target.style.setProperty('--tz-records-top-nudge', `${d.topNudge ?? 0}px`);

  const typo = merged.typography || DEFAULT_RECORDS_LAYOUT.typography;
  target.style.setProperty('--tz-records-field-color', typo.fieldColor || '#3d2e1a');
  target.style.setProperty('--tz-records-field-font', typo.fieldFont || 'calc(0.58rem + 1px)');
  target.style.setProperty('--tz-records-header-font', typo.headerFont || 'calc(0.52rem + 1px)');

  const designW = Number(d.maxDesignWidth ?? 394) || 394;
  const listRow = getRecordsItemLayout('listRow', merged);
  target.style.setProperty(
    '--tz-records-list-row-font-size',
    recordsFontCqi(13.2, designW, listRow.fontScale ?? 1),
  );

  for (const [itemKey, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    if (meta.kind !== 'text') continue;
    const box = getRecordsItemLayout(itemKey, merged);
    target.style.setProperty(
      `--tz-records-field-${meta.cssKey}-font-size`,
      recordsFontCqi(12, designW, box.fontScale ?? 1),
    );
  }

  for (const itemKey of Object.keys(RECORDS_ITEM_DEFS)) {
    const box = getRecordsItemLayout(itemKey, merged);
    const meta = RECORDS_ITEM_DEFS[itemKey];
    applyRecordsBoxVars(target, itemKey, box, meta);
  }
}

export function applyRecordsLayoutEverywhere(layout, root = document) {
  applyRecordsLayout(layout, root.documentElement || document.documentElement);
  const frame = root.getElementById?.('mockFrame')
    || root.querySelector?.('#journalRecordsPanel')?.closest?.('.tz-journal-dialog__frame')
    || root.querySelector?.('.tz-journal-dialog__frame');
  if (frame) applyRecordsLayout(layout, frame);
  applyRecordsItemPositions(layout, root);
}

export function syncRecordsItemVisibility(layout, root = document) {
  const merged = mergeRecordsLayout(layout);
  const panel = root.getElementById?.('journalRecordsPanel') || root.querySelector?.('#journalRecordsPanel');
  if (!panel) return;
  for (const [key, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    const box = getRecordsItemLayout(key, merged);
    const hidden = Boolean(box.hidden);
    if (meta.kind === 'tab') {
      panel.querySelectorAll(`[data-records-tab="${meta.tabKey}"]`).forEach((el) => {
        el.hidden = hidden;
      });
      continue;
    }
    if (meta.cssKey) {
      panel.querySelectorAll(`.tz-records-field--${meta.cssKey}`).forEach((el) => {
        el.hidden = hidden;
      });
    }
  }
  const recordsMode = panel.dataset.recordsMode || 'leaderboard';
  if (recordsMode === 'leaderboard') {
    panel.querySelectorAll('[data-records-item="fieldDailyTime"], .tz-records-field--daily-time').forEach((el) => {
      el.hidden = true;
    });
  }
}

export function applyRecordsTabArt(layout, root = document, activeTab = 'leaderboard') {
  const panel = root.getElementById?.('journalRecordsPanel') || root.querySelector?.('#journalRecordsPanel');
  if (!panel) return;
  for (const tabKey of RECORDS_TAB_KEYS) {
    const btn = panel.querySelector(`[data-records-tab="${tabKey}"]`);
    if (!btn) continue;
    const img = btn.querySelector('.tz-records-tab__art');
    const isActive = tabKey === activeTab;
    const src = getRecordsTabArtSrc(tabKey, layout, { active: isActive });
    if (img && src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
}

export function buildRecordsLayoutReport(layout) {
  const merged = mergeRecordsLayout(layout);
  const lines = ['Records screen layout', ''];
  const d = merged.dialog || {};
  lines.push(`maxDesignWidth: ${d.maxDesignWidth ?? 394}px`);
  lines.push('');
  for (const [key, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    const box = getRecordsItemLayout(key, merged);
    const hiddenNote = box.hidden ? ' hidden' : '';
    if (meta.kind === 'listRow') {
      lines.push(`${meta.label}: fontScale=${box.fontScale} pad=${box.padY}/${box.padX}px gap=${box.gap}px${hiddenNote}`);
    } else if (meta.kind === 'col') {
      lines.push(`${meta.label}: w=${box.w}%${hiddenNote}`);
    } else if (meta.kind === 'scroller') {
      lines.push(`${meta.label}: x=${box.x}% y=${box.y}% h=${box.h}% track=${box.trackScale} pin=${box.pinScale}${hiddenNote}`);
    } else {
      lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w ?? '—'}% h=${box.h ?? '—'}%${hiddenNote}`);
    }
  }
  return lines.join('\n');
}

export async function initRecordsLayout(root = document) {
  const layout = await loadRecordsLayout({ force: false });
  applyRecordsLayoutEverywhere(layout, root);
  syncRecordsItemVisibility(layout, root);
  return layout;
}
