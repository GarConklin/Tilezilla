/**
 * Invalid solve plaque — replaces the check-solve overlay when validation fails.
 */

function $(id) {
  return document.getElementById(id);
}

let getApp = () => null;
let onDismiss = async () => {};
let onResumeBoardEdit = () => {};

export function showInvalidSolve() {
  const root = document.querySelector('.tz-app');
  const panel = $('previewCheckSolve');
  if (!root || !panel) return;

  root.dataset.validation = 'invalid';
  panel.setAttribute('aria-hidden', 'false');
  panel.querySelector('.tz-preview-check-solve__ready')?.setAttribute('aria-hidden', 'true');
  panel.querySelector('.tz-preview-check-solve__invalid')?.setAttribute('aria-hidden', 'false');
  const title = $('previewTitle');
  if (title) title.textContent = 'Invalid Solve';
  $('previewInvalidOkayBtn')?.focus({ preventScroll: true });
}

export function hideInvalidSolve() {
  const root = document.querySelector('.tz-app');
  const panel = $('previewCheckSolve');
  if (root?.dataset.validation === 'invalid') {
    root.dataset.validation = '';
  }
  if (panel) {
    panel.setAttribute('aria-hidden', 'true');
    panel.querySelector('.tz-preview-check-solve__ready')?.setAttribute('aria-hidden', 'true');
    panel.querySelector('.tz-preview-check-solve__invalid')?.setAttribute('aria-hidden', 'true');
  }
}

export function isInvalidSolveShowing() {
  return document.querySelector('.tz-app')?.dataset?.validation === 'invalid';
}

async function handleOkay() {
  hideInvalidSolve();
  await onDismiss();
}

/** Player edits the board while invalid plaque is open — dismiss without undoing again. */
export function dismissInvalidSolveForBoardEdit() {
  if (!isInvalidSolveShowing()) return false;
  hideInvalidSolve();
  onResumeBoardEdit();
  return true;
}

export function initInvalidSolve(options = {}) {
  getApp = options.getApp || getApp;
  onDismiss = options.onDismiss || onDismiss;
  onResumeBoardEdit = options.onResumeBoardEdit || onResumeBoardEdit;

  $('previewInvalidOkayBtn')?.addEventListener('click', () => {
    void handleOkay();
  });

  window.__invalidSolve = {
    show: showInvalidSolve,
    hide: hideInvalidSolve,
    isShowing: isInvalidSolveShowing,
    dismissForBoardEdit: dismissInvalidSolveForBoardEdit,
    getApp,
  };
}
