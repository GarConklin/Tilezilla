/** Dual water-layer ripple animation — duration per layer + vertical amplitude. */

export const DEFAULT_WATER_RIPPLE_LAYOUT = {
  durationA: 14,
  durationB: 21,
  amplitudeAPx: 8,
  amplitudeBPx: 8,
};

const LS_LAYOUT_KEY = 'tilezilla:layouts:water-ripple';
const LS_PENDING_KEY = 'tilezilla:layouts:water-ripple:pending';

let layoutCache = null;

export function isWaterRippleTunerPage() {
  return /water-ripple-tuner(?:\.html)?$/i.test(window.location.pathname);
}

export function clearWaterRippleLayoutCache() {
  layoutCache = null;
}

export function stashWaterRippleLayoutDraft(layout) {
  try {
    localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearWaterRippleLayoutDraft() {
  try {
    localStorage.removeItem(LS_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeWaterRippleLayout(raw) {
  const base = { ...DEFAULT_WATER_RIPPLE_LAYOUT };
  if (!raw || typeof raw !== 'object') return base;
  if (raw.durationA != null) base.durationA = Number(raw.durationA) || base.durationA;
  if (raw.durationB != null) base.durationB = Number(raw.durationB) || base.durationB;
  if (raw.amplitudeAPx != null) base.amplitudeAPx = Number(raw.amplitudeAPx) || base.amplitudeAPx;
  if (raw.amplitudeBPx != null) base.amplitudeBPx = Number(raw.amplitudeBPx) || base.amplitudeBPx;
  // Legacy single amplitude — applies to both layers when per-layer values are absent.
  if (raw.amplitudePx != null) {
    const legacy = Number(raw.amplitudePx);
    if (Number.isFinite(legacy)) {
      if (raw.amplitudeAPx == null) base.amplitudeAPx = legacy;
      if (raw.amplitudeBPx == null) base.amplitudeBPx = legacy;
    }
  }
  return base;
}

export async function loadWaterRippleLayout({ force = false, fromDisk = false } = {}) {
  if (layoutCache && !force) return layoutCache;

  let raw = null;
  const onTuner = isWaterRippleTunerPage();

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
      const res = await fetch(`/data/water_ripple_layout.json?t=${Date.now()}`, { cache: 'no-store' });
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

  layoutCache = mergeWaterRippleLayout(raw);
  return layoutCache;
}

export async function reloadWaterRippleLayout() {
  clearWaterRippleLayoutCache();
  return loadWaterRippleLayout({ force: true, fromDisk: true });
}

export function applyWaterRippleLayout(layout, target = document.documentElement) {
  const merged = mergeWaterRippleLayout(layout);
  const durationA = Math.max(4, Math.min(120, Number(merged.durationA) || DEFAULT_WATER_RIPPLE_LAYOUT.durationA));
  const durationB = Math.max(4, Math.min(120, Number(merged.durationB) || DEFAULT_WATER_RIPPLE_LAYOUT.durationB));
  const amplitudeAPx = Math.max(0, Math.min(24, Number(merged.amplitudeAPx) || DEFAULT_WATER_RIPPLE_LAYOUT.amplitudeAPx));
  const amplitudeBPx = Math.max(0, Math.min(24, Number(merged.amplitudeBPx) || DEFAULT_WATER_RIPPLE_LAYOUT.amplitudeBPx));

  target.style.setProperty('--tz-ripple-duration-a', `${durationA}s`);
  target.style.setProperty('--tz-ripple-duration-b', `${durationB}s`);
  target.style.setProperty('--tz-ripple-amplitude-a', `${amplitudeAPx}px`);
  target.style.setProperty('--tz-ripple-amplitude-b', `${amplitudeBPx}px`);
  target.style.setProperty('--tz-ripple-amplitude', `${amplitudeAPx}px`);
}

export function buildWaterRippleLayoutReport(layout) {
  const merged = mergeWaterRippleLayout(layout);
  return [
    'Water ripple animation',
    `Layer A duration: ${merged.durationA}s (lower = faster)`,
    `Layer B duration: ${merged.durationB}s`,
    `Layer A vertical amplitude: ${merged.amplitudeAPx}px`,
    `Layer B vertical amplitude: ${merged.amplitudeBPx}px`,
  ].join('\n');
}
