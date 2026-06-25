/** Board background layers from data/tiles/tilesets.json → tileBGSetup. */

export const DEFAULT_TILE_BG_SETUP = {
  Standard: {
    'BG-Tile': 'img/Blank-bg-Tile.png',
    'MB-image': 'img/BG.png',
  },
  Enhanced: {
    'BG-Tile': 'img/Tiles/rainbow-catapiller-clear/Clear-bg-Tile.png',
    'MB-image': 'img/Tiles/rainbow-catapiller-clear/BG.png',
  },
};

/** @param {string | undefined | null} path */
export function toTileImgUrl(path) {
  if (!path) return '';
  const p = String(path).trim().replace(/\\/g, '/');
  if (p.startsWith('/')) return p;
  if (p.startsWith('img/')) return `/${p}`;
  return `/img/${p}`;
}

/**
 * @param {object | null | undefined} tileSets
 * @param {string | undefined | null} tilesetName
 */
export function getTilesetBgSetup(tileSets, tilesetName) {
  const name = tilesetName || tileSets?.activeTileset || 'gray-backs';
  const setupKey = tileSets?.tilesets?.[name]?.bgSetup || 'Standard';
  const setups = tileSets?.tileBGSetup || DEFAULT_TILE_BG_SETUP;
  const setup = setups[setupKey] || setups.Standard || DEFAULT_TILE_BG_SETUP.Standard;
  return {
    key: setupKey,
    bgTile: setup['BG-Tile'] || setup.bgTile || DEFAULT_TILE_BG_SETUP.Standard['BG-Tile'],
    mbImage: setup['MB-image'] || setup.mbImage || DEFAULT_TILE_BG_SETUP.Standard['MB-image'],
  };
}

/**
 * @param {object | null | undefined} tileSets
 * @param {string | undefined | null} tilesetName
 * @param {HTMLElement} [root]
 */
export function applyTileBoardBackground(tileSets, tilesetName, root = document.documentElement) {
  const setup = getTilesetBgSetup(tileSets, tilesetName);
  const bgTileUrl = toTileImgUrl(setup.bgTile);
  const mbUrl = toTileImgUrl(setup.mbImage);
  root.style.setProperty('--tz-cell-substrate', bgTileUrl ? `url("${bgTileUrl}")` : 'none');
  root.style.setProperty('--tz-board-mb-image', mbUrl ? `url("${mbUrl}")` : 'none');
  return setup;
}

/**
 * @param {object | null | undefined} tileSets
 * @param {string | undefined | null} tilesetName
 */
export function isEnhancedTileBgSetup(tileSets, tilesetName) {
  return getTilesetBgSetup(tileSets, tilesetName).key === 'Enhanced';
}

/**
 * Draw per-cell BG-Tile under transparent tile art (Enhanced tilesets).
 * @param {CanvasRenderingContext2D} g
 * @param {HTMLImageElement} bgImg
 * @param {number} dstW
 * @param {number} dstH
 * @param {number} rot
 * @param {number} cellCount
 */
export function drawBgTileUnderlay(g, bgImg, dstW, dstH, rot, cellCount) {
  if (!bgImg || cellCount <= 1) {
    g.drawImage(bgImg, 0, 0, dstW, dstH);
    return;
  }
  if (rot === 90 || rot === 270) {
    const ch = dstH / 2;
    g.drawImage(bgImg, 0, 0, dstW, ch);
    g.drawImage(bgImg, 0, ch, dstW, ch);
    return;
  }
  const cw = dstW / 2;
  g.drawImage(bgImg, 0, 0, cw, dstH);
  g.drawImage(bgImg, cw, 0, cw, dstH);
}
