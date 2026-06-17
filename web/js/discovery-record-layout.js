/** Discovery record plaque layout — load/apply field positions from JSON. */

export const DISCOVERY_ITEM_DEFS = {
  solutionTotal: { cssKey: 'solution-total', kind: 'text', label: 'Challenge progress' },
  note: { cssKey: 'note', kind: 'text', label: 'Note (duplicate)' },
  puzzleId: { cssKey: 'puzzle-id', kind: 'text', label: 'Puzzle ID' },
  solutionFound: { cssKey: 'solution-found', kind: 'text', label: 'Solution #' },
  time: { cssKey: 'time', kind: 'text', label: 'Time (new) / first found date (duplicate)' },
  tokens: { cssKey: 'tokens', kind: 'text', label: 'Hint tokens' },
  btnContinue: { cssKey: 'btn-continue', kind: 'btn', label: 'Continue button' },
  btnAdvance: { cssKey: 'btn-advance', kind: 'btn', label: 'Advance button' },
  btnViewFound: { cssKey: 'btn-view-found', kind: 'btn', label: 'View found button' },
  btnBook: { cssKey: 'btn-book', kind: 'btn', label: 'Journal button (chess / book)' },
};

export const DISCOVERY_VARIANT_KEYS = [
  'newAdvance',
  'newRegular',
  'duplicateAdvance',
  'duplicateRegular',
];

export const DEFAULT_DISCOVERY_TEXTS = {
  duplicateNote: 'You have already discovered this solution.',
  duplicateTitle: 'SOLUTION ALREADY DISCOVERED',
};

/** Default button PNG paths — override via layout JSON `buttons`. */
export const DEFAULT_DISCOVERY_BUTTON_ART = {
  btnContinue: '/img/ContinueSearch-btn.png',
  btnAdvance: '/img/AdvancePath-btn.png',
  btnViewFound: '/img/ViewSolve-btn.png',
  btnChess: '/img/Chess-Btn.png',
  btnBook: '/img/SolutionsJournal-Book-btn.png',
};

/** Four plaque arts — challenge (advance path) vs regular. */
export const DISCOVERY_PLAQUE_ART = {
  newAdvance: { src: '/img/RecordsPlacqueBase.png', w: 1393, h: 1150 },
  newRegular: { src: '/img/RecordsPlacqueBaseNoAdvance.png', w: 1393, h: 1150 },
  duplicateAdvance: { src: '/img/AlreadyRecordsPlacqueBase.png', w: 1400, h: 1123 },
  duplicateRegular: { src: '/img/AlreadyRecordsPlacqueBaseNoADVPth.png', w: 1400, h: 1123 },
};

const DEFAULT_BUTTONS = {
  btnContinue: { x: 15.5, y: 84, w: 38, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
  btnAdvance: { x: 50, y: 93, w: 42, h: 11, wScale: 0.82, hScale: 0.86, nudgeY: -28 },
  btnViewFound: { x: 52, y: 84, w: 38, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
  btnBook: { x: 86, y: 58, w: 16, h: 22, wScale: 1, hScale: 1 },
};

export const DEFAULT_DISCOVERY_LAYOUT = {
  plaque: { wScale: 1.28, hScale: 0.86, duplicateWScale: 0.8 },
  defaults: { nudgeX: 0, nudgeY: 0, fontScale: 1 },
  texts: { ...DEFAULT_DISCOVERY_TEXTS },
  buttons: { ...DEFAULT_DISCOVERY_BUTTON_ART },
  items: {
    solutionTotal: { x: 42, y: 22 },
    note: { x: 50, y: 28 },
    puzzleId: { x: 45, y: 36 },
    solutionFound: { x: 32, y: 43 },
    time: { x: 18, y: 56 },
    tokens: { x: 48, y: 56 },
  },
  variants: {
    newAdvance: {
      btnContinue: { x: 15.5, y: 84, w: 38, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
      btnAdvance: { x: 50, y: 93, w: 42, h: 11, wScale: 0.82, hScale: 0.86, nudgeY: -28 },
      btnBook: { x: 86, y: 58, w: 16, h: 22, wScale: 1, hScale: 1 },
    },
    newRegular: {
      btnContinue: { x: 50, y: 84, w: 60, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
      btnBook: { x: 86, y: 58, w: 16, h: 22, wScale: 1, hScale: 1 },
    },
    duplicateAdvance: {
      btnContinue: { x: 15.5, y: 84, w: 38, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
      btnViewFound: { x: 52, y: 84, w: 38, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
      btnAdvance: { x: 50, y: 93, w: 42, h: 11, wScale: 0.82, hScale: 0.86, nudgeY: -28 },
      btnBook: { x: 86, y: 58, w: 16, h: 22, wScale: 1, hScale: 1 },
    },
    duplicateRegular: {
      btnContinue: { x: 15.5, y: 84, w: 38, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
      btnViewFound: { x: 52, y: 84, w: 38, h: 11, wScale: 0.82, hScale: 0.9, nudgeY: -28 },
      btnBook: { x: 86, y: 58, w: 16, h: 22, wScale: 1, hScale: 1 },
    },
  },
};

let layoutCache = null;

export function clearDiscoveryRecordLayoutCache() {
  layoutCache = null;
}

export async function loadDiscoveryRecordLayout({ force = false } = {}) {
  if (force) layoutCache = null;
  if (!layoutCache) {
    const cacheBust = force ? `?t=${Date.now()}` : '';
    const res = await fetch(`/data/discovery_record_layout.json${cacheBust}`);
    if (!res.ok) throw new Error('Failed to load discovery_record_layout.json');
    layoutCache = await res.json();
  }
  return layoutCache;
}

export async function reloadDiscoveryRecordLayout() {
  clearDiscoveryRecordLayoutCache();
  return loadDiscoveryRecordLayout({ force: true });
}

function migrateLegacyButtonItems(base) {
  if (!base.variants) {
    base.variants = JSON.parse(JSON.stringify(DEFAULT_DISCOVERY_LAYOUT.variants));
  }
  for (const [key, meta] of Object.entries(DISCOVERY_ITEM_DEFS)) {
    if (meta.kind !== 'btn' || !base.items?.[key]) continue;
    const legacy = base.items[key];
    for (const vk of DISCOVERY_VARIANT_KEYS) {
      if (!base.variants[vk]) base.variants[vk] = {};
      if (!base.variants[vk][key] || !Object.keys(base.variants[vk][key]).length) {
        base.variants[vk][key] = { ...(base.variants[vk][key] || {}), ...legacy };
      }
    }
    delete base.items[key];
  }
}

export function mergeDiscoveryLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_DISCOVERY_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.plaque && typeof raw.plaque === 'object') {
    base.plaque = { ...base.plaque, ...raw.plaque };
  }
  if (raw.defaults && typeof raw.defaults === 'object') {
    base.defaults = { ...base.defaults, ...raw.defaults };
  }
  if (raw.texts && typeof raw.texts === 'object') {
    base.texts = { ...base.texts, ...raw.texts };
  }
  if (raw.buttons && typeof raw.buttons === 'object') {
    base.buttons = { ...base.buttons, ...raw.buttons };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!DISCOVERY_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  if (raw.variants && typeof raw.variants === 'object') {
    for (const vk of DISCOVERY_VARIANT_KEYS) {
      if (!raw.variants[vk] || typeof raw.variants[vk] !== 'object') continue;
      if (!base.variants[vk]) base.variants[vk] = {};
      for (const [key, val] of Object.entries(raw.variants[vk])) {
        if (!DISCOVERY_ITEM_DEFS[key] || typeof val !== 'object') continue;
        base.variants[vk][key] = { ...(base.variants[vk][key] || {}), ...val };
      }
    }
  }
  migrateLegacyButtonItems(base);
  return base;
}

export function getDiscoveryVariantKey(mode, showAdvance) {
  if (mode === 'duplicate') return showAdvance ? 'duplicateAdvance' : 'duplicateRegular';
  return showAdvance ? 'newAdvance' : 'newRegular';
}

export function resolveShowAdvance(payload) {
  if (payload?.showAdvancePath != null) return Boolean(payload.showAdvancePath);
  const screen = document.querySelector('.tz-app')?.dataset?.screen;
  return screen === 'daily-challenge' || screen === 'adventure';
}

export function getDiscoveryTexts(layout) {
  const merged = mergeDiscoveryLayout(layout);
  const texts = merged.texts || {};
  return {
    duplicateNote: texts.duplicateNote ?? DEFAULT_DISCOVERY_TEXTS.duplicateNote,
    duplicateTitle: texts.duplicateTitle ?? DEFAULT_DISCOVERY_TEXTS.duplicateTitle,
  };
}

export function getDiscoveryButtonArt(layout) {
  const merged = mergeDiscoveryLayout(layout);
  return { ...DEFAULT_DISCOVERY_BUTTON_ART, ...(merged.buttons || {}) };
}

export function discoveryRecordModeFromVariant(variantKey) {
  return String(variantKey || '').startsWith('duplicate') ? 'duplicate' : 'new';
}

/** PNG path for a button — journal slot uses chess (new) vs book (already found). */
export function getDiscoveryButtonSrc(itemKey, layout, mode = 'new') {
  const art = getDiscoveryButtonArt(layout);
  if (itemKey === 'btnBook') {
    return mode === 'duplicate'
      ? (art.btnBook || DEFAULT_DISCOVERY_BUTTON_ART.btnBook)
      : (art.btnChess || DEFAULT_DISCOVERY_BUTTON_ART.btnChess);
  }
  return art[itemKey] || DEFAULT_DISCOVERY_BUTTON_ART[itemKey] || '';
}

function btnClassSuffix(cssKey) {
  return cssKey.replace(/^btn-/, '');
}

/** Set button PNG src from layout — call on discovery record root after markup exists. */
export function applyDiscoveryButtonArt(layout, root, mode = 'new') {
  if (!root) return;
  for (const [itemKey, meta] of Object.entries(DISCOVERY_ITEM_DEFS)) {
    if (meta.kind !== 'btn') continue;
    const src = getDiscoveryButtonSrc(itemKey, layout, mode);
    if (!src) continue;
    const btn = root.querySelector(`.tz-discovery-record__btn--${btnClassSuffix(meta.cssKey)}`);
    const img = btn?.querySelector('img');
    if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
  }
}

export function getDiscoveryItemLayout(itemKey, layout, variantKey = null) {
  const merged = mergeDiscoveryLayout(layout);
  const def = merged.defaults || DEFAULT_DISCOVERY_LAYOUT.defaults;
  const meta = DISCOVERY_ITEM_DEFS[itemKey];
  const defaults = meta?.kind === 'btn'
    ? (DEFAULT_BUTTONS[itemKey] || DEFAULT_DISCOVERY_LAYOUT.variants?.newAdvance?.[itemKey] || {})
    : (DEFAULT_DISCOVERY_LAYOUT.items[itemKey] || {});
  const item = merged.items?.[itemKey] || defaults;
  let result = { ...def, ...defaults, ...item };
  if (variantKey) {
    const variant = merged.variants?.[variantKey]?.[itemKey];
    if (variant) result = { ...result, ...variant };
  }
  return result;
}

function varName(cssKey, suffix) {
  return `--tz-discovery-${cssKey}-${suffix}`;
}

function applyItemVars(item, meta, target) {
  const { cssKey, kind } = meta;
  const nudgeX = Number(item.nudgeX) || 0;
  const nudgeY = Number(item.nudgeY) || 0;

  target.style.setProperty(varName(cssKey, 'x'), `${item.x}%`);
  target.style.setProperty(varName(cssKey, 'y'), `${item.y}%`);
  target.style.setProperty(varName(cssKey, 'nudge-x'), `${nudgeX}px`);
  target.style.setProperty(varName(cssKey, 'nudge-y'), `${nudgeY}px`);

  if (kind === 'text') {
    target.style.setProperty(varName(cssKey, 'font-scale'), String(item.fontScale ?? 1));
  } else if (kind === 'btn') {
    const wScale = Math.max(0.05, Number(item.wScale) || 1);
    const hScale = Math.max(0.05, Number(item.hScale) || 1);
    target.style.setProperty(varName(cssKey, 'w'), `${(Number(item.w) || 0) * wScale}%`);
    target.style.setProperty(varName(cssKey, 'h'), `${(Number(item.h) || 0) * hScale}%`);
  }
}

/** Plaque box size — must live on :root so expanded preview-section vars resolve. */
export function applyDiscoveryPlaqueLayout(layout, target = document.documentElement) {
  const merged = mergeDiscoveryLayout(layout);
  target.style.setProperty('--tz-discovery-plaque-w-scale', String(merged.plaque.wScale ?? 1));
  target.style.setProperty('--tz-discovery-plaque-h-scale', String(merged.plaque.hScale ?? 1));
  target.style.setProperty(
    '--tz-discovery-plaque-duplicate-w-scale',
    String(merged.plaque.duplicateWScale ?? 0.8),
  );
}

/** Text field positions — optional variantKey applies per-plaque overrides. */
export function applyDiscoveryTextLayout(
  layout,
  target = document.documentElement,
  variantKey = null,
) {
  const merged = mergeDiscoveryLayout(layout);
  for (const [itemKey, meta] of Object.entries(DISCOVERY_ITEM_DEFS)) {
    if (meta.kind !== 'text') continue;
    applyItemVars(getDiscoveryItemLayout(itemKey, merged, variantKey), meta, target);
  }
}

/** Plaque box scale on :root — text/button positions apply when the popup opens (per variant). */
export function applyDiscoveryRecordLayout(layout, target = document.documentElement) {
  applyDiscoveryPlaqueLayout(layout, target);
}

/** Button positions for the active plaque variant — applied when popup opens. */
export function applyDiscoveryVariantLayout(layout, variantKey, target = document.documentElement) {
  const merged = mergeDiscoveryLayout(layout);
  for (const [itemKey, meta] of Object.entries(DISCOVERY_ITEM_DEFS)) {
    if (meta.kind !== 'btn') continue;
    applyItemVars(getDiscoveryItemLayout(itemKey, merged, variantKey), meta, target);
  }
}

/** Full in-popup layout — plaque on :root, text + buttons on the record element. */
export function applyDiscoveryPopupLayout(
  layout,
  variantKey,
  root,
  plaqueTarget = document.documentElement,
) {
  applyDiscoveryPlaqueLayout(layout, plaqueTarget);
  applyDiscoveryTextLayout(layout, root, variantKey);
  applyDiscoveryVariantLayout(layout, variantKey, root);
  applyDiscoveryButtonArt(layout, root, discoveryRecordModeFromVariant(variantKey));
}

export function applyDiscoveryVariantClasses(root, mode, showAdvance) {
  if (!root) return;
  root.classList.toggle('tz-discovery-record--duplicate', mode === 'duplicate');
  root.classList.toggle('tz-discovery-record--new', mode !== 'duplicate');
  root.classList.toggle('tz-discovery-record--with-advance', showAdvance);
  root.classList.toggle('tz-discovery-record--no-advance', !showAdvance);
}
