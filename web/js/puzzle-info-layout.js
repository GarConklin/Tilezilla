/** Puzzle Info popup layout — load/apply field positions from JSON. */

export const PINFO_ART = { w: 1120, h: 1157 };

export const PINFO_ITEM_DEFS = {
  rank: { cssKey: 'rank', kind: 'rank', label: 'Rank badge' },
  id: { cssKey: 'id', kind: 'text', label: 'Puzzle ID' },
  size: { cssKey: 'size', kind: 'text', label: 'Board size' },
  type: { cssKey: 'type', kind: 'text', label: 'Challenge type' },
  bar: { cssKey: 'bar', kind: 'bar', label: 'Solutions bar' },
  found: { cssKey: 'found', kind: 'textLg', label: 'Solutions found' },
  hints: { cssKey: 'hints', kind: 'textLg', label: 'Hints used' },
  best: { cssKey: 'best', kind: 'textLg', label: 'Best time' },
  solved: { cssKey: 'solved', kind: 'text', label: 'First solved' },
  closeX: { cssKey: 'close', kind: 'btn', label: 'Close X (exit-btn)' },
  closeJournal: { cssKey: 'journal', kind: 'btn', label: 'Close Journal (hit)' },
};

export const DEFAULT_PUZZLE_INFO_LAYOUT = {
  dialog: {
    artW: 1120,
    artH: 1157,
    displayPad: 32,
    maxDesignWidth: 390,
  },
  typography: {
    fieldColor: '#2d4f6e',
    fieldFont: 'calc(0.72rem + 5px)',
    fieldFontLg: 'calc(0.95rem + 5px)',
  },
  defaults: { nudgeX: 0, nudgeY: 0 },
  items: {
    rank: { x: 6, y: 16, w: 27, romanY: 78, romanNudgeY: 2 },
    id: { x: 62, y: 22, w: 34, nudgeX: 8, nudgeY: -8 },
    size: { x: 62, y: 30.5, w: 34, nudgeX: 15, nudgeY: -12 },
    type: { x: 62, y: 35, w: 34, nudgeX: -5, nudgeY: 4 },
    bar: { x: 10, y: 46.5, w: 36, h: 2.8, nudgeX: 26, nudgeY: 31 },
    found: { x: 10, y: 55, w: 36, nudgeX: 20, nudgeY: 7 },
    hints: { x: 68, y: 55, w: 22, nudgeX: 8, nudgeY: 7 },
    best: { x: 10, y: 70, w: 36, nudgeX: 0, nudgeY: 0 },
    solved: { x: 58, y: 70, w: 36, nudgeX: -12, nudgeY: 3 },
    closeX: { x: 87.5, y: 2.6, w: 7.9, h: 7.6, nudgeX: 26, nudgeY: -1 },
    closeJournal: { x: 33, y: 87, w: 35.8, h: 8.8, nudgeX: -5, nudgeY: -20 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:puzzle-info';
const LS_PENDING_KEY = 'tilezilla:layouts:puzzle-info:pending';

let layoutCache = null;

export function isPuzzleInfoTunerPage() {
  return /puzzle-info-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearPuzzleInfoLayoutCache() {
  layoutCache = null;
}

export function mergePuzzleInfoLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_PUZZLE_INFO_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.typography && typeof raw.typography === 'object') {
    base.typography = { ...base.typography, ...raw.typography };
  }
  if (raw.defaults && typeof raw.defaults === 'object') {
    base.defaults = { ...base.defaults, ...raw.defaults };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!PINFO_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...(base.items[key] || {}), ...val };
    }
    if (raw.items.close && !raw.items.closeX) {
      base.items.closeX = { ...(base.items.closeX || {}), ...raw.items.close };
    }
  }
  return base;
}

export async function loadPuzzleInfoLayout({ force = false } = {}) {
  if (layoutCache && !force) {
    return JSON.parse(JSON.stringify(layoutCache));
  }

  let raw = null;
  const tunerDraft = isPuzzleInfoTunerPage()
    && localStorage.getItem(LS_PENDING_KEY) === '1';

  if (tunerDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* fall through to file */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/puzzle_info_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergePuzzleInfoLayout(raw);
  return JSON.parse(JSON.stringify(layoutCache));
}

export async function reloadPuzzleInfoLayout() {
  clearPuzzleInfoLayoutCache();
  return loadPuzzleInfoLayout({ force: true });
}

export function getPuzzleInfoItemLayout(itemKey, layout) {
  const merged = mergePuzzleInfoLayout(layout);
  const fallback = DEFAULT_PUZZLE_INFO_LAYOUT.items[itemKey] || {};
  const stored = merged.items?.[itemKey];
  if (!stored || typeof stored !== 'object') {
    return { ...fallback };
  }
  return { ...fallback, ...stored };
}

function varName(cssKey, suffix) {
  return `--tz-pinfo-${cssKey}-${suffix}`;
}

function applyItemVars(itemKey, item, meta, target) {
  const { cssKey, kind } = meta;
  const nudgeX = Number(item.nudgeX) || 0;
  const nudgeY = Number(item.nudgeY) || 0;

  if (kind === 'rank') {
    target.style.setProperty(varName('rank', 'x'), `${item.x}%`);
    target.style.setProperty(varName('rank', 'y'), `${item.y}%`);
    target.style.setProperty(varName('rank', 'w'), `${item.w}%`);
    target.style.setProperty(varName('rank', 'roman-y'), `${item.romanY ?? 78}%`);
    target.style.setProperty(varName('rank', 'roman-nudge-y'), `${item.romanNudgeY ?? 0}px`);
    return;
  }

  target.style.setProperty(varName(cssKey, 'x'), `${item.x}%`);
  target.style.setProperty(varName(cssKey, 'y'), `${item.y}%`);
  target.style.setProperty(varName(cssKey, 'nudge-x'), `${nudgeX}px`);
  target.style.setProperty(varName(cssKey, 'nudge-y'), `${nudgeY}px`);

  if (kind === 'text') {
    if (cssKey === 'solved' && item.w != null) {
      target.style.setProperty(varName('solved', 'w'), `${item.w}%`);
    } else if ((cssKey === 'id' || cssKey === 'size' || cssKey === 'type') && item.w != null) {
      target.style.setProperty(varName(cssKey, 'w'), `${item.w}%`);
    }
  } else if (kind === 'textLg') {
    if (item.w != null) target.style.setProperty(varName(cssKey, 'w'), `${item.w}%`);
  } else if (kind === 'bar') {
    target.style.setProperty(varName('bar', 'w'), `${item.w}%`);
    target.style.setProperty(varName('bar', 'h'), `${item.h}%`);
  } else if (kind === 'btn') {
    if (item.w != null) target.style.setProperty(varName(cssKey, 'w'), `${item.w}%`);
    if (item.h != null) target.style.setProperty(varName(cssKey, 'h'), `${item.h}%`);
  }
}

/** Dialog art size + typography — applied on :root. */
export function applyPuzzleInfoLayout(layout, target = document.documentElement) {
  const merged = mergePuzzleInfoLayout(layout);
  const d = merged.dialog || DEFAULT_PUZZLE_INFO_LAYOUT.dialog;
  const t = merged.typography || DEFAULT_PUZZLE_INFO_LAYOUT.typography;

  target.style.setProperty('--tz-pinfo-art-w', String(d.artW ?? PINFO_ART.w));
  target.style.setProperty('--tz-pinfo-art-h', String(d.artH ?? PINFO_ART.h));
  target.style.setProperty('--tz-pinfo-display-pad', `${d.displayPad ?? 32}px`);
  target.style.setProperty('--tz-pinfo-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-pinfo-field-color', t.fieldColor ?? '#2d4f6e');
  target.style.setProperty('--tz-pinfo-field-font', t.fieldFont ?? 'calc(0.72rem + 5px)');
  target.style.setProperty('--tz-pinfo-field-font-lg', t.fieldFontLg ?? 'calc(0.95rem + 5px)');

  for (const [itemKey, meta] of Object.entries(PINFO_ITEM_DEFS)) {
    applyItemVars(itemKey, getPuzzleInfoItemLayout(itemKey, merged), meta, target);
  }
}

export function buildPuzzleInfoLayoutReport(layout) {
  const merged = mergePuzzleInfoLayout(layout);
  const lines = [
    'Puzzle Info layout report (390px game width preview)',
    `Art ${merged.dialog?.artW ?? PINFO_ART.w}×${merged.dialog?.artH ?? PINFO_ART.h}`,
    `maxDesignWidth ${merged.dialog?.maxDesignWidth ?? 390}px · displayPad ${merged.dialog?.displayPad ?? 32}px`,
    '',
  ];
  for (const [key, meta] of Object.entries(PINFO_ITEM_DEFS)) {
    const item = getPuzzleInfoItemLayout(key, merged);
    const parts = [`x:${item.x}%`, `y:${item.y}%`];
    if (item.w != null) parts.push(`w:${item.w}%`);
    if (item.h != null) parts.push(`h:${item.h}%`);
    if (item.nudgeX) parts.push(`nudgeX:${item.nudgeX}px`);
    if (item.nudgeY) parts.push(`nudgeY:${item.nudgeY}px`);
    if (key === 'rank') {
      if (item.romanY != null) parts.push(`romanY:${item.romanY}%`);
      if (item.romanNudgeY) parts.push(`romanNudgeY:${item.romanNudgeY}px`);
    }
    lines.push(`${meta.label}: ${parts.join(' · ')}`);
  }
  return lines.join('\n');
}

export function stashPuzzleInfoLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore quota */
  }
}

export function clearPuzzleInfoLayoutDraft() {
  try {
    localStorage.removeItem(LS_LAYOUT_KEY);
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
