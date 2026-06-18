/** Challenge Begin / progress gate — CP overlay + button layout (% of frame). */

export const CHALLENGE_BEGIN_ART = { w: 1397, h: 1126 };

export const CHALLENGE_GATE_BASE_SRC = '/img/ChallengeBeginBase.png';
export const CHALLENGE_PROGRESS_BASE_SRC = '/img/ChallengeProgressBase.png';

export const CHALLENGE_BEGIN_BTN_BEGIN = '/img/BeginChallenge-btn.png';
export const CHALLENGE_BEGIN_BTN_CONTINUE = '/img/CLD-ContinueSearch-btn.png';
export const CHALLENGE_BEGIN_BTN_LEVEL_UP = '/img/Level-UpandContinue.png';

export const CHALLENGE_BEGIN_SUPPORTED_TOTALS = [1, 2, 3, 4, 5, 6, 9];

/**
 * CP overlay art: `/img/CLD/CP-Overlay-{found}of{total}.png`
 *
 * `found` = routes discovered so far (0 at gate, then 1 after 1st solve, …, total after last solve).
 * `total` = required route count for the challenge (1, 2, 3, 4, 5, 6, or 9).
 *
 * Examples:
 *   total 3 → gate 0of3, after solves 1of3, 2of3, 3of3
 *   total 9 → gate 0of9, after solves 1of9 … 9of9
 */
export const CHALLENGE_BEGIN_ITEM_DEFS = {
  begin: { label: 'Begin challenge btn' },
  continue: { label: 'Continue search btn' },
};

export const DEFAULT_CHALLENGE_BEGIN_LAYOUT = {
  dialog: {
    artW: 1397,
    artH: 1126,
    displayPad: 32,
    maxDesignWidth: 390,
    widthScale: 0.92,
  },
  items: {
    begin: { x: 12, y: 86.5, w: 76, h: 9 },
    continue: { x: 12, y: 86.5, w: 76, h: 9 },
  },
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:challenge-begin';
const LS_PENDING_KEY = 'tilezilla:layouts:challenge-begin:pending';

let layoutCache = null;

export function normalizeChallengeBeginTotal(total) {
  const n = Math.max(1, Math.round(Number(total) || 1));
  if (CHALLENGE_BEGIN_SUPPORTED_TOTALS.includes(n)) return n;
  const next = CHALLENGE_BEGIN_SUPPORTED_TOTALS.find((t) => t >= n);
  return next ?? 9;
}

/** Gate = ChallengeBeginBase; progress = ChallengeProgressBase (same frame size). */
export function challengeBeginBaseSrc(mode = 'begin') {
  return mode === 'progress' ? CHALLENGE_PROGRESS_BASE_SRC : CHALLENGE_GATE_BASE_SRC;
}

/** Resolve overlay path — see CP overlay comment above CHALLENGE_BEGIN_ITEM_DEFS. */
export function challengeBeginOverlaySrc(found, total) {
  const t = normalizeChallengeBeginTotal(total);
  const f = Math.min(Math.max(0, Math.round(Number(found) || 0)), t);
  return `/img/CLD/CP-Overlay-${f}of${t}.png`;
}

/**
 * Button art paired with CP overlays:
 * - Gate (found 0): BeginChallenge-btn
 * - Progress, more routes remain (found < total): CLD-ContinueSearch-btn
 * - Progress, all routes found (found >= total): Level-UpandContinue
 */
export function challengeBeginButtonSrc(found, total, mode = 'begin') {
  if (mode === 'begin') return CHALLENGE_BEGIN_BTN_BEGIN;
  const t = normalizeChallengeBeginTotal(total);
  const f = Math.min(Math.max(0, Math.round(Number(found) || 0)), t);
  return f >= t ? CHALLENGE_BEGIN_BTN_LEVEL_UP : CHALLENGE_BEGIN_BTN_CONTINUE;
}

/** @deprecated use challengeBeginOverlaySrc */
export function challengeRoutesFoundSrc(found, total) {
  return challengeBeginOverlaySrc(found, total);
}

export function clearChallengeBeginLayoutCache() {
  layoutCache = null;
}

export function stashChallengeBeginLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearChallengeBeginLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeChallengeBeginLayout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_CHALLENGE_BEGIN_LAYOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.dialog && typeof raw.dialog === 'object') {
    base.dialog = { ...base.dialog, ...raw.dialog };
  }
  if (raw.items && typeof raw.items === 'object') {
    for (const [key, val] of Object.entries(raw.items)) {
      if (!CHALLENGE_BEGIN_ITEM_DEFS[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadChallengeBeginLayout({ force = false } = {}) {
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
      const res = await fetch(`/data/challenge_begin_layout.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  layoutCache = mergeChallengeBeginLayout(raw);
  return layoutCache;
}

export async function reloadChallengeBeginLayout() {
  clearChallengeBeginLayoutCache();
  return loadChallengeBeginLayout({ force: true });
}

export function getChallengeBeginItemLayout(itemKey, layout) {
  const merged = mergeChallengeBeginLayout(layout);
  const item = merged.items?.[itemKey] || {};
  const def = DEFAULT_CHALLENGE_BEGIN_LAYOUT.items?.[itemKey] || {};
  return {
    x: item.x ?? def.x ?? 0,
    y: item.y ?? def.y ?? 0,
    w: item.w ?? def.w ?? 0,
    h: item.h ?? def.h ?? 0,
  };
}

export function applyChallengeBeginLayout(layout, target = document.documentElement) {
  const merged = mergeChallengeBeginLayout(layout);
  const d = merged.dialog || DEFAULT_CHALLENGE_BEGIN_LAYOUT.dialog;
  target.style.setProperty('--tz-challenge-begin-art-w', String(d.artW ?? CHALLENGE_BEGIN_ART.w));
  target.style.setProperty('--tz-challenge-begin-art-h', String(d.artH ?? CHALLENGE_BEGIN_ART.h));
  target.style.setProperty('--tz-challenge-begin-display-pad', `${d.displayPad ?? 32}px`);
  target.style.setProperty('--tz-challenge-begin-max-design-width', `${d.maxDesignWidth ?? 390}px`);
  target.style.setProperty('--tz-challenge-begin-width-scale', String(d.widthScale ?? 0.92));

  for (const key of Object.keys(CHALLENGE_BEGIN_ITEM_DEFS)) {
    const box = getChallengeBeginItemLayout(key, merged);
    target.style.setProperty(`--tz-challenge-begin-${key}-x`, `${box.x}%`);
    target.style.setProperty(`--tz-challenge-begin-${key}-y`, `${box.y}%`);
    target.style.setProperty(`--tz-challenge-begin-${key}-w`, `${box.w}%`);
    target.style.setProperty(`--tz-challenge-begin-${key}-h`, `${box.h}%`);
  }
}
