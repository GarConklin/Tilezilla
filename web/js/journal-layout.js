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
  statsScreen: {
    label: 'Overlay — Stats (full journal screen)',
    group: 'tab',
    showWhen: { tab: 'stats' },
    defaultSrc: '/img/PuzzleJournal-Stats.png',
  },
  recordsScreen: {
    label: 'Overlay — Records (full journal screen)',
    group: 'tab',
    showWhen: { tab: 'records' },
    defaultSrc: '/img/PuzzleJournal-Records.png',
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
  statsScreen: '/img/PuzzleJournal-Stats.png',
  recordsScreen: '/img/PuzzleJournal-Records.png',
  bottomBar: '',
};

/** Side tab PNGs — idle (-W) and active (-G) per tab. Override via layout JSON `tabs`. */
export const JOURNAL_TAB_KEYS = ['puzzle', 'stats', 'filter', 'records'];

/** Tab PNG art is 98×194px on the 933×1686 artboard. */
export const JOURNAL_TAB_ART_PX = { w: 98, h: 194 };

/** Measured tab top edges on NewPuzzleJournalBlank.png (art px) — top to bottom: Filter, Puzzle, Stats, Records. */
export const JOURNAL_TAB_TOPS_PX = {
  filter: 88,
  puzzle: 300,
  stats: 512,
  records: 724,
};

export function journalTabItemFromArtTop(topPx) {
  const tabW = JOURNAL_TAB_ART_PX.w;
  const tabH = JOURNAL_TAB_ART_PX.h;
  return {
    x: Math.round(((JOURNAL_ART.w - tabW) / JOURNAL_ART.w) * 1000) / 10,
    y: Math.round((topPx / JOURNAL_ART.h) * 1000) / 10,
    w: Math.round((tabW / JOURNAL_ART.w) * 1000) / 10,
    h: Math.round((tabH / JOURNAL_ART.h) * 1000) / 10,
    nudgeX: 0,
    nudgeY: 0,
  };
}

export const DEFAULT_JOURNAL_TAB_ART = {
  puzzle: { idle: '/img/PuzzleTab-W.png', active: '/img/PuzzleTab-G.png' },
  stats: { idle: '/img/StatsTab-W.png', active: '/img/StatsTab-G.png' },
  filter: { idle: '/img/FilterTab-W.png', active: '/img/FilterTab-G.png' },
  records: { idle: '/img/RecordsTab-W.png', active: '/img/RecordsTab-G.png' },
};

export const JOURNAL_ITEM_DEFS = {
  paneTop: { cssKey: 'pane-top', kind: 'pane', label: 'Upper pane' },
  paneBottomLeft: { cssKey: 'pane-bl', kind: 'pane', label: 'Lower-left pane' },
  paneBottomRight: { cssKey: 'pane-br', kind: 'pane', label: 'Lower-right pane' },
  listTitleBar: { cssKey: 'list-title-bar', kind: 'listArea', label: 'List title bar', paneParent: 'paneBottomLeft' },
  titleFoundSolutions: { cssKey: 'title-found', kind: 'titleBarChild', label: 'Title — Found Solutions', titleBarParent: 'listTitleBar' },
  titleRecordedPuzzles: { cssKey: 'title-recorded', kind: 'titleBarChild', label: 'Title — Recorded Puzzles', titleBarParent: 'listTitleBar' },
  listScroller: { cssKey: 'list-scroller', kind: 'scroller', label: 'List scroll bar (track + pin)' },
  listContent: { cssKey: 'list-content', kind: 'listArea', label: 'List content area (puzzles / solutions)' },
  listRow: { cssKey: 'list-row', kind: 'list', label: 'List row size (solutions & puzzles)' },
  listRowMain: { cssKey: 'list-row-main', kind: 'listPart', label: 'List row — puzzle ID' },
  listRowDetail: { cssKey: 'list-row-detail', kind: 'listPart', label: 'List row — Adv_ID / release date' },
  listRowSub: { cssKey: 'list-row-sub', kind: 'listPart', label: 'List row — progress / stats line' },
  fieldPuzzleId: { cssKey: 'field-id', kind: 'text', label: 'Puzzle ID' },
  fieldPuzzleType: { cssKey: 'field-type', kind: 'text', label: 'Puzzle Type' },
  fieldBoardSize: { cssKey: 'field-size', kind: 'text', label: 'Board Size' },
  fieldTotalKnown: { cssKey: 'field-total', kind: 'text', label: 'Total Known Solutions' },
  fieldSolutionsFound: { cssKey: 'field-found', kind: 'text', label: 'Solutions Found' },
  fieldFirstSolved: { cssKey: 'field-first', kind: 'text', label: 'First Solved Date' },
  fieldLastPlayed: { cssKey: 'field-last', kind: 'text', label: 'Last Played Date' },
  progressBar: { cssKey: 'progress-bar', kind: 'bar', label: 'Progress bar' },
  solutionPreview: { cssKey: 'solution-preview', kind: 'preview', label: 'Solution preview canvas' },
  btnBeginSearch: { cssKey: 'btn-begin-search', kind: 'paneBtn', label: 'Begin Search button' },
  selectorBoardSize: { cssKey: 'selector-size', kind: 'pane', label: 'Library — board size area' },
  selectorPuzzleType: { cssKey: 'selector-type', kind: 'pane', label: 'Library — puzzle type area' },
  selectorStatus: { cssKey: 'selector-status', kind: 'pane', label: 'Library — status filter area' },
  tabPuzzle: { cssKey: 'tab-puzzle', kind: 'btn', label: 'Tab — Puzzle', tabKey: 'puzzle' },
  tabStats: { cssKey: 'tab-stats', kind: 'btn', label: 'Tab — Stats', tabKey: 'stats' },
  tabFilter: { cssKey: 'tab-filter', kind: 'btn', label: 'Tab — Filter', tabKey: 'filter' },
  tabRecords: { cssKey: 'tab-records', kind: 'btn', label: 'Tab — Records', tabKey: 'records' },
  btnFilter: { cssKey: 'btn-filter', kind: 'btn', label: 'Bottom — Filter' },
  btnStats: { cssKey: 'btn-stats', kind: 'btn', label: 'Bottom — Stats' },
  btnPrev: { cssKey: 'btn-prev', kind: 'btn', label: 'Bottom — Prev' },
  btnNext: { cssKey: 'btn-next', kind: 'btn', label: 'Bottom — Next' },
  btnExit: { cssKey: 'btn-exit', kind: 'btn', label: 'Bottom — Exit' },
  btnLibraryBack: { cssKey: 'btn-library-back', kind: 'btn', label: 'Library back (filter → puzzle)' },
};

/** Canonical puzzle-record journal layout — game + tuner share this via journal_layout.json. */
export const RECORD_PUZZLE_JOURNAL_ITEMS = {
  solutionPreview: { space: 'pane', x: 4, y: 4, w: 92, h: 92, nudgeX: 0, nudgeY: 0 },
  btnBeginSearch: { space: 'pane', x: 5, y: 38, w: 90, h: 22, nudgeX: 0, nudgeY: 0 },
  listContent: { space: 'pane', x: 9, y: 2, w: 89, h: 96, nudgeX: 1, nudgeY: 10 },
  listScroller: {
    space: 'pane', x: 0, y: 2, h: 96, trackScale: 0.34, pinScale: 0.66, nudgeX: 1, nudgeY: 10,
  },
  listRow: { fontScale: 0.62, padX: 4, padY: 2, gap: 1 },
  listRowMain: { fontScale: 1 },
  listRowDetail: { fontScale: 0.92 },
  listRowSub: { fontScale: 1 },
  fieldBoardSize: { x: 10, y: 7, w: 13, h: 5, nudgeX: 0, nudgeY: 0 },
  fieldPuzzleId: { x: 23, y: 7, w: 48, h: 5, nudgeX: 14, nudgeY: 0 },
  fieldPuzzleType: { x: 10, y: 14, w: 28, h: 5, nudgeX: 0, nudgeY: 0 },
  fieldTotalKnown: { x: 10, y: 20, w: 28, h: 5, nudgeX: 0, nudgeY: 0 },
  fieldSolutionsFound: { x: 42, y: 20, w: 34, h: 5, nudgeX: 0, nudgeY: 0 },
  progressBar: { x: 42, y: 16, w: 34, h: 2.5, nudgeX: 0, nudgeY: 58 },
  fieldFirstSolved: { x: 22, y: 29, w: 56, h: 5, nudgeX: 0, nudgeY: 12 },
  fieldLastPlayed: { x: 22, y: 37, w: 56, h: 5, nudgeX: 0, nudgeY: 0 },
};

export function mergeRecordPuzzleJournalLayout(base) {
  if (!base) return null;
  return {
    ...base,
    items: {
      ...(base.items || {}),
      ...RECORD_PUZZLE_JOURNAL_ITEMS,
    },
  };
}

const DEFAULT_ITEMS = {
  paneTop: { x: 8, y: 3, w: 84, h: 42, nudgeX: 0, nudgeY: 0 },
  paneBottomLeft: { x: 8, y: 52, w: 44, h: 32, nudgeX: 0, nudgeY: 0 },
  paneBottomRight: { x: 53, y: 52, w: 39, h: 32, nudgeX: 0, nudgeY: 0 },
  listTitleBar: {
    space: 'pane', x: 2, y: 1, w: 96, h: 10, nudgeX: 0, nudgeY: 0,
  },
  titleFoundSolutions: {
    space: 'titleBar', x: 4, y: 10, w: 92, h: 80, nudgeX: 0, nudgeY: 0,
  },
  titleRecordedPuzzles: {
    space: 'titleBar', x: 4, y: 10, w: 92, h: 80, nudgeX: 0, nudgeY: 0,
  },
  listScroller: {
    space: 'pane', x: 1, y: 10, h: 88, trackScale: 0.22, pinScale: 1, nudgeX: 0, nudgeY: 0,
  },
  listContent: {
    space: 'pane', x: 10, y: 12, w: 88, h: 86, nudgeX: 0, nudgeY: 0,
  },
  listRow: { fontScale: 1, padX: 8, padY: 6, gap: 4 },
  listRowMain: { fontScale: 1 },
  listRowDetail: { fontScale: 0.92 },
  listRowSub: { fontScale: 1 },
  fieldPuzzleId: { x: 12, y: 7, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldPuzzleType: { x: 12, y: 11.5, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldBoardSize: { x: 12, y: 16, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldTotalKnown: { x: 12, y: 20.5, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldSolutionsFound: { x: 12, y: 25, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldFirstSolved: { x: 12, y: 29.5, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  fieldLastPlayed: { x: 12, y: 34, w: 76, h: 4.5, nudgeX: 0, nudgeY: 0 },
  progressBar: { x: 12, y: 38.5, w: 76, h: 2.5, nudgeX: 0, nudgeY: 0 },
  solutionPreview: {
    space: 'pane', x: 16, y: 16, w: 68, h: 68, nudgeX: 0, nudgeY: 0,
  },
  btnBeginSearch: {
    space: 'pane', x: 5, y: 38, w: 90, h: 22, nudgeX: 0, nudgeY: 0,
  },
  selectorBoardSize: { x: 10, y: 8, w: 38, h: 32, nudgeX: 0, nudgeY: 0 },
  selectorPuzzleType: { x: 50, y: 8, w: 38, h: 32, nudgeX: 0, nudgeY: 0 },
  selectorStatus: { x: 10, y: 42, w: 78, h: 8, nudgeX: 0, nudgeY: 0 },
  tabPuzzle: { ...journalTabItemFromArtTop(JOURNAL_TAB_TOPS_PX.puzzle) },
  tabStats: { ...journalTabItemFromArtTop(JOURNAL_TAB_TOPS_PX.stats) },
  tabFilter: { ...journalTabItemFromArtTop(JOURNAL_TAB_TOPS_PX.filter) },
  tabRecords: { ...journalTabItemFromArtTop(JOURNAL_TAB_TOPS_PX.records) },
  btnFilter: { x: 8, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnStats: { x: 24, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnPrev: { x: 42, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnNext: { x: 58, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnExit: { x: 76, y: 88, w: 14, h: 5, nudgeX: 0, nudgeY: 0 },
  btnLibraryBack: { x: 94, y: 88, w: 9, h: 5.5, nudgeX: 8, nudgeY: 26 },
};

export const DEFAULT_JOURNAL_LAYOUT = {
  dialog: {
    artW: 933,
    artH: 1686,
    displayPad: 16,
    maxDesignWidth: 390,
    topNudge: 0,
  },
  typography: {
    fieldColor: '#3d2e1a',
    fieldFont: 'calc(0.62rem + 2px)',
    fieldFontLg: 'calc(0.78rem + 2px)',
    labelFont: 'calc(0.55rem + 1px)',
  },
  overlays: DEFAULT_OVERLAYS,
  tabs: JSON.parse(JSON.stringify(DEFAULT_JOURNAL_TAB_ART)),
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
  if (raw.tabs && typeof raw.tabs === 'object') {
    for (const [key, val] of Object.entries(raw.tabs)) {
      if (!DEFAULT_JOURNAL_TAB_ART[key] || typeof val !== 'object') continue;
      base.tabs[key] = { ...(base.tabs[key] || {}), ...val };
    }
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

export function getJournalTabArtSrc(tabKey, layout, { active = false } = {}) {
  const merged = mergeJournalLayout(layout);
  const stored = merged.tabs?.[tabKey];
  const defaults = DEFAULT_JOURNAL_TAB_ART[tabKey];
  if (!defaults) return '';
  const path = active ? (stored?.active || defaults.active) : (stored?.idle || defaults.idle);
  return typeof path === 'string' ? path.trim() : '';
}

/**
 * Swap side-tab button PNGs (idle vs active) on journal tab hit targets.
 * @param {object} layout
 * @param {HTMLElement} frameEl — .tz-journal-dialog__frame
 * @param {string} activeTab — puzzle | stats | filter | records
 */
export function applyJournalTabArt(layout, frameEl, activeTab = 'puzzle') {
  if (!frameEl) return;
  for (const tabKey of JOURNAL_TAB_KEYS) {
    const btn = frameEl.querySelector(`[data-journal-tab="${tabKey}"]`);
    const img = btn?.querySelector('.tz-journal-tab__art');
    if (!btn || !img) continue;
    const isActive = tabKey === activeTab;
    const src = getJournalTabArtSrc(tabKey, layout, { active: isActive });
    if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
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
  if (when.tab) return when.tab === activeTab;
  if (when.mode) {
    if (when.mode !== mode) return false;
    if (activeTab === 'stats' || activeTab === 'records') return false;
    return true;
  }
  return false;
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

  applyJournalTabArt(layout, frameEl, activeTab);
}

export function getJournalItemLayout(itemKey, layout) {
  const merged = mergeJournalLayout(layout);
  const def = JOURNAL_ITEM_DEFS[itemKey] || {};
  const fallback = DEFAULT_JOURNAL_LAYOUT.items[itemKey] || {};
  const stored = merged.items?.[itemKey];
  if (!stored || typeof stored !== 'object') {
    if (itemKey === 'listScroller') return normalizeScrollerItem({ ...fallback }, merged);
    if (itemKey === 'listContent') return normalizeListAreaItem({ ...fallback }, merged, 'paneBottomLeft');
    if (itemKey === 'listTitleBar') return normalizeListAreaItem({ ...fallback }, merged, 'paneBottomLeft');
    if (def.kind === 'titleBarChild') return normalizeTitleBarChildItem({ ...fallback }, merged, def.titleBarParent);
    if (itemKey === 'solutionPreview' || def.kind === 'paneBtn') {
      return normalizePaneBottomRightItem({ ...fallback }, merged);
    }
    return { ...fallback };
  }
  const item = { ...fallback, ...stored };
  if (itemKey === 'listScroller') return normalizeScrollerItem(item, merged);
  if (itemKey === 'listContent') return normalizeListAreaItem(item, merged, 'paneBottomLeft');
  if (itemKey === 'listTitleBar') return normalizeListAreaItem(item, merged, 'paneBottomLeft');
  if (def.kind === 'titleBarChild') return normalizeTitleBarChildItem(item, merged, def.titleBarParent);
  if (itemKey === 'solutionPreview' || def.kind === 'paneBtn') {
    return normalizePaneBottomRightItem(item, merged);
  }
  return item;
}

/** listScroller / listContent x/y/w/h are % inside paneBottomLeft (not the full journal frame). */
function getPaneBottomLeftLayout(mergedLayout) {
  const paneFallback = DEFAULT_JOURNAL_LAYOUT.items.paneBottomLeft || {};
  const paneStored = mergedLayout.items?.paneBottomLeft;
  return { ...paneFallback, ...(paneStored && typeof paneStored === 'object' ? paneStored : {}) };
}

/** solutionPreview x/y/w/h are % inside paneBottomRight (not the full journal frame). */
function getPaneBottomRightLayout(mergedLayout) {
  const paneFallback = DEFAULT_JOURNAL_LAYOUT.items.paneBottomRight || {};
  const paneStored = mergedLayout.items?.paneBottomRight;
  return { ...paneFallback, ...(paneStored && typeof paneStored === 'object' ? paneStored : {}) };
}

function getPaneLayout(mergedLayout, paneKey) {
  if (paneKey === 'paneBottomRight') return getPaneBottomRightLayout(mergedLayout);
  return getPaneBottomLeftLayout(mergedLayout);
}

function normalizeScrollerItem(item, mergedLayout) {
  const pane = getPaneBottomLeftLayout(mergedLayout);

  if (item.space === 'pane') {
    return { space: 'pane', ...item };
  }

  if (item.right != null || item.top != null) {
    const right = item.right ?? 2;
    const top = item.top ?? 8;
    const height = item.height ?? 84;
    return {
      space: 'pane',
      x: Math.round((100 - right) * 10) / 10,
      y: Math.round(top * 10) / 10,
      h: Math.round(height * 10) / 10,
      trackScale: item.trackScale,
      pinScale: item.pinScale,
      nudgeX: item.nudgeX ?? 0,
      nudgeY: item.nudgeY ?? 0,
    };
  }

  if (item.x != null && item.h != null) {
    const looksPaneRelative = item.h > 55;
    const px = pane.x ?? 8;
    const py = pane.y ?? 52;
    const pw = pane.w ?? 44;
    const ph = pane.h ?? 32;
    if (!looksPaneRelative && item.x >= px - 1) {
      return {
        space: 'pane',
        x: Math.round(((item.x - px) / pw) * 1000) / 10,
        y: Math.round(((item.y - py) / ph) * 1000) / 10,
        h: Math.round((item.h / ph) * 1000) / 10,
        trackScale: item.trackScale,
        pinScale: item.pinScale,
        nudgeX: item.nudgeX ?? 0,
        nudgeY: item.nudgeY ?? 0,
      };
    }
    return {
      space: 'pane',
      x: item.x,
      y: item.y ?? 7,
      h: item.h,
      trackScale: item.trackScale,
      pinScale: item.pinScale,
      nudgeX: item.nudgeX ?? 0,
      nudgeY: item.nudgeY ?? 0,
    };
  }

  return { space: 'pane', ...item };
}

function normalizeListAreaItem(item, mergedLayout, paneKey = 'paneBottomLeft') {
  if (item.space === 'pane') {
    return { space: 'pane', ...item };
  }
  const pane = getPaneLayout(mergedLayout, paneKey);
  const px = pane.x ?? 8;
  const py = pane.y ?? 52;
  const pw = pane.w ?? 44;
  const ph = pane.h ?? 32;
  if (item.x != null && item.w != null && item.x >= px - 1) {
    return {
      space: 'pane',
      x: Math.round(((item.x - px) / pw) * 1000) / 10,
      y: Math.round(((item.y - py) / ph) * 1000) / 10,
      w: Math.round((item.w / pw) * 1000) / 10,
      h: Math.round((item.h / ph) * 1000) / 10,
      nudgeX: item.nudgeX ?? 0,
      nudgeY: item.nudgeY ?? 0,
    };
  }
  return {
    space: 'pane',
    x: item.x ?? 12,
    y: item.y ?? 4,
    w: item.w ?? 82,
    h: item.h ?? 92,
    nudgeX: item.nudgeX ?? 0,
    nudgeY: item.nudgeY ?? 0,
  };
}

function normalizeTitleBarChildItem(item, mergedLayout, titleBarKey = 'listTitleBar') {
  if (item.space === 'titleBar') {
    return { space: 'titleBar', ...item };
  }
  const titleBar = normalizeListAreaItem(
    getJournalItemLayout(titleBarKey, mergedLayout),
    mergedLayout,
    'paneBottomLeft',
  );
  const pane = getPaneBottomLeftLayout(mergedLayout);
  const barX = (pane.x ?? 8) + ((titleBar.x ?? 2) / 100) * (pane.w ?? 44);
  const barY = (pane.y ?? 52) + ((titleBar.y ?? 1) / 100) * (pane.h ?? 32);
  const barW = ((titleBar.w ?? 96) / 100) * (pane.w ?? 44);
  const barH = ((titleBar.h ?? 8) / 100) * (pane.h ?? 32);
  if (item.x != null && item.w != null && item.x >= barX - 1) {
    return {
      space: 'titleBar',
      x: Math.round(((item.x - barX) / barW) * 1000) / 10,
      y: Math.round(((item.y - barY) / barH) * 1000) / 10,
      w: Math.round((item.w / barW) * 1000) / 10,
      h: Math.round((item.h / barH) * 1000) / 10,
      nudgeX: item.nudgeX ?? 0,
      nudgeY: item.nudgeY ?? 0,
    };
  }
  return {
    space: 'titleBar',
    x: item.x ?? 4,
    y: item.y ?? 10,
    w: item.w ?? 92,
    h: item.h ?? 80,
    nudgeX: item.nudgeX ?? 0,
    nudgeY: item.nudgeY ?? 0,
  };
}

function normalizePaneBottomRightItem(item, mergedLayout) {
  if (item.space === 'pane') {
    return { space: 'pane', ...item };
  }

  const pane = getPaneBottomRightLayout(mergedLayout);
  const px = pane.x ?? 53;
  const py = pane.y ?? 52;
  const pw = pane.w ?? 39;
  const ph = pane.h ?? 32;

  if (item.x != null && item.w != null && item.x >= px - 1) {
    return {
      space: 'pane',
      x: Math.round(((item.x - px) / pw) * 1000) / 10,
      y: Math.round(((item.y - py) / ph) * 1000) / 10,
      w: Math.round((item.w / pw) * 1000) / 10,
      h: Math.round((item.h / ph) * 1000) / 10,
      nudgeX: item.nudgeX ?? 0,
      nudgeY: item.nudgeY ?? 0,
    };
  }

  return {
    space: 'pane',
    x: item.x ?? 5,
    y: item.y ?? 5,
    w: item.w ?? 90,
    h: item.h ?? 90,
    nudgeX: item.nudgeX ?? 0,
    nudgeY: item.nudgeY ?? 0,
  };
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

function applyItemFontScaleVars(target, cssKey, item, kind) {
  if (kind === 'text') {
    target.style.setProperty(varName(cssKey, 'label-font-scale'), String(item.labelFontScale ?? 1));
    target.style.setProperty(varName(cssKey, 'value-font-scale'), String(item.valueFontScale ?? 1));
  } else if (kind === 'titleBarChild') {
    target.style.setProperty(varName(cssKey, 'font-scale'), String(item.fontScale ?? 1));
  }
}

export function applyJournalLayout(layout, target = document.documentElement) {
  const merged = mergeJournalLayout(layout);
  const d = merged.dialog || DEFAULT_JOURNAL_LAYOUT.dialog;
  const t = merged.typography || DEFAULT_JOURNAL_LAYOUT.typography;

  target.style.setProperty('--tz-journal-art-w', String(d.artW ?? JOURNAL_ART.w));
  target.style.setProperty('--tz-journal-art-h', String(d.artH ?? JOURNAL_ART.h));
  target.style.setProperty('--tz-journal-display-pad', `${d.displayPad ?? 16}px`);
  target.style.setProperty('--tz-journal-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-journal-dialog-top-nudge', `${d.topNudge ?? 0}px`);
  target.style.setProperty('--tz-journal-field-color', t.fieldColor ?? '#3d2e1a');
  target.style.setProperty('--tz-journal-field-font', t.fieldFont ?? 'calc(0.62rem + 2px)');
  target.style.setProperty('--tz-journal-field-font-lg', t.fieldFontLg ?? 'calc(0.78rem + 2px)');
  target.style.setProperty('--tz-journal-label-font', t.labelFont ?? 'calc(0.55rem + 1px)');

  for (const [key, meta] of Object.entries(JOURNAL_ITEM_DEFS)) {
    const item = getJournalItemLayout(key, merged);
    const { cssKey, kind } = meta;

    if (kind === 'scroller') {
      const scroller = normalizeScrollerItem(item, merged);
      target.style.setProperty(varName(cssKey, 'x'), String(scroller.x ?? 0));
      target.style.setProperty(varName(cssKey, 'y'), String(scroller.y ?? 0));
      target.style.setProperty(varName(cssKey, 'h'), String(scroller.h ?? 30));
      target.style.setProperty(varName(cssKey, 'track-scale'), String(scroller.trackScale ?? 1));
      target.style.setProperty(varName(cssKey, 'pin-scale'), String(scroller.pinScale ?? 1));
      target.style.setProperty(varName(cssKey, 'nudge-x'), `${scroller.nudgeX ?? 0}px`);
      target.style.setProperty(varName(cssKey, 'nudge-y'), `${scroller.nudgeY ?? 0}px`);
      continue;
    }

    if (kind === 'listArea') {
      const area = normalizeListAreaItem(item, merged, key === 'listTitleBar' ? 'paneBottomLeft' : 'paneBottomLeft');
      target.style.setProperty(varName(cssKey, 'x'), String(area.x ?? 0));
      target.style.setProperty(varName(cssKey, 'y'), String(area.y ?? 0));
      target.style.setProperty(varName(cssKey, 'w'), String(area.w ?? 100));
      target.style.setProperty(varName(cssKey, 'h'), String(area.h ?? 100));
      target.style.setProperty(varName(cssKey, 'nudge-x'), `${area.nudgeX ?? 0}px`);
      target.style.setProperty(varName(cssKey, 'nudge-y'), `${area.nudgeY ?? 0}px`);
      continue;
    }

    if (kind === 'titleBarChild') {
      const area = normalizeTitleBarChildItem(item, merged, meta.titleBarParent);
      target.style.setProperty(varName(cssKey, 'x'), String(area.x ?? 0));
      target.style.setProperty(varName(cssKey, 'y'), String(area.y ?? 0));
      target.style.setProperty(varName(cssKey, 'w'), String(area.w ?? 100));
      target.style.setProperty(varName(cssKey, 'h'), String(area.h ?? 100));
      target.style.setProperty(varName(cssKey, 'nudge-x'), `${area.nudgeX ?? 0}px`);
      target.style.setProperty(varName(cssKey, 'nudge-y'), `${area.nudgeY ?? 0}px`);
      applyItemFontScaleVars(target, cssKey, item, kind);
      continue;
    }

    if (kind === 'preview' || kind === 'paneBtn') {
      const area = normalizePaneBottomRightItem(item, merged);
      target.style.setProperty(varName(cssKey, 'x'), String(area.x ?? 0));
      target.style.setProperty(varName(cssKey, 'y'), String(area.y ?? 0));
      target.style.setProperty(varName(cssKey, 'w'), String(area.w ?? 90));
      target.style.setProperty(varName(cssKey, 'h'), String(area.h ?? 90));
      target.style.setProperty(varName(cssKey, 'nudge-x'), `${area.nudgeX ?? 0}px`);
      target.style.setProperty(varName(cssKey, 'nudge-y'), `${area.nudgeY ?? 0}px`);
      continue;
    }

    if (kind === 'list') {
      target.style.setProperty('--tz-journal-list-row-font-scale', String(item.fontScale ?? 1));
      target.style.setProperty('--tz-journal-list-row-pad-x', `${item.padX ?? 8}px`);
      target.style.setProperty('--tz-journal-list-row-pad-y', `${item.padY ?? 6}px`);
      target.style.setProperty('--tz-journal-list-row-gap', `${item.gap ?? 4}px`);
      continue;
    }

    if (kind === 'listPart') {
      target.style.setProperty(varName(cssKey, 'font-scale'), String(item.fontScale ?? 1));
      continue;
    }

    applyPaneOrBtn(target, cssKey, item);
    if (kind === 'text') {
      applyItemFontScaleVars(target, cssKey, item, kind);
    }
  }
}

/** Push tuned tab hit boxes onto the actual buttons (tuner + live) so spacing cannot drift via CSS vars. */
export function applyJournalTabHitPositions(layout) {
  const merged = mergeJournalLayout(layout);
  for (const frame of document.querySelectorAll('.tz-journal-dialog__frame')) {
    for (const [key, def] of Object.entries(JOURNAL_ITEM_DEFS)) {
      if (!def.tabKey) continue;
      const item = getJournalItemLayout(key, merged);
      for (const el of frame.querySelectorAll(`[data-journal-tab="${def.tabKey}"]`)) {
        el.style.left = `calc(${item.x ?? 0}% + ${item.nudgeX ?? 0}px)`;
        el.style.top = `calc(${item.y ?? 0}% + ${item.nudgeY ?? 0}px)`;
        el.style.width = `${item.w ?? 10}%`;
        el.style.height = `${item.h ?? 11}%`;
      }
    }
  }
}

const PANE_BR_HIT_TARGETS = {
  solutionPreview: '#journalPreviewWrap, #mockPreviewWrap',
  btnBeginSearch: '#journalBeginSearchBtn, #mockBeginSearchBtn',
};

/** Push tuned lower-right pane hit boxes (preview + Begin Search) onto real elements. */
export function applyJournalPaneBrHitPositions(layout) {
  const merged = mergeJournalLayout(layout);
  for (const [key, selector] of Object.entries(PANE_BR_HIT_TARGETS)) {
    const item = getJournalItemLayout(key, merged);
    const style = {
      left: `calc(${item.x ?? 0}% + ${item.nudgeX ?? 0}px)`,
      top: `calc(${item.y ?? 0}% + ${item.nudgeY ?? 0}px)`,
      width: `${item.w ?? 90}%`,
      height: `${item.h ?? 90}%`,
    };
    for (const el of document.querySelectorAll(selector)) {
      Object.assign(el.style, style);
    }
  }
}

/** @deprecated use applyJournalPaneBrHitPositions */
export function applyJournalPreviewHitPositions(layout) {
  applyJournalPaneBrHitPositions(layout);
}

/** Push tuned lower-left list areas onto real elements (tuner + live). */
export function applyJournalListPaneHitPositions(layout) {
  const merged = mergeJournalLayout(layout);

  const listContent = normalizeListAreaItem(
    getJournalItemLayout('listContent', merged),
    merged,
    'paneBottomLeft',
  );
  const contentStyle = {
    left: `calc(${listContent.x ?? 0}% + ${listContent.nudgeX ?? 0}px)`,
    top: `calc(${listContent.y ?? 0}% + ${listContent.nudgeY ?? 0}px)`,
    width: `${listContent.w ?? 82}%`,
    height: `${listContent.h ?? 92}%`,
  };
  for (const el of document.querySelectorAll('#journalListScroll, #mockListScroll')) {
    Object.assign(el.style, contentStyle);
  }

  const scroller = normalizeScrollerItem(getJournalItemLayout('listScroller', merged), merged);
  const scrollerStyle = {
    left: `calc(${scroller.x ?? 0}% + ${scroller.nudgeX ?? 0}px)`,
    top: `calc(${scroller.y ?? 0}% + ${scroller.nudgeY ?? 0}px)`,
    width: `calc(22px * ${scroller.trackScale ?? 1})`,
    height: `${scroller.h ?? 86}%`,
  };
  for (const el of document.querySelectorAll('#journalListScroller, #mockListScroller')) {
    Object.assign(el.style, scrollerStyle);
  }

  const titleBar = normalizeListAreaItem(
    getJournalItemLayout('listTitleBar', merged),
    merged,
    'paneBottomLeft',
  );
  const titleBarStyle = {
    left: `calc(${titleBar.x ?? 2}% + ${titleBar.nudgeX ?? 0}px)`,
    top: `calc(${titleBar.y ?? 1}% + ${titleBar.nudgeY ?? 0}px)`,
    width: `${titleBar.w ?? 96}%`,
    height: `${titleBar.h ?? 10}%`,
  };
  for (const el of document.querySelectorAll('#journalListTitleBar, #mockListTitleBar')) {
    Object.assign(el.style, titleBarStyle);
  }

  for (const key of ['titleFoundSolutions', 'titleRecordedPuzzles']) {
    const def = JOURNAL_ITEM_DEFS[key];
    const item = normalizeTitleBarChildItem(
      getJournalItemLayout(key, merged),
      merged,
      def.titleBarParent,
    );
    const titleStyle = {
      left: `calc(${item.x ?? 4}% + ${item.nudgeX ?? 0}px)`,
      top: `calc(${item.y ?? 10}% + ${item.nudgeY ?? 0}px)`,
      width: `${item.w ?? 92}%`,
      height: `${item.h ?? 80}%`,
    };
    const selector = key === 'titleFoundSolutions'
      ? '#journalTitleFound, #mockTitleFound'
      : '#journalTitleRecorded, #mockTitleRecorded';
    for (const el of document.querySelectorAll(selector)) {
      Object.assign(el.style, titleStyle);
    }
  }
}

/** Push tuned pane boxes onto real elements (tuner + live) — inline styles win over CSS vars. */
export function applyJournalPaneHitPositions(layout) {
  const merged = mergeJournalLayout(layout);
  const paneSelectors = {
    paneTop: '.tz-journal-pane--top, [data-tuner-item="paneTop"]',
    paneBottomLeft: '.tz-journal-pane--bl, [data-tuner-item="paneBottomLeft"]',
    paneBottomRight: '.tz-journal-pane--br, [data-tuner-item="paneBottomRight"]',
  };

  for (const [key, selector] of Object.entries(paneSelectors)) {
    const item = getJournalItemLayout(key, merged);
    const style = {
      left: `calc(${item.x ?? 0}% + ${item.nudgeX ?? 0}px)`,
      top: `calc(${item.y ?? 0}% + ${item.nudgeY ?? 0}px)`,
      width: `${item.w ?? 44}%`,
      height: `${item.h ?? 32}%`,
    };
    for (const el of document.querySelectorAll(selector)) {
      Object.assign(el.style, style);
    }
  }
}

/** Push all tuned hit boxes (tabs, panes, list pane, preview) onto real DOM nodes. */
export function applyJournalLayoutHits(layout) {
  applyJournalTabHitPositions(layout);
  applyJournalPaneHitPositions(layout);
  applyJournalListPaneHitPositions(layout);
  applyJournalPaneBrHitPositions(layout);
}

/** Apply layout CSS vars on :root and every journal frame (live + tuner preview). */
export function applyJournalLayoutEverywhere(layout) {
  applyJournalLayout(layout, document.documentElement);
  for (const frame of document.querySelectorAll('.tz-journal-dialog__frame')) {
    applyJournalLayout(layout, frame);
  }
  applyJournalLayoutHits(layout);
}

export function buildJournalLayoutReport(layout) {
  const merged = mergeJournalLayout(layout);
  const lines = [
    `Journal layout report (artboard ${merged.dialog?.artW ?? 933}×${merged.dialog?.artH ?? 1686})`,
    `maxDesignWidth ${merged.dialog?.maxDesignWidth ?? 390}px`,
    `topNudge ${merged.dialog?.topNudge ?? 0}px (dialog top aligns with main board)`,
    '',
    '— Layout box hierarchy —',
    '1) frame',
    '1.1) paneBottomLeft',
    '1.1.1) listTitleBar',
    '1.1.1.1) titleFoundSolutions / titleRecordedPuzzles',
    '1.1.2) listContent',
    '1.1.3) listScroller',
    '1.2) paneBottomRight',
    '1.2.1) solutionPreview',
    '1.2.2) btnBeginSearch',
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
      const scroller = normalizeScrollerItem(item, merged);
      lines.push(
        `${def.label}: pane x ${scroller.x}% · y ${scroller.y}% · h ${scroller.h}%`
        + ` · trackScale ${scroller.trackScale} (≈${Math.round(22 * (scroller.trackScale ?? 1))}px wide)`
        + ` · pinScale ${scroller.pinScale}`,
      );
      continue;
    }
    if (def.kind === 'listArea') {
      const area = normalizeListAreaItem(item, merged, key === 'listTitleBar' ? 'paneBottomLeft' : 'paneBottomLeft');
      lines.push(
        `${def.label}: pane x ${area.x}% · y ${area.y}% · w ${area.w}% · h ${area.h}%`
        + (area.nudgeX ? ` · nudgeX ${area.nudgeX}px` : '')
        + (area.nudgeY ? ` · nudgeY ${area.nudgeY}px` : ''),
      );
      continue;
    }
    if (def.kind === 'titleBarChild') {
      const area = normalizeTitleBarChildItem(item, merged, def.titleBarParent);
      lines.push(
        `${def.label}: title-bar x ${area.x}% · y ${area.y}% · w ${area.w}% · h ${area.h}%`
        + (area.nudgeX ? ` · nudgeX ${area.nudgeX}px` : '')
        + (area.nudgeY ? ` · nudgeY ${area.nudgeY}px` : ''),
      );
      continue;
    }
    if (def.kind === 'preview' || def.kind === 'paneBtn') {
      const area = normalizePaneBottomRightItem(item, merged);
      lines.push(
        `${def.label}: pane x ${area.x}% · y ${area.y}% · w ${area.w}% · h ${area.h}%`
        + (area.nudgeX ? ` · nudgeX ${area.nudgeX}px` : '')
        + (area.nudgeY ? ` · nudgeY ${area.nudgeY}px` : ''),
      );
      continue;
    }
    if (def.kind === 'list') {
      lines.push(
        `${def.label}: fontScale ${item.fontScale ?? 1}`
        + ` · pad ${item.padY ?? 6}px×${item.padX ?? 8}px · gap ${item.gap ?? 4}px`,
      );
      continue;
    }
    if (def.kind === 'listPart') {
      lines.push(`${def.label}: fontScale ${item.fontScale ?? 1}`);
      continue;
    }
    const parts = [`x:${item.x}%`, `y:${item.y}%`, `w:${item.w}%`];
    if (item.h != null) parts.push(`h:${item.h}%`);
    if (item.nudgeX) parts.push(`nudgeX:${item.nudgeX}px`);
    if (item.nudgeY) parts.push(`nudgeY:${item.nudgeY}px`);
    if (def.kind === 'text') {
      parts.push(`labelFontScale:${item.labelFontScale ?? 1}`);
      parts.push(`valueFontScale:${item.valueFontScale ?? 1}`);
    }
    if (def.kind === 'titleBarChild' && (item.fontScale ?? 1) !== 1) {
      parts.push(`fontScale:${item.fontScale}`);
    }
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
