/**
 * Rank advancement popup — shown after challenge level-up when crossing a rank boundary.
 */

import {
  applyRankAwardLayout,
  initRankAwardLayout,
  rankAwardPlaqueSrc,
  reloadRankAwardLayout,
} from './rank-award-layout.js';
import { playSfx } from './tilezilla-sfx.js';

let menuApi = null;
let pendingResolve = null;

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
    || $('challengeBeginRoot')?.hidden === false
    || $('useHintConfirmRoot')?.hidden === false
    || $('rankAwardRoot')?.hidden === false
  );
}

function dismissRankAward() {
  const root = $('rankAwardRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove('tz-modal-open');
  }
  const done = pendingResolve;
  pendingResolve = null;
  done?.();
}

export function closeRankAwardPopup() {
  dismissRankAward();
}

export function showRankAwardPopup({ rankId } = {}) {
  return new Promise((resolve) => {
    const root = $('rankAwardRoot');
    if (!root) {
      resolve();
      return;
    }

    const n = Math.max(1, Math.min(9, Math.round(Number(rankId) || 1)));
    const art = $('rankAwardArt');
    if (art) {
      art.src = rankAwardPlaqueSrc(n);
      art.alt = `New adventure rank reached — rank ${n}`;
    }

    const title = $('rankAwardTitle');
    if (title) title.textContent = 'New adventure rank reached';

    pendingResolve = resolve;
    menuApi?.closeAll?.();
    root.hidden = false;
    document.body.classList.add('tz-modal-open');
    playSfx('rankUp');

    requestAnimationFrame(() => {
      root.scrollTop = 0;
      $('rankAwardContinueBtn')?.focus();
    });
  });
}

export function initRankAwardPopup(options = {}) {
  menuApi = options.menuApi || menuApi;

  $('rankAwardBackdrop')?.addEventListener('click', dismissRankAward);
  $('rankAwardContinueBtn')?.addEventListener('click', dismissRankAward);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('rankAwardRoot')?.hidden) return;
    dismissRankAward();
  });

  void initRankAwardLayout().catch((err) => console.warn('Rank award layout:', err));

  window.addEventListener('tilezilla:rank-award-layout-saved', () => {
    void reloadRankAwardLayout()
      .then((layout) => applyRankAwardLayout(layout))
      .catch((err) => console.warn('Rank award layout reload:', err));
  });

  window.__rankAwardPopup = {
    open: showRankAwardPopup,
    close: closeRankAwardPopup,
  };
}
