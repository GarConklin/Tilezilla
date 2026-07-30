/** Puzzle Journal — Records screen layout (PuzzleJournal-Records.png, 933×1686). */

export const RECORDS_ART = { w: 933, h: 1686 };

export const RECORDS_TAB_KEYS = ['leaderboard', 'adventure', 'personalBest'];

/** Layout mode keys used by data-records-mode / byMode (personalBest tab → personal). */
export const RECORDS_MODE_KEYS = ['leaderboard', 'adventure', 'personal'];

/**
 * Pane / list / scroller / row spacing — independent per Records tab.
 * Shared chrome (tabs, header, buttons, columns) stays in `items`.
 */
export const RECORDS_MODE_ITEM_KEYS = [
  'paneTop', 'paneBl', 'paneBr',
  'listTop', 'listBl', 'listBr',
  'scrollerTop', 'scrollerBl', 'scrollerBr',
  'listRowTop', 'listRowBl', 'listRowBr',
];

export const DEFAULT_RECORDS_TAB_ART = {
  leaderboard: { idle: '/img/D-LeaderBoard-W.png', active: '/img/D-LeaderBoard-G.png' },
  adventure: { idle: '/img/A-LeaderBoard-W.png', active: '/img/A-LeaderBoard-G.png' },
  personalBest: { idle: '/img/Personal-Best-W.png', active: '/img/Personal-Best-G.png' },
};

/** Shared chrome appears on all three Records sub-tabs. */
const SCREENS_ALL = ['leaderboard', 'adventure', 'personal'];

export const RECORDS_ITEM_DEFS = {
  tabLeaderboard: { cssKey: 'tab-leaderboard', kind: 'tab', label: 'Tab — Daily Leaderboard', tabKey: 'leaderboard', screens: SCREENS_ALL },
  tabAdventure: { cssKey: 'tab-adventure', kind: 'tab', label: 'Tab — Adventure Leaderboard', tabKey: 'adventure', screens: SCREENS_ALL },
  tabPersonalBest: { cssKey: 'tab-personal', kind: 'tab', label: 'Tab — Personal Best', tabKey: 'personalBest', screens: SCREENS_ALL },
  fieldDailyPuzzleId: { cssKey: 'daily-puzzle-id', kind: 'text', label: 'Header — puzzle ID', slot: 'dailyPuzzleId', screens: SCREENS_ALL },
  fieldDailyDate: { cssKey: 'daily-date', kind: 'text', label: 'Header — date', slot: 'dailyDate', screens: SCREENS_ALL },
  fieldDailyTime: { cssKey: 'daily-time', kind: 'text', label: 'Header — time', slot: 'dailyTime', screens: ['personal'] },
  paneTop: { cssKey: 'pane-top', kind: 'pane', label: '0-hint pane', screens: SCREENS_ALL, modeLocal: true, panel: 'top' },
  paneBl: { cssKey: 'pane-bl', kind: 'pane', label: '1-hint pane', screens: SCREENS_ALL, modeLocal: true, panel: 'bl' },
  paneBr: { cssKey: 'pane-br', kind: 'pane', label: '2-hint pane', screens: SCREENS_ALL, modeLocal: true, panel: 'br' },
  listTop: { cssKey: 'list-top', kind: 'list', label: '0-hint list area', screens: SCREENS_ALL, modeLocal: true, panel: 'top' },
  scrollerTop: { cssKey: 'scroller-top', kind: 'scroller', label: '0-hint scroll bar', screens: SCREENS_ALL, modeLocal: true, panel: 'top' },
  listRowTop: { cssKey: 'list-row-top', kind: 'listRow', label: '0-hint row spacing / font', screens: SCREENS_ALL, modeLocal: true, panel: 'top' },
  listBl: { cssKey: 'list-bl', kind: 'list', label: '1-hint list area', screens: SCREENS_ALL, modeLocal: true, panel: 'bl' },
  scrollerBl: { cssKey: 'scroller-bl', kind: 'scroller', label: '1-hint scroll bar', screens: SCREENS_ALL, modeLocal: true, panel: 'bl' },
  listRowBl: { cssKey: 'list-row-bl', kind: 'listRow', label: '1-hint row spacing / font', screens: SCREENS_ALL, modeLocal: true, panel: 'bl' },
  listBr: { cssKey: 'list-br', kind: 'list', label: '2-hint list area', screens: SCREENS_ALL, modeLocal: true, panel: 'br' },
  scrollerBr: { cssKey: 'scroller-br', kind: 'scroller', label: '2-hint scroll bar', screens: SCREENS_ALL, modeLocal: true, panel: 'br' },
  listRowBr: { cssKey: 'list-row-br', kind: 'listRow', label: '2-hint row spacing / font', screens: SCREENS_ALL, modeLocal: true, panel: 'br' },
  listRow: { cssKey: 'list-row', kind: 'listRow', label: '(legacy) shared row spacing', screens: [] },
  colRank: { cssKey: 'col-rank', kind: 'col', label: 'Daily LB — rank', screens: ['leaderboard'] },
  colUser: { cssKey: 'col-user', kind: 'col', label: 'Daily LB — username', screens: ['leaderboard'] },
  colTime: { cssKey: 'col-time', kind: 'col', label: 'Daily/PB — time', screens: ['leaderboard', 'personal'] },
  colAdvRank: { cssKey: 'col-adv-rank', kind: 'col', label: 'Adv LB — rank', screens: ['adventure'] },
  colAdvUser: { cssKey: 'col-adv-user', kind: 'col', label: 'Adv LB — username', screens: ['adventure'] },
  colPaths: { cssKey: 'col-paths', kind: 'col', label: 'Adv LB — paths completed', screens: ['adventure'] },
  colRankName: { cssKey: 'col-rank-name', kind: 'col', label: 'Adv LB — level - sublevel', screens: ['adventure'] },
  colSubLevel: { cssKey: 'col-sub-level', kind: 'col', label: '(legacy) Adv LB — sublevel', screens: [] },
  colAdvTime: { cssKey: 'col-adv-time', kind: 'col', label: 'Adv LB — avg time / puzzle', screens: ['adventure'] },
  colAdvHints: { cssKey: 'col-adv-hints', kind: 'col', label: 'Adv LB — total hints used', screens: ['adventure'] },
  colSize: { cssKey: 'col-size', kind: 'col', label: 'PB column — board size', screens: ['personal'] },
  colPuzzle: { cssKey: 'col-puzzle', kind: 'col', label: 'PB column — puzzle ID', screens: ['personal'] },
  personalPane: { cssKey: 'personal-pane', kind: 'pane', label: '(legacy) personal pane', screens: [] },
  listPersonal: { cssKey: 'list-personal', kind: 'list', label: '(legacy) personal list', screens: [] },
  scrollerPersonal: { cssKey: 'scroller-personal', kind: 'scroller', label: '(legacy) personal scroll', screens: [] },
  btnBack: { cssKey: 'btn-back', kind: 'btn', label: 'Back (gold)', screens: SCREENS_ALL },
  btnClose: { cssKey: 'btn-close', kind: 'btn', label: 'Close (gold X)', screens: SCREENS_ALL },
};

export function normalizeRecordsMode(modeOrTab) {
  if (modeOrTab === 'personalBest' || modeOrTab === 'personal') return 'personal';
  if (modeOrTab === 'adventure') return 'adventure';
  return 'leaderboard';
}

export function detectRecordsMode(root = document) {
  const panel = root.getElementById?.('journalRecordsPanel')
    || root.querySelector?.('#journalRecordsPanel');
  return normalizeRecordsMode(panel?.dataset?.recordsMode || 'leaderboard');
}

export function isRecordsModeItem(itemKey) {
  return RECORDS_MODE_ITEM_KEYS.includes(itemKey);
}

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
    tabAdventure: { x: 88.5, y: 16.5, w: 9.5, h: 11.5, nudgeX: 0, nudgeY: 0 },
    tabPersonalBest: { x: 88.9, y: 28.5, w: 7.8, h: 10.7, nudgeX: 0, nudgeY: 0 },
    fieldDailyPuzzleId: { x: 10, y: 13.2, w: 34, h: 3.2, fontScale: 1.15, nudgeX: 0, nudgeY: 0 },
    fieldDailyDate: { x: 44, y: 13.2, w: 32, h: 3.2, fontScale: 1.05, nudgeX: 0, nudgeY: 0 },
    fieldDailyTime: { x: 76, y: 13.2, w: 14, h: 3.2, fontScale: 1.15, nudgeX: 0, nudgeY: 0 },
    paneTop: { x: 10.6, y: 15.3, w: 74, h: 32.1, nudgeX: 0, nudgeY: 0 },
    paneBl: { x: 8.4, y: 61.4, w: 37, h: 30.2, nudgeX: 0, nudgeY: 0 },
    paneBr: { x: 49, y: 61.5, w: 36, h: 30, nudgeX: 0, nudgeY: 0 },
    /* List areas are % inside their pane (not the full Records frame). */
    listTop: { x: 3, y: 12, w: 92, h: 84, nudgeX: 0, nudgeY: 0 },
    scrollerTop: { x: 84.5, y: 22, h: 24, trackScale: 0.55, pinScale: 0.66, nudgeX: 0, nudgeY: 0 },
    listRowTop: { fontScale: 1, padY: 4, padX: 6, gap: 2 },
    listBl: { x: 3, y: 14, w: 90, h: 82, nudgeX: 0, nudgeY: 0 },
    scrollerBl: { x: 43.5, y: 56, h: 20, trackScale: 0.5, pinScale: 0.66, nudgeX: 0, nudgeY: 0 },
    listRowBl: { fontScale: 1, padY: 4, padX: 6, gap: 2 },
    listBr: { x: 3, y: 14, w: 90, h: 82, nudgeX: 0, nudgeY: 0 },
    scrollerBr: { x: 85.5, y: 56, h: 20, trackScale: 0.5, pinScale: 0.66, nudgeX: 0, nudgeY: 0 },
    listRowBr: { fontScale: 1, padY: 4, padX: 6, gap: 2 },
    listRow: { fontScale: 1, padY: 4, padX: 6, gap: 2 },
    colRank: { w: 18 },
    colUser: { w: 52 },
    colTime: { w: 30 },
    colAdvRank: { w: 8 },
    colAdvUser: { w: 20 },
    colPaths: { w: 10 },
    colRankName: { w: 26 },
    colSubLevel: { w: 0, hidden: true },
    colAdvTime: { w: 16 },
    colAdvHints: { w: 20 },
    colSize: { w: 22 },
    colPuzzle: { w: 48 },
    personalPane: { x: 7.5, y: 16.5, w: 79, h: 64, nudgeX: 0, nudgeY: 0, hidden: true },
    listPersonal: { x: 10, y: 22, w: 74, h: 56, nudgeX: 0, nudgeY: 0, hidden: true },
    scrollerPersonal: { x: 84.5, y: 22, h: 56, trackScale: 0.55, pinScale: 0.66, nudgeX: 0, nudgeY: 0, hidden: true },
    btnBack: { x: 6.2, y: 1.9, w: 9, h: 5.2, nudgeX: 0, nudgeY: 0, hidden: false },
    btnClose: { x: 78.2, y: 1.4, w: 9, h: 5.2, nudgeX: 0, nudgeY: 0, hidden: false },
  },
  byMode: {},
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

function cloneDefaultModeItems(sharedItems = {}) {
  const legacyRow = sharedItems.listRow || DEFAULT_RECORDS_LAYOUT.items.listRow;
  const out = {};
  for (const key of RECORDS_MODE_ITEM_KEYS) {
    const def = DEFAULT_RECORDS_LAYOUT.items[key] || {};
    if (key.startsWith('listRow')) {
      out[key] = { ...def, ...legacyRow };
      continue;
    }
    if (key.startsWith('list')) {
      // Pane-relative insets — do not import old frame-absolute list coords.
      out[key] = { ...def };
      continue;
    }
    const fromShared = sharedItems[key];
    out[key] = fromShared && typeof fromShared === 'object'
      ? mergeBox(def, fromShared)
      : { ...def };
  }
  return out;
}

function normalizeBox(def, box) {
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

export function mergeRecordsLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RECORDS_LAYOUT));
  if (!raw || typeof raw !== 'object') {
    base.byMode = {
      leaderboard: cloneDefaultModeItems(base.items),
      adventure: cloneDefaultModeItems(base.items),
      personal: cloneDefaultModeItems(base.items),
    };
    return base;
  }
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

  const seeded = cloneDefaultModeItems(base.items);
  base.byMode = {
    leaderboard: JSON.parse(JSON.stringify(seeded)),
    adventure: JSON.parse(JSON.stringify(seeded)),
    personal: JSON.parse(JSON.stringify(seeded)),
  };
  if (raw.byMode && typeof raw.byMode === 'object') {
    for (const mode of RECORDS_MODE_KEYS) {
      const modeRaw = raw.byMode[mode];
      if (!modeRaw || typeof modeRaw !== 'object') continue;
      for (const key of RECORDS_MODE_ITEM_KEYS) {
        if (modeRaw[key] && typeof modeRaw[key] === 'object') {
          base.byMode[mode][key] = mergeBox(base.byMode[mode][key] || {}, modeRaw[key]);
        }
      }
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

export function getRecordsItemLayout(itemKey, layout, mode = null) {
  const merged = mergeRecordsLayout(layout);
  const def = DEFAULT_RECORDS_LAYOUT.items[itemKey] || {};
  let box = merged.items[itemKey] || {};
  if (isRecordsModeItem(itemKey)) {
    const modeKey = normalizeRecordsMode(mode || 'leaderboard');
    const modeBox = merged.byMode?.[modeKey]?.[itemKey];
    if (modeBox && typeof modeBox === 'object') {
      box = modeBox;
    }
  }
  return normalizeBox(def, box);
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

function applyRecordsBoxVars(target, itemKey, box, meta, designW = 394) {
  if (meta.kind === 'col') {
    target.style.setProperty(cssVarName(itemKey, 'w'), `${box.w}%`);
    return;
  }
  if (meta.kind === 'listRow') {
    target.style.setProperty(cssVarName(itemKey, 'font-scale'), String(box.fontScale));
    target.style.setProperty(cssVarName(itemKey, 'pad-x'), `${box.padX}px`);
    target.style.setProperty(cssVarName(itemKey, 'pad-y'), `${box.padY}px`);
    target.style.setProperty(cssVarName(itemKey, 'gap'), `${box.gap}px`);
    target.style.setProperty(
      cssVarName(itemKey, 'font-size'),
      recordsFontCqi(10.3, designW, box.fontScale ?? 1),
    );
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
export function applyRecordsItemPositions(layout, root = document, mode = null) {
  const merged = mergeRecordsLayout(layout);
  const modeKey = normalizeRecordsMode(mode || detectRecordsMode(root));
  const panel = root.getElementById?.('journalRecordsPanel') || root.querySelector?.('#journalRecordsPanel');
  if (!panel) return;

  for (const [itemKey, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    if (!['pane', 'list', 'btn', 'tab', 'scroller', 'text'].includes(meta.kind)) continue;
    if (meta.screens && meta.screens.length === 0) continue;
    const box = getRecordsItemLayout(itemKey, merged, modeKey);
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

export function applyRecordsLayout(layout, target = document.documentElement, mode = null) {
  const merged = mergeRecordsLayout(layout);
  const modeKey = normalizeRecordsMode(mode || 'leaderboard');
  const d = merged.dialog || DEFAULT_RECORDS_LAYOUT.dialog;
  target.style.setProperty('--tz-records-max-width', `${d.maxDesignWidth ?? 394}px`);
  target.style.setProperty('--tz-records-display-pad', `${d.displayPad ?? 16}px`);
  target.style.setProperty('--tz-records-top-nudge', `${d.topNudge ?? 0}px`);

  const typo = merged.typography || DEFAULT_RECORDS_LAYOUT.typography;
  target.style.setProperty('--tz-records-field-color', typo.fieldColor || '#3d2e1a');
  target.style.setProperty('--tz-records-field-font', typo.fieldFont || 'calc(0.58rem + 1px)');
  target.style.setProperty('--tz-records-header-font', typo.headerFont || 'calc(0.52rem + 1px)');

  const designW = Number(d.maxDesignWidth ?? 394) || 394;
  // Legacy fallback used when a pane-specific row font is missing.
  const legacyRow = getRecordsItemLayout('listRowTop', merged, modeKey);
  target.style.setProperty(
    '--tz-records-list-row-font-size',
    recordsFontCqi(10.3, designW, legacyRow.fontScale ?? 1),
  );
  target.style.setProperty('--tz-records-list-row-pad-x', `${legacyRow.padX ?? 6}px`);
  target.style.setProperty('--tz-records-list-row-pad-y', `${legacyRow.padY ?? 4}px`);
  target.style.setProperty('--tz-records-list-row-gap', `${legacyRow.gap ?? 2}px`);

  for (const [itemKey, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    if (meta.kind !== 'text') continue;
    const box = getRecordsItemLayout(itemKey, merged, modeKey);
    target.style.setProperty(
      `--tz-records-field-${meta.cssKey}-font-size`,
      recordsFontCqi(10.3, designW, box.fontScale ?? 1),
    );
  }

  for (const itemKey of Object.keys(RECORDS_ITEM_DEFS)) {
    const meta = RECORDS_ITEM_DEFS[itemKey];
    if (meta.screens && meta.screens.length === 0) continue;
    const box = getRecordsItemLayout(itemKey, merged, modeKey);
    applyRecordsBoxVars(target, itemKey, box, meta, designW);
  }
}

export function applyRecordsLayoutEverywhere(layout, root = document, mode = null) {
  const modeKey = normalizeRecordsMode(mode || detectRecordsMode(root));
  applyRecordsLayout(layout, root.documentElement || document.documentElement, modeKey);
  const frame = root.getElementById?.('mockFrame')
    || root.querySelector?.('#journalRecordsPanel')?.closest?.('.tz-journal-dialog__frame')
    || root.querySelector?.('.tz-journal-dialog__frame');
  if (frame) applyRecordsLayout(layout, frame, modeKey);
  applyRecordsItemPositions(layout, root, modeKey);
}

export function syncRecordsItemVisibility(layout, root = document, mode = null) {
  const merged = mergeRecordsLayout(layout);
  const modeKey = normalizeRecordsMode(mode || detectRecordsMode(root));
  const panel = root.getElementById?.('journalRecordsPanel') || root.querySelector?.('#journalRecordsPanel');
  if (!panel) return;
  for (const [key, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    const box = getRecordsItemLayout(key, merged, modeKey);
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
  if (modeKey === 'leaderboard' || modeKey === 'adventure') {
    panel.querySelectorAll('[data-records-item="fieldDailyTime"], .tz-records-field--daily-time').forEach((el) => {
      el.hidden = true;
    });
  }
  // Adventure: single bottom list (11+), no 1-hint / 2-hint split panes.
  if (modeKey === 'adventure') {
    panel.querySelectorAll(
      '[data-records-item="paneBr"], [data-records-item="scrollerBr"], .tz-records-field--pane-br, .tz-records-field--scroller-br',
    ).forEach((el) => {
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

export function buildRecordsLayoutReport(layout, mode = null) {
  const merged = mergeRecordsLayout(layout);
  const modeKey = normalizeRecordsMode(mode || 'leaderboard');
  const lines = ['Records screen layout', `Active tab mode: ${modeKey}`, ''];
  const d = merged.dialog || {};
  lines.push(`maxDesignWidth: ${d.maxDesignWidth ?? 394}px`);
  lines.push('');
  for (const [key, meta] of Object.entries(RECORDS_ITEM_DEFS)) {
    if (meta.screens && meta.screens.length === 0) continue;
    const box = getRecordsItemLayout(key, merged, modeKey);
    const hiddenNote = box.hidden ? ' hidden' : '';
    const modeNote = isRecordsModeItem(key) ? ` [${modeKey}]` : '';
    if (meta.kind === 'listRow') {
      lines.push(`${meta.label}${modeNote}: fontScale=${box.fontScale} pad=${box.padY}/${box.padX}px gap=${box.gap}px${hiddenNote}`);
    } else if (meta.kind === 'col') {
      lines.push(`${meta.label}: w=${box.w}%${hiddenNote}`);
    } else if (meta.kind === 'scroller') {
      lines.push(`${meta.label}${modeNote}: x=${box.x}% y=${box.y}% h=${box.h}% track=${box.trackScale} pin=${box.pinScale}${hiddenNote}`);
    } else {
      lines.push(`${meta.label}${modeNote}: x=${box.x}% y=${box.y}% w=${box.w ?? '—'}% h=${box.h ?? '—'}%${hiddenNote}`);
    }
  }
  return lines.join('\n');
}

export async function initRecordsLayout(root = document) {
  const layout = await loadRecordsLayout({ force: false });
  const mode = detectRecordsMode(root);
  applyRecordsLayoutEverywhere(layout, root, mode);
  syncRecordsItemVisibility(layout, root, mode);
  return layout;
}
