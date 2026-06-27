/**
 * Preview tile graphic sizing inside the tile slot (#activePad).
 * Separate width/height scale for 0°/180° vs 90°/270° orientations.
 */

import { toTileImgUrl } from './tile-bg-setup.js';

export const PREVIEW_TILE_CELL_PX = 55;

/** Default domino tile id shown in preview-v2 tuner (resolved via tilesets.json). */
export const PREVIEW_TUNER_TILE = 'UT';

const rotatedPreviewTileCache = new Map();
let tilesetsCache = null;

export async function loadPreviewTilesets() {
  if (tilesetsCache) return tilesetsCache;
  try {
    const res = await fetch(`/data/tiles/tilesets.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) tilesetsCache = await res.json();
  } catch {
    /* offline / file:// without server */
  }
  return tilesetsCache;
}

/** Resolve tile id or legacy filename to a fetchable image URL. */
export function resolvePreviewTileImageUrl(tileRef, tilesets = null) {
  const raw = String(tileRef || '').trim();
  if (!raw) return '';

  if (raw.includes('/') || raw.startsWith('img/')) {
    return toTileImgUrl(raw);
  }

  if (raw.includes('.png')) {
    return toTileImgUrl(`img/${raw.replace(/^img\//, '')}`);
  }

  const setKey = tilesets?.activeTileset || 'rainbow-catapiller';
  const fromActive = tilesets?.tilesets?.[setKey]?.[raw];
  if (fromActive) return toTileImgUrl(fromActive);

  for (const rel of Object.values(tilesets?.tilesets?.['gray-backs'] || {})) {
    if (typeof rel === 'string' && rel.includes(`/${raw}-`)) return toTileImgUrl(rel);
  }
  const fromGray = tilesets?.tilesets?.['gray-backs']?.[raw];
  if (fromGray) return toTileImgUrl(fromGray);

  return toTileImgUrl(`img/${raw}-Snake-G-Tile.png`);
}

function previewTileFetchUrl(url) {
  if (!url) return '';
  if (typeof location !== 'undefined' && location.protocol === 'file:' && url.startsWith('/')) {
    return url.slice(1);
  }
  return url;
}

export async function loadRotatedPreviewTileSrc(tileName, deg) {
  const r = ((deg % 360) + 360) % 360;
  const raw = String(tileName || '').trim();
  const tilesets = await loadPreviewTilesets();
  const candidates = [];
  const primary = resolvePreviewTileImageUrl(raw, tilesets);
  if (primary) candidates.push(primary);
  if (raw && !raw.includes('.png')) {
    candidates.push(toTileImgUrl(`img/${raw}-Snake-G-Tile.png`));
    candidates.push(toTileImgUrl(`Tiles/gray-backs/${raw}-Tile.png`));
    candidates.push(toTileImgUrl(`Tiles/rainbow-catapiller/${raw}-Tile.png`));
    candidates.push(toTileImgUrl(`Tiles/og/${raw}-Tile.png`));
  }

  let img = null;
  let usedUrl = '';
  for (const url of [...new Set(candidates.filter(Boolean))]) {
    const fetchUrl = previewTileFetchUrl(url);
    const keyProbe = `${fetchUrl}|${r}`;
    if (rotatedPreviewTileCache.has(keyProbe)) return rotatedPreviewTileCache.get(keyProbe);
    const probe = new Image();
    probe.src = fetchUrl;
    try {
      await probe.decode();
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        img = probe;
        usedUrl = fetchUrl;
        break;
      }
    } catch {
      /* try next candidate */
    }
  }

  if (!img) {
    throw new Error(
      `Preview tile image not found for "${raw}". Run python scripts/server.py and ensure a UT tile PNG exists (e.g. img/UT-Snake-G-Tile.png).`,
    );
  }

  const key = `${usedUrl}|${r}`;
  if (rotatedPreviewTileCache.has(key)) return rotatedPreviewTileCache.get(key);

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const dstW = (r === 90 || r === 270) ? srcH : srcW;
  const dstH = (r === 90 || r === 270) ? srcW : srcH;

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  ctx.translate(dstW / 2, dstH / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(img, -srcW / 2, -srcH / 2);

  const url = canvas.toDataURL('image/png');
  rotatedPreviewTileCache.set(key, url);
  return url;
}

export function isPreviewTileVerticalDeg(deg) {
  const rot = ((deg % 360) + 360) % 360;
  return rot === 90 || rot === 270;
}

export async function applyPreviewTunerTileMock({
  imgEl,
  padEl,
  deg,
  tileInSlot,
  tileName = PREVIEW_TUNER_TILE,
  dirLabelEl = null,
}) {
  if (!imgEl || !padEl) return;

  const padW = padEl.clientWidth;
  const padH = padEl.clientHeight;
  if (padW < 2 || padH < 2) return;

  const { drawW, drawH, offsetX, offsetY } = computePreviewTileDrawSize({
    padW,
    padH,
    deg,
    tileInSlot,
  });

  try {
    imgEl.src = await loadRotatedPreviewTileSrc(tileName, deg);
    imgEl.alt = String(tileName).replace(/\.png$/i, '');
    imgEl.hidden = false;
    imgEl.style.width = `${drawW}px`;
    imgEl.style.height = `${drawH}px`;
    imgEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    imgEl.style.opacity = '1';
    imgEl.removeAttribute('title');
  } catch (err) {
    console.warn('[preview-v2-tuner]', err);
    imgEl.removeAttribute('src');
    imgEl.alt = 'Tile image missing';
    imgEl.title = err?.message || 'Tile image failed to load';
    imgEl.style.opacity = '0.35';
    imgEl.hidden = false;
  }

  if (dirLabelEl) {
    const rot = ((deg % 360) + 360) % 360;
    dirLabelEl.textContent = `${rot}°`;
  }
}

export const DEFAULT_PREVIEW_TILE_IN_SLOT = {
  rot0ScaleW: 0.96,
  rot0ScaleH: 0.96,
  rot90ScaleW: 0.96,
  rot90ScaleH: 0.96,
  offsetX: 0,
  offsetY: -1,
  boardScale: 1,
  fitInsetX: 2,
  fitInsetY: 2,
  clampToSlot: 0,
};

export function mergePreviewTileInSlot(raw) {
  return { ...DEFAULT_PREVIEW_TILE_IN_SLOT, ...(raw && typeof raw === 'object' ? raw : {}) };
}

export function tileBoardPixelSize(deg, cellPx = PREVIEW_TILE_CELL_PX) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 90 || rot === 270) return { w: cellPx, h: 2 * cellPx };
  return { w: 2 * cellPx, h: cellPx };
}

export function getPreviewRotScales(tileInSlot, deg) {
  const t = mergePreviewTileInSlot(tileInSlot);
  const rot = ((deg % 360) + 360) % 360;
  const is90 = rot === 90 || rot === 270;
  if (is90) {
    const scaleW = t.rot90ScaleW ?? t.rot90Scale ?? 1;
    const scaleH = t.rot90ScaleH ?? t.rot90Scale ?? scaleW;
    return { scaleW, scaleH };
  }
  const scaleW = t.rot0ScaleW ?? t.rot0Scale ?? 1;
  const scaleH = t.rot0ScaleH ?? t.rot0Scale ?? scaleW;
  return { scaleW, scaleH };
}

export function readPreviewRotScalesFromStyle(rootStyle, deg) {
  const rot = ((deg % 360) + 360) % 360;
  const is90 = rot === 90 || rot === 270;
  const legacy = parseFloat(rootStyle.getPropertyValue(
    is90 ? '--tz-preview-tile-rot90-scale' : '--tz-preview-tile-rot0-scale',
  )) || 1;
  const scaleW = parseFloat(rootStyle.getPropertyValue(
    is90 ? '--tz-preview-tile-rot90-scale-w' : '--tz-preview-tile-rot0-scale-w',
  )) || legacy;
  const scaleH = parseFloat(rootStyle.getPropertyValue(
    is90 ? '--tz-preview-tile-rot90-scale-h' : '--tz-preview-tile-rot0-scale-h',
  )) || legacy;
  return { scaleW, scaleH };
}

export function computePreviewTileDrawSize({
  padW,
  padH,
  deg,
  tileInSlot,
  cellPx = PREVIEW_TILE_CELL_PX,
  rootStyle = null,
}) {
  const t = mergePreviewTileInSlot(tileInSlot);
  const fitInsetX = rootStyle
    ? (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-fit-inset-x')) || (t.fitInsetX ?? 2))
    : (t.fitInsetX ?? 2);
  const fitInsetY = rootStyle
    ? (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-fit-inset-y')) || (t.fitInsetY ?? 2))
    : (t.fitInsetY ?? 2);
  const fitW = Math.max(1, padW - fitInsetX * 2);
  const fitH = Math.max(1, padH - fitInsetY * 2);
  const size = tileBoardPixelSize(deg, cellPx);
  let drawW = size.w;
  let drawH = size.h;
  const boardScale = rootStyle
    ? (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-board-scale')) || (t.boardScale ?? 1))
    : (t.boardScale ?? 1);
  const { scaleW, scaleH } = rootStyle
    ? readPreviewRotScalesFromStyle(rootStyle, deg)
    : getPreviewRotScales(t, deg);
  drawW *= boardScale * scaleW;
  drawH *= boardScale * scaleH;
  const clampToSlot = rootStyle
    ? (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-clamp-to-slot')) || (t.clampToSlot ?? 0))
    : (t.clampToSlot ?? 0);
  if (clampToSlot > 0 && (drawW > fitW || drawH > fitH)) {
    const shrink = Math.min(fitW / drawW, fitH / drawH);
    drawW *= shrink;
    drawH *= shrink;
  }
  const offsetX = rootStyle
    ? (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-offset-x')) || (t.offsetX ?? 0))
    : (t.offsetX ?? 0);
  const offsetY = rootStyle
    ? (parseFloat(rootStyle.getPropertyValue('--tz-preview-tile-offset-y')) || (t.offsetY ?? 0))
    : (t.offsetY ?? 0);
  return { drawW, drawH, offsetX, offsetY };
}

export function applyPreviewTileInSlot(tileInSlot, target = document.documentElement) {
  const t = mergePreviewTileInSlot(tileInSlot);
  const rot0W = t.rot0ScaleW ?? 0.96;
  const rot0H = t.rot0ScaleH ?? 0.96;
  const rot90W = t.rot90ScaleW ?? 0.96;
  const rot90H = t.rot90ScaleH ?? 0.96;
  target.style.setProperty('--tz-preview-tile-rot0-scale-w', String(rot0W));
  target.style.setProperty('--tz-preview-tile-rot0-scale-h', String(rot0H));
  target.style.setProperty('--tz-preview-tile-rot90-scale-w', String(rot90W));
  target.style.setProperty('--tz-preview-tile-rot90-scale-h', String(rot90H));
  target.style.setProperty('--tz-preview-tile-rot0-scale', String((rot0W + rot0H) / 2));
  target.style.setProperty('--tz-preview-tile-rot90-scale', String((rot90W + rot90H) / 2));
  target.style.setProperty('--tz-preview-tile-board-scale', String(t.boardScale ?? 1));
  target.style.setProperty('--tz-preview-tile-offset-x', `${t.offsetX ?? 0}px`);
  target.style.setProperty('--tz-preview-tile-offset-y', `${t.offsetY ?? 0}px`);
  target.style.setProperty('--tz-preview-tile-fit-inset-x', `${t.fitInsetX ?? 2}px`);
  target.style.setProperty('--tz-preview-tile-fit-inset-y', `${t.fitInsetY ?? 2}px`);
  target.style.setProperty('--tz-preview-tile-clamp-to-slot', String(t.clampToSlot ?? 0));
}

export function previewTileInSlotReportLines(tileInSlot) {
  const t = mergePreviewTileInSlot(tileInSlot);
  return [
    `0°/180° scale W ${t.rot0ScaleW} · H ${t.rot0ScaleH}`,
    `90°/270° scale W ${t.rot90ScaleW} · H ${t.rot90ScaleH}`,
    `offset ${t.offsetX}px, ${t.offsetY}px · board ${t.boardScale}`,
  ];
}
