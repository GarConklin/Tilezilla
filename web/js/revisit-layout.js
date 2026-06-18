/** Journal revisit confirm popup — Revisit.png field + button positions (% of frame). */

export const REVISIT_ART = { w: 1418, h: 1048 };

export const REVISIT_ITEM_DEFS = {
  puzzleId: { label: 'Puzzle ID', cssPrefix: 'puzzle-id', kind: 'text' },
  solutions: { label: 'Found solutions', cssPrefix: 'solutions', kind: 'text' },
  solved: { label: 'Solved date', cssPrefix: 'solved', kind: 'text' },
  cancel: { label: 'Cancel', cssPrefix: 'cancel', kind: 'btn' },
  revisit: { label: 'Revisit', cssPrefix: 'revisit', kind: 'btn' },
};

export const DEFAULT_REVISIT_LAYOUT = {
  dialog: {
    artW: 1418,
    artH: 1048,
    widthScale: 0.94,
    displayPad: 16,
  },
  items: {
    puzzleId: { x: 54.5, y: 39.2, w: 38, h: 5 },
    solutions: { x: 54.5, y: 49.2, w: 38, h: 5 },
    solved: { x: 54.5, y: 59.2, w: 38, h: 5 },
    cancel: { x: 9.5, y: 83.8, w: 38.5, h: 11.5 },
    revisit: { x: 51.5, y: 83.8, w: 38.5, h: 11.5 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:revisit';
const LS_PENDING_KEY = 'tilezilla:layouts:revisit:pending';

let layoutCache = null;

export function clearRevisitLayoutCache() {
  layoutCache = null;
}

export function stashRevisitLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearRevisitLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadRevisitLayout({ force = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  let pendingDraft = false;
  try {
    pendingDraft = localStorage.getItem(LS_PENDING_KEY) === '1';
    if (pendingDraft) {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    }
  } catch {
    pendingDraft = false;
  }

  if (!pendingDraft) {
    try {
      const res = await fetch(`/data/revisit_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  if (!raw && !pendingDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  layoutCache = mergeRevisitLayout(raw);
  return layoutCache;
}

export async function reloadRevisitLayout() {
  clearRevisitLayoutCache();
  return loadRevisitLayout({ force: true });
}

export function mergeRevisitLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_REVISIT_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!REVISIT_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export function getRevisitItemLayout(itemKey, layout) {
  const merged = mergeRevisitLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_REVISIT_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
  };
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-revisit-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-revisit-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-revisit-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-revisit-${cssPrefix}-h`, `${box.h}%`);
}

export function applyRevisitLayout(layout, target = document.documentElement) {
  const merged = mergeRevisitLayout(layout);
  const d = merged.dialog || DEFAULT_REVISIT_LAYOUT.dialog;

  target.style.setProperty('--tz-revisit-art-w', String(d.artW ?? REVISIT_ART.w));
  target.style.setProperty('--tz-revisit-art-h', String(d.artH ?? REVISIT_ART.h));
  target.style.setProperty('--tz-revisit-display-pad', `${d.displayPad ?? 16}px`);
  target.style.setProperty('--tz-revisit-width-scale', String(d.widthScale ?? 0.94));

  for (const [key, meta] of Object.entries(REVISIT_ITEM_DEFS)) {
    setItemVars(target, meta.cssPrefix, getRevisitItemLayout(key, merged));
  }
}

export function buildRevisitLayoutReport(layout) {
  const merged = mergeRevisitLayout(layout);
  const d = merged.dialog || {};
  const lines = [
    'Journal revisit popup layout (Revisit.png)',
    `Art ${d.artW ?? REVISIT_ART.w}×${d.artH ?? REVISIT_ART.h}`,
    `widthScale ${d.widthScale ?? 0.94} · displayPad ${d.displayPad ?? 16}px`,
    'Positions are % of dialog frame (top-left origin)',
    '',
  ];
  for (const [key, def] of Object.entries(REVISIT_ITEM_DEFS)) {
    const box = getRevisitItemLayout(key, merged);
    lines.push(`${def.label}: x ${box.x}% · y ${box.y}% · w ${box.w}% · h ${box.h}%`);
  }
  return lines.join('\n');
}
