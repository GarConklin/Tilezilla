/**
 * Shared overlay / passport frame sizing (390×844 design).
 * Fills the board→tilebag region; scales up on desktop 2×/3×, never shrinks below 1× design width.
 */

import {
  TZ_DESIGN_WIDTH,
  applyUiScale,
  viewportSize,
} from './tilezilla-ui-scale.js';

/** Desktop 2×/3× only — mobile uiScale < 1 stays at 1× for overlay frames. */
export function getFrameUpscale() {
  const uiScale = parseFloat(document.documentElement.dataset.uiScale) || 1;
  return Math.max(1, uiScale);
}

export function getScaleHostWidth() {
  const host = document.querySelector('.tz-scale-host');
  const w = host?.getBoundingClientRect?.().width;
  if (w > 0) return w;
  return TZ_DESIGN_WIDTH * getFrameUpscale();
}

/**
 * @param {object} [options]
 * @param {number} [options.artW]
 * @param {number} [options.artH]
 * @param {number} [options.maxDesignWidth]
 * @param {number} [options.widthScale]
 * @param {number} [options.topFrac] Board-top fraction of viewport height (0–1).
 * @param {number} [options.horizontalPad]
 */
export function computeOverlayFrameSize({
  artW = 1418,
  artH = 2200,
  maxDesignWidth = TZ_DESIGN_WIDTH,
  widthScale = 1,
  topFrac = 0.081,
  horizontalPad = 16,
} = {}) {
  const { vw, vh } = viewportSize();
  const upscale = getFrameUpscale();
  const designCap = maxDesignWidth * widthScale * upscale;
  const availH = Math.max(0, vh * (1 - topFrac) - 8);
  const width = Math.min(
    Math.max(0, vw - horizontalPad),
    designCap,
    availH > 0 ? availH * (artW / artH) : designCap,
  );
  const height = Math.min(availH, width * (artH / artW));
  return {
    width,
    height,
    availH,
    top: vh * topFrac,
    upscale,
  };
}

export function applyPassportFrameVars(target, size, { prefix = 'auth-passport' } = {}) {
  if (!target?.style) return;
  target.style.setProperty(`--${prefix}-frame-width`, `${size.width}px`);
  target.style.setProperty(`--${prefix}-frame-height`, `${size.height}px`);
  target.style.setProperty(`--${prefix}-avail-h`, `${size.availH}px`);
  target.style.setProperty('--tz-frame-upscale', String(size.upscale));
}

export function syncAuthPassportFrame({
  boardYPercent = 8.1,
  maxDesignWidth = TZ_DESIGN_WIDTH,
  widthScale = 1,
  artW = 1418,
  artH = 2200,
  root = document.documentElement,
} = {}) {
  const size = computeOverlayFrameSize({
    artW,
    artH,
    maxDesignWidth,
    widthScale,
    topFrac: boardYPercent / 100,
  });
  applyPassportFrameVars(root, size);
  for (const stage of document.querySelectorAll('.auth-screen__stage')) {
    applyPassportFrameVars(stage, size);
  }
  return size;
}

export function syncProfileOverlayFrame(root = document) {
  const dialog = root.querySelector?.('#profileOverlayRoot .tz-profile-dialog')
    || root.querySelector?.('.tz-profile-dialog');
  if (!dialog) return null;

  const maxWidth = parseFloat(
    getComputedStyle(dialog).getPropertyValue('--auth-profile-max-width'),
  ) || 420;
  const board = document.querySelector('.tz-main-v2-app .tz-board-section');
  let topFrac = 0.081;
  if (board) {
    const { vh } = viewportSize();
    if (vh > 0) topFrac = board.getBoundingClientRect().top / vh;
  } else {
    const frac = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--auth-chrome-stage-top-frac'),
    );
    if (Number.isFinite(frac)) topFrac = frac;
  }

  const size = computeOverlayFrameSize({
    maxDesignWidth: maxWidth,
    topFrac,
  });
  applyPassportFrameVars(dialog, size, { prefix: 'auth-passport' });
  const visibilityRoot = root.getElementById?.('profileOverlayRoot') || root;
  if (visibilityRoot?.style) {
    visibilityRoot.style.setProperty('--tz-frame-upscale', String(size.upscale));
  }
  return size;
}

export function syncJournalDialogFrame() {
  const dialog = document.querySelector('#journalRoot .tz-journal-dialog');
  if (!dialog) return null;

  const artW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-journal-art-w')) || 933;
  const artH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tz-journal-art-h')) || 1686;
  const maxDesign = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--tz-journal-max-design-width'),
  ) || TZ_DESIGN_WIDTH;

  const board = document.querySelector('.tz-main-v2-app .tz-board-section');
  const tilebag = document.querySelector('.tz-main-v2-app .tz-tilebag-container');
  let topFrac = 0.081;
  if (board) {
    const { vh } = viewportSize();
    if (vh > 0) topFrac = board.getBoundingClientRect().top / vh;
  }

  const size = computeOverlayFrameSize({
    artW,
    artH,
    maxDesignWidth: maxDesign,
    widthScale: 1,
    topFrac,
    horizontalPad: 24,
  });

  dialog.style.width = `${size.width}px`;
  dialog.style.maxHeight = `${size.height}px`;

  if (board && tilebag) {
    const height = Math.max(0, tilebag.getBoundingClientRect().bottom - board.getBoundingClientRect().top);
    if (height > 0) dialog.style.maxHeight = `${height}px`;
  }

  document.documentElement.style.setProperty('--tz-frame-upscale', String(size.upscale));
  return size;
}

let frameListenersWired = false;

/** Call on auth pages and after shell boot so overlays track viewport + desktop scale lock. */
export function wireOverlayFrameListeners(getBoardYPercent = () => 8.1) {
  // Never call applyUiScale from the ui-scale-changed path — that event is
  // dispatched by applyUiScale itself and would recurse forever.
  const syncFrames = () => {
    try {
      const boardY = typeof getBoardYPercent === 'function' ? getBoardYPercent() : 8.1;
      if (document.body?.classList?.contains('auth-screen')) {
        const screenKey = ['login', 'create', 'profile'].find((k) =>
          document.body.classList.contains(`auth-screen--${k}`),
        );
        let maxW = TZ_DESIGN_WIDTH;
        let widthScale = 1;
        if (screenKey) {
          const maxVar = getComputedStyle(document.documentElement).getPropertyValue(`--auth-${screenKey}-max-width`);
          const parsed = parseFloat(maxVar);
          if (parsed > 0) maxW = parsed;
        }
        syncAuthPassportFrame({ boardYPercent: boardY, maxDesignWidth: maxW, widthScale });
      }
      syncProfileOverlayFrame();
      syncJournalDialogFrame();
    } catch (err) {
      console.warn('Overlay frame sync:', err);
    }
  };

  const onResize = () => {
    try {
      applyUiScale();
    } catch (err) {
      console.warn('applyUiScale on resize:', err);
    }
    syncFrames();
  };

  onResize();

  if (frameListenersWired) return syncFrames;
  frameListenersWired = true;
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  window.addEventListener('tilezilla:ui-scale-changed', syncFrames);
  return syncFrames;
}
