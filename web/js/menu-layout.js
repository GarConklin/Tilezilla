/** Hamburger menu plaque hit-area layout — load/apply from JSON. */

export const MENU_ITEM_DEFS = {
  close: {
    label: 'Close — green X (back to game)',
    kind: 'box',
    modes: ['standard', 'dev'],
  },
  puzzle: { label: 'Puzzle Info', kind: 'row', modes: ['standard', 'dev'] },
  found: { label: 'View Found Solutions', kind: 'row', modes: ['standard', 'dev'] },
  stuck: { label: "I'm Stuck", kind: 'row', modes: ['standard', 'dev'] },
  hint: { label: 'Hint Rules', kind: 'row', modes: ['standard', 'dev'] },
  settings: { label: 'Settings', kind: 'row', modes: ['standard', 'dev'] },
  journal: { label: "The Cartographer's Journal", kind: 'row', modes: ['standard', 'dev'] },
  devTools: { label: 'Dev Tools', kind: 'row', modes: ['dev'] },
  forceDiscovery: { label: 'Force Solution Popup', kind: 'row', modes: ['dev'] },
  switchPlayer: { label: 'Switch test player', kind: 'row', modes: ['dev'] },
};

const ROW_CSS_SUFFIX = {
  puzzle: 'puzzle',
  found: 'found',
  stuck: 'stuck',
  hint: 'hint',
  settings: 'settings',
  journal: 'journal',
  devTools: 'tools',
  forceDiscovery: 'force',
  switchPlayer: 'switch',
};

const DEFAULT_ROW = { x: 50, y: 50 };

/** First five links appear on both Menu.png and Menu-devtools.png. */
const SHARED_MENU_ITEMS = new Set(['puzzle', 'found', 'stuck', 'hint', 'settings', 'journal']);

export const DEFAULT_MENU_LAYOUT = {
  plaque: { offsetY: -50, displayW: 340, wScale: 1.3 },
  hits: { w: 74, h: 6.8 },
  close: { x: 91, y: 4.8, w: 8.2, h: 5.6 },
  standard: {
    puzzle: { x: 50, y: 23 },
    found: { x: 50, y: 33 },
    stuck: { x: 50, y: 43 },
    hint: { x: 50, y: 53 },
    settings: { x: 50, y: 63 },
    journal: { x: 50, y: 75 },
  },
  dev: {
    puzzle: { x: 50, y: 19 },
    found: { x: 50, y: 27 },
    stuck: { x: 50, y: 35 },
    hint: { x: 50, y: 43 },
    settings: { x: 50, y: 51 },
    journal: { x: 50, y: 63 },
    devTools: { x: 50, y: 59 },
    forceDiscovery: { x: 50, y: 67 },
    switchPlayer: { x: 50, y: 75 },
  },
};

let layoutCache = null;

export function clearMenuLayoutCache() {
  layoutCache = null;
}

export function mergeMenuLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_MENU_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.plaque && typeof raw.plaque === 'object') {
    base.plaque = { ...base.plaque, ...raw.plaque };
  }
  if (raw.hits && typeof raw.hits === 'object') {
    base.hits = { ...base.hits, ...raw.hits };
  }
  if (raw.close && typeof raw.close === 'object') {
    base.close = { ...base.close, ...raw.close };
  }
  for (const section of ['standard', 'dev']) {
    if (!raw[section] || typeof raw[section] !== 'object') continue;
    for (const [key, val] of Object.entries(raw[section])) {
      if (!ROW_CSS_SUFFIX[key] || typeof val !== 'object') continue;
      base[section][key] = { ...base[section][key], ...val };
    }
  }
  return base;
}

export async function loadMenuLayout() {
  if (layoutCache) return layoutCache;
  const res = await fetch('/data/menu_layout.json', { cache: 'no-store' });
  if (!res.ok) {
    layoutCache = mergeMenuLayout(null);
    return layoutCache;
  }
  layoutCache = mergeMenuLayout(await res.json());
  return layoutCache;
}

export function getMenuDisplayWidth(plaque) {
  const base = plaque?.displayW ?? 340;
  const scale = plaque?.wScale ?? 1;
  return Math.round(base * scale);
}

function isDevRowUntuned(itemKey, devRow) {
  const def = DEFAULT_MENU_LAYOUT.dev[itemKey];
  if (!def || !devRow) return false;
  if (devRow.w != null || devRow.h != null) return false;
  const x = devRow.x ?? def.x ?? DEFAULT_ROW.x;
  const y = devRow.y ?? def.y ?? DEFAULT_ROW.y;
  return x === (def.x ?? DEFAULT_ROW.x) && y === (def.y ?? DEFAULT_ROW.y);
}

export function getMenuItemLayout(itemKey, layout, mode = 'standard') {
  const merged = mergeMenuLayout(layout);
  if (itemKey === 'close') return { ...merged.close };

  if (mode === 'dev' && SHARED_MENU_ITEMS.has(itemKey) && isDevRowUntuned(itemKey, merged.dev[itemKey])) {
    const row = merged.standard[itemKey] || DEFAULT_ROW;
    return {
      x: row.x ?? DEFAULT_ROW.x,
      y: row.y ?? DEFAULT_ROW.y,
      w: row.w ?? merged.hits.w ?? 74,
      h: row.h ?? merged.hits.h ?? 6.8,
    };
  }

  const section = mode === 'dev' ? merged.dev : merged.standard;
  const row = section[itemKey] || merged.standard[itemKey] || DEFAULT_ROW;
  return {
    x: row.x ?? DEFAULT_ROW.x,
    y: row.y ?? DEFAULT_ROW.y,
    w: row.w ?? merged.hits.w ?? 74,
    h: row.h ?? merged.hits.h ?? 6.8,
  };
}

export function applyMenuLayout(layout, target = document.documentElement) {
  const merged = mergeMenuLayout(layout);
  const { plaque, hits, close, standard, dev } = merged;

  target.style.setProperty('--tz-menu-offset-y', `${plaque.offsetY ?? -50}px`);
  target.style.setProperty('--tz-menu-w-scale', String(plaque.wScale ?? 1));
  target.style.setProperty('--tz-menu-display-w', `${getMenuDisplayWidth(plaque)}px`);
  target.style.setProperty('--tz-menu-hit-w', `${hits.w ?? 74}%`);
  target.style.setProperty('--tz-menu-hit-h', `${hits.h ?? 6.8}%`);

  target.style.setProperty('--tz-menu-close-x', `${close.x}%`);
  target.style.setProperty('--tz-menu-close-y', `${close.y}%`);
  target.style.setProperty('--tz-menu-close-w', `${close.w}%`);
  target.style.setProperty('--tz-menu-close-h', `${close.h}%`);

  for (const [key, suffix] of Object.entries(ROW_CSS_SUFFIX)) {
    for (const [section, prefix] of [['standard', ''], ['dev', 'dev-']]) {
      const row = (section === 'dev' ? dev : standard)[key];
      if (!row) continue;
      const item = getMenuItemLayout(key, merged, section);
      target.style.setProperty(`--tz-menu-${prefix}${suffix}-x`, `${item.x}%`);
      target.style.setProperty(`--tz-menu-${prefix}${suffix}-y`, `${item.y}%`);
      target.style.setProperty(`--tz-menu-${prefix}${suffix}-w`, `${item.w}%`);
      target.style.setProperty(`--tz-menu-${prefix}${suffix}-h`, `${item.h}%`);
    }
  }
}

export function buildMenuLayoutReport(layout, mode = 'standard') {
  const merged = mergeMenuLayout(layout);
  const lines = [
    `Menu layout report (${mode === 'dev' ? 'Menu-devtools.png' : 'Menu.png'})`,
    `Plaque width: ${getMenuDisplayWidth(merged.plaque)}px (base ${merged.plaque.displayW} × scale ${merged.plaque.wScale ?? 1})`,
    `Plaque offset Y: ${merged.plaque.offsetY}px`,
    `Default row hit: ${merged.hits.w}% × ${merged.hits.h}%`,
    `Close (green X): x ${merged.close.x}% · y ${merged.close.y}% · ${merged.close.w}%×${merged.close.h}%`,
    '',
    'Menu links (% from left / top / size):',
  ];
  for (const [key, def] of Object.entries(MENU_ITEM_DEFS)) {
    if (key === 'close' || !def.modes.includes(mode)) continue;
    const item = getMenuItemLayout(key, merged, mode);
    lines.push(`  ${def.label}: x ${item.x}% · y ${item.y}% · ${item.w}%×${item.h}%`);
  }
  return lines.join('\n');
}
