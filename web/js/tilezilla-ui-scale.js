/**
 * Shared 390×844 viewport scaling (same as tilezilla-bootstrap.js).
 */

import { getDesktopScalePreference } from './tilezilla-settings.js';

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

  if (lockedDesktopScale) {
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
