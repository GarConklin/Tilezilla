import {
  TILEBAG_V2_ART,
  TILEBAG_ITEM_DEFS,
  applyTilebagV2Layout,
  buildTilebagV2LayoutReport,
  clearTilebagV2LayoutCache,
  clearTilebagV2LayoutDraft,
  getTilebagBoxItem,
  loadTilebagV2Layout,
  mergeTilebagV2Layout,
  stashTilebagV2LayoutDraft,
} from './tilebag-v2-layout.js';
import { computeExpandedTilebagHeights, resolveExpandedTilebagMetrics } from './tilebag-layout.js';

const ART_STEP = 1;
const PX_STEP = 1;
const SCALE_STEP = 0.02;
const SCALE_FINE_STEP = 0.01;
const SCALE_PERCENT_STEP = 0.05;
const FLOAT_STEP = 0.05;

const TILEBAG_V2_ITEM_DEFS = {
  bagArt: { label: 'Bag graphic (PNG)', kind: 'bagArt' },
  ...TILEBAG_ITEM_DEFS,
};

const BOX_ITEMS = new Set(['track', 'arrowPrev', 'arrowNext']);

const SECTION_FIELDS = {
  tiles: ['cell', 'gap', 'thumbHScale', 'fitInsetY', 'vNudge'],
  glow: ['ring', 'blur', 'spread', 'r', 'g', 'b', 'alpha'],
  expandedLayout: [
    'maxRows',
    'growScale',
    'heightTrim',
    'maxOverlap',
    'frameCollapsedH',
    'trackCollapsedH',
    'trackExpandedH',
    'trackExpandedNudgeY',
    'expandedBottomCapArt',
    'trackExpandedExtraH',
  ],
};

let workingLayout = mergeTilebagV2Layout(null);
let previewVariant = 'collapsed';
let currentItem = 'track';
let subFieldIndex = 0;
let dragState = null;

const els = {};

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

function variantKey() {
  return previewVariant === 'expanded' ? 'expanded' : 'collapsed';
}

function isBoxItem(key) {
  return BOX_ITEMS.has(key);
}

function patchBox(key, patch, { live = false } = {}) {
  const vk = variantKey();
  workingLayout[vk] = workingLayout[vk] || {};
  workingLayout[vk][key] = { ...(workingLayout[vk][key] || {}), ...patch };
  if (live) {
    applyTilebagV2Layout(workingLayout, document.documentElement);
    if (previewVariant === 'expanded') applyExpandedPreviewMetrics();
    buildMockPalette();
    els.readout.innerHTML = formatReadout(currentItem);
    renderOverlays();
    requestAnimationFrame(() => renderOverlays());
    stashTilebagV2LayoutDraft(workingLayout);
    scheduleSave();
    return;
  }
  refresh();
}

function sectionFieldName(section) {
  const fields = SECTION_FIELDS[section];
  if (!fields?.length) return null;
  return fields[((subFieldIndex % fields.length) + fields.length) % fields.length];
}

function cycleSubField(dir) {
  const fields = SECTION_FIELDS[currentItem];
  if (!fields?.length) return;
  subFieldIndex = (subFieldIndex + dir + fields.length) % fields.length;
  els.readout.innerHTML = formatReadout(currentItem);
  updateKeysHelp();
}

function stepForSectionField(section, field) {
  if (section === 'tiles') {
    if (field === 'thumbHScale') return SCALE_STEP;
    if (field === 'fitInsetY' || field === 'vNudge') return PX_STEP;
    return PX_STEP;
  }
  if (section === 'glow') {
    if (field === 'alpha') return FLOAT_STEP;
    return PX_STEP;
  }
  if (section === 'expandedLayout') {
    if (field === 'growScale') return FLOAT_STEP;
    if (field === 'maxRows') return 1;
    return PX_STEP;
  }
  return PX_STEP;
}

function minForSectionField(section, field) {
  if (section === 'tiles' && field === 'cell') return 16;
  if (section === 'tiles' && (field === 'gap' || field === 'gapRow')) return 0;
  if (section === 'glow') {
    if (field === 'alpha') return 0;
    if (['r', 'g', 'b'].includes(field)) return 0;
    return 0;
  }
  if (section === 'expandedLayout' && field === 'maxRows') return 1;
  if (section === 'expandedLayout' && field === 'trackExpandedH') return 8;
  if (section === 'expandedLayout' && field === 'expandedBottomCapArt') return 0;
  return section === 'expandedLayout' && field === 'growScale' ? 0.5 : 0;
}

function patchSectionField(section, field, delta, { live = false } = {}) {
  const obj = workingLayout[section] || {};
  const step = stepForSectionField(section, field);
  const min = minForSectionField(section, field);
  let next = (obj[field] ?? 0) + delta * step;
  if (field === 'alpha') next = Math.min(1, Math.max(min, next));
  else if (['r', 'g', 'b'].includes(field)) next = Math.min(255, Math.max(min, Math.round(next)));
  else if (field === 'maxRows') next = Math.max(min, Math.round(next));
  else if (field === 'cell') next = Math.max(min, Math.round(next));
  else if (field === 'gap' || field === 'gapRow') next = Math.max(min, Math.round(next));
  else if (field === 'trackExpandedH') next = Math.max(min, Math.round(next));
  else if (field === 'expandedBottomCapArt') next = Math.max(min, Math.round(next));
  else if (field === 'trackExpandedExtraH') next = Math.round(next);
  else if (Number.isInteger(obj[field])) next = Math.round(next);
  patchSection(section, { [field]: next }, { live });
}

function estimatedCollapsedThumbHeightPx(tiles = workingLayout.tiles) {
  const cell = tiles?.cell ?? 34;
  const hScale = tiles?.thumbHScale ?? 1;
  const inset = tiles?.fitInsetY ?? 0;
  return Math.ceil(cell * hScale) + Math.max(0, inset) + 2;
}

function syncCollapsedTrackHeightToTiles({ live = false } = {}) {
  if (previewVariant !== 'collapsed') return;
  const needed = estimatedCollapsedThumbHeightPx();
  const current = workingLayout.expandedLayout?.trackCollapsedH ?? 49;
  if (needed <= current) return;
  patchSection('expandedLayout', { trackCollapsedH: needed }, { live });
}

function bumpTileUniformScalePercent(percentDelta, { live = false } = {}) {
  const t = workingLayout.tiles || {};
  const factor = 1 + percentDelta / 100;
  const cell = t.cell ?? 34;
  const scale = t.thumbHScale ?? 1;
  patchSection('tiles', {
    cell: Math.max(16, Math.round(cell * factor)),
    thumbHScale: Number(Math.max(0.5, scale * factor).toFixed(3)),
  }, { live });
}

function patchSection(section, patch, { live = false } = {}) {
  workingLayout[section] = { ...workingLayout[section], ...patch };
  if (live) {
    applyTilebagV2Layout(workingLayout, document.documentElement);
    if (section === 'expandedLayout' || section === 'tiles') applyExpandedPreviewMetrics();
    if (section === 'tiles') syncCollapsedTrackHeightToTiles({ live: true });
    buildMockPalette();
    els.readout.innerHTML = formatReadout(currentItem);
    renderOverlays();
    if (section === 'tiles' || section === 'glow' || section === 'expandedLayout') {
      requestAnimationFrame(() => renderOverlays());
    }
    syncTileSizingInputs();
    stashTilebagV2LayoutDraft(workingLayout);
    scheduleSave();
    return;
  }
  refresh();
  if (section === 'tiles') syncCollapsedTrackHeightToTiles();
}

function buildFieldGrid() {
  els.fieldGrid.replaceChildren();
  for (const [key, def] of Object.entries(TILEBAG_V2_ITEM_DEFS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'field-btn';
    btn.dataset.item = key;
    btn.textContent = isBoxItem(key) ? `${def.label} (${previewVariant})` : def.label;
    btn.classList.toggle('is-hidden-mode', key === 'expandedLayout' && previewVariant === 'collapsed');
    btn.addEventListener('click', () => {
      currentItem = key;
      subFieldIndex = 0;
      refresh();
      els.mockStage?.focus({ preventScroll: true });
    });
    els.fieldGrid.appendChild(btn);
  }
}

function domOverlayRect(el) {
  const wrap = document.getElementById('mockWrap');
  if (!el || !wrap) return null;
  const er = el.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  return {
    left: `${er.left - wr.left}px`,
    top: `${er.top - wr.top}px`,
    width: `${er.width}px`,
    height: `${er.height}px`,
  };
}

function frameOriginInWrap() {
  const wrap = document.getElementById('mockWrap');
  const frame = document.querySelector('#mockTileBag .tz-tilebag-frame');
  if (!wrap || !frame) return { x: 0, y: 0 };
  const fr = frame.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  return { x: fr.left - wr.left, y: fr.top - wr.top };
}

function wrapCalculatedRect(rect) {
  if (!rect) return null;
  const left = parseFloat(rect.left);
  const top = parseFloat(rect.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return rect;
  const { x, y } = frameOriginInWrap();
  return {
    ...rect,
    left: `${left + x}px`,
    top: `${top + y}px`,
  };
}

function artGraphicFields(isExpanded) {
  const a = workingLayout.art || {};
  if (isExpanded) {
    return {
      offsetX: a.expandedOffsetX ?? a.offsetX ?? 0,
      offsetY: a.expandedOffsetY ?? a.offsetY ?? 0,
      scale: a.expandedScale ?? a.scale ?? 1,
      artH: a.expandedH ?? TILEBAG_V2_ART.expandedH,
      offsetXKey: 'expandedOffsetX',
      offsetYKey: 'expandedOffsetY',
      scaleKey: 'expandedScale',
      artHKey: 'expandedH',
    };
  }
  return {
    offsetX: a.offsetX ?? 0,
    offsetY: a.offsetY ?? 0,
    scale: a.scale ?? 1,
    artH: a.collapsedH ?? TILEBAG_V2_ART.collapsedH,
    offsetXKey: 'offsetX',
    offsetYKey: 'offsetY',
    scaleKey: 'scale',
    artHKey: 'collapsedH',
  };
}

function readCssPxVar(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

function collapsedFrameHeightPx() {
  const ex = workingLayout.expandedLayout || {};
  return readCssPxVar('--tz-h-tilebag-frame', ex.frameCollapsedH ?? TILEBAG_V2_ART.collapsedH);
}

function measureExpandedMetrics() {
  const ex = workingLayout.expandedLayout || {};
  const capTop = readCssPxVar('--tz-tilebag-expanded-cap-top', 26);
  const skinCapBottom = readCssPxVar('--tz-tilebag-expanded-cap-bottom', 22);
  const frameCollapsedH = collapsedFrameHeightPx();
  const maxRows = ex.maxRows ?? 3;
  const gap = readCssPxVar('--tz-tile-gap', 5);
  const rowGap = readCssPxVar('--tz-tilebag-row-gap', gap);
  const cell = readCssPxVar('--tz-tilebag-cell', 34);
  const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-tilebag-thumb-h-scale')) || 0.92;
  const rowH = Math.ceil(cell * hScale) + rowGap;
  const tabH = readCssPxVar('--tz-tilebag-tab-h', 26);
  const trackCapBottom = readCssPxVar('--tz-tilebag-track-expanded-cap-bottom', 22);
  const trackNudgeYExpanded = workingLayout.expanded?.track?.nudgeY || 0;
  const artExpandedH = workingLayout.art?.expandedH ?? TILEBAG_V2_ART.expandedH;

  const computed = computeExpandedTilebagHeights({
    maxRows,
    rowHPx: rowH,
    growScale: ex.growScale ?? 1.65,
    heightTrim: ex.heightTrim ?? 40,
    trackExpandedExtraH: 0,
    frameCollapsedH,
    capTopPx: capTop,
    skinCapBottomPx: skinCapBottom,
    trackPad: 4,
  });

  return resolveExpandedTilebagMetrics({
    expandedLayout: ex,
    computedTrackHeight: computed.trackHeight,
    computedFrameHeight: computed.frameHeight,
    frameCollapsedH,
    tabHPx: tabH,
    trackCapBottomPx: trackCapBottom,
    trackExpandedNudgeY: ex.trackExpandedNudgeY ?? 0,
    trackNudgeYExpanded,
    frameArtMinHPx: artExpandedH,
  });
}

function measureMockExpansion() {
  return measureExpandedMetrics();
}

function applyExpandedPreviewMetrics() {
  const bag = document.getElementById('mockTileBag');
  const wrap = document.getElementById('mockWrap');
  const frame = bag?.querySelector('.tz-tilebag-frame');
  const track = document.getElementById('mockTrack');
  if (!bag || !wrap || !frame || !track) return;

  const collapsedH = collapsedFrameHeightPx();

  if (!bag.classList.contains('is-expanded')) {
    bag.style.height = `${collapsedH}px`;
    wrap.style.minHeight = `${collapsedH + 44}px`;
    bag.style.removeProperty('--tz-tilebag-frame-h');
    frame.style.removeProperty('--tz-tilebag-frame-h');
    track.style.removeProperty('--tz-tilebag-track-h');
    return;
  }

  const { trackHeight, frameHeight } = measureExpandedMetrics();
  bag.style.height = `${frameHeight}px`;
  wrap.style.minHeight = `${frameHeight + 44}px`;
  bag.style.setProperty('--tz-tilebag-frame-h', `${frameHeight}px`);
  frame.style.setProperty('--tz-tilebag-frame-h', `${frameHeight}px`);
  track.style.setProperty('--tz-tilebag-track-h', `${trackHeight}px`);
}

function trackHeightPxForVariant(vk) {
  if (vk === 'collapsed') {
    return readCssPxVar(
      '--tz-tilebag-track-collapsed-h',
      workingLayout.expandedLayout?.trackCollapsedH ?? 49,
    );
  }
  if (previewVariant === 'expanded') {
    const trackEl = document.getElementById('mockTrack');
    if (trackEl?.clientHeight) return trackEl.clientHeight;
  }
  return measureExpandedMetrics().trackHeight;
}

function headerTabCapTopPx() {
  return readCssPxVar('--tz-tilebag-art-cap-top', 26);
}

function headerOverlayPos(h, key, fw, tabH) {
  const capTop = headerTabCapTopPx();
  const isExpanded = previewVariant === 'expanded';
  if (key === 'title') {
    const left = (h.titleX / TILEBAG_V2_ART.w) * fw
      + (isExpanded ? (h.titleExpandedNudgeX || 0) : (h.titleNudgeX || 0));
    const top = (h.titleY / capTop) * tabH
      + (isExpanded ? (h.titleExpandedNudgeY || 0) : (h.titleNudgeY || 0));
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(60, (h.countW / TILEBAG_V2_ART.w) * fw)}px`,
      height: '14px',
    };
  }
  const left = (h.countX / TILEBAG_V2_ART.w) * fw
    + (isExpanded ? (h.countExpandedNudgeX || 0) : (h.countNudgeX || 0));
  const top = (h.countY / capTop) * tabH
    + (isExpanded ? (h.countExpandedNudgeY || 0) : (h.countNudgeY || 0));
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${(h.countW / TILEBAG_V2_ART.w) * fw}px`,
    height: '14px',
  };
}

function overlayRectForItem(key, { variant: forceVariant, preferDom = true } = {}) {
  const vk = forceVariant ?? variantKey();
  const isActiveVariant = vk === previewVariant;

  if (isBoxItem(key) && isActiveVariant && preferDom) {
    const el = key === 'track'
      ? document.getElementById('mockTrack')
      : key === 'arrowPrev'
        ? document.getElementById('mockPrev')
        : document.getElementById('mockNext');
    const domRect = domOverlayRect(el);
    if (domRect) return domRect;
  }

  if ((key === 'handle' || key === 'title' || key === 'count') && isActiveVariant && preferDom) {
    const sel = key === 'handle'
      ? '.tz-tilebag-expand-handle'
      : key === 'title'
        ? '.tz-tilebag-title-overlay'
        : '.tz-tilebag-count-overlay';
    const domRect = domOverlayRect(document.querySelector(`#mockTileBag ${sel}`));
    if (domRect) return domRect;
  }

  if (key === 'bagArt' && isActiveVariant && preferDom) {
    const domRect = domOverlayRect(document.querySelector('#mockTileBag .tz-tilebag-frame'));
    if (domRect) return domRect;
  }

  const frame = document.querySelector('#mockTileBag .tz-tilebag-frame');
  if (!frame) return null;
  const fw = frame.clientWidth;
  const tabH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-tilebag-tab-h')) || 26;

  if (isBoxItem(key)) {
    const b = getTilebagBoxItem(key, vk, workingLayout);
    const trackH = trackHeightPxForVariant(vk);
    const top = vk === 'expanded'
      ? tabH
        + (workingLayout.expandedLayout?.trackExpandedNudgeY || 0)
        + (b.nudgeY || 0)
      : tabH + (b.nudgeY || 0);
    return wrapCalculatedRect({
      left: `${(b.left / TILEBAG_V2_ART.w) * fw + b.nudgeX}px`,
      top: `${top}px`,
      width: `${(b.width / TILEBAG_V2_ART.w) * fw}px`,
      height: `${trackH}px`,
    });
  }

  if (key === 'handle') {
    const h = workingLayout.handle;
    const isExpanded = previewVariant === 'expanded';
    const xOff = isExpanded ? (h.handleExpandedXOffset || 0) : (h.handleXOffset || 0);
    const xNudge = isExpanded ? (h.handleExpandedNudgeX || 0) : (h.handleNudgeX || 0);
    const yGap = isExpanded ? (h.handleExpandedYGap || 0) : (h.handleYGap || 0);
    const yNudge = isExpanded ? (h.handleExpandedNudgeY || 0) : (h.handleNudgeY || 0);
    const left = (h.countX / TILEBAG_V2_ART.w) * fw + xOff + xNudge;
    const top = tabH + yGap + yNudge;
    return wrapCalculatedRect({
      left: `${left}px`,
      top: `${top}px`,
      width: `${h.handleW || 32}px`,
      height: `${h.handleHitH || 12}px`,
    });
  }

  if (key === 'title' || key === 'count') {
    return wrapCalculatedRect(headerOverlayPos(workingLayout.handle, key, fw, tabH));
  }

  if (key === 'bagArt') {
    const fh = frame.clientHeight;
    return wrapCalculatedRect({
      left: '0px',
      top: '0px',
      width: `${fw}px`,
      height: `${fh}px`,
    });
  }

  if (key === 'tiles') {
    const wrap = document.getElementById('mockWrap');
    const pal = document.getElementById('mockPalette');
    if (!wrap || !pal) return null;
    const pr = pal.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const pad = 4;
    return {
      left: `${Math.max(0, pr.left - wr.left - pad)}px`,
      top: `${Math.max(0, pr.top - wr.top - pad)}px`,
      width: `${pr.width + pad * 2}px`,
      height: `${Math.max(pr.height, 20) + pad * 2}px`,
    };
  }

  if (key === 'glow') {
    const wrap = document.getElementById('mockWrap');
    const thumb = document.querySelector('#mockPalette .palItem.selected .palThumb');
    if (!wrap || !thumb) return null;
    const tr = thumb.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const pad = 6;
    return {
      left: `${tr.left - wr.left - pad}px`,
      top: `${tr.top - wr.top - pad}px`,
      width: `${tr.width + pad * 2}px`,
      height: `${tr.height + pad * 2}px`,
    };
  }

  return null;
}

function variantBoxLabel(key, vk) {
  const base = TILEBAG_V2_ITEM_DEFS[key]?.label || key;
  if (key === 'bagArt') return `${base} (${vk})`;
  return isBoxItem(key) ? `${base} (${vk})` : base;
}

function appendOverlay(layer, key, vk, { ghost = false } = {}) {
  if (isBoxItem(key) && getTilebagBoxItem(key, vk, workingLayout).hidden) return;
  const rect = overlayRectForItem(key, {
    variant: vk,
    preferDom: !ghost && vk === previewVariant,
  });
  if (!rect) return;
  const ov = document.createElement('div');
  ov.className = ghost ? 'tuner-overlay tuner-overlay--ghost' : 'tuner-overlay';
  ov.dataset.item = key;
  ov.dataset.variant = vk;
  ov.classList.toggle('is-active', !ghost && currentItem === key && vk === previewVariant);
  Object.assign(ov.style, rect);
  const label = document.createElement('span');
  label.className = 'tuner-overlay__label';
  label.textContent = variantBoxLabel(key, vk);
  ov.appendChild(label);
  if (!ghost) {
    ov.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('[data-handle="s"], [data-handle="se"]')) return;
      e.preventDefault();
      currentItem = key;
      refreshFieldGrid();
      onOverlayPointerDown(e, key);
    });
    if (key === 'track' && vk === 'expanded') {
      const handle = document.createElement('span');
      handle.className = 'tuner-handle tuner-handle--s';
      handle.dataset.handle = 's';
      handle.title = 'Drag to resize track height';
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        currentItem = key;
        refreshFieldGrid();
        onOverlayTrackHeightDown(e);
      });
      ov.appendChild(handle);
    }
    if (key === 'bagArt' && vk === previewVariant) {
      const handle = document.createElement('span');
      handle.className = 'tuner-handle tuner-handle--se';
      handle.dataset.handle = 'se';
      handle.title = 'Drag to scale bag graphic';
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        currentItem = key;
        refreshFieldGrid();
        onOverlayBagArtScaleDown(e);
      });
      ov.appendChild(handle);
    }
  }
  layer.appendChild(ov);
}

function renderOverlays() {
  const layer = document.getElementById('tunerOverlayLayer');
  if (!layer) return;
  layer.replaceChildren();

  const ghostVariant = previewVariant === 'expanded' ? 'collapsed' : 'expanded';
  for (const key of ['track']) {
    appendOverlay(layer, key, ghostVariant, { ghost: true });
  }

  if (isBoxItem(currentItem)) {
    for (const key of ['arrowPrev', 'arrowNext']) {
      appendOverlay(layer, key, ghostVariant, { ghost: true });
    }
  }

  for (const key of ['track', 'arrowPrev', 'arrowNext', 'handle', 'title', 'count', 'tiles', 'glow']) {
    if ((key === 'tiles' || key === 'glow') && key !== currentItem) continue;
    if (isBoxItem(key)) {
      appendOverlay(layer, key, previewVariant);
      continue;
    }
    appendOverlay(layer, key, previewVariant);
  }
  if (currentItem === 'bagArt') {
    appendOverlay(layer, 'bagArt', previewVariant);
  }
}

function overlaySnapshot(key) {
  if (isBoxItem(key)) {
    const base = { ...getTilebagBoxItem(key, variantKey(), workingLayout) };
    if (key === 'track' && variantKey() === 'expanded') {
      base.trackExpandedNudgeY = workingLayout.expandedLayout?.trackExpandedNudgeY || 0;
      base.expandedBottomCapArt = workingLayout.expandedLayout?.expandedBottomCapArt ?? 22;
      base.trackExpandedH = workingLayout.expandedLayout?.trackExpandedH ?? 0;
    }
    return base;
  }
  if (key === 'tiles') {
    return { ...workingLayout.tiles };
  }
  if (key === 'glow') {
    return { ...workingLayout.glow };
  }
  if (key === 'bagArt') {
    const a = workingLayout.art || {};
    return {
      offsetX: a.offsetX ?? 0,
      offsetY: a.offsetY ?? 0,
      scale: a.scale ?? 1,
      expandedOffsetX: a.expandedOffsetX ?? a.offsetX ?? 0,
      expandedOffsetY: a.expandedOffsetY ?? a.offsetY ?? 0,
      expandedScale: a.expandedScale ?? a.scale ?? 1,
      w: a.w ?? TILEBAG_V2_ART.w,
      collapsedH: a.collapsedH ?? TILEBAG_V2_ART.collapsedH,
      expandedH: a.expandedH ?? TILEBAG_V2_ART.expandedH,
    };
  }
  return { ...workingLayout.handle };
}

function currentExpandedTrackHeightPx() {
  const trackEl = document.getElementById('mockTrack');
  if (trackEl?.clientHeight) return trackEl.clientHeight;
  return measureExpandedMetrics().trackHeight;
}

function onOverlayTrackHeightDown(e) {
  const startH = workingLayout.expandedLayout?.trackExpandedH > 0
    ? workingLayout.expandedLayout.trackExpandedH
    : currentExpandedTrackHeightPx();
  dragState = {
    key: 'track',
    mode: 'resize-h',
    startY: e.clientY,
    startH,
  };
  e.currentTarget.setPointerCapture(e.pointerId);
}

function onOverlayBagArtScaleDown(e) {
  const fields = artGraphicFields(previewVariant === 'expanded');
  dragState = {
    key: 'bagArt',
    mode: 'resize-scale',
    startX: e.clientX,
    startY: e.clientY,
    startScale: fields.scale,
    scaleKey: fields.scaleKey,
  };
  e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId);
}

function onOverlayPointerDown(e, key) {
  const frame = document.querySelector('#mockTileBag .tz-tilebag-frame');
  const rect = frame.getBoundingClientRect();
  dragState = {
    key,
    startX: e.clientX,
    startY: e.clientY,
    frameW: rect.width,
    snapshot: overlaySnapshot(key),
  };
  e.currentTarget.setPointerCapture(e.pointerId);
}

function onOverlayPointerMove(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  const { key, frameW, snapshot, mode } = dragState;

  if (mode === 'resize-h' && key === 'track') {
    const next = Math.max(8, Math.round(dragState.startH + (e.clientY - dragState.startY)));
    patchSection('expandedLayout', { trackExpandedH: next }, { live: true });
    return;
  }

  if (mode === 'resize-scale' && key === 'bagArt') {
    const delta = (e.clientX - dragState.startX) + (e.clientY - dragState.startY);
    const next = Math.max(0.5, Math.min(2, Number((dragState.startScale + delta * 0.004).toFixed(3))));
    patchArt({ [dragState.scaleKey]: next }, { live: true });
    return;
  }

  if (isBoxItem(key)) {
    if (previewVariant === 'expanded' && key === 'track' && e.ctrlKey) {
      const base = snapshot.trackExpandedH > 0
        ? snapshot.trackExpandedH
        : currentExpandedTrackHeightPx();
      patchSection('expandedLayout', {
        trackExpandedH: Math.max(8, Math.round(base + dy)),
      }, { live: true });
    } else if (previewVariant === 'expanded' && key === 'track' && e.shiftKey) {
      patchSection('expandedLayout', {
        trackExpandedNudgeY: Math.round((snapshot.trackExpandedNudgeY || 0) + dy),
      }, { live: true });
    } else if (previewVariant === 'expanded' && key === 'track' && e.altKey) {
      patchSection('expandedLayout', {
        expandedBottomCapArt: Math.max(0, Math.round((snapshot.expandedBottomCapArt ?? 22) - dy * 0.15)),
      }, { live: true });
    } else {
      patchBox(key, {
        left: Math.round(snapshot.left + (dx / frameW) * TILEBAG_V2_ART.w),
        nudgeY: Math.round(snapshot.nudgeY + dy),
      }, { live: true });
    }
  } else if (key === 'handle') {
    if (previewVariant === 'expanded') {
      patchSection('handle', {
        handleExpandedNudgeX: Math.round(snapshot.handleExpandedNudgeX + dx),
        handleExpandedNudgeY: Math.round(snapshot.handleExpandedNudgeY + dy),
      }, { live: true });
    } else {
      patchSection('handle', {
        handleNudgeX: Math.round(snapshot.handleNudgeX + dx),
        handleNudgeY: Math.round(snapshot.handleNudgeY + dy),
      }, { live: true });
    }
  } else if (key === 'title') {
    if (previewVariant === 'expanded') {
      patchSection('handle', {
        titleExpandedNudgeX: Math.round(snapshot.titleExpandedNudgeX + dx),
        titleExpandedNudgeY: Math.round(snapshot.titleExpandedNudgeY + dy),
      }, { live: true });
    } else {
      patchSection('handle', {
        titleNudgeX: Math.round(snapshot.titleNudgeX + dx),
        titleNudgeY: Math.round(snapshot.titleNudgeY + dy),
      }, { live: true });
    }
  } else if (key === 'count') {
    if (previewVariant === 'expanded') {
      patchSection('handle', {
        countExpandedNudgeX: Math.round(snapshot.countExpandedNudgeX + dx),
        countExpandedNudgeY: Math.round(snapshot.countExpandedNudgeY + dy),
      }, { live: true });
    } else {
      patchSection('handle', {
        countNudgeX: Math.round(snapshot.countNudgeX + dx),
        countNudgeY: Math.round(snapshot.countNudgeY + dy),
      }, { live: true });
    }
  } else if (key === 'bagArt') {
    const fields = artGraphicFields(previewVariant === 'expanded');
    patchArt({
      [fields.offsetXKey]: Math.round(fields.offsetX + dx),
      [fields.offsetYKey]: Math.round(fields.offsetY + dy),
    }, { live: true });
  } else if (key === 'tiles') {
    if (e.altKey) {
      patchSection('tiles', {
        thumbHScale: Math.max(0.5, Number(((snapshot.thumbHScale || 0.94) - dy * 0.002).toFixed(2))),
      }, { live: true });
    } else if (e.shiftKey) {
      patchSection('tiles', {
        vNudge: Math.round((snapshot.vNudge || 0) + dy),
      }, { live: true });
    } else if (e.ctrlKey) {
      patchSection('tiles', {
        gap: Math.max(0, Math.round((snapshot.gap || 5) + dx * 0.08)),
      }, { live: true });
    } else {
      patchSection('tiles', {
        cell: Math.max(16, Math.round((snapshot.cell || 34) - dy * 0.12)),
      }, { live: true });
    }
  } else if (key === 'glow') {
    patchSection('glow', {
      blur: Math.max(0, Math.round((snapshot.blur || 0) + dy * 0.5)),
      ring: Math.max(0, Math.round((snapshot.ring || 0) + dx * 0.05)),
    }, { live: true });
  }

  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.snapshot = overlaySnapshot(key);
}

function onOverlayPointerUp() {
  dragState = null;
  renderOverlays();
}

function formatReadout(key) {
  const def = TILEBAG_V2_ITEM_DEFS[key];
  const mode = `<br />Preview: <strong>${previewVariant}</strong>`;
  if (isBoxItem(key)) {
    const b = getTilebagBoxItem(key, variantKey(), workingLayout);
    const variantNote = `<br /><em>Editing ${variantKey()} layout — switch Preview mode to tune the other variant.</em>`;
    return `<strong>${variantBoxLabel(key, variantKey())}</strong><br />left ${b.left} art px · width ${b.width} · nudge ${b.nudgeX}px, ${b.nudgeY}px${
      key === 'track' && variantKey() === 'collapsed'
        ? ` · height ${workingLayout.expandedLayout?.trackCollapsedH ?? 49}px`
        : ''
    }${
      key === 'track' && variantKey() === 'expanded'
        ? ` · height ${workingLayout.expandedLayout?.trackExpandedH ?? 0}px (0=auto, applied ${currentExpandedTrackHeightPx()}px) · slot Y ${workingLayout.expandedLayout?.trackExpandedNudgeY ?? 0}px · bottom cap ${workingLayout.expandedLayout?.expandedBottomCapArt ?? 22} art px`
        : ''
    }${variantNote}${mode}`;
  }
  if (key === 'container') {
    return `<strong>${def.label}</strong><br />yNudge ${workingLayout.container.yNudge}px${mode}`;
  }
  if (key === 'bagArt') {
    const a = workingLayout.art || {};
    const fields = artGraphicFields(previewVariant === 'expanded');
    const modeLabel = previewVariant === 'expanded' ? 'expanded' : 'collapsed';
    return `<strong>${def?.label || key}</strong> (${modeLabel})<br />offset ${fields.offsetX}, ${fields.offsetY}px · scale ${fields.scale}<br />art ${a.w ?? TILEBAG_V2_ART.w}×${fields.artH} px${mode}`;
  }
  if (key === 'handle' || key === 'title' || key === 'count') {
    const h = workingLayout.handle;
    if (key === 'handle') {
      const modeLabel = previewVariant === 'expanded' ? 'expanded' : 'collapsed';
      const nx = previewVariant === 'expanded' ? h.handleExpandedNudgeX : h.handleNudgeX;
      const ny = previewVariant === 'expanded' ? h.handleExpandedNudgeY : h.handleNudgeY;
      return `<strong>${def?.label || key}</strong> (${modeLabel})<br />countX ${h.countX} · handle nudge ${nx}, ${ny}px · handleW ${h.handleW}px${mode}`;
    }
    if (key === 'title') {
      const modeLabel = previewVariant === 'expanded' ? 'expanded' : 'collapsed';
      const nx = previewVariant === 'expanded' ? h.titleExpandedNudgeX : h.titleNudgeX;
      const ny = previewVariant === 'expanded' ? h.titleExpandedNudgeY : h.titleNudgeY;
      return `<strong>${def?.label || key}</strong> (${modeLabel})<br />titleX ${h.titleX} · titleY ${h.titleY} · nudge ${nx}, ${ny}px${mode}`;
    }
    if (key === 'count') {
      const modeLabel = previewVariant === 'expanded' ? 'expanded' : 'collapsed';
      const nx = previewVariant === 'expanded' ? h.countExpandedNudgeX : h.countNudgeX;
      const ny = previewVariant === 'expanded' ? h.countExpandedNudgeY : h.countNudgeY;
      return `<strong>${def?.label || key}</strong> (${modeLabel})<br />countX ${h.countX} · countY ${h.countY} · nudge ${nx}, ${ny}px · w ${h.countW}${mode}`;
    }
    return `<strong>${def?.label || key}</strong>${mode}`;
  }
  if (key === 'tiles') {
    const t = workingLayout.tiles;
    return `<strong>${def.label}</strong><br />width ${t.cell}px · scale ${t.thumbHScale} · col gap ${t.gap}px · row gap ${t.gapRow ?? t.gap ?? 4}px · vNudge ${t.vNudge}px${
      previewVariant === 'collapsed'
        ? `<br />collapsed track H ${workingLayout.expandedLayout?.trackCollapsedH ?? 49}px (auto ≥ ${estimatedCollapsedThumbHeightPx()}px)`
        : ''
    }<br />Scroll = width · Alt+scroll = scale · Shift+Alt+scroll = ±5% (collapsed)${mode}`;
  }
  if (key === 'glow') {
    const g = workingLayout.glow;
    const field = sectionFieldName('glow');
    return `<strong>${def.label}</strong><br />field <strong>${field}</strong> = ${g[field]}${mode}`;
  }
  if (key === 'expandedLayout') {
    const ex = workingLayout.expandedLayout;
    const field = sectionFieldName('expandedLayout');
    return `<strong>${def.label}</strong><br />field <strong>${field}</strong> = ${ex[field]}${mode}`;
  }
  return `${key}${mode}`;
}

function updateKeysHelp() {
  const ul = els.keysList;
  if (!ul) return;
  if (isBoxItem(currentItem)) {
    if (previewVariant === 'collapsed' && currentItem === 'track') {
      ul.innerHTML = [
        '<li>Scroll — track nudge Y · Shift+scroll — nudge X</li>',
        '<li>Ctrl+scroll — width · Ctrl+Shift+scroll — track height (collapsed px)</li>',
        '<li>←→ scroll — move left (art px) · Drag yellow box on preview</li>',
        '<li>Cyan dashed box = expanded track (switch Preview mode to edit)</li>',
      ].join('');
      return;
    }
    if (previewVariant === 'expanded' && currentItem === 'track') {
      ul.innerHTML = [
        '<li><strong>Ctrl+Shift+scroll</strong> — track height (px) · drag bottom edge of yellow box</li>',
        '<li>Scroll — track nudge Y · Shift+scroll — expanded slot Y (top)</li>',
        '<li>Alt+scroll — bottom cap (lower = track extends toward graphic bottom)</li>',
        '<li>Ctrl+scroll — width · Ctrl+drag — height</li>',
        '<li>“Fill to art bottom” sets height to max slot in expanded PNG frame</li>',
        '<li>Cyan dashed box = collapsed track (switch Preview mode to edit)</li>',
      ].join('');
      return;
    }
    ul.innerHTML = [
      '<li>Scroll — nudge Y · Shift+scroll — nudge X</li>',
      '<li>←→ scroll — move left (art px) · Ctrl+scroll — width</li>',
      '<li>Arrows — left/width · [ ] — width art px</li>',
      '<li>Drag yellow box on preview</li>',
    ].join('');
    return;
  }
  if (currentItem === 'tiles') {
    const collapsedNote = previewVariant === 'collapsed'
      ? '<li><strong>Shift+Alt+scroll</strong> — ±5% tile size (collapsed) · track height auto-grows if needed</li>'
      : '';
    ul.innerHTML = [
      '<li><strong>Scroll</strong> — tile width · <strong>Ctrl+scroll</strong> — column gap</li>',
      '<li><strong>Alt+scroll</strong> — height scale · <strong>Shift+scroll</strong> — vNudge</li>',
      collapsedNote,
      '<li>Alt+Shift+scroll — row gap (expanded multi-row only)</li>',
      '<li>Drag — up/down = width · Alt+drag = height · Shift+drag = vNudge · Ctrl+drag = gap</li>',
    ].filter(Boolean).join('');
    return;
  }
  if (currentItem === 'glow') {
    ul.innerHTML = [
      '<li>Scroll — blur · Shift+scroll — ring width</li>',
      '<li>Drag glow box — ring (X) / blur (Y)</li>',
      '<li>[ ] — cycle color / alpha fields</li>',
    ].join('');
    return;
  }
  if (['expandedLayout', 'container'].includes(currentItem)) {
    if (SECTION_FIELDS[currentItem]) {
      ul.innerHTML = [
        `<li>Scroll — increase <strong>${sectionFieldName(currentItem)}</strong> · Shift+scroll — decrease</li>`,
        '<li>Tab / [ ] — previous / next field in section</li>',
      ].join('');
      return;
    }
    ul.innerHTML = '<li>Scroll — increase · Shift+scroll — decrease</li>';
    return;
  }
  if (['handle', 'title', 'count'].includes(currentItem)) {
    const who = currentItem === 'handle' ? 'handle bar' : currentItem;
    ul.innerHTML = [
      `<li><strong>${who}</strong> — Scroll: nudge X · Shift+scroll: nudge Y · Drag overlay: X/Y</li>`,
      '<li>Ctrl+scroll: art anchor X (titleX / countX) · Ctrl+Shift+scroll: art anchor Y (titleY / countY)</li>',
      '<li>Switch Preview mode to tune collapsed vs expanded independently</li>',
    ].join('');
    return;
  }
  if (currentItem === 'bagArt') {
    ul.innerHTML = [
      '<li><strong>Drag</strong> — move bag PNG left/right/up/down</li>',
      '<li><strong>Scroll</strong> — offset X · <strong>Shift+scroll</strong> — offset Y</li>',
      '<li><strong>Ctrl+scroll</strong> — scale · <strong>Ctrl+Shift+scroll</strong> — art height (collapsedH / expandedH)</li>',
      '<li><strong>Alt+scroll</strong> — art width · drag bottom-right corner — scale</li>',
      '<li>Switch Preview mode to tune collapsed vs expanded PNG independently</li>',
    ].join('');
    return;
  }
  ul.innerHTML = '<li>Scroll / drag — position handle & header overlays</li>';
}

function refreshFieldGrid() {
  for (const btn of els.fieldGrid.querySelectorAll('.field-btn')) {
    btn.classList.toggle('is-active', btn.dataset.item === currentItem);
  }
}

function setPreviewVariant(variant) {
  previewVariant = variant;
  document.getElementById('mockTileBag')?.classList.toggle('is-expanded', variant === 'expanded');
  if (els.modeSelect) els.modeSelect.value = variant;
  buildFieldGrid();
  refresh();
}

function buildMockPalette() {
  const pal = document.getElementById('mockPalette');
  if (!pal) return;
  const want = previewVariant === 'expanded' ? 15 : 10;
  if (pal.childElementCount !== want) {
    pal.replaceChildren();
    for (let i = 0; i < want; i += 1) {
      const item = document.createElement('div');
      item.className = `palItem${i === 2 ? ' selected' : ''}`;
      const thumb = document.createElement('div');
      thumb.className = 'palThumb mock-pal-thumb';
      const label = document.createElement('span');
      label.textContent = `T${i + 1}`;
      thumb.appendChild(label);
      item.appendChild(thumb);
      pal.appendChild(item);
    }
  }
  for (const thumb of pal.querySelectorAll('.palThumb')) {
    const scale = 'var(--tz-tilebag-thumb-h-scale)';
    thumb.style.width = `calc(var(--tz-tilebag-cell) * ${scale})`;
    thumb.style.height = `calc(var(--tz-tilebag-cell) * ${scale})`;
  }
}

function syncArtInputsFromLayout() {
  const art = workingLayout.art || {};
  if (els.artCollapsed) els.artCollapsed.value = art.collapsed || '';
  if (els.artExpanded) els.artExpanded.value = art.expanded || '';
  if (els.artHandlebar) els.artHandlebar.value = art.handlebar || '';
  if (els.artW) els.artW.value = String(art.w ?? TILEBAG_V2_ART.w);
  if (els.artCollapsedH) els.artCollapsedH.value = String(art.collapsedH ?? TILEBAG_V2_ART.collapsedH);
  if (els.artExpandedH) els.artExpandedH.value = String(art.expandedH ?? TILEBAG_V2_ART.expandedH);
}

function patchArt(patch, { live = false } = {}) {
  workingLayout.art = { ...(workingLayout.art || {}), ...patch };
  if (live) {
    applyTilebagV2Layout(workingLayout, document.documentElement);
    applyExpandedPreviewMetrics();
    syncArtInputsFromLayout();
    els.readout.innerHTML = formatReadout(currentItem);
    renderOverlays();
    requestAnimationFrame(() => renderOverlays());
    stashTilebagV2LayoutDraft(workingLayout);
    scheduleSave();
    return;
  }
  refresh();
}

function syncTileSizingInputs() {
  const t = workingLayout.tiles || {};
  const ex = workingLayout.expandedLayout || {};
  if (els.tileCellInput && document.activeElement !== els.tileCellInput) {
    els.tileCellInput.value = String(t.cell ?? 34);
  }
  if (els.tileGapInput && document.activeElement !== els.tileGapInput) {
    els.tileGapInput.value = String(t.gap ?? 5);
  }
  if (els.tileRowGapInput && document.activeElement !== els.tileRowGapInput) {
    els.tileRowGapInput.value = String(t.gapRow ?? t.gap ?? 4);
  }
  if (els.tileHScaleInput && document.activeElement !== els.tileHScaleInput) {
    els.tileHScaleInput.value = String(t.thumbHScale ?? 0.94);
  }
  if (els.trackBottomCapInput && document.activeElement !== els.trackBottomCapInput) {
    els.trackBottomCapInput.value = String(ex.expandedBottomCapArt ?? 22);
  }
  if (els.trackExtraHInput && document.activeElement !== els.trackExtraHInput) {
    els.trackExtraHInput.value = String(ex.trackExpandedExtraH ?? 0);
  }
  if (els.collapsedTrackPanel) {
    els.collapsedTrackPanel.hidden = previewVariant !== 'collapsed';
  }
  if (els.expandedTrackPanel) {
    els.expandedTrackPanel.hidden = previewVariant !== 'expanded';
  }
  if (els.trackExpandedHInput && document.activeElement !== els.trackExpandedHInput) {
    els.trackExpandedHInput.value = String(ex.trackExpandedH ?? 0);
  }
  if (els.trackCollapsedHInput && document.activeElement !== els.trackCollapsedHInput) {
    els.trackCollapsedHInput.value = String(ex.trackCollapsedH ?? 49);
  }
}

function refresh() {
  applyTilebagV2Layout(workingLayout, document.documentElement);
  applyExpandedPreviewMetrics();
  buildMockPalette();
  syncCollapsedTrackHeightToTiles();
  syncArtInputsFromLayout();
  syncTileSizingInputs();
  els.readout.innerHTML = formatReadout(currentItem);
  els.jsonOut.value = JSON.stringify(workingLayout, null, 2);
  els.reportOut.value = buildTilebagV2LayoutReport(workingLayout);
  stashTilebagV2LayoutDraft(workingLayout);
  refreshFieldGrid();
  requestAnimationFrame(() => renderOverlays());
  updateKeysHelp();
  scheduleSave();
}

function tuningBlocked(target) {
  return !!target?.closest?.('textarea, input, select');
}

function onWheel(e) {
  if (tuningBlocked(e.target)) return;
  const inStage = e.target.closest('#mockStage');
  if (!inStage) return;

  const dir = e.deltaY < 0 ? 1 : -1;
  const stepDir = dir * (e.shiftKey ? -1 : 1);

  e.preventDefault();
  e.stopPropagation();

  if (isBoxItem(currentItem)) {
    const b = getTilebagBoxItem(currentItem, variantKey(), workingLayout);
    if (e.ctrlKey) {
      patchBox(currentItem, { width: Math.max(4, b.width + stepDir * ART_STEP) }, { live: true });
      return;
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      patchBox(currentItem, { left: b.left + (e.deltaX > 0 ? ART_STEP : -ART_STEP) }, { live: true });
      return;
    }
    if (previewVariant === 'collapsed' && currentItem === 'track' && e.ctrlKey && e.shiftKey) {
      const h = workingLayout.expandedLayout?.trackCollapsedH ?? 49;
      patchSection('expandedLayout', {
        trackCollapsedH: Math.max(8, h + stepDir * PX_STEP),
      }, { live: true });
      return;
    }
    if (previewVariant === 'expanded' && currentItem === 'track') {
      if (e.ctrlKey && e.shiftKey) {
        const h = workingLayout.expandedLayout?.trackExpandedH ?? 0;
        const base = h > 0 ? h : currentExpandedTrackHeightPx();
        patchSection('expandedLayout', {
          trackExpandedH: Math.max(8, base + stepDir * PX_STEP),
        }, { live: true });
        return;
      }
      if (e.altKey && e.ctrlKey) {
        const extra = workingLayout.expandedLayout?.trackExpandedExtraH || 0;
        patchSection('expandedLayout', {
          trackExpandedExtraH: extra + stepDir * PX_STEP,
        }, { live: true });
        return;
      }
      if (e.altKey) {
        const cap = workingLayout.expandedLayout?.expandedBottomCapArt ?? 22;
        patchSection('expandedLayout', {
          expandedBottomCapArt: Math.max(0, cap - stepDir * ART_STEP),
        }, { live: true });
        return;
      }
      if (e.shiftKey) {
        patchSection('expandedLayout', {
          trackExpandedNudgeY: (workingLayout.expandedLayout?.trackExpandedNudgeY || 0) + stepDir * PX_STEP,
        }, { live: true });
      } else {
        patchBox(currentItem, { nudgeY: b.nudgeY + stepDir * PX_STEP }, { live: true });
      }
      return;
    }
    if (e.shiftKey) {
      patchBox(currentItem, { nudgeX: b.nudgeX + stepDir * PX_STEP }, { live: true });
      return;
    }
    patchBox(currentItem, { nudgeY: b.nudgeY + stepDir * PX_STEP }, { live: true });
    return;
  }

  if (currentItem === 'container') {
    patchSection('container', {
      yNudge: (workingLayout.container.yNudge || 0) + stepDir * PX_STEP,
    }, { live: true });
    return;
  }

  if (currentItem === 'bagArt') {
    const fields = artGraphicFields(previewVariant === 'expanded');
    const a = workingLayout.art || {};
    if (e.altKey) {
      patchArt({ w: Math.max(200, Math.min(500, (a.w ?? TILEBAG_V2_ART.w) + stepDir * ART_STEP)) }, { live: true });
    } else if (e.ctrlKey && e.shiftKey) {
      patchArt({ [fields.artHKey]: Math.max(40, (fields.artH || 100) + stepDir * ART_STEP) }, { live: true });
    } else if (e.ctrlKey) {
      patchArt({ [fields.scaleKey]: Math.max(0.5, Math.min(2, Number((fields.scale + stepDir * 0.02).toFixed(3)))) }, { live: true });
    } else if (e.shiftKey) {
      patchArt({ [fields.offsetYKey]: fields.offsetY + stepDir * PX_STEP }, { live: true });
    } else {
      patchArt({ [fields.offsetXKey]: fields.offsetX + stepDir * PX_STEP }, { live: true });
    }
    return;
  }

  if (currentItem === 'handle' || currentItem === 'title' || currentItem === 'count') {
    const h = workingLayout.handle;
    const isExpanded = previewVariant === 'expanded';
    if (currentItem === 'handle') {
      if (e.ctrlKey) {
        patchSection('handle', { handleW: Math.max(8, (h.handleW || 32) + stepDir) }, { live: true });
      } else if (e.shiftKey) {
        patchSection('handle', {
          [isExpanded ? 'handleExpandedNudgeY' : 'handleNudgeY']:
            (h[isExpanded ? 'handleExpandedNudgeY' : 'handleNudgeY'] || 0) + stepDir,
        }, { live: true });
      } else {
        patchSection('handle', {
          [isExpanded ? 'handleExpandedNudgeX' : 'handleNudgeX']:
            (h[isExpanded ? 'handleExpandedNudgeX' : 'handleNudgeX'] || 0) + stepDir,
        }, { live: true });
      }
      return;
    }
    if (currentItem === 'title') {
      if (e.ctrlKey && e.shiftKey) {
        patchSection('handle', { titleY: Math.max(0, (h.titleY || 0) + stepDir) }, { live: true });
      } else if (e.ctrlKey) {
        patchSection('handle', {
          titleX: Math.max(-120, Math.min(390, (h.titleX || 0) + stepDir * ART_STEP)),
        }, { live: true });
      } else if (e.shiftKey) {
        patchSection('handle', {
          [isExpanded ? 'titleExpandedNudgeY' : 'titleNudgeY']:
            (h[isExpanded ? 'titleExpandedNudgeY' : 'titleNudgeY'] || 0) + stepDir,
        }, { live: true });
      } else {
        patchSection('handle', {
          [isExpanded ? 'titleExpandedNudgeX' : 'titleNudgeX']:
            (h[isExpanded ? 'titleExpandedNudgeX' : 'titleNudgeX'] || 0) + stepDir,
        }, { live: true });
      }
      return;
    }
    if (currentItem === 'count') {
      if (e.ctrlKey && e.shiftKey) {
        patchSection('handle', { countY: Math.max(0, (h.countY || 0) + stepDir) }, { live: true });
      } else if (e.ctrlKey) {
        patchSection('handle', {
          countX: Math.max(0, Math.min(390, (h.countX || 0) + stepDir * ART_STEP)),
        }, { live: true });
      } else if (e.shiftKey) {
        patchSection('handle', {
          [isExpanded ? 'countExpandedNudgeY' : 'countNudgeY']:
            (h[isExpanded ? 'countExpandedNudgeY' : 'countNudgeY'] || 0) + stepDir,
        }, { live: true });
      } else {
        patchSection('handle', {
          [isExpanded ? 'countExpandedNudgeX' : 'countNudgeX']:
            (h[isExpanded ? 'countExpandedNudgeX' : 'countNudgeX'] || 0) + stepDir,
        }, { live: true });
      }
      return;
    }
  }

  if (currentItem === 'tiles') {
    if (e.altKey && e.shiftKey && previewVariant === 'collapsed') {
      bumpTileUniformScalePercent(stepDir > 0 ? 5 : -5, { live: true });
      return;
    }
    if (e.altKey && e.shiftKey) {
      patchSectionField('tiles', 'gapRow', stepDir, { live: true });
    } else if (e.altKey) {
      const step = e.shiftKey ? SCALE_FINE_STEP : SCALE_STEP;
      const t = workingLayout.tiles;
      const next = Math.max(0.5, Number(((t.thumbHScale ?? 0.94) + stepDir * step).toFixed(3)));
      patchSection('tiles', { thumbHScale: next }, { live: true });
    } else if (e.ctrlKey) {
      patchSectionField('tiles', 'gap', stepDir, { live: true });
    } else if (e.shiftKey) {
      patchSectionField('tiles', 'vNudge', stepDir, { live: true });
    } else {
      patchSectionField('tiles', 'cell', stepDir, { live: true });
    }
    return;
  }
  if (currentItem === 'glow') {
    if (e.shiftKey) {
      patchSectionField('glow', 'ring', stepDir, { live: true });
    } else if (e.ctrlKey) {
      const field = sectionFieldName('glow');
      if (field) patchSectionField('glow', field, stepDir, { live: true });
    } else {
      patchSectionField('glow', 'blur', stepDir, { live: true });
    }
    return;
  }
  if (currentItem === 'expandedLayout') {
    const field = sectionFieldName('expandedLayout');
    if (field) patchSectionField('expandedLayout', field, stepDir, { live: true });
  }
}

function onKeyDown(e) {
  if (tuningBlocked(e.target)) return;
  if (SECTION_FIELDS[currentItem] && (e.key === '[' || e.key === ']' || e.key === 'Tab')) {
    cycleSubField(e.key === '[' ? -1 : 1);
    e.preventDefault();
    return;
  }
  if (currentItem === 'tiles') {
    const t = workingLayout.tiles;
    if (e.key === 'ArrowUp') {
      patchSection('tiles', { vNudge: (t.vNudge || 0) - PX_STEP }, { live: true });
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      patchSection('tiles', { vNudge: (t.vNudge || 0) + PX_STEP }, { live: true });
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft') {
      patchSectionField('tiles', 'cell', -1, { live: true });
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight') {
      patchSectionField('tiles', 'cell', 1, { live: true });
      e.preventDefault();
      return;
    }
  }
  if (!isBoxItem(currentItem)) return;
  const b = getTilebagBoxItem(currentItem, variantKey(), workingLayout);
  if (e.key === 'ArrowLeft') { patchBox(currentItem, { left: b.left - ART_STEP }); e.preventDefault(); }
  if (e.key === 'ArrowRight') { patchBox(currentItem, { left: b.left + ART_STEP }); e.preventDefault(); }
  if (e.key === 'ArrowUp') { patchBox(currentItem, { nudgeY: b.nudgeY - PX_STEP }); e.preventDefault(); }
  if (e.key === 'ArrowDown') { patchBox(currentItem, { nudgeY: b.nudgeY + PX_STEP }); e.preventDefault(); }
  if (e.key === '[') { patchBox(currentItem, { width: Math.max(4, b.width - ART_STEP) }); e.preventDefault(); }
  if (e.key === ']') { patchBox(currentItem, { width: b.width + ART_STEP }); e.preventDefault(); }
}

let saveTimer = null;
let saveInFlight = false;
let saveQueued = false;

async function saveToFile({ quiet = false } = {}) {
  if (saveInFlight) { saveQueued = true; return; }
  saveInFlight = true;
  try {
    const res = await fetch('/api/dev/save-tilebag-v2-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workingLayout, null, 2),
    });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    clearTilebagV2LayoutCache();
    clearTilebagV2LayoutDraft();
    localStorage.setItem('tilezilla:tilebag-v2-layout-version', String(Date.now()));
    window.dispatchEvent(new CustomEvent('tilezilla:tilebag-v2-layout-saved'));
    els.status.textContent = quiet ? 'Auto-saved' : 'Saved to data/tilebag_v2_layout.json';
  } catch (err) {
    els.status.textContent = `Save failed — ${err.message || err}`;
  } finally {
    saveInFlight = false;
    if (saveQueued) { saveQueued = false; void saveToFile({ quiet: true }); }
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveToFile({ quiet: true }), 600);
}

function wireBagScroll() {
  const track = document.getElementById('mockTrack');
  const prev = document.getElementById('mockPrev');
  const next = document.getElementById('mockNext');
  const mockBag = document.getElementById('mockTileBag');
  if (!track) return;
  const sync = () => {
    const isExpanded = previewVariant === 'expanded' || mockBag?.classList.contains('is-expanded');
    if (isExpanded) {
      track.classList.remove('tz-tilebag-track--h-scrollbar');
    } else {
      const tileCount = track.querySelectorAll('.palItem:not(.palItem--removed)').length;
      track.classList.toggle('tz-tilebag-track--h-scrollbar', tileCount > 3);
    }
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = max <= 2 || track.scrollLeft >= max - 2;
  };
  track.addEventListener('scroll', sync, { passive: true });
  prev?.addEventListener('click', () => track.scrollBy({ left: -90, behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: 90, behavior: 'smooth' }));
  const observer = new MutationObserver(() => {
    requestAnimationFrame(sync);
  });
  observer.observe(track, { childList: true, subtree: true, attributes: true });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => requestAnimationFrame(sync));
    ro.observe(track);
  }
  sync();
  return sync;
}

function fillExpandedTrackToArtBottom() {
  const ex = workingLayout.expandedLayout || {};
  const tabH = readCssPxVar('--tz-tilebag-tab-h', 26);
  const topSlot = tabH + (ex.trackExpandedNudgeY ?? 0) + (workingLayout.expanded?.track?.nudgeY ?? 0);
  const artExpandedH = workingLayout.art?.expandedH ?? TILEBAG_V2_ART.expandedH;
  const targetH = Math.max(8, Math.round(artExpandedH - topSlot));
  patchSection('expandedLayout', {
    trackExpandedH: targetH,
    expandedBottomCapArt: 0,
  });
}

async function init() {
  els.fieldGrid = document.getElementById('fieldGrid');
  els.readout = document.getElementById('readout');
  els.status = document.getElementById('status');
  els.jsonOut = document.getElementById('jsonOut');
  els.reportOut = document.getElementById('reportOut');
  els.mockStage = document.getElementById('mockStage');
  els.modeSelect = document.getElementById('modeSelect');
  els.keysList = document.getElementById('keysList');
  els.artCollapsed = document.getElementById('artCollapsed');
  els.artExpanded = document.getElementById('artExpanded');
  els.artHandlebar = document.getElementById('artHandlebar');
  els.artW = document.getElementById('artW');
  els.artCollapsedH = document.getElementById('artCollapsedH');
  els.artExpandedH = document.getElementById('artExpandedH');
  els.tileCellInput = document.getElementById('tileCellInput');
  els.tileGapInput = document.getElementById('tileGapInput');
  els.tileRowGapInput = document.getElementById('tileRowGapInput');
  els.tileHScaleInput = document.getElementById('tileHScaleInput');
  els.trackBottomCapInput = document.getElementById('trackBottomCapInput');
  els.trackExtraHInput = document.getElementById('trackExtraHInput');
  els.trackExpandedHInput = document.getElementById('trackExpandedHInput');
  els.collapsedTrackPanel = document.getElementById('collapsedTrackPanel');
  els.expandedTrackPanel = document.getElementById('expandedTrackPanel');
  els.trackCollapsedHInput = document.getElementById('trackCollapsedHInput');
  els.tileScaleUpBtn = document.getElementById('tileScaleUpBtn');
  els.tileScaleDownBtn = document.getElementById('tileScaleDownBtn');

  const onTileSizingChange = () => {
    patchSection('tiles', {
      cell: Math.max(16, parseInt(els.tileCellInput?.value, 10) || 34),
      gap: Math.max(0, parseInt(els.tileGapInput?.value, 10) || 0),
      gapRow: Math.max(0, parseInt(els.tileRowGapInput?.value, 10) || 0),
      thumbHScale: Math.max(0.5, parseFloat(els.tileHScaleInput?.value) || 0.94),
    });
  };
  els.tileCellInput?.addEventListener('change', onTileSizingChange);
  els.tileGapInput?.addEventListener('change', onTileSizingChange);
  els.tileRowGapInput?.addEventListener('change', onTileSizingChange);
  els.tileHScaleInput?.addEventListener('change', onTileSizingChange);
  els.tileScaleUpBtn?.addEventListener('click', () => {
    currentItem = 'tiles';
    bumpTileUniformScalePercent(5);
  });
  els.tileScaleDownBtn?.addEventListener('click', () => {
    currentItem = 'tiles';
    bumpTileUniformScalePercent(-5);
  });
  els.trackExpandedHInput?.addEventListener('change', () => {
    patchSection('expandedLayout', {
      trackExpandedH: Math.max(0, parseInt(els.trackExpandedHInput?.value, 10) || 0),
    });
  });
  els.trackCollapsedHInput?.addEventListener('change', () => {
    patchSection('expandedLayout', {
      trackCollapsedH: Math.max(8, parseInt(els.trackCollapsedHInput?.value, 10) || 49),
    });
  });
  els.trackBottomCapInput?.addEventListener('change', () => {
    patchSection('expandedLayout', {
      expandedBottomCapArt: Math.max(0, parseInt(els.trackBottomCapInput?.value, 10) || 22),
    });
  });
  els.trackExtraHInput?.addEventListener('change', () => {
    patchSection('expandedLayout', {
      trackExpandedExtraH: parseInt(els.trackExtraHInput?.value, 10) || 0,
    });
  });

  const onArtChange = () => {
    patchArt({
      collapsed: els.artCollapsed?.value.trim() || '',
      expanded: els.artExpanded?.value.trim() || '',
      handlebar: els.artHandlebar?.value.trim() || '',
      w: parseInt(els.artW?.value, 10) || TILEBAG_V2_ART.w,
      collapsedH: parseInt(els.artCollapsedH?.value, 10) || TILEBAG_V2_ART.collapsedH,
      expandedH: parseInt(els.artExpandedH?.value, 10) || TILEBAG_V2_ART.expandedH,
    });
  };
  els.artCollapsed?.addEventListener('change', onArtChange);
  els.artExpanded?.addEventListener('change', onArtChange);
  els.artHandlebar?.addEventListener('change', onArtChange);
  els.artW?.addEventListener('change', onArtChange);
  els.artCollapsedH?.addEventListener('change', onArtChange);
  els.artExpandedH?.addEventListener('change', onArtChange);

  els.modeSelect?.addEventListener('change', () => setPreviewVariant(els.modeSelect.value));
  document.getElementById('reloadBtn')?.addEventListener('click', async () => {
    clearTilebagV2LayoutCache();
    clearTilebagV2LayoutDraft();
    workingLayout = cloneLayout(await loadTilebagV2Layout({ force: true }));
    refresh();
    els.status.textContent = 'Reloaded from file';
  });
  document.getElementById('fillTrackBtn')?.addEventListener('click', () => fillExpandedTrackToArtBottom());
  document.getElementById('saveBtn')?.addEventListener('click', () => void saveToFile());
  document.getElementById('copyReportBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.reportOut.value);
      els.status.textContent = 'Report copied';
    } catch {
      els.reportOut.select();
    }
  });

  els.mockStage?.addEventListener('wheel', onWheel, { passive: false, capture: true });
  els.mockStage?.addEventListener('click', () => els.mockStage.focus({ preventScroll: true }));
  document.addEventListener('keydown', onKeyDown, { capture: true });
  document.addEventListener('pointermove', onOverlayPointerMove);
  document.addEventListener('pointerup', onOverlayPointerUp);
  document.addEventListener('pointercancel', onOverlayPointerUp);

  try {
    workingLayout = cloneLayout(await loadTilebagV2Layout());
  } catch {
    workingLayout = mergeTilebagV2Layout(null);
  }

  buildFieldGrid();
  setPreviewVariant('collapsed');
  wireBagScroll();
  els.mockStage?.focus();
  els.status.textContent = 'Ready — select a layout item';
}

init().catch((err) => {
  const st = document.getElementById('status');
  if (st) st.textContent = `Init failed — ${err?.message || err}`;
  console.error(err);
});
