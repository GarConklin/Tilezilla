/**
 * Buy hint tokens — coming-soon art popup (Buy-Hints.png).
 */

let menuApi = null;

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
    || $('buyHintsRoot')?.hidden === false
  );
}

export function openBuyHintsPopup() {
  const root = $('buyHintsRoot');
  if (!root) return;
  menuApi?.closeAll?.();
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  requestAnimationFrame(() => {
    root.scrollTop = 0;
    $('buyHintsExitBtn')?.focus();
  });
}

export function closeBuyHintsPopup() {
  const root = $('buyHintsRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  if (!anyModalOpen()) {
    document.body.classList.remove('tz-modal-open');
  }
}

export function initBuyHintsPopup(options = {}) {
  menuApi = options.menuApi || menuApi;

  $('buyHintsBackdrop')?.addEventListener('click', closeBuyHintsPopup);
  $('buyHintsExitBtn')?.addEventListener('click', closeBuyHintsPopup);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('buyHintsRoot')?.hidden) return;
    closeBuyHintsPopup();
  });
}

export function wireBuyHintsTriggers() {
  for (const id of ['hintTokenAddBtnUse', 'hintTokenAddBtnCount']) {
    $(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      openBuyHintsPopup();
    });
  }
  document.querySelector('.tz-hints__add')?.addEventListener('click', (e) => {
    e.preventDefault();
    openBuyHintsPopup();
  });
}
