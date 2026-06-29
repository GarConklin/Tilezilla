/**

 * "I'm Stuck" art popup — confirm forfeit, then show route preview.

 */



import {

  applyStuckRevealLayout,

  applyStuckRevealItemPositions,

  fitStuckRevealDialog,

  getStuckRevealDialogLayout,

  getStuckRevealItemLayout,

  isStuckRevealTunerPage,

  loadStuckRevealLayout,

  reloadStuckRevealLayout,

  STUCK_REVEAL_ART,

} from './stuck-reveal-layout.js';

import { isRestrictedFeature } from './tilezilla-guest.js';



const STUCK_CONFIRM_ART = { w: 1379, h: 1098 };



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



function isStuckPreviewStep() {

  return document.querySelector('.tz-stuck-dialog__frame')?.classList.contains('is-preview');

}



function stuckArtSize() {

  if (isStuckPreviewStep()) {

    const cs = getComputedStyle(document.documentElement);

    const w = parseFloat(cs.getPropertyValue('--tz-stuck-reveal-art-w')) || STUCK_REVEAL_ART.w;

    const h = parseFloat(cs.getPropertyValue('--tz-stuck-reveal-art-h')) || STUCK_REVEAL_ART.h;

    return { w, h };

  }

  return STUCK_CONFIRM_ART;

}



/** Cap dialog width to preview pane (95% by default). */

function stuckMaxWidth() {

  const cs = getComputedStyle(document.documentElement);

  const layoutRatio = parseFloat(cs.getPropertyValue('--tz-stuck-preview-layout-width-ratio')) || 0.95;

  const previewSection = document.querySelector('.tz-preview-section');

  if (previewSection) {

    const w = previewSection.getBoundingClientRect().width;

    if (w > 0) return Math.floor(w * layoutRatio);

  }

  const isV2 = Boolean(document.querySelector('.tz-main-v2-app'));

  if (isV2) {

    const designW = parseFloat(cs.getPropertyValue('--tz-design-width')) || 390;

    const uiScale = parseFloat(cs.getPropertyValue('--tz-ui-scale')) || 1;

    return Math.floor(designW * uiScale * layoutRatio);

  }

  const previewW = cs.getPropertyValue('--tz-w-preview').trim();

  if (previewW.endsWith('px')) {

    const uiScale = parseFloat(cs.getPropertyValue('--tz-ui-scale')) || 1;

    return Math.floor(parseFloat(previewW) * uiScale * layoutRatio);

  }

  const base = parseFloat(cs.getPropertyValue('--tz-stuck-display-w')) || 720;

  const scale = parseFloat(cs.getPropertyValue('--tz-stuck-width-scale')) || 1;

  return Math.floor(base * scale * layoutRatio);

}



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

let previewResizeObserver = null;

let previewResizeTimer = null;

let revealLayoutCache = null;



async function ensureRevealLayoutApplied() {

  if (!revealLayoutCache) {

    try {

      revealLayoutCache = await loadStuckRevealLayout({ fromDisk: !isStuckRevealTunerPage() });

    } catch {

      revealLayoutCache = null;

    }

  }

  applyStuckRevealLayout(revealLayoutCache);

  return revealLayoutCache;

}



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

  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.style.removeProperty('width');

  canvas.style.removeProperty('height');

}



function clearRevealInlinePositions() {

  for (const el of document.querySelectorAll(

    '.tz-stuck-dialog__preview, .tz-stuck-dialog__btn--keep, .tz-stuck-dialog__btn--close',

  )) {

    el.style.removeProperty('left');

    el.style.removeProperty('top');

    el.style.removeProperty('width');

    el.style.removeProperty('height');

    el.style.removeProperty('transform');

  }

}



function fitStuckDialog() {
  const dialog = document.querySelector('.tz-stuck-dialog');
  const root = $('stuckPopupRoot');
  if (!dialog || !root || root.hidden) return;

  const { h: rootH, v: rootV } = stuckRootPadding();

  let previewPaneWidth = 0;
  const previewSection = document.querySelector('.tz-preview-section');
  if (previewSection) {
    const w = previewSection.getBoundingClientRect().width;
    if (w > 0) previewPaneWidth = w;
  }

  if (isStuckPreviewStep()) {
    const revealDialog = getStuckRevealDialogLayout(revealLayoutCache);
    fitStuckRevealDialog(dialog, {
      previewPaneWidth,
      layoutRatio: revealDialog.previewWidthRatio,
      artW: revealDialog.artW,
      artH: revealDialog.artH,
      maxViewportWidth: window.innerWidth,
      maxViewportHeight: window.innerHeight,
      displayPad: stuckDisplayPad(),
      rootPaddingH: rootH,
      rootPaddingV: rootV,
    });
    if (revealLayoutCache) applyStuckRevealItemPositions(revealLayoutCache);
    return;
  }

  const { w: artW, h: artH } = stuckArtSize();
  const vw = stuckMaxDialogWidth();
  const vh = stuckMaxDialogHeight();
  const wFromHeight = (vh * artW) / artH;
  const w = Math.floor(Math.min(stuckMaxWidth(), vw, wFromHeight));
  const h = Math.floor((w * artH) / artW);

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

  const dialog = document.querySelector('.tz-stuck-dialog');



  if (previewWrap) previewWrap.hidden = !isPreview;

  if (viewBtn) viewBtn.hidden = isPreview;

  if (closeBtn) closeBtn.hidden = !isPreview;

  frame?.classList.toggle('is-preview', isPreview);

  dialog?.classList.toggle('is-reveal', isPreview);



  if (!isPreview) clearPreviewCanvas();

  if (!isPreview) clearRevealInlinePositions();

  fitStuckDialog();

  if (isPreview) {

    requestAnimationFrame(() => {

      void renderStuckPreview(getApp());

    });

  }

}



function bindStuckResize() {

  if (resizeHandler) return;

  resizeHandler = () => {

    if ($('stuckPopupRoot')?.hidden) return;

    fitStuckDialog();

    if (isStuckPreviewStep()) {

      clearTimeout(previewResizeTimer);

      previewResizeTimer = setTimeout(() => {

        void renderStuckPreview(getApp());

      }, 80);

    }

  };

  window.addEventListener('resize', resizeHandler);

}



function installPreviewResizeObserver() {

  const wrap = $('stuckPreviewWrap');

  if (!wrap || previewResizeObserver) return;

  previewResizeObserver = new ResizeObserver(() => {

    if (wrap.hidden || $('stuckPopupRoot')?.hidden) return;

    clearTimeout(previewResizeTimer);

    previewResizeTimer = setTimeout(() => {

      void renderStuckPreview(getApp());

    }, 80);

  });

  previewResizeObserver.observe(wrap);

}



function openStuckPopup() {

  const root = $('stuckPopupRoot');

  if (!root) return;

  menuApi?.closeAll?.();

  root.hidden = false;

  document.body.classList.add('tz-modal-open');

  bindStuckResize();

  installPreviewResizeObserver();

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



function nextFrame() {

  return new Promise((resolve) => requestAnimationFrame(resolve));

}



async function renderStuckPreview(app) {

  const canvas = $('stuckRoutePreview');

  const wrap = $('stuckPreviewWrap');

  if (!canvas || !wrap || !app || wrap.hidden) return false;



  const placements = await app.getExampleRoutePlacements();

  if (!placements?.length) return false;



  await ensureRevealLayoutApplied();

  const previewLayout = getStuckRevealItemLayout('preview', revealLayoutCache);

  const boardScale = previewLayout.boardScale ?? 1;



  await nextFrame();

  await nextFrame();



  const rect = wrap.getBoundingClientRect();

  const cssW = Math.max(1, rect.width || wrap.clientWidth);

  const cssH = Math.max(1, rect.height || wrap.clientHeight);

  const dpr = window.devicePixelRatio || 1;

  const maxPx = Math.max(48, Math.round(Math.min(cssW, cssH) * boardScale * dpr));



  const ok = await app.renderSolutionPreview(canvas, placements, {

    level: app.state.currentLevel,

    tileset: app.state?.activeTileset || undefined,

    maxPx: maxPx / dpr,

  });

  if (!ok) return false;



  canvas.style.width = '100%';

  canvas.style.height = '100%';

  canvas.style.objectFit = 'contain';

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



  await ensureRevealLayoutApplied();

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
  if (isRestrictedFeature('stuck')) return;

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

    await ensureRevealLayoutApplied();

  } catch (err) {

    console.warn('Stuck reveal layout:', err);

  }



  const reloadLayout = async () => {

    try {

      revealLayoutCache = await reloadStuckRevealLayout({ fromDisk: !isStuckRevealTunerPage() });

      applyStuckRevealLayout(revealLayoutCache);

      if (isStuckPreviewStep()) {

        await renderStuckPreview(getApp());

      }

      fitStuckDialog();

    } catch {

      /* ignore */

    }

  };



  window.addEventListener('tilezilla:stuck-reveal-layout-saved', () => {

    void reloadLayout();

  });



  window.addEventListener('storage', (e) => {

    if (

      e.key === 'tilezilla:layouts:stuck-reveal'

      || e.key === 'tilezilla:layouts:stuck-reveal:pending'

      || e.key === 'tilezilla:stuck-reveal-layout-version'

    ) {

      void reloadLayout();

    }

  });



  window.addEventListener('focus', () => {

    void reloadLayout();

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


