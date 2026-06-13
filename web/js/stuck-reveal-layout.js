/** I'm Stuck reveal art (Imstuckreveal.png) — hit areas as % of dialog frame. */

export const STUCK_REVEAL_ART = { w: 1402, h: 1122 };

export const STUCK_REVEAL_ITEM_DEFS = {
  preview: { label: 'Route preview', cssPrefix: 'reveal-preview' },
  keep: { label: 'Keep Trying', cssPrefix: 'reveal-keep' },
  close: { label: 'Close (X)', cssPrefix: 'reveal-close' },
};

export const DEFAULT_STUCK_REVEAL_LAYOUT = {
  items: {
    preview: { x: 57, y: 24, w: 36, h: 58 },
    keep: { x: 4.5, y: 88.5, w: 27, h: 9.5 },
    close: { x: 91, y: 2.5, w: 7, h: 7 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:stuck-reveal';
const LS_PENDING_KEY = 'tilezilla:layouts:stuck-reveal:pending';

let layoutCache = null;

export function clearStuckRevealLayoutCache() {
  layoutCache = null;
}

export function stashStuckRevealLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearStuckRevealLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeStuckRevealLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_STUCK_REVEAL_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!STUCK_REVEAL_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadStuckRevealLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/stuck_reveal_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeStuckRevealLayout(raw);
  return layoutCache;
}

export async function reloadStuckRevealLayout() {
  clearStuckRevealLayoutCache();
  return loadStuckRevealLayout({ force: true });
}

export function getStuckRevealItemLayout(itemKey, layout) {
  const merged = mergeStuckRevealLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_STUCK_REVEAL_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
  };
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-stuck-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-stuck-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-stuck-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-stuck-${cssPrefix}-h`, `${box.h}%`);
}

export function applyStuckRevealLayout(layout, target = document.documentElement) {
  const merged = mergeStuckRevealLayout(layout);
  for (const [key, meta] of Object.entries(STUCK_REVEAL_ITEM_DEFS)) {
    setItemVars(target, meta.cssPrefix, getStuckRevealItemLayout(key, merged));
  }
}

export function buildStuckRevealLayoutReport(layout) {
  const merged = mergeStuckRevealLayout(layout);
  const lines = [
    "I'm Stuck reveal layout (Imstuckreveal.png)",
    'Coordinates are % of dialog frame (top-left origin)',
    '',
  ];
  for (const [key, def] of Object.entries(STUCK_REVEAL_ITEM_DEFS)) {
    const box = getStuckRevealItemLayout(key, merged);
    lines.push(`${def.label}: x ${box.x}% · y ${box.y}% · w ${box.w}% · h ${box.h}%`);
  }
  return lines.join('\n');
}
