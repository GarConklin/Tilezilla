/** Puzzle Journal layout — positions on NewPuzzleJournalBlank.png (933×1686). */

export const JOURNAL_ART = { w: 933, h: 1686 };

/** Decorative PNG layers stacked on shellBlank (933×1686). Paths in layout.overlays. */
export const JOURNAL_OVERLAY_DEFS = {
  shellBlank: {
    label: 'Shell — blank binder (base layer)',
    isBase: true,
    defaultSrc: '/img/NewPuzzleJournalBlank.png',
  },
  recordTop: {
    label: 'Overlay — Record (current puzzle info)',
    group: 'mode',
    showWhen: { mode: 'record' },
  },
  libraryTop: {
    label: 'Overlay — Library (filters / selector)',
    group: 'mode',
    showWhen: { mode: 'library' },
  },
  tabPuzzle: {
    label: 'Overlay — Tab PUZZLE (active art)',
    group: 'tab',
    showWhen: { tab: 'puzzle' },
  },
  tabStats: {
    label: 'Overlay — Tab STATS',
    group: 'tab',
    showWhen: { tab: 'stats' },
  },
  tabFilter: {
    label: 'Overlay — Tab FILTER',
    group: 'tab',
    showWhen: { tab: 'filter' },
  },
  tabRecords: {
    label: 'Overlay — Tab RECORDS',
    group: 'tab',
    showWhen: { tab: 'records' },
  },
  bottomBar: {
    label: 'Overlay — Bottom button row labels',
    group: 'chrome',
    showWhen: { always: true },
  },
};

const DEFAULT_OVERLAYS = {
  shellBlank: '/img/NewPuzzleJournalBlank.png',
  recordTop: '',
  libraryTop: '',
  tabPuzzle: '',
  tabStats: '',
  tabFilter: '',
  tabRecords: '',
  bottomBar: '',
};

export const JOURNAL_ITEM_DEFS = {
  paneTop: { cssKey: 'pane-top', kind: 'pane', label: 'Upper pane' },
  paneBottomLeft: { cssKey: 'pane-bl', kind: 'pane', label: 'Lower-left pane' },
  paneBottomRight: { cssKey: 'pane-br', kind: 'pane', label: 'Lower-right pane' },
  titleFoundSolutions: { cssKey: 'title-found', kind: 'label', label: 'Title — Found Solutions' },
  titleRecordedPuzzles: { cssKey: 'title-recorded', kind: 'label', label: 'Title — Recorded Puzzles' },
  listScroller: { cssKey: 'list-scroller', kind: 'scroller', label: 'List scroll bar (track + pin)' },
  fieldPuzzleId: { cssKey: 'field-id', kind: 'text', label: 'Puzzle ID' },
  fieldPuzzleType: { cssKey: 'field-type', kind: 'text', label: 'Puzzle Type' },
  fieldBoardSize: { cssKey: 'field-size', kind: 'text', label: 'Board Size' },
  fieldTotalKnown: { cssKey: 'field-total', kind: 'text', label: 'Total Known Solutions' },
  fieldSolutionsFound: { cssKey: 'field-found', kind: 'text', label: 'Solutions Found' },
  fieldFirstSolved: { cssKey: 'field-first', kind: 'text', label: 'First Solved Date' },
  fieldLastPlayed: { cssKey: 'field-last', kind: 'text', label: 'Last Played Date' },
  progressBar: { cssKey: 'progress-bar', kind: 'bar', label: 'Progress bar' },
  solutionPreview: { cssKey: 'solution-preview', kind: 'preview', label: 'Solution preview canvas' },
  selectorBoardSize: { cssKey: 'selector-size', kind: 'pane', label: 'Library — board size area' },
  selectorPuzzleType: { cssKey: 'selector-type', kind: 'pane', label: 'Library — puzzle type area' },
  selectorStatus: { cssKey: 'selector-status', kind: 'pane', label: 'Library — status filter area' },
  tabPuzzle: { cssKey: 'tab-puzzle', kind: 'btn', label: 'Tab — Puzzle' },
  tabStats: { cssKey: 'tab-stats', kind: 'btn', label: 'Tab — Stats' },
  tabFilter: { cssKey: 'tab-filter', kind: 'btn', label: 'Tab — Filter' },
  tabRecords: { cssKey: 'tab-records', kind: 'btn', label: 'Tab — Records' },
  btnFilter: { cssKey: 'btn-filter', kind: 'btn', label: 'Bottom — Filter' },
  btnStats: { cssKey: 'btn-stats', kind: 'btn', label: 'Bottom — Stats' },
  btnPrev: { cssKey: 'btn-prev', kind: 'btn', label: 'Bottom — Prev' },
  btnNext: { cssKey: 'btn-next', kind: 'btn', label: 'Bottom — Next' },
  btnExit: { cssKey: 'btn-exit', kind: 'btn', label: 'Bottom — Exit' },
};

const DEFAULT_ITEMS = {
  paneTop: { x: 8, y: 3, w: 84, h: 42, nudgeX: 0, nudgeY: 0 },
  paneBottomLeft: { x: 8, y: 52, w: 44, h: 32, nudgeX: 0, nudgeY: 0 },
  paneBottomRight: { x: 53, y: 52, w: 39, h: 32, nudgeX: 0, nudgeY: 0 },
  titleFoundSolutions: { x: 10, y: 53.5, w: 40, h: 3, nudgeX: 0, nudgeY: 0 },
  titleRecordedPuzzles: { x: 10, y: 53.5, w: 40, h: 3, nudgeX: 0, nudgeY: 0 },
  listScroller: {
    right: 2, top: 8, height: 84, trackScale: 1, pinScale: 1, nudgeX: 0, nudgeY: 0,
  },
  fieldPuzzleId: { x: 12, y: 7, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldPuzzleType: { x: 12, y: 11.5, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldBoardSize: { x: 12, y: 16, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldTotalKnown: { x: 12, y: 20.5, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldSolutionsFound: { x: 12, y: 25, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldFirstSolved: { x: 12, y: 29.5, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldLastPlayed: { x: 12, y: 34, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  progressBar: { x: 12, y: 38.5, w: 76, h: 2.5, nudgeX: 0, nudgeY: 0 },
  solutionPreview: { x: 55, y: 55, w: 35, h: 26, nudgeX: 0, nudgeY: 0 },
  selectorBoardSize: { x: 10, y: 8, w: 38, h: 32, nudgeX: 0, nudgeY: 0 },
  selectorPuzzleType: { x: 50, y: 8, w: 38, h: 32, nudgeX: 0, nudgeY: 0 },
  selectorStatus: { x: 10, y: 42, w: 78, h: 8, nudgeX: 0, nudgeY: 0 },
  tabPuzzle: { x: 92, y: 6, w: 6, h: 10, nudgeX: 0, nudgeY: 0 },
  tabStats: { x: 92, y: 18, w: 6, h: 10, nudgeX: 0, nudgeY: 0 },
  tabFilter: { x: 92, y: 30, w: 6, h: 10, nudgeX: 0, nudgeY: 0 },
  tabRecords: { x: 92, y: 42, w: 6, h: 10, nudgeX: 0, nudgeY: 0 },
  btnFilter: { x: 8, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnStats: { x: 24, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnPrev: { x: 42, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnNext: { x: 58, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnExit: { x: 76, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
};

export const DEFAULT_JOURNAL_LAYOUT = {
  dialog: {
    artW: 933,
    artH: 1686,
    displayPad: 16,
    maxDesignWidth: 390,
  },
  typography: {
    fieldColor: '#3d2e1a',
    fieldFont: 'calc(0.62rem + 2px)',
    fieldFontLg: 'calc(0.78rem + 2px)',
    labelFont: 'calc(0.55rem + 1px)',
  },
  overlays: DEFAULT_OVERLAYS,
  items: DEFAULT_ITEMS,
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:journal';
const LS_PENDING_KEY = 'tilezilla:layouts:journal:pending';

let layoutCache = null;

export function isJournalTunerPage() {
  return /journal-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearJournalLayoutCache() {
  layoutCache = null;
}

export function mergeJournalLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_JOURNAL_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.typography && typeof raw.typography === 'object') {
    base.typography = { ...base.typography, ...raw.typography };
  }
  if (raw.overlays && typeof raw.overlays === 'object') {
    base.overlays = { ...base.overlays, ...raw.overlays };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!JOURNAL_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...(base.items[key] || {}), ...val };
    }
  }
  return base;
}

export async function loadJournalLayout({ force = false } = {}) {
  if (layoutCache && !force) {
    return JSON.parse(JSON.stringify(layoutCache));
  }

  let raw = null;
  const tunerDraft = isJournalTunerPage()
    && localStorage.getItem(LS_PENDING_KEY) === '1';

  if (tunerDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* fall through */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/journal_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergeJournalLayout(raw);
  return JSON.parse(JSON.stringify(layoutCache));
}

export async function reloadJournalLayout() {
  clearJournalLayoutCache();
  return loadJournalLayout({ force: true });
}

export function getJournalOverlaySrc(overlayKey, layout) {
  const merged = mergeJournalLayout(layout);
  const def = JOURNAL_OVERLAY_DEFS[overlayKey];
  const stored = merged.overlays?.[overlayKey];
  if (typeof stored === 'string' && stored.trim()) return stored.trim();
  if (def?.defaultSrc) return def.defaultSrc;
  return '';
}

export function shouldShowJournalOverlay(overlayKey, { mode = 'record', activeTab = 'puzzle' } = {}) {
  const def = JOURNAL_OVERLAY_DEFS[overlayKey];
  if (!def || def.isBase) return false;
  const when = def.showWhen || {};
  if (when.always) return true;
  if (when.mode && when.mode !== mode) return false;
  if (when.tab && when.tab !== activeTab) return false;
  return true;
}

/**
 * Stack decorative art PNGs on the journal shell. Live data + hit targets stay above overlays.
 * @param {object} layout
 * @param {HTMLElement} frameEl — .tz-journal-dialog__frame
 * @param {{ mode?: string, activeTab?: string }} context
 */
export function applyJournalOverlays(layout, frameEl, { mode = 'record', activeTab = 'puzzle' } = {}) {
  if (!frameEl) return;

  const shellSrc = getJournalOverlaySrc('shellBlank', layout);
  const shellBg = frameEl.querySelector('.tz-journal-dialog__bg');
  if (shellBg && shellSrc) {
    shellBg.src = shellSrc;
  }

  for (const key of Object.keys(JOURNAL_OVERLAY_DEFS)) {
    if (JOURNAL_OVERLAY_DEFS[key].isBase) continue;
    const img = frameEl.querySelector(`[data-journal-overlay="${key}"]`);
    if (!img) continue;
    const src = getJournalOverlaySrc(key, layout);
    const visible = src && shouldShowJournalOverlay(key, { mode, activeTab });
    if (visible) {
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.hidden = false;
    } else {
      img.hidden = true;
    }
  }
}

export function getJournalItemLayout(itemKey, layout) {
  const merged = mergeJournalLayout(layout);
  const fallback = DEFAULT_JOURNAL_LAYOUT.items[itemKey] || {};
  const stored = merged.items?.[itemKey];
  if (!stored || typeof stored !== 'object') return { ...fallback };
  return { ...fallback, ...stored };
}

function varName(cssKey, suffix) {
  return `--tz-journal-${cssKey}-${suffix}`;
}

function applyPaneOrBtn(target, cssKey, item) {
  target.style.setProperty(varName(cssKey, 'x'), String(item.x ?? 0));
  target.style.setProperty(varName(cssKey, 'y'), String(item.y ?? 0));
  target.style.setProperty(varName(cssKey, 'w'), String(item.w ?? 0));
  if (item.h != null) target.style.setProperty(varName(cssKey, 'h'), String(item.h));
  target.style.setProperty(varName(cssKey, 'nudge-x'), `${item.nudgeX ?? 0}px`);
  target.style.setProperty(varName(cssKey, 'nudge-y'), `${item.nudgeY ?? 0}px`);
}

export function applyJournalLayout(layout, target = document.documentElement) {
  const merged = mergeJournalLayout(layout);
  const d = merged.dialog || DEFAULT_JOURNAL_LAYOUT.dialog;
  const t = merged.typography || DEFAULT_JOURNAL_LAYOUT.typography;

  target.style.setProperty('--tz-journal-art-w', String(d.artW ?? JOURNAL_ART.w));
  target.style.setProperty('--tz-journal-art-h', String(d.artH ?? JOURNAL_ART.h));
  target.style.setProperty('--tz-journal-display-pad', `${d.displayPad ?? 16}px`);
  target.style.setProperty('--tz-journal-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-journal-field-color', t.fieldColor ?? '#3d2e1a');
  target.style.setProperty('--tz-journal-field-font', t.fieldFont ?? 'calc(0.62rem + 2px)');
  target.style.setProperty('--tz-journal-field-font-lg', t.fieldFontLg ?? 'calc(0.78rem + 2px)');
  target.style.setProperty('--tz-journal-label-font', t.labelFont ?? 'calc(0.55rem + 1px)');

  for (const [key, meta] of Object.entries(JOURNAL_ITEM_DEFS)) {
    const item = getJournalItemLayout(key, merged);
    const { cssKey, kind } = meta;

    if (kind === 'scroller') {
      target.style.setProperty(varName(cssKey, 'right'), String(item.right ?? 2));
      target.style.setProperty(varName(cssKey, 'top'), String(item.top ?? 8));
      target.style.setProperty(varName(cssKey, 'height'), String(item.height ?? 84));
      target.style.setProperty(varName(cssKey, 'track-scale'), String(item.trackScale ?? 1));
      target.style.setProperty(varName(cssKey, 'pin-scale'), String(item.pinScale ?? 1));
      target.style.setProperty(varName(cssKey, 'nudge-x'), `${item.nudgeX ?? 0}px`);
      target.style.setProperty(varName(cssKey, 'nudge-y'), `${item.nudgeY ?? 0}px`);
      continue;
    }

    applyPaneOrBtn(target, cssKey, item);
  }
}

export function buildJournalLayoutReport(layout) {
  const merged = mergeJournalLayout(layout);
  const lines = [
    `Journal layout report (artboard ${merged.dialog?.artW ?? 933}×${merged.dialog?.artH ?? 1686})`,
    `maxDesignWidth ${merged.dialog?.maxDesignWidth ?? 390}px`,
    '',
    '— Art overlays (PNG paths, stacked on shellBlank) —',
  ];
  for (const [key, def] of Object.entries(JOURNAL_OVERLAY_DEFS)) {
    const src = getJournalOverlaySrc(key, merged);
    lines.push(`${def.label}: ${src || '(not set)'}`);
  }
  lines.push('');
  for (const [key, def] of Object.entries(JOURNAL_ITEM_DEFS)) {
    const item = getJournalItemLayout(key, merged);
    if (def.kind === 'scroller') {
      lines.push(
        `${def.label}: right ${item.right}% · top ${item.top}% · height ${item.height}%`
        + ` · trackScale ${item.trackScale} · pinScale ${item.pinScale}`,
      );
      continue;
    }
    const parts = [`x:${item.x}%`, `y:${item.y}%`, `w:${item.w}%`];
    if (item.h != null) parts.push(`h:${item.h}%`);
    if (item.nudgeX) parts.push(`nudgeX:${item.nudgeX}px`);
    if (item.nudgeY) parts.push(`nudgeY:${item.nudgeY}px`);
    lines.push(`${def.label}: ${parts.join(' · ')}`);
  }
  return lines.join('\n');
}

export function stashJournalLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearJournalLayoutDraft() {
  try {
    localStorage.removeItem(LS_LAYOUT_KEY);
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
