/** Hint sub-layout — local artboard px inside preview Hint_data zone. */

export const HINT_V2_ART = { w: 245, h: 145 };

export const DEFAULT_HINT_V2_ART = {
  hintPlaqueCount: '/img/hintplaque.png',
  hintPlaqueUse: '/img/hint bubble plaque w room for use hint btn.png',
  useHintBtn: '/img/use hint bubble.png',
};

export const HINT_V2_ITEM_DEFS = {
  hintPlaqueUse: { label: 'Use plaque (empty board)', cssKey: 'plaque-use' },
  hintPlaqueCount: { label: 'Count plaque (tiles placed)', cssKey: 'plaque-count' },
  hintTokenCountUse: { label: 'Token count (use plaque)', cssKey: 'token-count-use' },
  hintTokenAddUse: { label: '+ button (use plaque)', cssKey: 'token-add-use' },
  hintTokenCountCount: { label: 'Token count (count plaque)', cssKey: 'token-count-count' },
  hintTokenAddCount: { label: '+ button (count plaque)', cssKey: 'token-add-count' },
  hintUseBtn: { label: 'Use hint button', cssKey: 'use-btn' },
};

export const HINT_V2_ITEM_KEYS = Object.keys(HINT_V2_ITEM_DEFS);

export const DEFAULT_HINT_TOKEN_COUNT_FONT = 'clamp(6px, 14cqi, 12px)';

export const DEFAULT_HINT_TOKEN_FONT_PARTS = { minPx: 6, cqi: 14, maxPx: 12 };

/** @returns {{ minPx: number, cqi: number, maxPx: number }} */
export function parseHintTokenFontSize(fontSize) {
  const s = String(fontSize || '');
  const clampMatch = s.match(
    /clamp\(\s*([\d.]+)\s*px\s*,\s*([\d.]+)\s*cqi\s*,\s*([\d.]+)\s*px\s*\)/i,
  );
  if (clampMatch) {
    return {
      minPx: parseFloat(clampMatch[1]),
      cqi: parseFloat(clampMatch[2]),
      maxPx: parseFloat(clampMatch[3]),
    };
  }
  return { ...DEFAULT_HINT_TOKEN_FONT_PARTS };
}

/** @param {{ minPx: number, cqi: number, maxPx: number }} parts */
export function buildHintTokenFontSize(parts) {
  const minPx = Math.max(4, Math.round(parts.minPx * 10) / 10);
  const cqi = Math.max(6, Math.round(parts.cqi * 10) / 10);
  let maxPx = Math.max(minPx + 1, Math.round(parts.maxPx * 10) / 10);
  maxPx = Math.min(22, maxPx);
  return `clamp(${minPx}px, ${cqi}cqi, ${maxPx}px)`;
}

/** @param {'px' | 'cqi'} [mode] px = min+max bounds; cqi = container scaling term */
export function adjustHintTokenFontSize(fontSize, dir, mode = 'px') {
  const parts = parseHintTokenFontSize(fontSize);
  if (mode === 'cqi') {
    parts.cqi = Math.max(6, Math.min(28, parts.cqi + dir * 0.5));
    return buildHintTokenFontSize(parts);
  }
  const step = 0.5;
  parts.minPx = Math.max(4, Math.min(16, parts.minPx + dir * step));
  parts.maxPx = Math.max(parts.minPx + 1, Math.min(22, parts.maxPx + dir * step));
  return buildHintTokenFontSize(parts);
}

export function formatHintTokenFontReport(fontSize) {
  const { minPx, cqi, maxPx } = parseHintTokenFontSize(fontSize);
  return `font clamp(${minPx}px, ${cqi}cqi, ${maxPx}px)`;
}

export function getHintV2TokenCountFont(layout) {
  const merged = mergeHintV2Layout(layout);
  const raw = merged.tokenCountFont;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return DEFAULT_HINT_TOKEN_COUNT_FONT;
}

export const DEFAULT_HINT_V2_LAYOUT = {
  frame: { w: 245, h: 145 },
  tokenCountFont: DEFAULT_HINT_TOKEN_COUNT_FONT,
  art: { ...DEFAULT_HINT_V2_ART },
  items: {
    hintPlaqueUse: { x: 0, y: 0, w: 237, h: 125 },
    hintPlaqueCount: { x: 0, y: 0, w: 237, h: 66 },
    hintTokenCountUse: { x: 95, y: 36, w: 48, h: 20 },
    hintTokenAddUse: { x: 205, y: 32, w: 24, h: 24 },
    hintTokenCountCount: { x: 95, y: 28, w: 48, h: 20 },
    hintTokenAddCount: { x: 205, y: 24, w: 24, h: 24 },
    hintUseBtn: { x: 6, y: 72, w: 225, h: 50 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:hint-v2';
const LS_PENDING_KEY = 'tilezilla:layouts:hint-v2:pending';

let layoutCache = null;

export function clearHintV2LayoutCache() {
  layoutCache = null;
}

export function stashHintV2LayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearHintV2LayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeHintV2Layout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_HINT_V2_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.frame && typeof raw.frame === 'object') {
    base.frame = { ...base.frame, ...raw.frame };
  }
  if (raw.art && typeof raw.art === 'object') {
    base.art = { ...base.art, ...raw.art };
    if (raw.art.hintCountPlaque && !raw.art.hintPlaqueCount) {
      base.art.hintPlaqueCount = raw.art.hintCountPlaque;
    }
  }
  if (typeof raw.tokenCountFont === 'string' && raw.tokenCountFont.trim()) {
    base.tokenCountFont = raw.tokenCountFont.trim();
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!HINT_V2_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
    if (raw.items.hintPlaqueUse && !raw.items.hintUseBtn) {
      base.items.hintUseBtn = { ...base.items.hintUseBtn, ...raw.items.hintPlaqueUse };
    } else     if (raw.items.hint && !raw.items.hintUseBtn) {
      base.items.hintUseBtn = { ...base.items.hintUseBtn, ...raw.items.hint };
    }
    if (raw.items.hintTokenCount && !raw.items.hintTokenCountUse) {
      base.items.hintTokenCountUse = { ...base.items.hintTokenCountUse, ...raw.items.hintTokenCount };
      base.items.hintTokenCountCount = { ...base.items.hintTokenCountCount, ...raw.items.hintTokenCount };
    }
    if (raw.items.hintTokenAdd && !raw.items.hintTokenAddUse) {
      base.items.hintTokenAddUse = { ...base.items.hintTokenAddUse, ...raw.items.hintTokenAdd };
      base.items.hintTokenAddCount = { ...base.items.hintTokenAddCount, ...raw.items.hintTokenAdd };
    }
  }
  return base;
}

export async function loadHintV2Layout({ force = false } = {}) {
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
      const res = await fetch(`/data/hint_v2_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeHintV2Layout(raw);
  return layoutCache;
}

export async function reloadHintV2Layout() {
  clearHintV2LayoutCache();
  return loadHintV2Layout({ force: true });
}

export function getHintV2ItemLayout(itemKey, layout) {
  const merged = mergeHintV2Layout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_HINT_V2_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
  };
}

function setBoxVars(target, cssKey, box) {
  target.style.setProperty(`--tz-hint-${cssKey}-x-art`, String(box.x));
  target.style.setProperty(`--tz-hint-${cssKey}-y-art`, String(box.y));
  target.style.setProperty(`--tz-hint-${cssKey}-w-art`, String(box.w));
  target.style.setProperty(`--tz-hint-${cssKey}-h-art`, String(box.h));
}

function cssBgUrl(path) {
  const bg = String(path || '').trim();
  if (!bg) return 'none';
  if (bg.includes('(')) return bg;
  const encoded = bg
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `url("${encoded}")`;
}

export function applyHintV2Art(target = document.documentElement, layout) {
  const merged = mergeHintV2Layout(layout);
  const art = merged.art || DEFAULT_HINT_V2_ART;
  target.style.setProperty('--tz-preview-v2-hint-count-plaque', cssBgUrl(art.hintPlaqueCount));
  target.style.setProperty('--tz-preview-v2-hint-use-plaque', cssBgUrl(art.hintPlaqueUse));
  target.style.setProperty('--tz-preview-v2-use-hint-btn', cssBgUrl(art.useHintBtn));
}

export function applyHintV2ArtImages(root = document, layout) {
  const merged = mergeHintV2Layout(layout);
  const art = merged.art || DEFAULT_HINT_V2_ART;
  root.querySelectorAll('.tz-preview-v2-hint-plaque--count .tz-preview-v2-hint-plaque__art').forEach((img) => {
    if (art.hintPlaqueCount) img.src = art.hintPlaqueCount;
  });
  root.querySelectorAll('.tz-preview-v2-hint-plaque--use .tz-preview-v2-hint-plaque__art').forEach((img) => {
    if (art.hintPlaqueUse) img.src = art.hintPlaqueUse;
  });
  root.querySelectorAll('.tz-preview-v2-hint-use-btn__art').forEach((img) => {
    if (art.useHintBtn) img.src = art.useHintBtn;
  });
}

export function applyHintV2Layout(layout, target = document.documentElement) {
  const merged = mergeHintV2Layout(layout);
  const frame = merged.frame || HINT_V2_ART;
  target.style.setProperty('--tz-hint-art-w', String(frame.w ?? HINT_V2_ART.w));
  target.style.setProperty('--tz-hint-art-h', String(frame.h ?? HINT_V2_ART.h));
  for (const [key, meta] of Object.entries(HINT_V2_ITEM_DEFS)) {
    setBoxVars(target, meta.cssKey, getHintV2ItemLayout(key, merged));
  }
  target.style.setProperty('--tz-hint-token-count-font', getHintV2TokenCountFont(merged));
  applyHintV2Art(target, merged);
}

export function buildHintV2LayoutReport(layout) {
  const merged = mergeHintV2Layout(layout);
  const frame = merged.frame || HINT_V2_ART;
  const art = merged.art || DEFAULT_HINT_V2_ART;
  const lines = [
    `Hint v2 sub-layout (local artboard ${frame.w}×${frame.h}px)`,
    'Coordinates are pixels within the preview Hint_data zone',
    'Hint_data zone position: tune in preview-v2-tuner.html',
    '',
    '— Art —',
    `count plaque (tiles placed): ${art.hintPlaqueCount || '(none)'}`,
    `use plaque (empty board): ${art.hintPlaqueUse || '(none)'}`,
    `use hint button: ${art.useHintBtn || '(none)'}`,
    '',
    `token count font: ${getHintV2TokenCountFont(merged)}`,
    '',
    '— Hint items —',
  ];
  for (const [key, def] of Object.entries(HINT_V2_ITEM_DEFS)) {
    const box = getHintV2ItemLayout(key, merged);
    lines.push(`${def.label}: x ${box.x} · y ${box.y} · w ${box.w} · h ${box.h}`);
  }
  return lines.join('\n');
}
