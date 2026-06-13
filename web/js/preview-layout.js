/** Preview frame hit areas — artboard px on preview tile Area bubble.png (1593×872). */

export const PREVIEW_ART = { w: 1593, h: 872 };

export const PREVIEW_ITEM_DEFS = {
  renderer: { label: 'Tile slot (preview)', cssKey: 'renderer' },
  rotateCcw: { label: 'Rotate left', cssKey: 'rotate-ccw' },
  rotateCw: { label: 'Rotate right', cssKey: 'rotate-cw' },
  tileDir: { label: 'Rotation ° label', cssKey: 'tile-dir' },
  hint: { label: 'Use hint', cssKey: 'hint' },
  undo: { label: 'Undo', cssKey: 'undo' },
  reset: { label: 'Reset', cssKey: 'reset' },
};

export const DEFAULT_PREVIEW_LAYOUT = {
  items: {
    renderer: { x: 437, y: 219, w: 719, h: 493 },
    rotateCcw: { x: 113, y: 338, w: 277, h: 205 },
    rotateCw: { x: 1205, y: 338, w: 277, h: 205 },
    tileDir: { x: 437, y: 672, w: 719, h: 40 },
    hint: { x: 52, y: 228, w: 328, h: 92 },
    undo: { x: 113, y: 562, w: 277, h: 118 },
    reset: { x: 1205, y: 562, w: 277, h: 118 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:preview';
const LS_PENDING_KEY = 'tilezilla:layouts:preview:pending';

let layoutCache = null;

export function clearPreviewLayoutCache() {
  layoutCache = null;
}

export function stashPreviewLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPreviewLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergePreviewLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_PREVIEW_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!PREVIEW_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadPreviewLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/preview_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergePreviewLayout(raw);
  return layoutCache;
}

export async function reloadPreviewLayout() {
  clearPreviewLayoutCache();
  return loadPreviewLayout({ force: true });
}

export function getPreviewItemLayout(itemKey, layout) {
  const merged = mergePreviewLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_PREVIEW_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
  };
}

function setBoxVars(target, cssKey, box) {
  target.style.setProperty(`--tz-preview-${cssKey}-x-art`, String(box.x));
  target.style.setProperty(`--tz-preview-${cssKey}-y-art`, String(box.y));
  target.style.setProperty(`--tz-preview-${cssKey}-w-art`, String(box.w));
  target.style.setProperty(`--tz-preview-${cssKey}-h-art`, String(box.h));
}

export function applyPreviewLayout(layout, target = document.documentElement) {
  const merged = mergePreviewLayout(layout);
  for (const [key, meta] of Object.entries(PREVIEW_ITEM_DEFS)) {
    setBoxVars(target, meta.cssKey, getPreviewItemLayout(key, merged));
  }
}

export function buildPreviewLayoutReport(layout) {
  const merged = mergePreviewLayout(layout);
  const lines = [
    `Preview layout report (artboard ${PREVIEW_ART.w}×${PREVIEW_ART.h}px)`,
    'Coordinates are art pixels on preview tile Area bubble.png',
    '',
  ];
  for (const [key, def] of Object.entries(PREVIEW_ITEM_DEFS)) {
    const box = getPreviewItemLayout(key, merged);
    lines.push(
      `${def.label}: x ${box.x} · y ${box.y} · w ${box.w} · h ${box.h}`,
    );
  }
  return lines.join('\n');
}
