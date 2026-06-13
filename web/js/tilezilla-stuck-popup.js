/**
 * "I'm Stuck" art popup — confirm forfeit, then show route preview.
 */

import {
  applyStuckRevealLayout,
  loadStuckRevealLayout,
  reloadStuckRevealLayout,
} from './stuck-reveal-layout.js';

const STUCK_ART_W = 1379;
const STUCK_ART_H = 1098;

function stuckMaxWidth() {
  const cs = getComputedStyle(document.documentElement);
  const base = parseFloat(cs.getPropertyValue('--tz-stuck-display-w')) || 720;
  const scale = parseFloat(cs.getPropertyValue('--tz-stuck-width-scale')) || 1;
  return Math.floor(base * scale);
}

function stuckRootPadding() {
  const root = $('stuckPopupRoot');
  if (!root) return { h: 0, v: 0 };
  const rs = getComputedStyle(root);
  return {
    h: (parseFloat(rs.paddingLeft) || 0) + (parseFloat(rs.paddingRight) || 0),
    v: (parseFloat(rs.paddingTop) || 0) + (parseFloat(rs.paddingBottom) || 0),
  };
}

function stuckDisplayPad() {
  const cs = getComputedStyle(document.documentElement);
  return parseFloat(cs.getPropertyValue('--tz-stuck-display-pad')) || 82;
}

/** Max dialog width — matches CSS min(100vw - pad, content box). */
function stuckMaxDialogWidth() {
  const pad = stuckDisplayPad();
  const { h: rootH } = stuckRootPadding();
  const contentW = window.innerWidth - rootH;
  return Math.max(280, Math.min(contentW, window.innerWidth - pad));
}

function stuckMaxDialogHeight() {
  const pad = stuckDisplayPad();
  const { v: rootV } = stuckRootPadding();
  const contentH = window.innerHeight - rootV;
  return Math.max(320, Math.min(contentH, window.innerHeight - pad));
}

let getApp = () => null;
let menuApi = null;
let resizeHandler = null;

function $(id) {
  return document.getElementById(id);
}

function updateHintCountDisplay(app) {
  const el = $('hintCount');
  if (el && app?.getGlobalHintTokens) {
    el.textContent = String(app.getGlobalHintTokens());
  }
}

function clearPreviewCanvas() {
  const canvas = $('stuckRoutePreview');
  const wrap = $('stuckPreviewWrap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  wrap?.style.removeProperty('--tz-stuck-preview-fit-w');
  wrap?.style.removeProperty('--tz-stuck-preview-fit-h');
}

/** Size the parchment dialog to fully fit the visible viewport. */
function fitStuckDialog() {
  const dialog = document.querySelector('.tz-stuck-dialog');
  const root = $('stuckPopupRoot');
  if (!dialog || !root || root.hidden) return;

  const vw = stuckMaxDialogWidth();
  const vh = stuckMaxDialogHeight();
  const wFromHeight = (vh * STUCK_ART_W) / STUCK_ART_H;
  const w = Math.floor(Math.min(stuckMaxWidth(), vw, wFromHeight));
  const h = Math.floor((w * STUCK_ART_H) / STUCK_ART_W);

  dialog.style.width = `${w}px`;
  dialog.style.height = `${h}px`;
  dialog.style.aspectRatio = 'auto';
}

function setStep(step) {
  const isPreview = step === 'preview';
  const previewWrap = $('stuckPreviewWrap');
  const viewBtn = $('stuckViewRouteBtn');
  const closeBtn = $('stuckCloseBtn');
  const frame = document.querySelector('.tz-stuck-dialog__frame');

  if (previewWrap) previewWrap.hidden = !isPreview;
  if (viewBtn) viewBtn.hidden = isPreview;
  if (closeBtn) closeBtn.hidden = !isPreview;
  frame?.classList.toggle('is-preview', isPreview);

  if (!isPreview) clearPreviewCanvas();
  fitStuckDialog();
}

function bindStuckResize() {
  if (resizeHandler) return;
  resizeHandler = () => {
    if ($('stuckPopupRoot')?.hidden) return;
    fitStuckDialog();
  };
  window.addEventListener('resize', resizeHandler);
}

function openStuckPopup() {
  const root = $('stuckPopupRoot');
  if (!root) return;
  menuApi?.closeAll?.();
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  bindStuckResize();
  requestAnimationFrame(() => {
    fitStuckDialog();
    root.scrollTop = 0;
  });
}

function closeStuckPopup() {
  const root = $('stuckPopupRoot');
  if (!root) return;
  root.hidden = true;
  setStep('confirm');
  if (
    $('menuRoot')?.hidden !== false
    && $('menuPanelRoot')?.hidden !== false
    && $('settingsRoot')?.hidden !== false
    && $('hintMenuRoot')?.hidden !== false
  ) {
    document.body.classList.remove('tz-modal-open');
  }
}

function updateViewRouteButton(app) {
  const btn = $('stuckViewRouteBtn');
  const warn = $('stuckTokenWarn');
  if (!btn || !app) return;

  const lv = app.state?.currentLevel;
  const alreadyViewed = lv?.id && app.hasViewedExampleRoute?.(lv.id);
  const afford = alreadyViewed || (app.canAffordExampleRoute?.() ?? false);

  btn.disabled = !afford;
  btn.setAttribute('aria-disabled', afford ? 'false' : 'true');
  if (warn) {
    warn.hidden = afford;
    if (!afford) warn.textContent = 'Not enough hint tokens.';
  }
}

/** Plain tile art (no grid lines) for route previews in I'm Stuck. */
const STUCK_PREVIEW_TILESET = 'og';

async function renderStuckPreview(app) {
  const canvas = $('stuckRoutePreview');
  if (!canvas || !app) return false;
  const placements = await app.getExampleRoutePlacements();
  if (!placements?.length) return false;
  await app.renderSolutionPreview(canvas, placements, {
    level: app.state.currentLevel,
    tileset: STUCK_PREVIEW_TILESET,
  });
  fitStuckDialog();
  return true;
}

async function showStuckPreview() {
  const app = getApp();
  if (!app) return;

  const placements = await app.getExampleRoutePlacements();
  if (!placements?.length) {
    const warn = $('stuckTokenWarn');
    if (warn) {
      warn.hidden = false;
      warn.textContent = 'No example route is available for this puzzle yet.';
    }
    return;
  }

  const lv = app.state?.currentLevel;
  const alreadyViewed = lv?.id && app.hasViewedExampleRoute?.(lv.id);

  if (!alreadyViewed) {
    const result = await app.purchaseExampleRoute();
    if (!result.ok) {
      if (result.reason === 'insufficient-tokens') {
        const warn = $('stuckTokenWarn');
        if (warn) {
          warn.hidden = false;
          warn.textContent = 'Not enough hint tokens.';
        }
        updateViewRouteButton(app);
      }
      return;
    }
    if (result.charged) updateHintCountDisplay(app);
  }

  setStep('preview');
  const ok = await renderStuckPreview(app);
  if (!ok) {
    setStep('confirm');
    return;
  }

  const warn = $('stuckTokenWarn');
  if (warn) warn.hidden = true;
}

export async function openStuckFlow() {
  const app = getApp();
  if (!app) return;

  setStep('confirm');
  openStuckPopup();
  updateViewRouteButton(app);

  const warn = $('stuckTokenWarn');
  if (warn) {
    warn.hidden = true;
    warn.textContent = 'Not enough hint tokens.';
  }
}

export async function initStuckPopup({ getApp: getAppFn, menuApi: menu }) {
  getApp = getAppFn || (() => null);
  menuApi = menu || null;

  try {
    applyStuckRevealLayout(await loadStuckRevealLayout());
  } catch (err) {
    console.warn('Stuck reveal layout:', err);
  }

  window.addEventListener('tilezilla:stuck-reveal-layout-saved', () => {
    void reloadStuckRevealLayout().then(applyStuckRevealLayout).catch(() => {});
  });

  window.addEventListener('storage', (e) => {
    if (
      e.key === 'tilezilla:layouts:stuck-reveal'
      || e.key === 'tilezilla:layouts:stuck-reveal:pending'
      || e.key === 'tilezilla:stuck-reveal-layout-version'
    ) {
      void reloadStuckRevealLayout().then(applyStuckRevealLayout).catch(() => {});
    }
  });

  window.addEventListener('focus', () => {
    void reloadStuckRevealLayout().then(applyStuckRevealLayout).catch(() => {});
  });

  const root = $('stuckPopupRoot');
  if (!root) return null;

  $('stuckKeepTryingBtn')?.addEventListener('click', closeStuckPopup);
  $('stuckCloseBtn')?.addEventListener('click', closeStuckPopup);
  $('stuckPopupBackdrop')?.addEventListener('click', closeStuckPopup);

  $('stuckViewRouteBtn')?.addEventListener('click', () => {
    void showStuckPreview();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeStuckPopup();
  });

  return { openStuckFlow, closeStuckPopup };
}
