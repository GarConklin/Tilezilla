/**
 * Reset board when hint tiles are on the board — Remove Hints vs Keep Hints.
 */

import {
  applyResetHintTilesLayout,
  initResetHintTilesLayout,
  loadResetHintTilesLayout,
  reloadResetHintTilesLayout,
} from './reset-hint-tiles-layout.js';

let menuApi = null;
let onRemoveHints = async () => {};
let onKeepHints = async () => {};
let layoutReady = loadResetHintTilesLayout();

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
    || $('useHintConfirmRoot')?.hidden === false
    || $('buyHintsRoot')?.hidden === false
    || $('resetHintTilesRoot')?.hidden === false
  );
}

export function closeResetHintTilesPopup() {
  const root = $('resetHintTilesRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove('tz-modal-open');
  }
}

export function openResetHintTilesPopup() {
  const root = $('resetHintTilesRoot');
  if (!root) return;
  menuApi?.closeAll?.();
  void layoutReady.then((layout) => applyResetHintTilesLayout(layout));
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  requestAnimationFrame(() => {
    root.scrollTop = 0;
    $('resetHintTilesCloseBtn')?.focus();
  });
}

async function handleRemoveHints() {
  closeResetHintTilesPopup();
  await onRemoveHints();
}

async function handleKeepHints() {
  closeResetHintTilesPopup();
  await onKeepHints();
}

export function initResetHintTilesPopup({
  menuApi: menu,
  onRemoveHints: onRemove,
  onKeepHints: onKeep,
} = {}) {
  menuApi = menu || menuApi;
  onRemoveHints = onRemove || onRemoveHints;
  onKeepHints = onKeep || onKeepHints;

  const root = $('resetHintTilesRoot');
  if (!root) return null;

  $('resetHintTilesBackdrop')?.addEventListener('click', closeResetHintTilesPopup);
  $('resetHintTilesCloseBtn')?.addEventListener('click', closeResetHintTilesPopup);
  $('resetHintRemoveBtn')?.addEventListener('click', () => { void handleRemoveHints(); });
  $('resetHintKeepBtn')?.addEventListener('click', () => { void handleKeepHints(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeResetHintTilesPopup();
  });

  void initResetHintTilesLayout().then((layout) => {
    layoutReady = Promise.resolve(layout);
  });

  window.addEventListener('tilezilla:reset-hint-tiles-layout-saved', () => {
    layoutReady = reloadResetHintTilesLayout().then((layout) => {
      applyResetHintTilesLayout(layout);
      return layout;
    });
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'tilezilla:reset-hint-tiles-layout-version') {
      layoutReady = reloadResetHintTilesLayout().then((layout) => {
        applyResetHintTilesLayout(layout);
        return layout;
      });
    }
  });

  return { openResetHintTilesPopup, closeResetHintTilesPopup };
}
