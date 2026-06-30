/**
 * Shared 390×844 viewport scaling (same as tilezilla-bootstrap.js).
 */

import { getDesktopScalePreference, isPhonePreviewMode } from './tilezilla-settings.js';

export const TZ_DESIGN_WIDTH = 390;
export const TZ_DESIGN_HEIGHT = 844;
const TZ_DESKTOP_SCALE_AUTO = 2;

function viewportSize() {
  const vp = window.visualViewport;
  return {
    vw: vp?.width ?? window.innerWidth,
    vh: vp?.height ?? window.innerHeight,
  };
}

export function getLockedDesktopScale() {
  const pref = getDesktopScalePreference();
  if (pref === '2' || pref === '3') return Number(pref);
  return null;
}

/** Pixel size of the locked canvas (content area), or null when using Auto. */
export function getViewportLockDimensions() {
  if (isPhonePreviewMode()) {
    return {
      width: TZ_DESIGN_WIDTH,
      height: TZ_DESIGN_HEIGHT,
      scale: 1,
      label: '390×844 mobile',
    };
  }
  const locked = getLockedDesktopScale();
  if (locked === 2) {
    return {
      width: TZ_DESIGN_WIDTH * 2,
      height: TZ_DESIGN_HEIGHT * 2,
      scale: 2,
      label: '780×1688 (2×)',
    };
  }
  if (locked === 3) {
    return {
      width: TZ_DESIGN_WIDTH * 3,
      height: TZ_DESIGN_HEIGHT * 3,
      scale: 3,
      label: '1170×2532 (3×)',
    };
  }
  return null;
}

export function isViewportLocked() {
  return Boolean(getViewportLockDimensions());
}

function applyViewportLock() {
  const dims = getViewportLockDimensions();
  const locked = Boolean(dims);
  document.documentElement.classList.toggle('tz-viewport-locked', locked);
  if (dims) {
    document.documentElement.style.setProperty('--tz-lock-width', `${dims.width}px`);
    document.documentElement.style.setProperty('--tz-lock-height', `${dims.height}px`);
    document.documentElement.dataset.viewportLock = dims.label;
  } else {
    document.documentElement.style.removeProperty('--tz-lock-width');
    document.documentElement.style.removeProperty('--tz-lock-height');
    delete document.documentElement.dataset.viewportLock;
  }
}

/**
 * Resize the browser window so the content area matches the locked canvas.
 * Browsers may block this unless the tab was opened by script; chrome size is compensated.
 */
export function tryFitWindowToViewportLock() {
  const dims = getViewportLockDimensions();
  if (!dims) {
    return { ok: false, reason: 'not-locked', label: null };
  }
  const chromeW = Math.max(0, window.outerWidth - window.innerWidth);
  const chromeH = Math.max(0, window.outerHeight - window.innerHeight);
  try {
    window.resizeTo(dims.width + chromeW, dims.height + chromeH);
    return { ok: true, label: dims.label, width: dims.width, height: dims.height };
  } catch {
    return { ok: false, reason: 'blocked', label: dims.label, width: dims.width, height: dims.height };
  }
}

export function applyUiScale() {
  const phonePreview = document.documentElement.classList.contains('tz-phone-preview');
  const lockedDesktopScale = phonePreview ? null : getLockedDesktopScale();
  const { vw: layoutVw, vh } = viewportSize();
  const vw = phonePreview ? Math.min(TZ_DESIGN_WIDTH, layoutVw) : layoutVw;
  const desktopMinWidth = TZ_DESIGN_WIDTH * (lockedDesktopScale ?? TZ_DESKTOP_SCALE_AUTO);
  const isDesktop = !phonePreview && vw >= desktopMinWidth;
  const scaleW = vw / TZ_DESIGN_WIDTH;
  const scaleH = vh / TZ_DESIGN_HEIGHT;
  let scale = 1;

  if (phonePreview) {
    scale = 1;
  } else if (lockedDesktopScale) {
    scale = lockedDesktopScale;
  } else if (isDesktop) {
    scale = Math.min(TZ_DESKTOP_SCALE_AUTO, scaleH);
  } else {
    scale = Math.min(scaleW, scaleH);
  }

  const locked = Boolean(lockedDesktopScale);
  document.documentElement.classList.toggle('tz-desktop-scale-locked', locked);
  document.documentElement.dataset.desktopScale = locked ? String(lockedDesktopScale) : 'auto';
  document.documentElement.dataset.uiScale = String(scale);
  document.documentElement.style.setProperty('--tz-ui-scale', String(scale));

  const scaleHost = document.querySelector('.tz-scale-host');
  const stage = document.querySelector('.tz-stage');

  if (scaleHost && stage) {
    stage.style.zoom = '';
    stage.style.transform = '';
  } else if (stage) {
    stage.style.zoom = String(scale);
    if (!('zoom' in stage.style)) {
      stage.style.transform = scale === 1 ? '' : `scale(${scale})`;
      stage.style.transformOrigin = 'top center';
    } else {
      stage.style.transform = '';
    }
  }

  applyViewportLock();

  window.__journalApi?.syncJournalDialogTop?.();
  window.__journalApi?.syncJournalLayoutHits?.();
  window.dispatchEvent(new CustomEvent('tilezilla:ui-scale-changed', { detail: { scale, locked } }));
  return scale;
}

export function wireUiScaleListeners() {
  window.addEventListener('resize', applyUiScale);
  window.visualViewport?.addEventListener('resize', applyUiScale);
  window.visualViewport?.addEventListener('scroll', applyUiScale);
}
