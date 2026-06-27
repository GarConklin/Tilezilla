/** Experimental main screen v2 — 390×844 artboard zones (% of stage). */

export const MAIN_SCREEN_V2_ARTBOARD = { w: 390, h: 844 };

export const MAIN_SCREEN_V2_ITEM_DEFS = {
  topBar: { label: 'TopBar layout', cssPrefix: 'top-bar' },
  menu: { label: 'Hamburger', cssPrefix: 'menu' },
  title: { label: 'Title bar', cssPrefix: 'title' },
  board: { label: 'Main board area', cssPrefix: 'board' },
  infoBar: { label: 'InfoBar layout', cssPrefix: 'info-bar' },
  preview: { label: 'Preview area', cssPrefix: 'preview' },
  tilebag: { label: 'TileBag layout', cssPrefix: 'tilebag' },
  bottomMenuTab: { label: 'Bottom menu expand tab (closed)', cssPrefix: 'bottom-menu-tab' },
  bottomMenuCloseTab: { label: 'Bottom menu close tab (open)', cssPrefix: 'bottom-menu-close-tab' },
  bottomMenuPanel: { label: 'Bottom menu panel (expanded)', cssPrefix: 'bottom-menu-panel' },
};

export const DEFAULT_MAIN_SCREEN_V2_LAYOUT = {
  background: '/img/Background lake and sun-no-water.png',
  backgroundWaterA: '/img/Background lake and sun-Just-water1.png',
  backgroundWaterB: '/img/Background lake and sun-Just-water2.png',
  art: {
    src: '',
    objectFit: 'cover',
    objectPosition: 'center center',
  },
  items: {
    topBar: { x: 0, y: 0, w: 100, h: 7.58 },
    menu: { x: 2.05, y: 0.95, w: 11.69, h: 5.41 },
    title: { x: 20.51, y: 0.47, w: 58.99, h: 6.65 },
    board: { x: 0, y: 7.7, w: 100, h: 46.21 },
    infoBar: { x: 0, y: 7.7, w: 100, h: 1.78 },
    preview: { x: 0, y: 56.17, w: 100, h: 30.69 },
    tilebag: { x: 0, y: 88.15, w: 100, h: 11.85 },
    bottomMenuTab: { x: 22, y: 96.2, w: 56, h: 3.8 },
    bottomMenuCloseTab: { x: 22, y: 74.7, w: 56, h: 3.8, opacity: 1, bg: '' },
    bottomMenuPanel: { x: 0, y: 78.5, w: 100, h: 21.5 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:main-screen-v2';
const LS_PENDING_KEY = 'tilezilla:layouts:main-screen-v2:pending';

let layoutCache = null;

export function isMainScreenV2TunerPage() {
  return /main-screen-v2-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearMainScreenV2LayoutCache() {
  layoutCache = null;
}

export function stashMainScreenV2LayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearMainScreenV2LayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeMainScreenV2Layout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_MAIN_SCREEN_V2_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (typeof raw.background === 'string') base.background = raw.background;
  if (typeof raw.backgroundWaterA === 'string') base.backgroundWaterA = raw.backgroundWaterA;
  if (typeof raw.backgroundWaterB === 'string') base.backgroundWaterB = raw.backgroundWaterB;
  if (raw.art && typeof raw.art === 'object') {
    base.art = { ...base.art, ...raw.art };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!MAIN_SCREEN_V2_ITEM_DEFS[key] || typeof val !== 'object') continue;
      const { px, ...rest } = val;
      base.items[key] = { ...base.items[key], ...rest };
    }
  }
  return base;
}

export async function loadMainScreenV2Layout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isMainScreenV2TunerPage();
  const hasPending = localStorage.getItem(LS_PENDING_KEY) === '1';

  // Only the tuner prefers an in-progress browser draft. The live game always reads JSON from disk.
  if (!fromDisk && onTuner && hasPending) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* fall through */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/main_screen_v2_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  if (!raw) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  layoutCache = mergeMainScreenV2Layout(raw);
  return layoutCache;
}

export async function reloadMainScreenV2Layout() {
  clearMainScreenV2LayoutCache();
  return loadMainScreenV2Layout({ force: true, fromDisk: true });
}

export function getMainScreenV2ItemLayout(itemKey, layout) {
  const merged = mergeMainScreenV2Layout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_MAIN_SCREEN_V2_LAYOUT.items[itemKey] || {};
  const box = {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
  };
  if (itemKey === 'bottomMenuCloseTab') {
    box.opacity = item.opacity ?? def.opacity ?? 1;
    box.bg = item.bg ?? def.bg ?? '';
  }
  return box;
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-msv2-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-msv2-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-msv2-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-msv2-${cssPrefix}-h`, `${box.h}%`);
}

function cssBgUrl(path) {
  const bg = String(path || '').trim();
  if (!bg) return '';
  return bg.includes('(') ? bg : `url("${bg.replace(/"/g, '%22')}")`;
}

export function applyMainScreenV2Layout(layout, target = document.documentElement) {
  const merged = mergeMainScreenV2Layout(layout);
  for (const [key, meta] of Object.entries(MAIN_SCREEN_V2_ITEM_DEFS)) {
    setItemVars(target, meta.cssPrefix, getMainScreenV2ItemLayout(key, merged));
  }
  const closeTab = getMainScreenV2ItemLayout('bottomMenuCloseTab', merged);
  target.style.setProperty('--tz-msv2-bottom-menu-close-tab-opacity', String(closeTab.opacity ?? 1));
  const closeBg = String(closeTab.bg ?? '').trim();
  target.style.setProperty('--tz-msv2-bottom-menu-close-tab-bg', closeBg || 'transparent');
  const art = merged.art || {};
  target.style.setProperty('--tz-msv2-art-fit', art.objectFit || 'cover');
  target.style.setProperty('--tz-msv2-art-position', art.objectPosition || 'center center');
  const sky = cssBgUrl(merged.background || DEFAULT_MAIN_SCREEN_V2_LAYOUT.background);
  if (sky) target.style.setProperty('--tz-msv2-bg', sky);
  const waterA = cssBgUrl(merged.backgroundWaterA || DEFAULT_MAIN_SCREEN_V2_LAYOUT.backgroundWaterA);
  if (waterA) target.style.setProperty('--tz-msv2-bg-water-a', waterA);
  const waterB = cssBgUrl(merged.backgroundWaterB || DEFAULT_MAIN_SCREEN_V2_LAYOUT.backgroundWaterB);
  if (waterB) target.style.setProperty('--tz-msv2-bg-water-b', waterB);
}

export function applyMainScreenV2Art(imgEl, layout) {
  if (!imgEl) return;
  const merged = mergeMainScreenV2Layout(layout);
  const src = String(merged.art?.src || '').trim();
  if (src) {
    imgEl.src = src;
    imgEl.hidden = false;
  } else {
    imgEl.removeAttribute('src');
    imgEl.hidden = true;
  }
  imgEl.style.objectFit = merged.art?.objectFit || 'cover';
  imgEl.style.objectPosition = merged.art?.objectPosition || 'center center';
}

export function buildMainScreenV2LayoutReport(layout) {
  const merged = mergeMainScreenV2Layout(layout);
  const lines = [
    `Main screen v2 — ${MAIN_SCREEN_V2_ARTBOARD.w}×${MAIN_SCREEN_V2_ARTBOARD.h} mobile stage`,
    `background (sky): ${merged.background || '(none)'}`,
    `background water A: ${merged.backgroundWaterA || '(none)'}`,
    `background water B: ${merged.backgroundWaterB || '(none)'}`,
    `art overlay: ${merged.art?.src || '(none)'}`,
    '',
  ];
  for (const [key, meta] of Object.entries(MAIN_SCREEN_V2_ITEM_DEFS)) {
    const box = getMainScreenV2ItemLayout(key, merged);
    let line = `${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%`;
    if (key === 'bottomMenuCloseTab') {
      line += ` opacity=${box.opacity ?? 1} bg=${box.bg || '(transparent)'}`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}
