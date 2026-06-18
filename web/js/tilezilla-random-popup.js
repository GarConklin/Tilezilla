/**
 * Random puzzle confirmation popup — remain on adventure path or venture into archives.
 */

import {
  applyRandomPopupLayout,
  loadRandomPopupLayout,
  reloadRandomPopupLayout,
} from './random-popup-layout.js';

let getApp = () => null;
let menuApi = null;
let onRemainOnPath = async () => {};
let onVentureForth = async () => {};

function $(id) {
  return document.getElementById(id);
}

function anyModalOpen() {
  return (
    $('menuRoot')?.hidden === false
    || $('menuPanelRoot')?.hidden === false
    || $('settingsRoot')?.hidden === false
    || $('hintMenuRoot')?.hidden === false
    || $('stuckPopupRoot')?.hidden === false
    || $('randomPopupRoot')?.hidden === false
  );
}

export function openRandomPuzzlePopup() {
  const root = $('randomPopupRoot');
  if (!root) return;
  menuApi?.closeAll?.();
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  requestAnimationFrame(() => {
    root.scrollTop = 0;
    $('randomRemainBtn')?.focus();
  });
}

export function closeRandomPuzzlePopup() {
  const root = $('randomPopupRoot');
  if (!root) return;
  root.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove('tz-modal-open');
  }
}

async function handleRemainOnPath() {
  closeRandomPuzzlePopup();
  await onRemainOnPath();
}

async function handleVentureForth() {
  closeRandomPuzzlePopup();
  await onVentureForth();
}

export function initRandomPuzzlePopup(options = {}) {
  getApp = options.getApp || getApp;
  menuApi = options.menuApi || menuApi;
  onRemainOnPath = options.onRemainOnPath || onRemainOnPath;
  onVentureForth = options.onVentureForth || onVentureForth;

  $('randomPopupBackdrop')?.addEventListener('click', closeRandomPuzzlePopup);
  $('randomCloseBtn')?.addEventListener('click', closeRandomPuzzlePopup);
  $('randomRemainBtn')?.addEventListener('click', () => { void handleRemainOnPath(); });
  $('randomVentureBtn')?.addEventListener('click', () => { void handleVentureForth(); });

  void loadRandomPopupLayout()
    .then((layout) => applyRandomPopupLayout(layout))
    .catch((err) => console.warn('Random popup layout:', err));

  window.addEventListener('tilezilla:random-popup-layout-saved', () => {
    void reloadRandomPopupLayout()
      .then((layout) => applyRandomPopupLayout(layout))
      .catch((err) => console.warn('Random popup layout reload:', err));
  });

  window.addEventListener('storage', (e) => {
    if (
      e.key === 'tilezilla:layouts:random-popup'
      || e.key === 'tilezilla:layouts:random-popup:pending'
      || e.key === 'tilezilla:random-popup-layout-version'
    ) {
      void reloadRandomPopupLayout()
        .then((layout) => applyRandomPopupLayout(layout))
        .catch((err) => console.warn('Random popup layout reload:', err));
    }
  });

  window.__randomPuzzlePopup = {
    open: openRandomPuzzlePopup,
    close: closeRandomPuzzlePopup,
    getApp,
  };
}
