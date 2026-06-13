/** Bottom navigation plaque — image + transparent hit areas (same pattern as menu-layout.js). */

export const BOTTOM_NAV_ITEM_DEFS = {
  adventure: { label: 'Adventure', cssKey: 'adventure', hoverSrc: '/img/BMB-1H.png' },
  dailyChallenge: { label: 'Daily Challenge', cssKey: 'daily-challenge', nav: 'daily-challenge', hoverSrc: '/img/BMB-2H.png' },
  random: { label: 'Random Puzzle', cssKey: 'random', hoverSrc: '/img/BMB-3H.png' },
  library: { label: 'Puzzle Library', cssKey: 'library', hoverSrc: '/img/BMB-4H.png' },
  profile: { label: 'Profile', cssKey: 'profile', hoverSrc: '/img/BMB-5H.png' },
};

export const BOTTOM_NAV_ART = { w: 1698, h: 456 };

export const DEFAULT_BOTTOM_NAV_LAYOUT = {
  plaque: { offsetY: 0, wScale: 1, hScale: 1 },
  hits: { w: 18, h: 88, y: 50 },
  items: {
    adventure: { x: 10 },
    dailyChallenge: { x: 30 },
    random: { x: 50 },
    library: { x: 70 },
    profile: { x: 90 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:bottom-nav';
const LS_PENDING_KEY = 'tilezilla:layouts:bottom-nav:pending';

let layoutCache = null;

export function clearBottomNavLayoutCache() {
  layoutCache = null;
}

export function stashBottomNavLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearBottomNavLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeBottomNavLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_BOTTOM_NAV_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.plaque && typeof raw.plaque === 'object') {
    base.plaque = { ...base.plaque, ...raw.plaque };
    if (raw.plaque.scale != null && raw.plaque.wScale == null) {
      base.plaque.wScale = raw.plaque.scale;
    }
    if (raw.plaque.scale != null && raw.plaque.hScale == null) {
      base.plaque.hScale = raw.plaque.scale;
    }
  }
  if (raw.hits && typeof raw.hits === 'object') {
    base.hits = { ...base.hits, ...raw.hits };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!BOTTOM_NAV_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadBottomNavLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/bottom_nav_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through to draft / defaults */
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

  layoutCache = mergeBottomNavLayout(raw);
  return layoutCache;
}

export async function reloadBottomNavLayout() {
  clearBottomNavLayoutCache();
  return loadBottomNavLayout({ force: true });
}

export function getPlaqueScales(plaque) {
  const legacy = plaque?.scale;
  return {
    w: plaque?.wScale ?? legacy ?? 1,
    h: plaque?.hScale ?? legacy ?? 1,
  };
}

export function getBottomNavItemLayout(itemKey, layout) {
  const merged = mergeBottomNavLayout(layout);
  const item = merged.items[itemKey] || {};
  return {
    x: item.x ?? 0,
    y: item.y ?? merged.hits.y ?? 50,
  };
}

export function applyBottomNavLayout(layout, target = document.documentElement) {
  const merged = mergeBottomNavLayout(layout);
  const { plaque, hits, items } = merged;

  const scales = getPlaqueScales(plaque);
  target.style.setProperty('--tz-bottom-nav-w-scale', String(scales.w));
  target.style.setProperty('--tz-bottom-nav-h-scale', String(scales.h));
  target.style.setProperty('--tz-bottom-nav-offset-y', `${plaque.offsetY ?? 0}px`);
  target.style.setProperty('--tz-bottom-nav-hit-w', `${hits.w ?? 18}%`);
  target.style.setProperty('--tz-bottom-nav-hit-h', `${hits.h ?? 88}%`);
  target.style.setProperty('--tz-bottom-nav-hit-y', `${hits.y ?? 50}%`);

  for (const [key, meta] of Object.entries(BOTTOM_NAV_ITEM_DEFS)) {
    const item = items[key] || {};
    const x = item.x ?? 0;
    const y = item.y ?? hits.y ?? 50;
    target.style.setProperty(`--tz-bottom-nav-${meta.cssKey}-x`, `${x}%`);
    target.style.setProperty(`--tz-bottom-nav-${meta.cssKey}-y`, `${y}%`);
  }
}

export function buildBottomNavLayoutReport(layout) {
  const merged = mergeBottomNavLayout(layout);
  const lines = [
    'Bottom nav layout report (NewBotmMenu.png)',
    `Graphic scale: ${getPlaqueScales(merged.plaque).w}× wide · ${getPlaqueScales(merged.plaque).h}× tall`,
    `Plaque offset Y: ${merged.plaque.offsetY}px`,
    `Shared hit size: ${merged.hits.w}% × ${merged.hits.h}% · default Y ${merged.hits.y}%`,
    '',
    'Tabs (% from left / top of plaque):',
  ];
  for (const [key, def] of Object.entries(BOTTOM_NAV_ITEM_DEFS)) {
    const item = merged.items[key] || {};
    const x = item.x ?? 0;
    const y = item.y ?? merged.hits.y ?? 50;
    lines.push(`  ${def.label}: x ${x}% · y ${y}%`);
  }
  return lines.join('\n');
}
