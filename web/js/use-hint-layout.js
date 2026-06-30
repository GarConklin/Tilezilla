/** In-game random hint confirm — Use ingame hint.png dialog + hit areas (% of frame). */

export const USE_HINT_ART = { w: 1376, h: 1143 };

export const USE_HINT_ITEM_DEFS = {
  close: { label: 'Close (X)', cssPrefix: 'close' },
  confirm: { label: 'Use hint bubble', cssPrefix: 'confirm' },
  cost: { label: 'Cost line (dynamic text)', cssPrefix: 'cost' },
  warn: { label: 'Warning line', cssPrefix: 'warn' },
};

export const DEFAULT_USE_HINT_BUTTON_ART = {
  close: '/img/X-gold-rnd-btn.png',
  confirm: '/img/use hint bubble.png',
};

export const DEFAULT_USE_HINT_LAYOUT = {
  dialog: {
    artW: 1376,
    artH: 1143,
    baseSrc: '/img/Use ingame hint.png',
    displayPad: 32,
    maxDesignWidth: 390,
    widthScale: 0.92,
  },
  buttons: { ...DEFAULT_USE_HINT_BUTTON_ART },
  items: {
    close: { x: 88, y: 2.5, w: 8, h: 7, hidden: false },
    confirm: { x: 14, y: 86, w: 72, h: 9, hidden: false },
    cost: { x: 8, y: 68, w: 84, h: 10, fontScale: 1, hidden: false },
    warn: { x: 8, y: 78, w: 84, h: 8, fontScale: 1, hidden: false },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:use-hint';
const LS_PENDING_KEY = 'tilezilla:layouts:use-hint:pending';

const USE_HINT_ITEM_SELECTORS = {
  close: '.tz-use-hint-dialog__close',
  confirm: '.tz-use-hint-dialog__confirm',
  cost: '.tz-use-hint-dialog__cost',
  warn: '.tz-use-hint-dialog__warn',
};

let layoutCache = null;

export function isUseHintTunerPage() {
  return /use-hint-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearUseHintLayoutCache() {
  layoutCache = null;
}

export function stashUseHintLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearUseHintLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeUseHintLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_USE_HINT_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.buttons && typeof raw.buttons === 'object') {
    base.buttons = { ...base.buttons, ...raw.buttons };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!USE_HINT_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadUseHintLayout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isUseHintTunerPage();

  if (!fromDisk && onTuner) {
    try {
      if (localStorage.getItem(LS_PENDING_KEY) === '1') {
        const draft = localStorage.getItem(LS_LAYOUT_KEY);
        if (draft) raw = JSON.parse(draft);
      }
    } catch {
      /* ignore */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/use_hint_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeUseHintLayout(raw);
  return layoutCache;
}

export async function reloadUseHintLayout() {
  clearUseHintLayoutCache();
  return loadUseHintLayout({ force: true, fromDisk: true });
}

export function getUseHintItemLayout(itemKey, layout) {
  const merged = mergeUseHintLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_USE_HINT_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    fontScale: item.fontScale ?? def.fontScale ?? 1,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function useHintBoxStyle(box) {
  return {
    position: 'absolute',
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
    margin: '0',
    boxSizing: 'border-box',
  };
}

export function applyUseHintItemPositions(layout, root = document) {
  const merged = mergeUseHintLayout(layout);
  const doc = root.ownerDocument || root;
  const frames = [...(doc.querySelectorAll?.('.tz-use-hint-dialog__frame') || [])];
  if (!frames.length) return;

  for (const frame of frames) {
    for (const [key, selector] of Object.entries(USE_HINT_ITEM_SELECTORS)) {
      const box = getUseHintItemLayout(key, merged);
      for (const el of frame.querySelectorAll(selector)) {
        Object.assign(el.style, useHintBoxStyle(box));
        if (key === 'confirm') {
          el.style.transform = 'none';
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        }
        if (key === 'close') {
          el.style.top = `${box.y}%`;
          el.style.right = 'auto';
          el.style.left = `${box.x}%`;
          el.style.width = `${box.w}%`;
          el.style.height = `${box.h}%`;
        }
        if (key === 'cost' || key === 'warn') {
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.fontSize = `calc(clamp(0.58rem, 2.4cqi, 0.82rem) * ${box.fontScale ?? 1})`;
        }
        if (box.hidden) {
          el.setAttribute('hidden', '');
        } else if (key !== 'warn') {
          el.removeAttribute('hidden');
        }
      }
    }
  }
}

export function fitUseHintDialog(dialog, layout, {
  maxViewportWidth = typeof window !== 'undefined' ? window.innerWidth : 720,
  maxViewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900,
} = {}) {
  if (!dialog) return;

  const merged = mergeUseHintLayout(layout);
  const d = merged.dialog || DEFAULT_USE_HINT_LAYOUT.dialog;
  const artW = d.artW ?? USE_HINT_ART.w;
  const artH = d.artH ?? USE_HINT_ART.h;
  const displayPad = d.displayPad ?? 32;
  const maxDesign = d.maxDesignWidth ?? 390;
  const widthScale = d.widthScale ?? 0.92;

  const vw = Math.max(280, maxViewportWidth - displayPad);
  const vh = Math.max(320, maxViewportHeight - displayPad);
  const baseW = Math.floor(maxDesign * widthScale);
  const wFromHeight = (vh * artW) / artH;
  const w = Math.floor(Math.min(baseW, vw, wFromHeight, artW));
  const h = Math.floor((w * artH) / artW);

  dialog.style.width = `${w}px`;
  dialog.style.height = `${h}px`;
  dialog.style.aspectRatio = 'auto';
}

export function applyUseHintLayout(layout, target = document.documentElement) {
  const merged = mergeUseHintLayout(layout);
  const d = merged.dialog || DEFAULT_USE_HINT_LAYOUT.dialog;

  target.style.setProperty('--tz-use-hint-art-w', String(d.artW ?? USE_HINT_ART.w));
  target.style.setProperty('--tz-use-hint-art-h', String(d.artH ?? USE_HINT_ART.h));
  target.style.setProperty('--tz-use-hint-display-pad', `${d.displayPad ?? 32}px`);
  target.style.setProperty('--tz-use-hint-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-use-hint-width-scale', String(d.widthScale ?? 0.92));

  const doc = target.ownerDocument || document;
  const bg = doc.getElementById('useHintConfirmBg') || doc.querySelector('.tz-use-hint-dialog__bg');
  if (bg && d.baseSrc) bg.src = d.baseSrc;

  const buttons = merged.buttons || DEFAULT_USE_HINT_BUTTON_ART;
  const closeImg = doc.querySelector('#useHintConfirmCloseBtn img, .tz-use-hint-dialog__close img');
  const confirmImg = doc.querySelector('#useHintConfirmBtn img, .tz-use-hint-dialog__confirm img');
  if (closeImg && buttons.close) closeImg.src = buttons.close;
  if (confirmImg && buttons.confirm) confirmImg.src = buttons.confirm;

  for (const dialog of doc.querySelectorAll('.tz-use-hint-dialog')) {
    fitUseHintDialog(dialog, merged);
  }
  applyUseHintItemPositions(merged, doc);
}

export function buildUseHintLayoutReport(layout) {
  const merged = mergeUseHintLayout(layout);
  const d = merged.dialog || {};
  const lines = [
    'Use random hint confirm (Use ingame hint.png)',
    `Base art: ${d.baseSrc ?? DEFAULT_USE_HINT_LAYOUT.dialog.baseSrc}`,
    `Art ${d.artW ?? USE_HINT_ART.w}×${d.artH ?? USE_HINT_ART.h}`,
    `maxDesignWidth ${d.maxDesignWidth ?? 390}px · displayPad ${d.displayPad ?? 32}px · widthScale ${d.widthScale ?? 0.92}`,
    `Button art: close ${merged.buttons?.close ?? ''} · confirm ${merged.buttons?.confirm ?? ''}`,
    'Hit areas are % of dialog frame (top-left origin)',
    '',
  ];
  for (const [key, def] of Object.entries(USE_HINT_ITEM_DEFS)) {
    const box = getUseHintItemLayout(key, merged);
    const hiddenNote = box.hidden ? ' · hidden in game' : '';
    const extra = (key === 'cost' || key === 'warn') ? ` · fontScale ${box.fontScale ?? 1}` : '';
    lines.push(`${def.label}: x ${box.x}% · y ${box.y}% · w ${box.w}% · h ${box.h}%${extra}${hiddenNote}`);
  }
  return lines.join('\n');
}
