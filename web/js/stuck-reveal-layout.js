/** I'm Stuck reveal art (Imstuckreveal.png) — hit areas as % of dialog frame. */



export const STUCK_REVEAL_ART = { w: 1402, h: 1122 };



export const STUCK_REVEAL_ITEM_DEFS = {

  preview: { label: 'Route preview', cssPrefix: 'reveal-preview' },

  keep: { label: 'Keep Trying', cssPrefix: 'reveal-keep' },

  close: { label: 'Close (X)', cssPrefix: 'reveal-close' },

};



export const DEFAULT_STUCK_REVEAL_LAYOUT = {

  dialog: {

    previewWidthRatio: 0.95,

    artW: STUCK_REVEAL_ART.w,

    artH: STUCK_REVEAL_ART.h,

  },

  items: {

    preview: {

      x: 74,

      y: 24,

      w: 36,

      h: 58,

      widthScale: 0.95,

      heightScale: 0.45,

      boardScale: 1.45,

      centerX: true,

    },

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

  if (raw.dialog && typeof raw.dialog === 'object') {

    base.dialog = { ...base.dialog, ...raw.dialog };

  }

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

    widthScale: item.widthScale ?? def.widthScale ?? 1,

    heightScale: item.heightScale ?? def.heightScale ?? 1,

    boardScale: item.boardScale ?? def.boardScale ?? 1,

    centerX: item.centerX ?? def.centerX ?? false,

  };

}



export function getStuckRevealDialogLayout(layout) {

  const merged = mergeStuckRevealLayout(layout);

  const d = merged.dialog || {};

  const def = DEFAULT_STUCK_REVEAL_LAYOUT.dialog;

  return {

    previewWidthRatio: d.previewWidthRatio ?? def.previewWidthRatio ?? 0.95,

    artW: d.artW ?? def.artW ?? STUCK_REVEAL_ART.w,

    artH: d.artH ?? def.artH ?? STUCK_REVEAL_ART.h,

  };

}



function setItemVars(target, cssPrefix, box) {

  target.style.setProperty(`--tz-stuck-${cssPrefix}-x`, `${box.x}%`);

  target.style.setProperty(`--tz-stuck-${cssPrefix}-y`, `${box.y}%`);

  target.style.setProperty(`--tz-stuck-${cssPrefix}-w`, `${box.w}%`);

  target.style.setProperty(`--tz-stuck-${cssPrefix}-h`, `${box.h}%`);

  if (cssPrefix === 'reveal-preview') {

    target.style.setProperty(

      '--tz-stuck-reveal-preview-width-scale',

      String(box.widthScale ?? 0.95),

    );

    target.style.setProperty(

      '--tz-stuck-reveal-preview-height-scale',

      String(box.heightScale ?? 0.45),

    );

    target.style.setProperty(

      '--tz-stuck-reveal-preview-board-scale',

      String(box.boardScale ?? 1),

    );

    target.style.setProperty(

      '--tz-stuck-reveal-preview-center-x',

      box.centerX ? '1' : '0',

    );

  }

}



export function applyStuckRevealLayout(layout, target = document.documentElement) {

  const merged = mergeStuckRevealLayout(layout);

  const dialog = getStuckRevealDialogLayout(merged);

  target.style.setProperty(

    '--tz-stuck-preview-layout-width-ratio',

    String(dialog.previewWidthRatio),

  );

  target.style.setProperty('--tz-stuck-reveal-art-w', String(dialog.artW));

  target.style.setProperty('--tz-stuck-reveal-art-h', String(dialog.artH));

  for (const [key, meta] of Object.entries(STUCK_REVEAL_ITEM_DEFS)) {

    setItemVars(target, meta.cssPrefix, getStuckRevealItemLayout(key, merged));

  }

}



export function buildStuckRevealLayoutReport(layout) {

  const merged = mergeStuckRevealLayout(layout);

  const dialog = getStuckRevealDialogLayout(merged);

  const lines = [

    "I'm Stuck reveal layout (Imstuckreveal.png)",

    'Coordinates are % of dialog frame (top-left origin; preview X is center when centerX)',

    '',

    `dialog.previewWidthRatio: ${dialog.previewWidthRatio}`,

    '',

  ];

  for (const [key, def] of Object.entries(STUCK_REVEAL_ITEM_DEFS)) {

    const box = getStuckRevealItemLayout(key, merged);

    const scalePart = key === 'preview'

      ? ` · widthScale ${box.widthScale} · heightScale ${box.heightScale} · boardScale ${box.boardScale} · centerX ${box.centerX}`

      : '';

    lines.push(`${def.label}: x ${box.x}% · y ${box.y}% · w ${box.w}% · h ${box.h}%${scalePart}`);

  }

  return lines.join('\n');

}


