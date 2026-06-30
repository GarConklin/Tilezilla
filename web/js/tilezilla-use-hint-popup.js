import {
  applyUseHintLayout,
  loadUseHintLayout,
  reloadUseHintLayout,
} from './use-hint-layout.js';
let getApp = () => null;
let menuApi = null;
let onConfirmHook = null;
let useHintLayoutReady = loadUseHintLayout();

function refreshUseHintLayout() {
  useHintLayoutReady = reloadUseHintLayout().then((layout) => {
    applyUseHintLayout(layout);
    return layout;
  });
  return useHintLayoutReady;
}

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
  );
}

function syncConfirmState() {
  const app = getApp();
  const cost = app?.getHintCost?.('random') ?? 1;
  const tokens = app?.getGlobalHintTokens?.() ?? 0;
  const randomRemaining = app?.randomHintsRemainingThisPuzzle?.() ?? 0;
  const confirmBtn = $('useHintConfirmBtn');
  const costEl = $('useHintConfirmCost');
  const warnEl = $('useHintConfirmWarn');

  if (costEl) {
    costEl.textContent = `You have ${tokens}.`;
  }

  let blocked = '';
  if (randomRemaining <= 0) blocked = 'No random hints remaining for this puzzle (2 per puzzle).';
  else if (tokens < cost) blocked = 'Not enough hint tokens.';

  if (warnEl) {
    warnEl.hidden = !blocked;
    if (blocked) warnEl.textContent = blocked;
  }
  if (confirmBtn) {
    confirmBtn.disabled = !!blocked;
    confirmBtn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  }
}

export function openUseHintConfirm() {
  const root = $('useHintConfirmRoot');
  if (!root) return;
  menuApi?.closeAll?.();
  syncConfirmState();
  void useHintLayoutReady.then((layout) => applyUseHintLayout(layout));
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  requestAnimationFrame(() => {
    root.scrollTop = 0;
    ($('useHintConfirmBtn')?.disabled ? $('useHintConfirmCloseBtn') : $('useHintConfirmBtn'))?.focus();
  });
}

export function closeUseHintConfirm() {
  const root = $('useHintConfirmRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove('tz-modal-open');
  }
}

export function initUseHintConfirmPopup({
  getApp: getAppFn,
  menuApi: menu,
  onConfirm,
} = {}) {
  getApp = getAppFn || (() => null);
  menuApi = menu || null;
  onConfirmHook = typeof onConfirm === 'function' ? onConfirm : null;

  const root = $('useHintConfirmRoot');
  if (!root) return null;

  $('useHintConfirmBackdrop')?.addEventListener('click', closeUseHintConfirm);
  $('useHintConfirmCloseBtn')?.addEventListener('click', closeUseHintConfirm);
  $('useHintConfirmBtn')?.addEventListener('click', () => {
    if ($('useHintConfirmBtn')?.disabled) return;
    closeUseHintConfirm();
    void onConfirmHook?.();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeUseHintConfirm();
  });

  window.addEventListener('tilezilla:hint-balance', () => {
    if (!root.hidden) syncConfirmState();
  });

  void useHintLayoutReady.then((layout) => applyUseHintLayout(layout));

  window.addEventListener('tilezilla:use-hint-layout-saved', () => {
    void refreshUseHintLayout();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'tilezilla:use-hint-layout-version') void refreshUseHintLayout();
  });

  return { openUseHintConfirm, closeUseHintConfirm };
}

export function wireUseHintConfirmTriggers(openFn) {
  const open = openFn || openUseHintConfirm;
  const plaque = $('hintPlaqueCount');
  const usePlaque = $('hintPlaqueUse');
  const countLabel = $('previewV2HintCountCount');
  const hintSlot = $('previewHintSlot');
  const hintBtn = $('hintBtn');
  const useSlot = $('previewHintUseSlot');

  const handleOpen = (e) => {
    if (e.target.closest('#hintTokenAddBtnCount, .tz-preview-v2-hint-token-add')) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  };

  plaque?.addEventListener('click', handleOpen);
  usePlaque?.addEventListener('click', handleOpen);
  countLabel?.addEventListener('click', handleOpen);
  hintSlot?.addEventListener('click', handleOpen);
  useSlot?.addEventListener('click', (e) => {
    if (e.target.closest('#hintTokenAddBtnCount, .tz-preview-v2-hint-token-add')) return;
    if (useSlot.hasAttribute('hidden')) return;
    handleOpen(e);
  });

  hintBtn?.addEventListener('click', (e) => {
    if (hintBtn?.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    e.stopPropagation();
    void open();
  }, { capture: true });
}
