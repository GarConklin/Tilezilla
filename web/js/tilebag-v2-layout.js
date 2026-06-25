/**
 * Tile bag layout v2 — main-screen v2 zone (390×100 collapsed slot on 390×844).
 * Internal hit areas use art pixels on the bag PNG (configurable via `art` block).
 */

import {
  TILEBAG_ITEM_DEFS,
  TILEBAG_VARIANTS,
  applyTilebagLayout,
  getTilebagBoxItem,
  mergeTilebagLayout,
} from './tilebag-layout.js';

export { TILEBAG_ITEM_DEFS, TILEBAG_VARIANTS, getTilebagBoxItem };

export const TILEBAG_V2_ART = { w: 390, collapsedH: 100, expandedH: 260 };

export const DEFAULT_TILEBAG_V2_LAYOUT = {
  art: {
    w: 390,
    collapsedH: 100,
    expandedH: 260,
    collapsed: '/img/390x840-tile bag.png',
    expanded: '/img/expanded-tile bag.png',
    handlebar: '/img/handlebar-tilebag.png',
  },
  container: { yNudge: 0 },
  collapsed: {
    track: { left: 18, width: 353, nudgeX: 0, nudgeY: 0 },
    arrowPrev: { left: 0, width: 15, nudgeX: 0, nudgeY: 0 },
    arrowNext: { left: 374, width: 15, nudgeX: 0, nudgeY: 0 },
  },
  expanded: {
    track: { left: 18, width: 353, nudgeX: 0, nudgeY: 0 },
    arrowPrev: { left: 0, width: 15, nudgeX: 0, nudgeY: 0, hidden: true },
    arrowNext: { left: 374, width: 15, nudgeX: 0, nudgeY: 0, hidden: true },
  },
  handle: {
    countX: 216,
    countY: 1,
    countW: 60,
    countH: 14,
    countNudgeX: -3,
    countExpandedNudgeY: -3,
    handleXOffset: -55,
    handleYGap: 1,
    handleNudgeX: 24,
    handleNudgeY: -4,
    handleW: 32,
    handleHitH: 12,
    handleExpandedXOffset: -55,
    handleExpandedYGap: 1,
    handleExpandedNudgeX: -8,
    handleExpandedNudgeY: -1,
    titleOffsetX: -70,
    titleNudgeX: 10,
    titleNudgeY: 0,
    titleExpandedNudgeX: 0,
    titleExpandedNudgeY: 0,
  },
  tiles: {
    cell: 34,
    gap: 4,
    thumbHScale: 0.94,
    fitInsetY: 2,
    vNudge: -2,
  },
  glow: {
    ring: 2,
    blur: 10,
    spread: 0,
    r: 232,
    g: 185,
    b: 35,
    alpha: 0.55,
  },
  expandedLayout: {
    maxRows: 3,
    growScale: 1.5,
    heightTrim: 24,
    maxOverlap: 56,
    frameCollapsedH: 100,
    trackCollapsedH: 49,
    trackExpandedNudgeY: 0,
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:tilebag-v2';
const LS_PENDING_KEY = 'tilezilla:layouts:tilebag-v2:pending';

let layoutCache = null;

export function isTilebagV2TunerPage() {
  return /tilebag-v2-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearTilebagV2LayoutCache() {
  layoutCache = null;
}

export function stashTilebagV2LayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearTilebagV2LayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeTilebagV2Layout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_TILEBAG_V2_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.art && typeof raw.art === 'object') {
    base.art = { ...base.art, ...raw.art };
  }
  const merged = mergeTilebagLayout({ ...base, ...raw, art: base.art });
  merged.art = base.art;
  return merged;
}

export async function loadTilebagV2Layout({ force = false } = {}) {
  if (layoutCache && !force) {
    return JSON.parse(JSON.stringify(layoutCache));
  }

  let raw = null;
  const tunerDraft = isTilebagV2TunerPage() && localStorage.getItem(LS_PENDING_KEY) === '1';

  if (tunerDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  if (!tunerDraft) {
    try {
      const res = await fetch(`/data/tilebag_v2_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* ignore */
    }
  }

  if (!raw && !tunerDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  layoutCache = mergeTilebagV2Layout(raw);
  return JSON.parse(JSON.stringify(layoutCache));
}

export async function reloadTilebagV2Layout() {
  clearTilebagV2LayoutCache();
  return loadTilebagV2Layout({ force: true });
}

function cssBgUrl(path) {
  const bg = String(path || '').trim();
  if (!bg) return '';
  return bg.includes('(') ? bg : `url("${bg.replace(/"/g, '%22')}")`;
}

export function applyTilebagV2Layout(layout, target = document.documentElement) {
  const merged = mergeTilebagV2Layout(layout);
  const art = merged.art || DEFAULT_TILEBAG_V2_LAYOUT.art;

  applyTilebagLayout(merged, target);

  const artW = art.w ?? TILEBAG_V2_ART.w;
  const collapsedH = art.collapsedH ?? TILEBAG_V2_ART.collapsedH;
  const expandedH = art.expandedH ?? TILEBAG_V2_ART.expandedH;

  target.style.setProperty('--tz-tilebag-art-w', String(artW));
  target.style.setProperty('--tz-tilebag-art-h', String(collapsedH));
  target.style.setProperty('--tz-tilebag-art-expanded-h', String(expandedH));

  const collapsedUrl = cssBgUrl(art.collapsed);
  const expandedUrl = cssBgUrl(art.expanded);
  const handleUrl = cssBgUrl(art.handlebar);
  if (collapsedUrl) target.style.setProperty('--tz-img-tilebag', collapsedUrl);
  if (expandedUrl) target.style.setProperty('--tz-img-tilebag-expanded', expandedUrl);
  if (handleUrl) target.style.setProperty('--tz-img-tilebag-handlebar', handleUrl);
}

export function buildTilebagV2LayoutReport(layout) {
  const merged = mergeTilebagV2Layout(layout);
  const art = merged.art || {};
  const lines = [
    `Tile bag v2 layout (art ${art.w ?? TILEBAG_V2_ART.w}×${art.collapsedH ?? TILEBAG_V2_ART.collapsedH} collapsed · ${art.expandedH ?? TILEBAG_V2_ART.expandedH} expanded)`,
    `collapsed PNG: ${art.collapsed || '(default)'}`,
    `expanded PNG: ${art.expanded || '(default)'}`,
    `handlebar PNG: ${art.handlebar || '(default)'}`,
    '',
    `Container Y nudge: ${merged.container?.yNudge ?? 0}px`,
    '',
    '— Collapsed —',
  ];
  for (const key of ['track', 'arrowPrev', 'arrowNext']) {
    const b = getTilebagBoxItem(key, 'collapsed', merged);
    lines.push(`${TILEBAG_ITEM_DEFS[key]?.label || key}: left ${b.left} · width ${b.width} · nudge ${b.nudgeX}, ${b.nudgeY}`);
  }
  lines.push('', '— Expanded —');
  for (const key of ['track', 'arrowPrev', 'arrowNext']) {
    const b = getTilebagBoxItem(key, 'expanded', merged);
    lines.push(`${TILEBAG_ITEM_DEFS[key]?.label || key}: left ${b.left} · width ${b.width}${b.hidden ? ' (hidden)' : ''}`);
  }
  const t = merged.tiles;
  lines.push('', `Tiles: cell ${t.cell}px · gap ${t.gap}px · hScale ${t.thumbHScale} · insetY ${t.fitInsetY} · vNudge ${t.vNudge}`);
  const g = merged.glow;
  lines.push(`Glow: ring ${g.ring}px · blur ${g.blur}px · rgba(${g.r},${g.g},${g.b},${g.alpha})`);
  const ex = merged.expandedLayout;
  lines.push(`Expanded: maxRows ${ex.maxRows} · grow ${ex.growScale} · trim ${ex.heightTrim}px`);
  return lines.join('\n');
}
