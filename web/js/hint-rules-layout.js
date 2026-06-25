/** Hint Rules overlay — window position/scale + close button layout from JSON. */

export const HINT_RULES_MU_ART = { w: 709, h: 0 };
export const HINT_RULES_DT_ART = { w: 1122, h: 0 };

export const HINT_RULES_ITEM_DEFS = {
  window: { label: 'Window (panel)', kind: 'window' },
  scroller: { label: 'Fancy scroller (right edge)', kind: 'scroller' },
  exit: { label: 'Close button', kind: 'exit' },
};

export const DEFAULT_HINT_RULES_LAYOUT = {
  window: {
    topVh: 7.7,
    heightVh: 92.3,
    maxDesignWidth: 390,
    widthScale: 0.95,
    anchorMainScreenV2: true,
    nudgeX: 0,
    nudgeY: 0,
    scale: 1,
  },
  exit: {
    right: 6,
    bottom: 6,
    size: 48,
    nudgeX: 0,
    nudgeY: 0,
  },
  scroller: {
    right: 1.5,
    top: 4,
    height: 88,
    trackScale: 1,
    pinScale: 1,
    nudgeX: 0,
    nudgeY: 0,
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:hint-rules';
const LS_PENDING_KEY = 'tilezilla:layouts:hint-rules:pending';

let layoutCache = null;

export function isHintRulesTunerPage() {
  return /hint-rules-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearHintRulesLayoutCache() {
  layoutCache = null;
}

export function mergeHintRulesLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_HINT_RULES_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.window && typeof raw.window === 'object') {
    base.window = { ...base.window, ...raw.window };
  }
  if (raw.exit && typeof raw.exit === 'object') {
    base.exit = { ...base.exit, ...raw.exit };
  }
  if (raw.scroller && typeof raw.scroller === 'object') {
    base.scroller = { ...base.scroller, ...raw.scroller };
  }
  return base;
}

export async function loadHintRulesLayout({ force = false } = {}) {
  if (layoutCache && !force) {
    return JSON.parse(JSON.stringify(layoutCache));
  }

  let raw = null;
  const tunerDraft = isHintRulesTunerPage()
    && localStorage.getItem(LS_PENDING_KEY) === '1';

  if (tunerDraft) {
    try {
      const draft = localStorage.getItem(LS_LAYOUT_KEY);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* fall through to file */
    }
  }

  if (!raw) {
    try {
      const res = await fetch(`/data/hint_rules_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergeHintRulesLayout(raw);
  return JSON.parse(JSON.stringify(layoutCache));
}

export async function reloadHintRulesLayout() {
  clearHintRulesLayoutCache();
  return loadHintRulesLayout({ force: true });
}

export function getHintRulesSectionLayout(sectionKey, layout) {
  const merged = mergeHintRulesLayout(layout);
  const fallback = DEFAULT_HINT_RULES_LAYOUT[sectionKey] || {};
  const stored = merged[sectionKey];
  if (!stored || typeof stored !== 'object') return { ...fallback };
  return { ...fallback, ...stored };
}

export function applyHintRulesLayout(layout, target = document.documentElement) {
  const merged = mergeHintRulesLayout(layout);
  const w = merged.window || DEFAULT_HINT_RULES_LAYOUT.window;
  const ex = merged.exit || DEFAULT_HINT_RULES_LAYOUT.exit;
  const sc = merged.scroller || DEFAULT_HINT_RULES_LAYOUT.scroller;

  target.style.setProperty('--tz-hint-rules-top-vh', String(w.topVh ?? 7.7));
  target.style.setProperty('--tz-hint-rules-height-vh', String(w.heightVh ?? 92.3));
  target.style.setProperty('--tz-hint-rules-max-design-width', `${w.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-hint-rules-width-scale', String(w.widthScale ?? 0.95));
  target.style.setProperty('--tz-hint-rules-nudge-x', `${w.nudgeX ?? 0}px`);
  target.style.setProperty('--tz-hint-rules-nudge-y', `${w.nudgeY ?? 0}px`);
  target.style.setProperty('--tz-hint-rules-scale', String(w.scale ?? 1));

  requestAnimationFrame(() => syncHintRulesWindowGeometry(merged));

  target.style.setProperty('--tz-hint-rules-exit-right', `${ex.right ?? 6}px`);
  target.style.setProperty('--tz-hint-rules-exit-bottom', `${ex.bottom ?? 6}px`);
  target.style.setProperty('--tz-hint-rules-exit-size', `${ex.size ?? 48}px`);
  target.style.setProperty('--tz-hint-rules-exit-nudge-x', `${ex.nudgeX ?? 0}px`);
  target.style.setProperty('--tz-hint-rules-exit-nudge-y', `${ex.nudgeY ?? 0}px`);

  target.style.setProperty('--tz-hint-rules-scroller-right', String(sc.right ?? 1.5));
  target.style.setProperty('--tz-hint-rules-scroller-top', String(sc.top ?? 4));
  target.style.setProperty('--tz-hint-rules-scroller-height', String(sc.height ?? 88));
  target.style.setProperty('--tz-hint-rules-scroller-track-scale', String(sc.trackScale ?? 1));
  target.style.setProperty('--tz-hint-rules-scroller-pin-scale', String(sc.pinScale ?? 1));
  target.style.setProperty('--tz-hint-rules-scroller-nudge-x', `${sc.nudgeX ?? 0}px`);
  target.style.setProperty('--tz-hint-rules-scroller-nudge-y', `${sc.nudgeY ?? 0}px`);
}

/** Pin hint rules panel to main-screen v2 board top → tilebag bottom (live game). */
export function syncHintRulesWindowGeometry(layout) {
  const win = document.querySelector('.tz-hint-rules-window');
  if (!win) return;

  const merged = mergeHintRulesLayout(layout ?? layoutCache);
  const w = getHintRulesSectionLayout('window', merged);
  const useV2Anchor = w.anchorMainScreenV2 !== false
    && document.querySelector('.tz-main-v2-app');

  if (!useV2Anchor) {
    win.classList.remove('is-msv2-synced');
    win.style.removeProperty('--tz-hint-rules-sync-left');
    win.style.removeProperty('--tz-hint-rules-sync-top');
    win.style.removeProperty('--tz-hint-rules-sync-width');
    win.style.removeProperty('--tz-hint-rules-sync-height');
    return;
  }

  const board = document.querySelector('.tz-main-v2-app .tz-board-section');
  const tilebag = document.querySelector('.tz-main-v2-app .tz-tilebag-container');
  if (!board || !tilebag) {
    win.classList.remove('is-msv2-synced');
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const tilebagRect = tilebag.getBoundingClientRect();
  const uiScale = parseFloat(document.documentElement.dataset.uiScale) || 1;
  const widthScale = Number(w.widthScale ?? 0.95);
  const width = (Number(w.maxDesignWidth) || 390) * widthScale * uiScale;
  const top = boardRect.top + (Number(w.nudgeY) || 0);
  const height = Math.max(0, tilebagRect.bottom - top);

  win.classList.add('is-msv2-synced');
  win.style.removeProperty('--tz-hint-rules-sync-left');
  win.style.setProperty('--tz-hint-rules-sync-top', `${top}px`);
  win.style.setProperty('--tz-hint-rules-sync-width', `${width}px`);
  win.style.setProperty('--tz-hint-rules-sync-height', `${height}px`);
}

export function buildHintRulesLayoutReport(layout) {
  const merged = mergeHintRulesLayout(layout);
  const w = merged.window || {};
  const ex = merged.exit || {};
  const sc = merged.scroller || {};
  const effectiveW = Math.round((w.maxDesignWidth ?? 390) * (w.widthScale ?? 0.95));
  return [
    'Hint Rules layout report (390px game width preview)',
    '',
    `Window: top ${w.topVh ?? 7.7}vh · height ${w.heightVh ?? 92.3}vh · max ${w.maxDesignWidth ?? 390}px × widthScale ${w.widthScale ?? 0.95} (= ${effectiveW}px)`,
    `Window: nudgeX ${w.nudgeX ?? 0}px · nudgeY ${w.nudgeY ?? 0}px · scale ${w.scale ?? 1}`,
    `Window: anchorMainScreenV2 ${w.anchorMainScreenV2 !== false} (board top → tilebag bottom in v2 game)`,
    '',
    `Scroller: right ${sc.right ?? 1.5}% · top ${sc.top ?? 4}% · height ${sc.height ?? 88}%`,
    `Scroller: trackScale ${sc.trackScale ?? 1} · pinScale ${sc.pinScale ?? 1}`,
    `Scroller: nudgeX ${sc.nudgeX ?? 0}px · nudgeY ${sc.nudgeY ?? 0}px`,
    '',
    `Close: right ${ex.right ?? 6}px · bottom ${ex.bottom ?? 6}px · size ${ex.size ?? 48}px`,
    `Close: nudgeX ${ex.nudgeX ?? 0}px · nudgeY ${ex.nudgeY ?? 0}px`,
  ].join('\n');
}

export function stashHintRulesLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore quota */
  }
}

export function clearHintRulesLayoutDraft() {
  try {
    localStorage.removeItem(LS_LAYOUT_KEY);
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
