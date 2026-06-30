/** Pre-game Use Hint menu — usehintmenu-area.png dialog + hit areas (% of frame). */

export const USE_HINT_START_ART = { w: 1071, h: 1248 };

export const USE_HINT_START_ITEM_DEFS = {
  close: { label: 'Close (X)' },
  available: { label: 'Available token count' },
  random: { label: 'Random tile (1 token)' },
  start: { label: 'Start tile (2 tokens)' },
  end: { label: 'End tile (2 tokens)' },
  cancel: { label: 'Cancel' },
  confirm: { label: 'Use hint confirm' },
};

export const DEFAULT_USE_HINT_START_BUTTON_ART = {
  random: '/img/hintMenu-btn1.png',
  start: '/img/hintMenu-btn2.png',
  end: '/img/hintMenu-btn3.png',
  cancel: '/img/cancelbtn.png',
  confirm: '/img/UseHintbtn.png',
};

export const DEFAULT_USE_HINT_START_LAYOUT = {
  dialog: {
    artW: 1071,
    artH: 1248,
    displayW: 300,
    baseSrc: '/img/usehintmenu-area.png',
  },
  buttons: { ...DEFAULT_USE_HINT_START_BUTTON_ART },
  items: {
    close: {
      x: 87.5, y: 2.6, w: 6.8, h: 5.8, nudgeX: 12, nudgeY: 12, scale: 1.202, opacity: 1,
    },
    available: { y: 19.2, nudgeX: -42, nudgeY: -14, padX: 6, fontScale: 1 },
    random: { x: 13.2, y: 36, w: 80.3, h: 15.2, nudgeX: -12, nudgeY: -5 },
    start: { x: 13.2, y: 48.2, w: 80.3, h: 15.2, nudgeX: -12, nudgeY: 11 },
    end: { x: 13.2, y: 61.1, w: 80.3, h: 15.2, nudgeX: -12, nudgeY: 22 },
    cancel: { x: 8.3, y: 89.4, w: 36, h: 8.3 },
    confirm: { x: 47.7, y: 89.4, w: 46.5, h: 8.4 },
  },
};

const TOKEN_KEYS = ['random', 'start', 'end'];
const LS_LAYOUT_KEY = 'tilezilla:layouts:use-hint-start';
const LS_PENDING_KEY = 'tilezilla:layouts:use-hint-start:pending';

const HINT_START_ITEM_SELECTORS = {
  close: '.tz-hint-menu__close',
  available: '.tz-hint-menu__available',
  random: '.tz-hint-menu__token--random',
  start: '.tz-hint-menu__token--start',
  end: '.tz-hint-menu__token--end',
  cancel: '.tz-hint-menu__cancel',
  confirm: '.tz-hint-menu__confirm',
};

let layoutCache = null;

function pct(v, fallback = '0%') {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  return `${v}%`;
}

function px(v, fallback = '0px') {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  return `${v}px`;
}

export function isUseHintStartTunerPage() {
  return /usehintstart-tuner(?:\.html)?$/i.test(window.location.pathname)
    || /use-hint-start-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearUseHintStartLayoutCache() {
  layoutCache = null;
}

export function stashUseHintStartLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearUseHintStartLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeUseHintStartLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_USE_HINT_START_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.buttons && typeof raw.buttons === 'object') {
    base.buttons = { ...base.buttons, ...raw.buttons };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!USE_HINT_START_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadUseHintStartLayout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isUseHintStartTunerPage();

  if (!fromDisk && onTuner) {
    try {
      if (localStorage.getItem(LS_PENDING_KEY) === '1') {
        const draft = localStorage.getItem(LS_LAYOUT_KEY);
        if (draft) raw = JSON.parse(draft);
      }
    } catch {
      /* ignore */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/use_hint_start_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  if (!raw && onTuner) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  layoutCache = mergeUseHintStartLayout(raw);
  return layoutCache;
}

export async function reloadUseHintStartLayout() {
  clearUseHintStartLayoutCache();
  return loadUseHintStartLayout({ force: true, fromDisk: true });
}

export function getUseHintStartItemLayout(itemKey, layout) {
  const merged = mergeUseHintStartLayout(layout);
  const item = merged.items[itemKey] || {};
  const def = DEFAULT_USE_HINT_START_LAYOUT.items[itemKey] || {};
  return {
    x: item.x ?? def.x,
    y: item.y ?? def.y,
    w: item.w ?? def.w,
    h: item.h ?? def.h,
    nudgeX: item.nudgeX ?? def.nudgeX ?? 0,
    nudgeY: item.nudgeY ?? def.nudgeY ?? 0,
    scale: item.scale ?? def.scale ?? 1,
    opacity: item.opacity ?? def.opacity ?? 1,
    padX: item.padX ?? def.padX ?? 6,
    fontScale: item.fontScale ?? def.fontScale ?? 1,
  };
}

function sharedTokenDims(layout) {
  const random = getUseHintStartItemLayout('random', layout);
  return { x: random.x, w: random.w, h: random.h };
}

function useHintStartBoxStyle(box) {
  const style = {
    position: 'absolute',
    margin: '0',
    boxSizing: 'border-box',
  };
  if (box.x != null) style.left = `${box.x}%`;
  if (box.y != null) style.top = `${box.y}%`;
  if (box.w != null) style.width = `${box.w}%`;
  if (box.h != null) style.height = `${box.h}%`;
  return style;
}

export function clearUseHintStartInlineStyles(root = document) {
  const doc = root?.ownerDocument || root || document;
  const menus = root?.classList?.contains('tz-hint-menu')
    ? [root]
    : [...(doc.querySelectorAll?.('.tz-hint-menu') || [])];
  for (const menu of menus) {
    for (const selector of Object.values(HINT_START_ITEM_SELECTORS)) {
      for (const el of menu.querySelectorAll(selector)) {
        el.removeAttribute('style');
      }
    }
  }
}

export function applyUseHintStartItemPositions(layout, root = document) {
  const merged = mergeUseHintStartLayout(layout);
  const doc = root.ownerDocument || root;
  const menus = [...(doc.querySelectorAll?.('.tz-hint-menu') || [])];
  if (!menus.length) return;

  for (const menu of menus) {
    for (const [key, selector] of Object.entries(HINT_START_ITEM_SELECTORS)) {
      const box = getUseHintStartItemLayout(key, merged);
      for (const el of menu.querySelectorAll(selector)) {
        if (key === 'available') {
          Object.assign(el.style, {
            position: 'absolute',
            left: '50%',
            top: `${box.y ?? 19.2}%`,
            transform: `translate(calc(-50% + ${box.nudgeX ?? 0}px), ${box.nudgeY ?? 0}px)`,
            fontSize: `calc(clamp(0.72rem, 3.2cqi, 1.05rem) * ${box.fontScale ?? 1})`,
            padding: `2px ${box.padX ?? 6}px`,
            margin: '0',
            boxSizing: 'border-box',
          });
          continue;
        }
        if (key === 'close') {
          Object.assign(el.style, useHintStartBoxStyle(box));
          el.style.left = `calc(${box.x}% + ${box.nudgeX ?? 0}px)`;
          el.style.top = `calc(${box.y}% + ${box.nudgeY ?? 0}px)`;
          el.style.transform = `scale(${box.scale ?? 1})`;
          continue;
        }
        if (TOKEN_KEYS.includes(key)) {
          const shared = sharedTokenDims(merged);
          Object.assign(el.style, {
            position: 'absolute',
            left: `${shared.x ?? 71}%`,
            top: `${box.y ?? 0}%`,
            width: `${shared.w ?? 22.3}%`,
            height: `${shared.h ?? 7.4}%`,
            transform: `translate(${box.nudgeX ?? 0}px, ${box.nudgeY ?? 0}px)`,
            margin: '0',
            boxSizing: 'border-box',
          });
          continue;
        }
        Object.assign(el.style, useHintStartBoxStyle(box));
      }
    }
  }
}

function setHintMenuTokenVars(target, key, box) {
  target.style.setProperty(`--tz-hint-menu-token-${key}-x`, pct(box.x));
  target.style.setProperty(`--tz-hint-menu-token-${key}-y`, pct(box.y));
  target.style.setProperty(`--tz-hint-menu-token-${key}-w`, pct(box.w));
  target.style.setProperty(`--tz-hint-menu-token-${key}-h`, pct(box.h));
  target.style.setProperty(`--tz-hint-menu-token-${key}-nudge-x`, px(box.nudgeX));
  target.style.setProperty(`--tz-hint-menu-token-${key}-nudge-y`, px(box.nudgeY));
}

export function applyUseHintStartLayout(layout, target = document.documentElement) {
  const merged = mergeUseHintStartLayout(layout);
  const d = merged.dialog || DEFAULT_USE_HINT_START_LAYOUT.dialog;
  const close = getUseHintStartItemLayout('close', merged);
  const available = getUseHintStartItemLayout('available', merged);
  const random = getUseHintStartItemLayout('random', merged);
  const start = getUseHintStartItemLayout('start', merged);
  const end = getUseHintStartItemLayout('end', merged);
  const cancel = getUseHintStartItemLayout('cancel', merged);
  const confirm = getUseHintStartItemLayout('confirm', merged);
  const token = sharedTokenDims(merged);

  target.style.setProperty('--tz-hint-menu-art-w', String(d.artW ?? USE_HINT_START_ART.w));
  target.style.setProperty('--tz-hint-menu-art-h', String(d.artH ?? USE_HINT_START_ART.h));
  target.style.setProperty('--tz-hint-menu-display-w', px(d.displayW ?? 300));

  target.style.setProperty('--tz-hint-menu-available-y', pct(available.y));
  target.style.setProperty('--tz-hint-menu-available-nudge-x', px(available.nudgeX));
  target.style.setProperty('--tz-hint-menu-available-nudge-y', px(available.nudgeY));
  target.style.setProperty('--tz-hint-menu-available-pad-x', px(available.padX));

  target.style.setProperty('--tz-hint-menu-close-x', pct(close.x));
  target.style.setProperty('--tz-hint-menu-close-y', pct(close.y));
  target.style.setProperty('--tz-hint-menu-close-nudge-x', px(close.nudgeX));
  target.style.setProperty('--tz-hint-menu-close-nudge-y', px(close.nudgeY));
  target.style.setProperty('--tz-hint-menu-close-w', pct(close.w));
  target.style.setProperty('--tz-hint-menu-close-h', pct(close.h));
  target.style.setProperty('--tz-hint-menu-close-scale', String(close.scale ?? 1));
  target.style.setProperty('--tz-hint-menu-close-opacity', String(close.opacity ?? 1));

  target.style.setProperty('--tz-hint-menu-token-x', pct(token.x));
  target.style.setProperty('--tz-hint-menu-token-w', pct(token.w));
  target.style.setProperty('--tz-hint-menu-token-h', pct(token.h));

  for (const key of TOKEN_KEYS) {
    setHintMenuTokenVars(target, key, getUseHintStartItemLayout(key, merged));
  }

  target.style.setProperty('--tz-hint-menu-cancel-x', pct(cancel.x));
  target.style.setProperty('--tz-hint-menu-cancel-y', pct(cancel.y));
  target.style.setProperty('--tz-hint-menu-cancel-w', pct(cancel.w));
  target.style.setProperty('--tz-hint-menu-cancel-h', pct(cancel.h));

  target.style.setProperty('--tz-hint-menu-confirm-x', pct(confirm.x));
  target.style.setProperty('--tz-hint-menu-confirm-y', pct(confirm.y));
  target.style.setProperty('--tz-hint-menu-confirm-w', pct(confirm.w));
  target.style.setProperty('--tz-hint-menu-confirm-h', pct(confirm.h));

  const doc = target.ownerDocument || document;
  const bg = doc.querySelector('.tz-hint-menu__bg');
  if (bg && d.baseSrc) bg.src = d.baseSrc;

  const buttons = merged.buttons || DEFAULT_USE_HINT_START_BUTTON_ART;
  const imgMap = [
    ['.tz-hint-menu__token--random img', buttons.random],
    ['.tz-hint-menu__token--start img', buttons.start],
    ['.tz-hint-menu__token--end img', buttons.end],
    ['.tz-hint-menu__cancel img', buttons.cancel],
    ['.tz-hint-menu__confirm img', buttons.confirm],
  ];
  for (const [sel, src] of imgMap) {
    if (!src) continue;
    for (const img of doc.querySelectorAll(sel)) img.src = src;
  }
}

export function syncUseHintStartTokenDims(layout, sourceKey, patch) {
  const merged = mergeUseHintStartLayout(layout);
  if (!TOKEN_KEYS.includes(sourceKey)) return merged;
  const dimKeys = ['x', 'w', 'h'];
  const hasDim = dimKeys.some((k) => patch[k] != null);
  if (!hasDim) return merged;
  for (const key of TOKEN_KEYS) {
    merged.items[key] = { ...merged.items[key] };
    for (const k of dimKeys) {
      if (patch[k] != null) merged.items[key][k] = patch[k];
    }
  }
  return merged;
}

export function buildUseHintStartLayoutReport(layout) {
  const merged = mergeUseHintStartLayout(layout);
  const d = merged.dialog || {};
  const lines = [
    'Use Hint start menu (usehintmenu-area.png)',
    `Base art: ${d.baseSrc ?? DEFAULT_USE_HINT_START_LAYOUT.dialog.baseSrc}`,
    `Art ${d.artW ?? USE_HINT_START_ART.w}×${d.artH ?? USE_HINT_START_ART.h}`,
    `displayW ${d.displayW ?? 300}px`,
    '',
  ];
  for (const [key, def] of Object.entries(USE_HINT_START_ITEM_DEFS)) {
    const box = getUseHintStartItemLayout(key, merged);
    if (key === 'available') {
      lines.push(`${def.label}: y ${box.y}% · nudge ${box.nudgeX}px, ${box.nudgeY}px · padX ${box.padX}px`);
      continue;
    }
    const extra = key === 'close'
      ? ` · scale ${box.scale ?? 1} · opacity ${box.opacity ?? 1} · nudge ${box.nudgeX}px, ${box.nudgeY}px`
      : TOKEN_KEYS.includes(key)
        ? ` · nudge ${box.nudgeX}px, ${box.nudgeY}px`
        : '';
    lines.push(`${def.label}: x ${box.x ?? '—'}% · y ${box.y ?? '—'}% · w ${box.w ?? '—'}% · h ${box.h ?? '—'}%${extra}`);
  }
  return lines.join('\n');
}
