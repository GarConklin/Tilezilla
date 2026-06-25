/** Player tileset choice — local until account sync. */

const STORAGE_KEY = 'tilezilla:active-tileset';

export function loadActiveTilesetPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && typeof v === 'string' ? v.trim() : null;
  } catch {
    return null;
  }
}

export function saveActiveTilesetPreference(tilesetId) {
  try {
    if (tilesetId) localStorage.setItem(STORAGE_KEY, tilesetId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const TILESET_SAMPLE_TILES = ['SH', 'LR', 'QC', 'CT'];

export const TILESET_DISPLAY_NAMES = {
  'rainbow-catapiller': 'Rainbow Caterpillar',
  'rainbow-catapiller-clear': 'Rainbow Clear',
  'gar-dotgrnew': 'Gar Dot Grid (New)',
  'gar-dotgr': 'Gar Dot Grid',
  'gray-backs': 'Gray Backs',
  og: 'Original',
};

export function formatTilesetDisplayName(id) {
  if (!id) return '—';
  if (TILESET_DISPLAY_NAMES[id]) return TILESET_DISPLAY_NAMES[id];
  return String(id)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const TILESET_GALLERY_ORDER = [
  'rainbow-catapiller',
  'rainbow-catapiller-clear',
  'gar-dotgrnew',
  'gar-dotgr',
  'gray-backs',
  'og',
];

export function listTilesetIds(tileSets) {
  const keys = Object.keys(tileSets?.tilesets || {});
  const ordered = [];
  for (const id of TILESET_GALLERY_ORDER) {
    if (keys.includes(id)) ordered.push(id);
  }
  for (const id of keys.sort()) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}
