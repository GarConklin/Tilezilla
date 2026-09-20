/** Live rank badge v2: BG band + Nc tile + gld/slvr roman (from tuner layout). */

import { romanForSubLevel, normalizeSublevelBadge } from './sublevel-icon.js';

const LAYOUT_URL = '/data/rank_badge_v2_layout.json';

const DEFAULTS = {
  version: 1,
  art: { bgW: 115, bgH: 145 },
  tile: { scale: 0.9, nudgeX: 0, nudgeY: -2 },
  defaults: { h: 52, nudgeX: 0, nudgeY: 6, wScale: 1 },
  numerals: {},
  bands: {},
};

let layoutCache = null;
let layoutPromise = null;

export function clearRankBadgeV2LayoutCache() {
  layoutCache = null;
  layoutPromise = null;
}

export async function loadRankBadgeV2Layout({ force = false } = {}) {
  if (layoutCache && !force) return layoutCache;
  if (!force && layoutPromise) return layoutPromise;
  layoutPromise = (async () => {
    const res = await fetch(`${LAYOUT_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load rank badge v2 layout');
    layoutCache = { ...DEFAULTS, ...(await res.json()) };
    return layoutCache;
  })();
  try {
    return await layoutPromise;
  } finally {
    layoutPromise = null;
  }
}

export function bandKeyForRank(r) {
  const n = Number(r) || 1;
  if (n <= 10) return '1-10';
  if (n <= 20) return '11-20';
  if (n <= 30) return '21-30';
  if (n <= 40) return '31-40';
  if (n <= 50) return '41-50';
  return '51-55';
}

export function bgPathForRank(r) {
  return `/img/ranks/${bandKeyForRank(r)}bg.png`;
}

export function tilePathForRank(r) {
  const n = Math.max(1, Math.min(55, Number(r) || 1));
  return `/img/ranks/${n}c.png`;
}

export function numeralPath(subLevel, romanStyle = 'slvr') {
  const n = Math.max(1, Math.min(15, Number(subLevel) || 1));
  const cat = normalizeSublevelBadge(romanStyle);
  return `/img/ranks/${cat}-${n}.png`;
}

function getBandEntry(layout, key) {
  return layout?.bands?.[key] || {};
}

function getTileForBand(layout, key) {
  const base = { ...DEFAULTS.tile, ...(layout?.tile || {}) };
  const over = getBandEntry(layout, key).tile || {};
  return {
    scale: Number(over.scale ?? base.scale),
    nudgeX: Number(over.nudgeX ?? base.nudgeX),
    nudgeY: Number(over.nudgeY ?? base.nudgeY),
  };
}

function getNumeralShiftForBand(layout, key) {
  const over = getBandEntry(layout, key).numeralShift || {};
  return {
    nudgeX: Number(over.nudgeX ?? 0),
    nudgeY: Number(over.nudgeY ?? 0),
  };
}

function getNumeral(layout, n) {
  const key = String(n);
  const def = { ...DEFAULTS.defaults, ...(layout?.defaults || {}) };
  const over = layout?.numerals?.[key] || {};
  return {
    h: Number(over.h ?? def.h),
    nudgeX: Number(over.nudgeX ?? def.nudgeX),
    nudgeY: Number(over.nudgeY ?? def.nudgeY),
    wScale: Number(over.wScale ?? def.wScale),
  };
}

function getResolvedNumeral(layout, n, rank) {
  const L = getNumeral(layout, n);
  const shift = getNumeralShiftForBand(layout, bandKeyForRank(rank));
  return {
    ...L,
    nudgeX: L.nudgeX + shift.nudgeX,
    nudgeY: L.nudgeY + shift.nudgeY,
  };
}

/** Avoid re-requesting the same asset when the stack is reapplied. */
function setImgSrcIfChanged(img, src) {
  if (!img || !src) return;
  if (img.getAttribute('src') === src) return;
  img.src = src;
}

/** Ensure stack has bg / tile / num img children (migrates legacy markup). */
export function ensureRankBadgeV2Stack(stackEl) {
  if (!stackEl) return null;
  stackEl.classList.add('tz-rank-badge-v2', 'badge-stack');

  let bg = stackEl.querySelector('.badge-stack__bg');
  let tile = stackEl.querySelector('.badge-stack__tile');
  let num = stackEl.querySelector('.badge-stack__num');

  if (!bg) {
    bg = document.createElement('img');
    bg.className = 'badge-stack__bg';
    bg.alt = '';
    bg.draggable = false;
    bg.decoding = 'async';
    stackEl.insertBefore(bg, stackEl.firstChild);
  }
  if (!tile) {
    tile =
      stackEl.querySelector('.tz-rank-badge__img')
      || stackEl.querySelector('.tz-preview-v2-user-data__badge')
      || document.createElement('img');
    tile.classList.add('badge-stack__tile');
    tile.draggable = false;
    tile.decoding = 'async';
    if (!tile.parentElement) stackEl.appendChild(tile);
  }
  if (!num) {
    num =
      stackEl.querySelector('.tz-rank-sublevel__img')
      || stackEl.querySelector('.tz-preview-v2-user-data__sublevel')
      || document.createElement('img');
    num.classList.add('badge-stack__num');
    num.draggable = false;
    num.decoding = 'async';
    if (!num.parentElement) stackEl.appendChild(num);
  }

  // Keep legacy class names for callers that still query them; CSS scopes v2 layout.
  tile.classList.add('tz-rank-badge__img');
  num.classList.add('tz-rank-sublevel__img');

  return { bg, tile, num };
}

function resolvePreviewScale(stackEl, artH, explicitScale) {
  if (Number.isFinite(explicitScale) && explicitScale > 0) return explicitScale;
  const cssH = parseFloat(getComputedStyle(stackEl).getPropertyValue('--tz-rank-badge-h'));
  const boxH = stackEl.getBoundingClientRect().height;
  const target = (boxH > 8 ? boxH : 0) || (Number.isFinite(cssH) && cssH > 0 ? cssH : 0) || artH * 0.4;
  return target / artH;
}

/**
 * Apply layered badge to a stack element.
 * @param {HTMLElement} stackEl
 * @param {{ rankId: number, subLevel: number, romanStyle?: string, rankName?: string, scale?: number, layout?: object }} opts
 */
export function applyRankBadgeV2(stackEl, opts = {}) {
  if (!stackEl) return false;
  const layout = opts.layout || layoutCache || DEFAULTS;
  const rankId = Math.max(1, Math.min(55, Number(opts.rankId) || 1));
  const subLevel = Math.max(1, Math.min(15, Number(opts.subLevel) || 1));
  const romanStyle = normalizeSublevelBadge(opts.romanStyle || 'slvr');
  const art = { ...DEFAULTS.art, ...(layout.art || {}) };
  const band = bandKeyForRank(rankId);
  const tileLayout = getTileForBand(layout, band);
  const L = getResolvedNumeral(layout, subLevel, rankId);
  const parts = ensureRankBadgeV2Stack(stackEl);
  if (!parts) return false;

  const scale = resolvePreviewScale(stackEl, art.bgH || 145, opts.scale);

  stackEl.style.setProperty('--art-w', String(art.bgW || 115));
  stackEl.style.setProperty('--art-h', String(art.bgH || 145));
  stackEl.style.setProperty('--preview-scale', String(scale));
  stackEl.style.setProperty('--tile-scale', String(tileLayout.scale ?? 0.9));
  stackEl.style.setProperty('--tile-nudge-x', String(tileLayout.nudgeX ?? 0));
  stackEl.style.setProperty('--tile-nudge-y', String(tileLayout.nudgeY ?? 0));
  stackEl.style.setProperty('--num-h', String(L.h));
  stackEl.style.setProperty('--num-nudge-x', String(L.nudgeX));
  stackEl.style.setProperty('--num-nudge-y', String(L.nudgeY));
  stackEl.style.setProperty('--num-w-scale', String(L.wScale));

  const roman = romanForSubLevel(subLevel);
  const rankName = opts.rankName || `Rank ${rankId}`;

  // Only the current BG + Nc + roman — never preload other ranks/bands.
  setImgSrcIfChanged(parts.bg, bgPathForRank(rankId));
  setImgSrcIfChanged(parts.tile, tilePathForRank(rankId));
  parts.tile.alt = `${rankName} rank`;
  setImgSrcIfChanged(parts.num, numeralPath(subLevel, romanStyle));
  parts.num.alt = `Sublevel ${roman}`;

  stackEl.dataset.rankId = String(rankId);
  stackEl.dataset.sublevel = String(subLevel);
  stackEl.dataset.sublevelBadge = romanStyle;
  stackEl.setAttribute('aria-label', `${rankName}, sublevel ${roman}`);

  return true;
}

/**
 * Load layout then apply. Returns false on failure (caller may use legacy path).
 */
export async function applyRankBadgeV2Async(stackEl, opts = {}) {
  try {
    const layout = opts.layout || (await loadRankBadgeV2Layout());
    return applyRankBadgeV2(stackEl, { ...opts, layout });
  } catch (err) {
    console.warn('Rank badge v2:', err);
    return false;
  }
}
