/** Rank advancement popup — RankAwardPlacque*.png + Continue journey hit (% of frame). */

import { RANK_AWARD_PLAQUE_COUNT, rankAwardPlaqueSrc } from './adventure-path.js';

export { rankAwardPlaqueSrc, RANK_AWARD_PLAQUE_COUNT };

export const RANK_AWARD_ART = { w: 354, h: 534 };

export const RANK_AWARD_ITEM_DEFS = {
  continue: { label: 'Continue journey', cssClass: 'tz-rank-award__hit--continue' },
};

export const DEFAULT_RANK_AWARD_LAYOUT = {
  dialog: {
    artW: 354,
    artH: 534,
    maxWidth: 390,
    widthScale: 0.92,
  },
  items: {
    continue: { x: 14, y: 87, w: 72, h: 9, hidden: false },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:rank-award';
const LS_PENDING_KEY = 'tilezilla:layouts:rank-award:pending';

let layoutCache = null;

export function clearRankAwardLayoutCache() {
  layoutCache = null;
}

export function stashRankAwardLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearRankAwardLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeRankAwardLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RANK_AWARD_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!RANK_AWARD_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadRankAwardLayout({ force = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  try {
    const pending = localStorage.getItem(LS_PENDING_KEY) === '1';
    if (pending) {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    }
  } catch {
    /* ignore */
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/rank_award_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergeRankAwardLayout(raw);
  return layoutCache;
}

export async function reloadRankAwardLayout() {
  clearRankAwardLayoutCache();
  return loadRankAwardLayout({ force: true });
}

export function getRankAwardItemLayout(itemKey, layout) {
  const merged = mergeRankAwardLayout(layout);
  const item = merged.items?.[itemKey] || {};
  const def = DEFAULT_RANK_AWARD_LAYOUT.items?.[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function cssVarName(itemKey, dim) {
  return `--tz-rank-award-${itemKey}-${dim}`;
}

export function applyRankAwardLayout(layout, target = document.documentElement) {
  const merged = mergeRankAwardLayout(layout);
  const d = merged.dialog || DEFAULT_RANK_AWARD_LAYOUT.dialog;
  target.style.setProperty('--tz-rank-award-max-width', `${d.maxWidth ?? 390}px`);
  target.style.setProperty('--tz-rank-award-width-scale', String(d.widthScale ?? 0.92));
  target.style.setProperty('--tz-rank-award-art-w', String(d.artW ?? RANK_AWARD_ART.w));
  target.style.setProperty('--tz-rank-award-art-h', String(d.artH ?? RANK_AWARD_ART.h));

  for (const key of Object.keys(RANK_AWARD_ITEM_DEFS)) {
    const box = getRankAwardItemLayout(key, merged);
    target.style.setProperty(cssVarName(key, 'x'), `${box.x}%`);
    target.style.setProperty(cssVarName(key, 'y'), `${box.y}%`);
    target.style.setProperty(cssVarName(key, 'w'), `${box.w}%`);
    target.style.setProperty(cssVarName(key, 'h'), `${box.h}%`);
  }
}

export async function initRankAwardLayout() {
  const layout = await loadRankAwardLayout();
  applyRankAwardLayout(layout, document.documentElement);
  return layout;
}
