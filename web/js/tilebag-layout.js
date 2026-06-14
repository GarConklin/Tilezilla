/** Tile bag layout — artboard 381×74 (collapsed) / 381×226 (expanded PNG). */

export const TILEBAG_ART = { w: 381, collapsedH: 74, expandedH: 226 };

export const TILEBAG_VARIANTS = ['collapsed', 'expanded'];

export const TILEBAG_ITEM_DEFS = {
  container: { label: 'Bag on screen (Y nudge)', kind: 'container' },
  track: { label: 'Tile track area', kind: 'box', variant: true },
  arrowPrev: { label: 'Scroll ← button', kind: 'box', variant: true },
  arrowNext: { label: 'Scroll → button', kind: 'box', variant: true },
  handle: { label: 'Expand handle bar', kind: 'handle' },
  title: { label: '“Tile Bag” title', kind: 'header' },
  count: { label: 'Count badge (0/15)', kind: 'header' },
  tiles: { label: 'Tile size & spacing', kind: 'tiles' },
  glow: { label: 'Selected tile glow', kind: 'glow' },
  expandedLayout: { label: 'Expanded layout rules', kind: 'expanded' },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:tilebag';
const LS_PENDING_KEY = 'tilezilla:layouts:tilebag:pending';

let layoutCache = null;

export function isTilebagTunerPage() {
  return /tilebag-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export const DEFAULT_TILEBAG_LAYOUT = {
  container: { yNudge: 25 },
  collapsed: {
    track: { left: 18, width: 345, nudgeX: 0, nudgeY: 0 },
    arrowPrev: { left: 0, width: 15, nudgeX: 0, nudgeY: 0 },
    arrowNext: { left: 366, width: 15, nudgeX: 0, nudgeY: 0 },
  },
  expanded: {
    track: { left: 18, width: 345, nudgeX: 0, nudgeY: 0 },
    arrowPrev: { left: 0, width: 15, nudgeX: 0, nudgeY: 0, hidden: true },
    arrowNext: { left: 366, width: 15, nudgeX: 0, nudgeY: 0, hidden: true },
  },
  handle: {
    countX: 213,
    countY: 1,
    countW: 60,
    countH: 16,
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
    gap: 5,
    thumbHScale: 0.92,
    fitInsetY: 6,
    vNudge: -8,
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
    growScale: 1.65,
    heightTrim: 40,
    maxOverlap: 72,
    frameCollapsedH: 94,
    trackCollapsedH: 48,
    trackExpandedNudgeY: 0,
  },
};

export function clearTilebagLayoutCache() {
  layoutCache = null;
}

export function stashTilebagLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearTilebagLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeTilebagLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_TILEBAG_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;

  if (raw.container && typeof raw.container === 'object') {
    base.container = { ...base.container, ...raw.container };
  }
  if (raw.handle && typeof raw.handle === 'object') {
    base.handle = { ...base.handle, ...raw.handle };
  }
  if (raw.tiles && typeof raw.tiles === 'object') {
    base.tiles = { ...base.tiles, ...raw.tiles };
  }
  if (raw.glow && typeof raw.glow === 'object') {
    base.glow = { ...base.glow, ...raw.glow };
  }
  if (raw.expandedLayout && typeof raw.expandedLayout === 'object') {
    base.expandedLayout = { ...base.expandedLayout, ...raw.expandedLayout };
  }
  for (const vk of TILEBAG_VARIANTS) {
    if (raw[vk] && typeof raw[vk] === 'object') {
      base[vk] = { ...base[vk], ...raw[vk] };
      for (const key of ['track', 'arrowPrev', 'arrowNext']) {
        if (raw[vk][key] && typeof raw[vk][key] === 'object') {
          base[vk][key] = { ...base[vk][key], ...raw[vk][key] };
        }
      }
    }
  }
  return base;
}

export async function loadTilebagLayout({ force = false } = {}) {
  if (layoutCache && !force) {
    return JSON.parse(JSON.stringify(layoutCache));
  }

  let raw = null;
  const tunerDraft = isTilebagTunerPage() && localStorage.getItem(LS_PENDING_KEY) === '1';

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
      const res = await fetch(`/data/tilebag_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeTilebagLayout(raw);
  return JSON.parse(JSON.stringify(layoutCache));
}

export async function reloadTilebagLayout() {
  clearTilebagLayoutCache();
  return loadTilebagLayout({ force: true });
}

export function getTilebagVariantLayout(variant, layout) {
  const merged = mergeTilebagLayout(layout);
  const vk = TILEBAG_VARIANTS.includes(variant) ? variant : 'collapsed';
  return merged[vk] || merged.collapsed;
}

export function getTilebagBoxItem(itemKey, variant, layout) {
  const v = getTilebagVariantLayout(variant, layout);
  const def = DEFAULT_TILEBAG_LAYOUT[variant]?.[itemKey]
    || DEFAULT_TILEBAG_LAYOUT.collapsed[itemKey]
    || {};
  const item = v[itemKey] || {};
  return {
    left: item.left ?? def.left ?? 0,
    width: item.width ?? def.width ?? 10,
    nudgeX: item.nudgeX ?? def.nudgeX ?? 0,
    nudgeY: item.nudgeY ?? def.nudgeY ?? 0,
    hidden: item.hidden ?? def.hidden ?? false,
  };
}

function glowCss(glow) {
  const { r, g, b, alpha, ring, blur, spread } = glow;
  const inner = `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.35)})`;
  const outer = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  return `0 0 0 ${ring}px ${inner}, 0 0 ${blur}px ${spread}px ${outer}`;
}

export function applyTilebagLayout(layout, target = document.documentElement) {
  const merged = mergeTilebagLayout(layout);
  const h = merged.handle;
  const t = merged.tiles;
  const g = merged.glow;
  const ex = merged.expandedLayout;

  target.style.setProperty('--tz-y-tilebag-nudge', `${merged.container.yNudge ?? 25}px`);

  for (const vk of TILEBAG_VARIANTS) {
    const suffix = vk === 'expanded' ? '-expanded' : '';
    const track = getTilebagBoxItem('track', vk, merged);
    const prev = getTilebagBoxItem('arrowPrev', vk, merged);
    const next = getTilebagBoxItem('arrowNext', vk, merged);

    target.style.setProperty(`--tz-tilebag-track-left-art${suffix}`, String(track.left));
    target.style.setProperty(`--tz-tilebag-track-width-art${suffix}`, String(track.width));
    target.style.setProperty(`--tz-tilebag-track-nudge-x${suffix}`, `${track.nudgeX}px`);
    target.style.setProperty(`--tz-tilebag-track-nudge-y${suffix}`, `${track.nudgeY}px`);

    target.style.setProperty(`--tz-tilebag-arrow-prev-left-art${suffix}`, String(prev.left));
    target.style.setProperty(`--tz-tilebag-arrow-next-left-art${suffix}`, String(next.left));
    target.style.setProperty(`--tz-tilebag-arrow-width-art${suffix}`, String(prev.width));
    target.style.setProperty(`--tz-tilebag-arrow-next-width-art${suffix}`, String(next.width));
    target.style.setProperty(`--tz-tilebag-arrow-prev-nudge-x${suffix}`, `${prev.nudgeX}px`);
    target.style.setProperty(`--tz-tilebag-arrow-prev-nudge-y${suffix}`, `${prev.nudgeY}px`);
    target.style.setProperty(`--tz-tilebag-arrow-next-nudge-x${suffix}`, `${next.nudgeX}px`);
    target.style.setProperty(`--tz-tilebag-arrow-next-nudge-y${suffix}`, `${next.nudgeY}px`);
    target.style.setProperty(
      `--tz-tilebag-arrow-prev-display${suffix}`,
      prev.hidden ? 'none' : 'block',
    );
    target.style.setProperty(
      `--tz-tilebag-arrow-next-display${suffix}`,
      next.hidden ? 'none' : 'block',
    );
  }

  target.style.setProperty('--tz-tilebag-count-x', String(h.countX ?? 213));
  target.style.setProperty('--tz-tilebag-count-y', String(h.countY ?? 1));
  target.style.setProperty('--tz-tilebag-count-w', String(h.countW ?? 60));
  target.style.setProperty('--tz-tilebag-count-h', String(h.countH ?? 16));
  target.style.setProperty('--tz-tilebag-count-nudge-x', `${h.countNudgeX ?? 0}px`);
  target.style.setProperty('--tz-tilebag-count-expanded-nudge-y', `${h.countExpandedNudgeY ?? 0}px`);
  target.style.setProperty('--tz-tilebag-handle-x-offset', `${h.handleXOffset ?? -55}px`);
  target.style.setProperty('--tz-tilebag-handle-y-gap', `${h.handleYGap ?? 1}px`);
  target.style.setProperty('--tz-tilebag-handle-nudge-x', `${h.handleNudgeX ?? 0}px`);
  target.style.setProperty('--tz-tilebag-handle-nudge-y', `${h.handleNudgeY ?? 0}px`);
  target.style.setProperty('--tz-tilebag-handle-w', `${h.handleW ?? 32}px`);
  target.style.setProperty('--tz-tilebag-handle-hit-h', `${h.handleHitH ?? 12}px`);
  target.style.setProperty('--tz-tilebag-handle-expanded-x-offset', `${h.handleExpandedXOffset ?? h.handleXOffset ?? -55}px`);
  target.style.setProperty('--tz-tilebag-handle-expanded-y-gap', `${h.handleExpandedYGap ?? h.handleYGap ?? 1}px`);
  target.style.setProperty('--tz-tilebag-handle-expanded-nudge-x', `${h.handleExpandedNudgeX ?? 0}px`);
  target.style.setProperty('--tz-tilebag-handle-expanded-nudge-y', `${h.handleExpandedNudgeY ?? 0}px`);
  target.style.setProperty('--tz-tilebag-title-offset-x', `${h.titleOffsetX ?? -70}px`);
  target.style.setProperty('--tz-tilebag-title-nudge-x', `${h.titleNudgeX ?? 0}px`);
  target.style.setProperty('--tz-tilebag-title-nudge-y', `${h.titleNudgeY ?? 0}px`);
  target.style.setProperty('--tz-tilebag-title-expanded-nudge-x', `${h.titleExpandedNudgeX ?? 0}px`);
  target.style.setProperty('--tz-tilebag-title-expanded-nudge-y', `${h.titleExpandedNudgeY ?? 0}px`);

  target.style.setProperty('--tz-tilebag-cell', `${t.cell ?? 34}px`);
  target.style.setProperty('--tz-tile-gap', `${t.gap ?? 5}px`);
  target.style.setProperty('--tz-tilebag-thumb-h-scale', String(t.thumbHScale ?? 0.92));
  target.style.setProperty('--tz-tilebag-thumb-fit-inset-y', `${t.fitInsetY ?? 6}px`);
  target.style.setProperty('--tz-tilebag-thumb-v-nudge', `${t.vNudge ?? 0}px`);

  target.style.setProperty('--tz-tilebag-glow-ring', `${g.ring ?? 2}px`);
  target.style.setProperty('--tz-tilebag-glow-blur', `${g.blur ?? 10}px`);
  target.style.setProperty('--tz-tilebag-glow-spread', `${g.spread ?? 0}px`);
  target.style.setProperty('--tz-tilebag-glow-shadow', glowCss(g));

  target.style.setProperty('--tz-tilebag-expanded-max-rows', String(ex.maxRows ?? 3));
  target.style.setProperty('--tz-tilebag-expanded-grow-scale', String(ex.growScale ?? 1.65));
  target.style.setProperty('--tz-tilebag-expanded-height-trim', `${ex.heightTrim ?? 40}px`);
  target.style.setProperty('--tz-tilebag-expanded-max-overlap', `${ex.maxOverlap ?? 72}px`);
  target.style.setProperty('--tz-h-tilebag-frame', `${ex.frameCollapsedH ?? 94}px`);
  target.style.setProperty('--tz-tilebag-track-collapsed-h', `${ex.trackCollapsedH ?? 48}px`);
  target.style.setProperty('--tz-tilebag-track-expanded-nudge-y', `${ex.trackExpandedNudgeY ?? 0}px`);
}

export function buildTilebagLayoutReport(layout) {
  const merged = mergeTilebagLayout(layout);
  const lines = [
    `Tile bag layout (art ${TILEBAG_ART.w}×${TILEBAG_ART.collapsedH} collapsed · ${TILEBAG_ART.expandedH} expanded)`,
    '',
    `Container Y nudge: ${merged.container.yNudge}px`,
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
