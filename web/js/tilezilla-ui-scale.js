/**
 * Shared 390×844 viewport scaling (same as tilezilla-bootstrap.js).
 */

export const TZ_DESIGN_WIDTH = 390;
export const TZ_DESIGN_HEIGHT = 844;
const TZ_DESKTOP_SCALE = 2;
const TZ_DESKTOP_MIN_WIDTH = TZ_DESIGN_WIDTH * TZ_DESKTOP_SCALE;

function viewportSize() {
  const vp = window.visualViewport;
  return {
    vw: vp?.width ?? window.innerWidth,
    vh: vp?.height ?? window.innerHeight,
  };
}

export function applyUiScale() {
  const phonePreview = document.documentElement.classList.contains('tz-phone-preview');
  const { vw: layoutVw, vh } = viewportSize();
  const vw = phonePreview ? Math.min(TZ_DESIGN_WIDTH, layoutVw) : layoutVw;
  const isDesktop = !phonePreview && vw >= TZ_DESKTOP_MIN_WIDTH;
  const scaleW = vw / TZ_DESIGN_WIDTH;
  const scaleH = vh / TZ_DESIGN_HEIGHT;
  let scale = 1;

  if (isDesktop) {
    scale = Math.min(TZ_DESKTOP_SCALE, scaleH);
  } else {
    scale = Math.min(scaleW, scaleH);
  }

  const stage = document.querySelector('.tz-stage');
  if (stage) {
    stage.style.zoom = String(scale);
    if (!('zoom' in stage.style)) {
      stage.style.transform = scale === 1 ? '' : `scale(${scale})`;
      stage.style.transformOrigin = 'top center';
    } else {
      stage.style.transform = '';
    }
  }

  document.documentElement.dataset.uiScale = String(scale);
  document.documentElement.style.setProperty('--tz-ui-scale', String(scale));
  window.__journalApi?.syncJournalDialogTop?.();
  window.__journalApi?.syncJournalLayoutHits?.();
  return scale;
}

export function wireUiScaleListeners() {
  window.visualViewport?.addEventListener('resize', applyUiScale);
  window.visualViewport?.addEventListener('scroll', applyUiScale);
}
