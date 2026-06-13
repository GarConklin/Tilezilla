/** Sub-level roman numeral icons (gld / slvr) — paths, layout, and DOM apply. */

const SUBLEVEL_BADGES = new Set(['gld', 'slvr']);

const DEFAULT_LAYOUT = { h: 9.6, nudgeX: 0, nudgeY: 0, wScale: 1 };

let layoutCache = null;

export function clearSublevelLayoutCache() {
  layoutCache = null;
}

export function romanForSubLevel(subLevel) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return numerals[(subLevel || 1) - 1] || String(subLevel);
}

export function normalizeSublevelBadge(value) {
  const v = String(value || 'gld').toLowerCase();
  return SUBLEVEL_BADGES.has(v) ? v : 'gld';
}

export function subLevelIconPath(subLevel, badge = 'gld') {
  const n = Math.max(1, Math.min(10, Number(subLevel) || 1));
  return `/img/ranks/${normalizeSublevelBadge(badge)}-${n}.png`;
}

export async function loadSublevelIconLayout() {
  if (!layoutCache) {
    const res = await fetch('/data/sublevel_icon_layout.json');
    if (!res.ok) throw new Error('Failed to load sublevel icon layout');
    layoutCache = await res.json();
  }
  return layoutCache;
}

export function getSublevelIconLayout(subLevel, badge, layout) {
  const n = Math.max(1, Math.min(10, Number(subLevel) || 1));
  const cat = normalizeSublevelBadge(badge);
  const def = { ...DEFAULT_LAYOUT, ...(layout?.defaults || {}) };
  const levelOverrides = layout?.levels?.[cat]?.[String(n)]
    ?? layout?.levels?.[cat]?.[n]
    ?? {};
  return { ...def, ...levelOverrides };
}

export function applySublevelIconElement(img, subLevel, badge, layout) {
  if (!img) return;
  const cat = normalizeSublevelBadge(badge);
  const L = getSublevelIconLayout(subLevel, cat, layout);
  img.src = subLevelIconPath(subLevel, cat);
  img.style.setProperty('--tz-rank-sublevel-icon-h', `${L.h}px`);
  img.style.setProperty('--tz-rank-sublevel-nudge-x', `${L.nudgeX}px`);
  img.style.setProperty('--tz-rank-sublevel-nudge-y', `${L.nudgeY}px`);
  img.style.setProperty('--tz-rank-sublevel-w-scale', String(L.wScale));
  img.dataset.sublevel = String(Math.max(1, Math.min(10, Number(subLevel) || 1)));
  img.dataset.sublevelBadge = cat;
}
