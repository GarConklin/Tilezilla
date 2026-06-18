/**
 * Challenge Begin gate + in-challenge progress screen.
 */

import { adventureSolveCount } from './adventure-path.js';
import {
  applyChallengeBeginLayout,
  challengeBeginBaseSrc,
  challengeBeginButtonSrc,
  challengeBeginOverlaySrc,
  loadChallengeBeginLayout,
  reloadChallengeBeginLayout,
} from './challenge-begin-layout.js';

let menuApi = null;
let onContinueSearch = async () => {};
let pendingJob = null;
let currentMode = 'begin';

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
  );
}

function applyChallengeButtonArt(found, total, mode) {
  const beginBtn = $('challengeBeginBtn');
  const continueBtn = $('challengeBeginContinueBtn');
  const beginImg = beginBtn?.querySelector('img');
  const continueImg = continueBtn?.querySelector('img');
  if (beginImg) beginImg.src = challengeBeginButtonSrc(0, total, 'begin');
  if (continueImg) continueImg.src = challengeBeginButtonSrc(found, total, 'progress');
  if (continueBtn) {
    const t = Math.max(1, Math.round(Number(total) || 1));
    const f = Math.min(Math.max(0, Math.round(Number(found) || 0)), t);
    continueBtn.setAttribute(
      'aria-label',
      mode === 'progress' && f >= t ? 'Level up and continue' : 'Continue search',
    );
  }
}

function setMode(mode) {
  currentMode = mode;
  const root = $('challengeBeginRoot');
  if (!root) return;
  const isGate = mode === 'begin';
  root.classList.toggle('tz-challenge-begin--gate', isGate);
  root.classList.toggle('tz-challenge-begin--progress', mode === 'progress');
  const bg = $('challengeBeginBg');
  if (bg) bg.src = challengeBeginBaseSrc(mode);
  const title = $('challengeBeginTitle');
  if (title) title.textContent = isGate ? 'Challenge Gate' : 'Challenge Progress';
}

function finishPending(result) {
  const job = pendingJob;
  pendingJob = null;
  if (!job) return;
  if (result && typeof job.onConfirm === 'function') {
    void job.onConfirm();
    return;
  }
  if (!result && typeof job.onCancel === 'function') {
    job.onCancel();
  }
}

export function closeChallengeBeginPopup() {
  const root = $('challengeBeginRoot');
  if (!root) return;
  root.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove('tz-modal-open');
  }
}

function openChallengeDialog({ mode, onConfirm, onCancel, focusId }) {
  const root = $('challengeBeginRoot');
  if (!root) {
    void onConfirm?.();
    return;
  }

  pendingJob = { onConfirm, onCancel };
  menuApi?.closeAll?.();
  setMode(mode);

  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  requestAnimationFrame(() => {
    root.scrollTop = 0;
    $(focusId)?.focus();
  });
}

export function openChallengeBeginPopup({ found = 0, total = 1, onBegin, onCancel } = {}) {
  // Gate overlay: CP-Overlay-0of{total}.png + BeginChallenge-btn
  const overlay = $('challengeBeginOverlay');
  if (overlay) {
    overlay.src = challengeBeginOverlaySrc(found, total);
    overlay.alt = `${found} of ${total} routes — begin challenge`;
  }
  applyChallengeButtonArt(0, total, 'begin');
  openChallengeDialog({
    mode: 'begin',
    onConfirm: onBegin,
    onCancel,
    focusId: 'challengeBeginBtn',
  });
}

export function openChallengeProgressPopup({ found = 1, total = 1, onContinue, onCancel } = {}) {
  // Progress overlay + ContinueSearch or Level-UpandContinue when complete
  const overlay = $('challengeBeginOverlay');
  if (overlay) {
    overlay.src = challengeBeginOverlaySrc(found, total);
    overlay.alt = `${found} of ${total} routes found`;
  }
  applyChallengeButtonArt(found, total, 'progress');
  openChallengeDialog({
    mode: 'progress',
    onConfirm: onContinue,
    onCancel,
    focusId: 'challengeBeginContinueBtn',
  });
}

export function shouldShowChallengeProgress(levelId) {
  if (document.querySelector('.tz-app')?.dataset?.screen !== 'adventure') return false;
  const meta = window.__adventureMeta;
  return !!(meta?.isChallenge && meta.levelId === levelId);
}

export function getChallengeProgressState(levelId, progress) {
  const meta = window.__adventureMeta || {};
  const required = meta.requiredSolutionCount || 1;
  const found = adventureSolveCount(progress, levelId, { isChallenge: true });
  return { found, required, incomplete: found < required };
}

/**
 * Show gate when entering an adventure challenge, or run load immediately.
 * @returns {Promise<boolean>}
 */
export function gateAdventureChallengeBegin({
  isChallenge = false,
  found = 0,
  required = 1,
  onBegin,
  onCancel,
} = {}) {
  if (!isChallenge || found >= required) {
    return Promise.resolve(onBegin?.()).then(() => true);
  }

  if (found > 0) {
    return new Promise((resolve) => {
      openChallengeProgressPopup({
        found,
        total: required,
        onContinue: async () => {
          closeChallengeBeginPopup();
          await onBegin?.();
          resolve(true);
        },
        onCancel: () => {
          closeChallengeBeginPopup();
          onCancel?.();
          resolve(false);
        },
      });
    });
  }

  return new Promise((resolve) => {
    openChallengeBeginPopup({
      found: 0,
      total: required,
      onBegin: async () => {
        closeChallengeBeginPopup();
        await onBegin?.();
        resolve(true);
      },
      onCancel: () => {
        closeChallengeBeginPopup();
        onCancel?.();
        resolve(false);
      },
    });
  });
}

export function showChallengeProgressAfterSolve({ found, total } = {}) {
  return new Promise((resolve) => {
    openChallengeProgressPopup({
      found,
      total,
      onContinue: async () => {
        closeChallengeBeginPopup();
        await onContinueSearch();
        resolve(true);
      },
      onCancel: () => {
        closeChallengeBeginPopup();
        resolve(false);
      },
    });
  });
}

function handleBegin() {
  finishPending(true);
}

function handleContinue() {
  finishPending(true);
}

function handleBackdrop() {
  if (currentMode === 'progress') {
    finishPending(true);
    return;
  }
  finishPending(false);
}

export function initChallengeBeginPopup(options = {}) {
  menuApi = options.menuApi || menuApi;
  onContinueSearch = options.onContinueSearch || onContinueSearch;

  $('challengeBeginBackdrop')?.addEventListener('click', handleBackdrop);
  $('challengeBeginBtn')?.addEventListener('click', handleBegin);
  $('challengeBeginContinueBtn')?.addEventListener('click', handleContinue);

  void loadChallengeBeginLayout()
    .then((layout) => applyChallengeBeginLayout(layout))
    .catch((err) => console.warn('Challenge begin layout:', err));

  window.addEventListener('tilezilla:challenge-begin-layout-saved', () => {
    void reloadChallengeBeginLayout()
      .then((layout) => applyChallengeBeginLayout(layout))
      .catch((err) => console.warn('Challenge begin layout reload:', err));
  });

  window.__challengeBeginPopup = {
    open: openChallengeBeginPopup,
    openProgress: openChallengeProgressPopup,
    close: closeChallengeBeginPopup,
    gate: gateAdventureChallengeBegin,
    shouldShowProgress: shouldShowChallengeProgress,
    getProgressState: getChallengeProgressState,
    showProgressAfterSolve: showChallengeProgressAfterSolve,
  };
}
