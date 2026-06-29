/** Load screen button hits (% of Load-Screen.png art frame). */

import { DEFAULT_PREVIEW_V2_ART, isBlockedGameImagePath } from './preview-v2-layout.js';

export const LOAD_SCREEN_ART_PIXELS = { w: 375, h: 467 };

export const LOAD_SCREEN_ITEM_DEFS = {
  art: { label: 'Load screen image', cssPrefix: 'art', kind: 'art', frame: 'stage' },
  preview: { label: 'Preview frame overlay', cssPrefix: 'preview', frame: 'art' },
  guest: { label: 'Play As Guest', cssPrefix: 'guest', frame: 'art' },
  login: { label: 'Login', cssPrefix: 'login', frame: 'art' },
  carouselPrev: { label: 'Carousel ← prev', cssPrefix: 'carousel-prev', frame: 'carousel' },
  carouselNext: { label: 'Carousel → next', cssPrefix: 'carousel-next', frame: 'carousel' },
  carouselPlay: { label: 'Carousel play', cssPrefix: 'carousel-play', frame: 'carousel' },
  carouselSlide: { label: 'Carousel slide image', cssPrefix: 'carousel-slide', kind: 'carouselSlide', frame: 'carousel' },
};

export const DEFAULT_LOAD_SCREEN_LAYOUT = {
  art: {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    artPixelW: LOAD_SCREEN_ART_PIXELS.w,
    artPixelH: LOAD_SCREEN_ART_PIXELS.h,
    frame: DEFAULT_PREVIEW_V2_ART.frame,
    src: '/img/Load-Screen.png',
    objectFit: 'fill',
    objectPosition: 'top center',
    maxHeightPercent: 58,
  },
  items: {
    preview: { x: 11, y: 33, w: 78, h: 24, hidden: true },
    guest: { x: 8, y: 67.5, w: 36, h: 8.5 },
    login: { x: 56, y: 67.5, w: 36, h: 8.5 },
    carouselPrev: { x: 6, y: 87.5, w: 11, h: 8 },
    carouselNext: { x: 83, y: 87.5, w: 11, h: 8 },
    carouselPlay: { x: 41, y: 30, w: 18, h: 16 },
    carouselSlide: { x: 0, y: 0, w: 100, h: 100 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:load-screen';
const LS_PENDING_KEY = 'tilezilla:layouts:load-screen:pending';

let layoutCache = null;

export function isLoadScreenTunerPage() {
  return /load-screen-tuner(?:\.html)?$/i.test(window.location.pathname);
}

function cssBgUrl(path) {
  const p = String(path || '').trim();
  if (!p) return 'none';
  if (p.startsWith('url(')) return p;
  const encoded = p
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
    .replace(/^%2F/, '/');
  return `url("${encoded}")`;
}

export function clearLoadScreenLayoutCache() {
  layoutCache = null;
}

export function stashLoadScreenLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearLoadScreenLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeLoadScreenLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_LOAD_SCREEN_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.art && typeof raw.art === 'object') {
    base.art = { ...base.art, ...raw.art };
    if (isBlockedGameImagePath(base.art.frame)) {
      base.art.frame = DEFAULT_PREVIEW_V2_ART.frame;
    }
    delete base.art.rendererStage;
    delete base.art.rendererStageWidthScale;
    if (!base.art.src) base.art.src = DEFAULT_LOAD_SCREEN_LAYOUT.art.src;
    if (!base.art.objectFit) base.art.objectFit = DEFAULT_LOAD_SCREEN_LAYOUT.art.objectFit;
    if (!base.art.objectPosition) base.art.objectPosition = DEFAULT_LOAD_SCREEN_LAYOUT.art.objectPosition;
    if (!base.art.artPixelW) base.art.artPixelW = DEFAULT_LOAD_SCREEN_LAYOUT.art.artPixelW;
    if (!base.art.artPixelH) base.art.artPixelH = DEFAULT_LOAD_SCREEN_LAYOUT.art.artPixelH;
    if (base.art.maxHeightPercent == null) {
      base.art.maxHeightPercent = DEFAULT_LOAD_SCREEN_LAYOUT.art.maxHeightPercent;
    }
    for (const dim of ['x', 'y', 'w', 'h']) {
      if (base.art[dim] == null) base.art[dim] = DEFAULT_LOAD_SCREEN_LAYOUT.art[dim];
    }
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!LOAD_SCREEN_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadLoadScreenLayout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isLoadScreenTunerPage();

  // Only the tuner prefers an in-progress browser draft. The live page always reads JSON from disk.
  if (!fromDisk && onTuner) {
    try {
      if (localStorage.getItem(LS_PENDING_KEY) === '1') {
        const draft = localStorage.getItem(LS_LAYOUT_KEY);
        if (draft) raw = JSON.parse(draft);
      }
    } catch {
      /* fall through */
    }
  }

  if (!raw || fromDisk) {
    try {
      const res = await fetch(`/data/load_screen_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeLoadScreenLayout(raw);
  return layoutCache;
}

export async function reloadLoadScreenLayout({ fromDisk = false } = {}) {
  clearLoadScreenLayoutCache();
  return loadLoadScreenLayout({ force: true, fromDisk });
}

export function getLoadScreenItemLayout(itemKey, layout) {
  const merged = mergeLoadScreenLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_LOAD_SCREEN_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function setItemVars(target, cssPrefix, box) {
  target.style.setProperty(`--tz-load-${cssPrefix}-x`, `${box.x}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-y`, `${box.y}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-w`, `${box.w}%`);
  target.style.setProperty(`--tz-load-${cssPrefix}-h`, `${box.h}%`);
}

export function getLoadScreenArtLayout(layout) {
  const merged = mergeLoadScreenLayout(layout);
  const art = merged.art || DEFAULT_LOAD_SCREEN_LAYOUT.art;
  const def = DEFAULT_LOAD_SCREEN_LAYOUT.art;
  return {
    x: art.x ?? def.x ?? 0,
    y: art.y ?? def.y ?? 0,
    w: art.w ?? def.w ?? 100,
    h: art.h ?? def.h ?? 100,
    src: art.src || def.src,
    frame: isBlockedGameImagePath(art.frame) ? DEFAULT_PREVIEW_V2_ART.frame : art.frame,
    objectFit: art.objectFit || def.objectFit,
    objectPosition: art.objectPosition || def.objectPosition,
    artPixelW: art.artPixelW ?? def.artPixelW ?? LOAD_SCREEN_ART_PIXELS.w,
    artPixelH: art.artPixelH ?? def.artPixelH ?? LOAD_SCREEN_ART_PIXELS.h,
    maxHeightPercent: art.maxHeightPercent ?? def.maxHeightPercent ?? 58,
  };
}

export function applyLoadScreenArt(layout) {
  const art = getLoadScreenArtLayout(layout);
  const root = document.documentElement;
  root.style.setProperty('--tz-load-art-x', `${art.x}%`);
  root.style.setProperty('--tz-load-art-y', `${art.y}%`);
  root.style.setProperty('--tz-load-art-w', `${art.w}%`);
  root.style.setProperty('--tz-load-art-h', `${art.h}%`);
  root.style.setProperty('--tz-load-art-aspect', `${art.artPixelW} / ${art.artPixelH}`);
  root.style.setProperty('--tz-load-art-fit', art.objectFit);
  root.style.setProperty('--tz-load-art-position', art.objectPosition);
  root.style.setProperty('--tz-load-art-max-h', `${art.maxHeightPercent}%`);
  root.style.setProperty(
    '--tz-load-preview-frame-bg',
    cssBgUrl(art.frame),
  );
  document.querySelectorAll('.tz-load-screen__art').forEach((img) => {
    if (img.getAttribute('src') !== art.src) img.setAttribute('src', art.src);
    img.style.objectFit = art.objectFit;
    img.style.objectPosition = art.objectPosition;
  });
}

function isLoadScreenItemKey(key) {
  return key !== 'art' && Boolean(LOAD_SCREEN_ITEM_DEFS[key]);
}

export function getLoadScreenItemFrame(itemKey) {
  return LOAD_SCREEN_ITEM_DEFS[itemKey]?.frame || 'art';
}

export function isLoadScreenCarouselSlideItem(itemKey) {
  return LOAD_SCREEN_ITEM_DEFS[itemKey]?.kind === 'carouselSlide';
}

const LOAD_SCREEN_ITEM_SELECTORS = {
  preview: '.tz-load-screen__preview',
  guest: '.tz-load-screen__hit--guest',
  login: '.tz-load-screen__hit--login',
  carouselPrev: '.tz-load-screen__carousel-arrow--prev',
  carouselNext: '.tz-load-screen__carousel-arrow--next',
  carouselPlay: '.tz-load-screen__carousel-play',
};

function loadScreenBoxStyle(box) {
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

/** Inline tuned boxes on real DOM nodes (tuner + index.html) so layout cannot drift via CSS vars. */
export function applyLoadScreenItemPositions(layout, root = document) {
  const merged = mergeLoadScreenLayout(layout);
  const doc = root.ownerDocument || root;
  const screens = [...(doc.querySelectorAll?.('.tz-load-screen') || [])];
  if (!screens.length) return;

  const art = getLoadScreenArtLayout(merged);
  const slide = getLoadScreenItemLayout('carouselSlide', merged);
  const scaleW = (slide.w ?? 100) / 100;
  const scaleH = (slide.h ?? 100) / 100;

  for (const screen of screens) {
    const artWrap = screen.querySelector('.tz-load-screen__art-wrap');
    if (artWrap) {
      if (screen.classList.contains('tz-load-screen--with-carousel')) {
        artWrap.style.maxHeight = `${art.maxHeightPercent}%`;
        artWrap.style.left = '';
        artWrap.style.top = '';
        artWrap.style.width = '';
        artWrap.style.height = '';
      } else {
        Object.assign(artWrap.style, loadScreenBoxStyle({
          x: art.x,
          y: art.y,
          w: art.w,
          h: art.h,
        }));
        artWrap.style.maxHeight = `${art.h}%`;
      }
    }

    for (const [key, selector] of Object.entries(LOAD_SCREEN_ITEM_SELECTORS)) {
      const box = getLoadScreenItemLayout(key, merged);
      for (const el of screen.querySelectorAll(selector)) {
        Object.assign(el.style, loadScreenBoxStyle(box));
        if (key === 'preview') el.hidden = Boolean(box.hidden);
      }
    }

    for (const img of screen.querySelectorAll('.tz-load-screen__carousel-slide')) {
      img.style.transform = `scale(${scaleW}, ${scaleH})`;
      img.style.transformOrigin = 'center center';
    }
  }
}

export function applyLoadScreenLayout(layout, target = document.documentElement) {
  const merged = mergeLoadScreenLayout(layout);
  for (const [key, meta] of Object.entries(LOAD_SCREEN_ITEM_DEFS)) {
    if (!isLoadScreenItemKey(key)) continue;
    setItemVars(target, meta.cssPrefix, getLoadScreenItemLayout(key, merged));
  }
  const preview = getLoadScreenItemLayout('preview', merged);
  document.querySelectorAll('.tz-load-screen__preview').forEach((el) => {
    el.hidden = Boolean(preview.hidden);
  });
  const slide = getLoadScreenItemLayout('carouselSlide', merged);
  target.style.setProperty('--tz-load-carousel-slide-w', String(slide.w ?? 100));
  target.style.setProperty('--tz-load-carousel-slide-h', String(slide.h ?? 100));
  applyLoadScreenArt(merged);
  applyLoadScreenItemPositions(merged, target.ownerDocument || document);
}

export function buildLoadScreenLayoutReport(layout) {
  const merged = mergeLoadScreenLayout(layout);
  const art = getLoadScreenArtLayout(merged);
  const lines = [
    'Load screen — hits are % of Load-Screen.png art frame (inside art-wrap)',
    `Art: ${art.src}`,
    `Art box: x=${art.x}% y=${art.y}% w=${art.w}% h=${art.h}%`,
    `Art pixels: ${art.artPixelW}×${art.artPixelH} · fit: ${art.objectFit} · position: ${art.objectPosition}`,
    `Art max height (carousel): ${art.maxHeightPercent}%`,
    `Preview frame: ${art.frame}`,
    '',
  ];
  const slide = getLoadScreenItemLayout('carouselSlide', merged);
  lines.push(`Carousel slide scale: w=${slide.w}% · h=${slide.h}%`);
  lines.push('');
  for (const [key, meta] of Object.entries(LOAD_SCREEN_ITEM_DEFS)) {
    if (!isLoadScreenItemKey(key)) continue;
    if (isLoadScreenCarouselSlideItem(key)) continue;
    const box = getLoadScreenItemLayout(key, merged);
    const hiddenPart = box.hidden ? ' · hidden' : '';
    lines.push(`${meta.label}: x=${box.x}% y=${box.y}% w=${box.w}% h=${box.h}%${hiddenPart}`);
  }
  return lines.join('\n');
}
