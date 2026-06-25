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

const ART_STEP = 1;
const PX_STEP = 1;
const SCALE_STEP = 0.02;
const FLOAT_STEP = 0.05;

const BOX_ITEMS = new Set(['track', 'arrowPrev', 'arrowNext']);

const TILE_FIELD_LABELS = {
  cell: 'tile width (cell px)',
  gap: 'gap between tiles',
  thumbHScale: 'tile height scale',
  fitInsetY: 'fit inset Y',
  vNudge: 'vertical nudge',
};

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
    'trackExpandedNudgeY',
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
  if (section === 'glow') {
    if (field === 'alpha') return 0;
    if (['r', 'g', 'b'].includes(field)) return 0;
    return 0;
  }
  if (section === 'expandedLayout' && field === 'maxRows') return 1;
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
  else if (Number.isInteger(obj[field])) next = Math.round(next);
  patchSection(section, { [field]: next }, { live });
}

function patchSection(section, patch, { live = false } = {}) {
  workingLayout[section] = { ...workingLayout[section], ...patch };
  if (live) {
    applyTilebagV2Layout(workingLayout, document.documentElement);
    if (section === 'expandedLayout') applyExpandedPreviewMetrics();
    buildMockPalette();
    els.readout.innerHTML = formatReadout(currentItem);
    renderOverlays();
    if (section === 'tiles' || section === 'glow' || section === 'expandedLayout') {
      requestAnimationFrame(() => renderOverlays());
    }
    stashTilebagV2LayoutDraft(workingLayout);
    scheduleSave();
    return;
  }
  refresh();
}

function buildFieldGrid() {
  els.fieldGrid.replaceChildren();
  for (const [key, def] of Object.entries(TILEBAG_ITEM_DEFS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'field-btn';
    btn.dataset.item = key;
    btn.textContent = def.label;
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

function readCssPxVar(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

function measureMockExpansion() {
  const ex = workingLayout.expandedLayout || {};
  const capTop = readCssPxVar('--tz-tilebag-expanded-cap-top', 26);
  const capBottom = readCssPxVar('--tz-tilebag-expanded-cap-bottom', 24);
  const frameCollapsedH = ex.frameCollapsedH ?? 94;
  const trackCollapsedH = ex.trackCollapsedH ?? 48;
  const maxRows = ex.maxRows ?? 3;
  const gap = readCssPxVar('--tz-tile-gap', 5);
  const cell = readCssPxVar('--tz-tilebag-cell', 34);
  const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-tilebag-thumb-h-scale')) || 0.92;
  const rowH = Math.ceil(cell * hScale) + gap;
  const trackPad = 4;

  let trackHeight = maxRows * rowH + trackPad;
  let frameHeight = capTop + trackHeight + capBottom;

  const growScale = ex.growScale ?? 1.65;
  if (growScale !== 1) {
    frameHeight = Math.max(frameCollapsedH, Math.round(frameHeight * growScale));
    trackHeight = Math.max(trackCollapsedH, frameHeight - capTop - capBottom);
  }

  const heightTrim = ex.heightTrim ?? 40;
  if (heightTrim > 0) {
    frameHeight = Math.max(frameCollapsedH, frameHeight - heightTrim);
    trackHeight = Math.max(trackCollapsedH, frameHeight - capTop - capBottom);
  }

  return { trackHeight, frameHeight };
}

function applyExpandedPreviewMetrics() {
  const bag = document.getElementById('mockTileBag');
  const frame = bag?.querySelector('.tz-tilebag-frame');
  const track = document.getElementById('mockTrack');
  if (!bag?.classList.contains('is-expanded') || !frame || !track) {
    frame?.style.removeProperty('--tz-tilebag-frame-h');
    track?.style.removeProperty('--tz-tilebag-track-h');
    bag?.style.removeProperty('--tz-tilebag-frame-h');
    return;
  }

  const { trackHeight, frameHeight } = measureMockExpansion();
  bag.style.setProperty('--tz-tilebag-frame-h', `${frameHeight}px`);
  frame.style.setProperty('--tz-tilebag-frame-h', `${frameHeight}px`);
  track.style.setProperty('--tz-tilebag-track-h', `${trackHeight}px`);
}

function overlayRectForItem(key) {
  if (isBoxItem(key)) {
    const el = key === 'track'
      ? document.getElementById('mockTrack')
      : key === 'arrowPrev'
        ? document.getElementById('mockPrev')
        : document.getElementById('mockNext');
    const domRect = domOverlayRect(el);
    if (domRect) return domRect;
  }

  const frame = document.querySelector('#mockTileBag .tz-tilebag-frame');
  if (!frame) return null;
  const fw = frame.clientWidth;
  const tabH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-tilebag-tab-h')) || 26;

  if (isBoxItem(key)) {
    const b = getTilebagBoxItem(key, variantKey(), workingLayout);
    const trackEl = document.getElementById('mockTrack');
    const trackH = trackEl ? trackEl.clientHeight : 48;
    const top = previewVariant === 'expanded'
      ? tabH
        + (workingLayout.expandedLayout?.trackExpandedNudgeY || 0)
        + (b.nudgeY || 0)
      : tabH + (b.nudgeY || 0);
    return {
      left: `${(b.left / TILEBAG_V2_ART.w) * fw + b.nudgeX}px`,
      top: `${top}px`,
      width: `${(b.width / TILEBAG_V2_ART.w) * fw}px`,
      height: `${trackH}px`,
    };
  }

  if (key === 'handle') {
    const h = workingLayout.handle;
    const left = (h.countX / TILEBAG_V2_ART.w) * fw + (h.handleXOffset || 0) + (h.handleNudgeX || 0);
    const top = tabH + (h.handleYGap || 0) + (h.handleNudgeY || 0);
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${h.handleW || 32}px`,
      height: `${h.handleHitH || 12}px`,
    };
  }

  if (key === 'title' || key === 'count') {
    const h = workingLayout.handle;
    const left = (h.countX / TILEBAG_V2_ART.w) * fw + (h.countNudgeX || 0)
      + (key === 'title' ? (h.titleOffsetX || 0) + (h.titleNudgeX || 0) : 0);
    const width = key === 'count'
      ? (h.countW / TILEBAG_V2_ART.w) * fw
      : Math.max(60, (h.countW / TILEBAG_V2_ART.w) * fw);
    return {
      left: `${left}px`,
      top: `${tabH + (h.titleNudgeY || 0)}px`,
      width: `${width}px`,
      height: '14px',
    };
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

function renderOverlays() {
  const layer = document.getElementById('tunerOverlayLayer');
  if (!layer) return;
  layer.replaceChildren();

  for (const key of ['track', 'arrowPrev', 'arrowNext', 'handle', 'title', 'count', 'tiles', 'glow']) {
    if ((key === 'tiles' || key === 'glow') && key !== currentItem) continue;
    if (isBoxItem(key) && getTilebagBoxItem(key, variantKey(), workingLayout).hidden) continue;
    const rect = overlayRectForItem(key);
    if (!rect) continue;
    const ov = document.createElement('div');
    ov.className = 'tuner-overlay';
    ov.dataset.item = key;
    ov.classList.toggle('is-active', currentItem === key);
    Object.assign(ov.style, rect);
    const label = document.createElement('span');
    label.className = 'tuner-overlay__label';
    label.textContent = TILEBAG_ITEM_DEFS[key]?.label || key;
    ov.appendChild(label);
    ov.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      currentItem = key;
      refreshFieldGrid();
      onOverlayPointerDown(e, key);
    });
    layer.appendChild(ov);
  }
}

function overlaySnapshot(key) {
  if (isBoxItem(key)) {
    const base = { ...getTilebagBoxItem(key, variantKey(), workingLayout) };
    if (key === 'track' && variantKey() === 'expanded') {
      base.trackExpandedNudgeY = workingLayout.expandedLayout?.trackExpandedNudgeY || 0;
    }
    return base;
  }
  if (key === 'tiles') {
    return { ...workingLayout.tiles };
  }
  if (key === 'glow') {
    return { ...workingLayout.glow };
  }
  return { ...workingLayout.handle };
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
  const { key, frameW, snapshot } = dragState;

  if (isBoxItem(key)) {
    if (previewVariant === 'expanded' && key === 'track' && e.shiftKey) {
      patchSection('expandedLayout', {
        trackExpandedNudgeY: Math.round((snapshot.trackExpandedNudgeY || 0) + dy),
      }, { live: true });
    } else {
      patchBox(key, {
        left: Math.round(snapshot.left + (dx / frameW) * TILEBAG_V2_ART.w),
        nudgeY: Math.round(snapshot.nudgeY + dy),
      }, { live: true });
    }
  } else if (key === 'handle') {
    patchSection('handle', {
      handleNudgeX: Math.round(snapshot.handleNudgeX + dx),
      handleNudgeY: Math.round(snapshot.handleNudgeY + dy),
    }, { live: true });
  } else if (key === 'title') {
    patchSection('handle', {
      titleNudgeX: Math.round(snapshot.titleNudgeX + dx),
      titleNudgeY: Math.round(snapshot.titleNudgeY + dy),
    }, { live: true });
  } else if (key === 'count') {
    patchSection('handle', {
      countNudgeX: Math.round(snapshot.countNudgeX + dx),
    }, { live: true });
  } else if (key === 'tiles') {
    if (e.altKey) {
      patchSection('tiles', {
        thumbHScale: Math.max(0.5, Number(((snapshot.thumbHScale || 0.94) + dy * 0.002).toFixed(2))),
      }, { live: true });
    } else if (e.shiftKey || e.ctrlKey) {
      patchSection('tiles', {
        cell: Math.max(16, Math.round((snapshot.cell || 34) + dx * 0.15)),
      }, { live: true });
    } else {
      patchSection('tiles', {
        vNudge: Math.round((snapshot.vNudge || 0) + dy),
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
  const def = TILEBAG_ITEM_DEFS[key];
  const mode = `<br />Preview: <strong>${previewVariant}</strong>`;
  if (isBoxItem(key)) {
    const b = getTilebagBoxItem(key, variantKey(), workingLayout);
    return `<strong>${def.label}</strong><br />left ${b.left} art px · width ${b.width} · nudge ${b.nudgeX}px, ${b.nudgeY}px${
      key === 'track' && variantKey() === 'expanded'
        ? ` · expanded slot Y ${workingLayout.expandedLayout?.trackExpandedNudgeY ?? 0}px`
        : ''
    }${mode}`;
  }
  if (key === 'container') {
    return `<strong>${def.label}</strong><br />yNudge ${workingLayout.container.yNudge}px${mode}`;
  }
  if (key === 'handle' || key === 'title' || key === 'count') {
    const h = workingLayout.handle;
    return `<strong>${def?.label || key}</strong><br />countX ${h.countX} · handle nudge ${h.handleNudgeX}, ${h.handleNudgeY}px · handleW ${h.handleW}px${mode}`;
  }
  if (key === 'tiles') {
    const t = workingLayout.tiles;
    const field = sectionFieldName('tiles');
    const fieldLabel = TILE_FIELD_LABELS[field] || field;
    return `<strong>${def.label}</strong><br />cell ${t.cell}px · gap ${t.gap}px · height ${t.thumbHScale} · vNudge ${t.vNudge}px<br />active: <strong>${fieldLabel}</strong> = ${t[field]}${mode}`;
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
    if (previewVariant === 'expanded' && currentItem === 'track') {
      ul.innerHTML = [
        '<li>Scroll — track nudge Y · Shift+scroll — expanded slot Y (trackExpandedNudgeY)</li>',
        '<li>Shift+horizontal scroll — nudge X · Ctrl+scroll — width</li>',
        '<li>Drag yellow box — move track · Shift+drag — expanded slot Y</li>',
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
    const field = sectionFieldName('tiles');
    const fieldLabel = TILE_FIELD_LABELS[field] || field;
    ul.innerHTML = [
      `<li><strong>Height:</strong> Alt+scroll — thumbHScale · or Tab/[ ] until active is <strong>tile height scale</strong>, then scroll</li>`,
      `<li>Scroll — <strong>${fieldLabel}</strong> · Shift+scroll — vNudge · Ctrl+scroll — gap</li>`,
      '<li>Tab / [ ] — previous / next tile field (width, gap, height, fit inset, vNudge)</li>',
      '<li>Drag yellow box — vNudge · Shift+drag — cell width · Alt+drag up/down — height scale</li>',
      '<li>↑↓ — vNudge · ←→ — cell width</li>',
    ].join('');
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
  if (pal.childElementCount >= 10) return;
  pal.replaceChildren();
  for (let i = 0; i < 10; i += 1) {
    const item = document.createElement('div');
    item.className = `palItem${i === 2 ? ' selected' : ''}`;
    const thumb = document.createElement('div');
    thumb.className = 'palThumb mock-pal-thumb';
    thumb.style.width = 'calc(var(--tz-tilebag-cell) * 1.35)';
    thumb.style.height = 'calc(var(--tz-tilebag-cell) * var(--tz-tilebag-thumb-h-scale))';
    const label = document.createElement('span');
    label.textContent = `T${i + 1}`;
    thumb.appendChild(label);
    item.appendChild(thumb);
    pal.appendChild(item);
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

function patchArt(patch) {
  workingLayout.art = { ...(workingLayout.art || {}), ...patch };
  refresh();
}

function refresh() {
  applyTilebagV2Layout(workingLayout, document.documentElement);
  applyExpandedPreviewMetrics();
  buildMockPalette();
  syncArtInputsFromLayout();
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
    if (previewVariant === 'expanded' && currentItem === 'track') {
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

  if (currentItem === 'handle' || currentItem === 'title' || currentItem === 'count') {
    const h = workingLayout.handle;
    if (e.ctrlKey) {
      patchSection('handle', { handleW: Math.max(8, (h.handleW || 32) + stepDir) }, { live: true });
    } else if (e.shiftKey) {
      patchSection('handle', { handleNudgeY: (h.handleNudgeY || 0) + stepDir }, { live: true });
    } else {
      patchSection('handle', { handleNudgeX: (h.handleNudgeX || 0) + stepDir }, { live: true });
    }
    return;
  }

  if (currentItem === 'tiles') {
    if (e.altKey) {
      patchSectionField('tiles', 'thumbHScale', stepDir, { live: true });
    } else if (e.ctrlKey) {
      patchSectionField('tiles', 'gap', stepDir, { live: true });
    } else if (e.shiftKey) {
      patchSectionField('tiles', 'vNudge', stepDir, { live: true });
    } else {
      const field = sectionFieldName('tiles');
      patchSectionField('tiles', field, stepDir, { live: true });
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
  if (!track) return;
  const sync = () => {
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = max <= 2 || track.scrollLeft >= max - 2;
  };
  track.addEventListener('scroll', sync, { passive: true });
  prev?.addEventListener('click', () => track.scrollBy({ left: -90, behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: 90, behavior: 'smooth' }));
  sync();
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
