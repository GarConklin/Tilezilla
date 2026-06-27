/** Preview frame hit areas — artboard px within main-screen v2 preview zone (390×259). */

import {
  DEFAULT_PREVIEW_TILE_IN_SLOT,
  applyPreviewTileInSlot,
  previewTileInSlotReportLines,
} from './preview-tile-display.js';

export const PREVIEW_V2_ART = { w: 390, h: 259 };

export const DEFAULT_PREVIEW_V2_ART = {
  frame: '/img/preview tile Area bubble.png',
  rendererStage: '',
  rendererStageWidthScale: 0.9,
};

/** Dev-only scratch assets under img/Stuff must never ship in game UI. */
export function isBlockedGameImagePath(path) {
  const p = String(path || '').trim();
  if (!p) return true;
  return /\/Stuff\//i.test(p) || /^Stuff\//i.test(p);
}



/** V1 interaction keys (shared cssKey names with preview-layout.js). */

const PREVIEW_V2_INTERACTION_DEFS = {

  renderer: { label: 'Tile slot (preview)', cssKey: 'renderer' },

  rotateCcw: { label: 'Rotate left', cssKey: 'rotate-ccw' },

  rotateCw: { label: 'Rotate right', cssKey: 'rotate-cw' },

  tileDir: { label: 'Rotation ° label', cssKey: 'tile-dir' },

  hintPreview: { label: 'Hint plaque (below rotation)', cssKey: 'hint-preview' },

  undo: { label: 'Undo', cssKey: 'undo' },

  reset: { label: 'Reset', cssKey: 'reset' },

};



export const PREVIEW_V2_DATA_DEFS = {

  gameData: { label: 'Game_Data', cssKey: 'game-data' },

  userData: { label: 'User_data', cssKey: 'user-data' },

  infoData: { label: 'Info_data', cssKey: 'info-data' },

  timerData: { label: 'Timer_data', cssKey: 'timer-data' },

  hintData: { label: 'Hint_data', cssKey: 'hint-data' },

};



export const PREVIEW_V2_ITEM_DEFS = {

  ...PREVIEW_V2_DATA_DEFS,

  ...PREVIEW_V2_INTERACTION_DEFS,

};



export const PREVIEW_V2_DATA_KEYS = Object.keys(PREVIEW_V2_DATA_DEFS);

export const PREVIEW_V2_INTERACTION_KEYS = Object.keys(PREVIEW_V2_INTERACTION_DEFS);

export const PREVIEW_V2_ALL_ITEM_KEYS = Object.keys(PREVIEW_V2_ITEM_DEFS);



export const DEFAULT_PREVIEW_V2_LAYOUT = {

  frame: { w: 390, h: 259 },

  art: { ...DEFAULT_PREVIEW_V2_ART },

  items: {

    userData: { x: 8, y: 4, w: 104, h: 72 },

    gameData: { x: 118, y: 4, w: 154, h: 54 },

    infoData: { x: 118, y: 48, w: 154, h: 18 },

    timerData: { x: 278, y: 4, w: 104, h: 52 },

    hintData: { x: 8, y: 6, w: 120, h: 64 },

    renderer: { x: 118, y: 88, w: 162, h: 120 },

    rotateCcw: { x: 8, y: 100, w: 52, h: 48 },

    rotateCw: { x: 330, y: 100, w: 52, h: 48 },

    tileDir: { x: 202, y: 202, w: 18, h: 8 },

    hintPreview: { x: 148, y: 212, w: 94, h: 48 },

    undo: { x: 250, y: 212, w: 64, h: 28 },

    reset: { x: 74, y: 212, w: 64, h: 28 },

  },

  tileInSlot: { ...DEFAULT_PREVIEW_TILE_IN_SLOT },

};

const LS_LAYOUT_KEY = 'tilezilla:layouts:preview-v2';
const LS_PENDING_KEY = 'tilezilla:layouts:preview-v2:pending';



let layoutCache = null;



export function clearPreviewV2LayoutCache() {

  layoutCache = null;

}



export function stashPreviewV2LayoutDraft(layout) {

  try {

    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));

    localStorage.setItem(LS_PENDING_KEY, '1');

  } catch {

    /* ignore */

  }

}



export function clearPreviewV2LayoutDraft() {

  try {

    localStorage.removeItem(LS_PENDING_KEY);

  } catch {

    /* ignore */

  }

}



export function mergePreviewV2Layout(raw) {

  const base = JSON.parse(JSON.stringify(DEFAULT_PREVIEW_V2_LAYOUT));

  if (!raw || typeof raw !== 'object') return base;

  if (raw.frame && typeof raw.frame === 'object') {

    base.frame = { ...base.frame, ...raw.frame };

  }

  if (raw.art && typeof raw.art === 'object') {
    base.art = { ...base.art, ...raw.art };
    if (raw.art.frame) base.art.frame = raw.art.frame;
    if (raw.art.rendererStage && !isBlockedGameImagePath(raw.art.rendererStage)) {
      base.art.rendererStage = raw.art.rendererStage;
    }
    if (raw.art.rendererStageWidthScale != null) {
      base.art.rendererStageWidthScale = raw.art.rendererStageWidthScale;
    }
  }

  if (raw.items && typeof raw.items === 'object') {

    for (const [key, val] of Object.entries(raw.items)) {

      if (!PREVIEW_V2_ITEM_DEFS[key] || typeof val !== 'object') continue;

      base.items[key] = { ...base.items[key], ...val };

    }

    if (raw.items.hintData && !raw.items.hintPreview) {
      base.items.hintPreview = { ...base.items.hintPreview, ...raw.items.hintData };
    }

  }

  if (raw.tileInSlot && typeof raw.tileInSlot === 'object') {
    base.tileInSlot = { ...base.tileInSlot, ...raw.tileInSlot };
  }

  return base;

}



export async function loadPreviewV2Layout({ force = false } = {}) {

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

      const res = await fetch(`/data/preview_v2_layout.json?t=${Date.now()}`, { cache: 'no-store' });

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



  layoutCache = mergePreviewV2Layout(raw);

  return layoutCache;

}



export async function reloadPreviewV2Layout() {

  clearPreviewV2LayoutCache();

  return loadPreviewV2Layout({ force: true });

}



export function getPreviewV2ItemLayout(itemKey, layout) {

  const merged = mergePreviewV2Layout(layout);

  const item = merged.items[itemKey] || {};

  const def = DEFAULT_PREVIEW_V2_LAYOUT.items[itemKey] || {};

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



function assetUrl(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  if (p.startsWith('url(')) return p;
  return p
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
    .replace(/^%2F/, '/');
}

export function applyPreviewV2RendererStage(target = document.documentElement, layout) {
  const merged = mergePreviewV2Layout(layout);
  const art = merged.art || DEFAULT_PREVIEW_V2_ART;
  const scale = Number(art.rendererStageWidthScale);
  const widthScale = Number.isFinite(scale) && scale > 0 ? scale : 0.9;
  target.style.setProperty('--tz-preview-renderer-stage-width-scale', String(widthScale));
  const raw = art.rendererStage || '';
  const src = isBlockedGameImagePath(raw) ? '' : assetUrl(raw);
  const root = target === document.documentElement ? document : target;
  root.querySelectorAll('.tz-preview-renderer__stage').forEach((img) => {
    if (src) {
      img.src = src;
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  });
}

export function applyPreviewV2Art(target = document.documentElement, layout) {
  const merged = mergePreviewV2Layout(layout);
  const art = merged.art || DEFAULT_PREVIEW_V2_ART;
  target.style.setProperty('--tz-preview-v2-frame-bg', cssBgUrl(art.frame));
  applyPreviewV2RendererStage(target, merged);
}



export function applyPreviewV2ArtImages() {

  /* Hint art is applied via hint-v2-layout.js */

}



export function applyPreviewV2Layout(layout, target = document.documentElement) {

  const merged = mergePreviewV2Layout(layout);

  const frame = merged.frame || PREVIEW_V2_ART;

  target.style.setProperty('--tz-preview-art-w', String(frame.w ?? PREVIEW_V2_ART.w));

  target.style.setProperty('--tz-preview-art-h', String(frame.h ?? PREVIEW_V2_ART.h));

  target.style.setProperty('--tz-preview-display-scale', '1');

  target.style.setProperty('--tz-preview-size-scale', '1');

  target.style.setProperty('--tz-preview-height-scale', '1');

  target.style.setProperty('--tz-preview-height-add', '0px');

  target.style.setProperty('--tz-preview-height-stretch-down', '0px');

  target.style.setProperty('--tz-preview-height-stretch-up', '0px');

  target.style.setProperty('--tz-preview-slot-nudge-y', '0px');

  for (const [key, meta] of Object.entries(PREVIEW_V2_ITEM_DEFS)) {

    setBoxVars(target, meta.cssKey, getPreviewV2ItemLayout(key, merged));

  }

  applyPreviewV2Art(target, merged);

  applyPreviewTileInSlot(merged.tileInSlot, target);

}



export { applyPreviewTileInSlot, DEFAULT_PREVIEW_TILE_IN_SLOT } from './preview-tile-display.js';

export function buildPreviewV2LayoutReport(layout) {

  const merged = mergePreviewV2Layout(layout);

  const frame = merged.frame || PREVIEW_V2_ART;

  const art = merged.art || DEFAULT_PREVIEW_V2_ART;

  const lines = [

    `Preview v2 layout (artboard ${frame.w}×${frame.h}px)`,

    'Coordinates are pixels within the main-screen v2 preview zone',

    '',

    '— Art —',

    `frame: ${art.frame || '(none)'}`,
    `rendererStage: ${art.rendererStage || '(none)'}`,
    `rendererStageWidthScale: ${art.rendererStageWidthScale ?? 0.9}`,
    '',

    '— Data overlays —',

  ];

  for (const [key, def] of Object.entries(PREVIEW_V2_DATA_DEFS)) {

    const box = getPreviewV2ItemLayout(key, merged);

    lines.push(`${def.label}: x ${box.x} · y ${box.y} · w ${box.w} · h ${box.h}`);

  }

  lines.push('', '— Sub-layouts —');

  lines.push('Data zone items: game-data-v2-tuner.html · info-data-v2-tuner.html · timer-data-v2-tuner.html · preview-data-v2-tuner.html');

  lines.push('Hint plaque zone: preview-v2-tuner (Hint plaque below rotation) · hint items: hint-v2-tuner.html');
  lines.push('Use-hint hit: tile renderer zone from preview-v2-tuner (Tile slot)');

  lines.push('', '— Preview controls —');

  for (const [key, def] of Object.entries(PREVIEW_V2_INTERACTION_DEFS)) {

    const box = getPreviewV2ItemLayout(key, merged);

    lines.push(`${def.label}: x ${box.x} · y ${box.y} · w ${box.w} · h ${box.h}`);

  }

  lines.push('', '— Tile graphic in slot —');

  for (const line of previewTileInSlotReportLines(merged.tileInSlot)) {
    lines.push(line);
  }

  lines.push('', 'Hint zones: tune in hint-v2-tuner.html');

  return lines.join('\n');

}


