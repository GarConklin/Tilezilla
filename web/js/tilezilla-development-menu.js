/**
 * Development submenu — scroll popup for dev tools, tuners, and QA links.
 */

let menuApi = null;
let onForceDiscovery = () => {};
let openDevToolsPanel = () => {};

function $(id) {
  return document.getElementById(id);
}

function anyOtherModalOpen() {
  return (
    $('menuRoot')?.hidden === false
    || $('menuPanelRoot')?.hidden === false
    || $('settingsRoot')?.hidden === false
    || $('puzzleInfoRoot')?.hidden === false
    || $('stuckPopupRoot')?.hidden === false
    || $('hintRulesRoot')?.hidden === false
    || $('cartographersJournalRoot')?.hidden === false
    || $('tilesetPickerRoot')?.hidden === false
  );
}

function syncModalOpen() {
  const root = $('developmentMenuRoot');
  if (!root || root.hidden) return;
  if (!anyOtherModalOpen()) {
    document.body.classList.add('tz-modal-open');
  }
}

export function closeDevelopmentMenu() {
  const root = $('developmentMenuRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  if (!anyOtherModalOpen()) {
    document.body.classList.remove('tz-modal-open');
  }
}

export function openDevelopmentMenu() {
  const root = $('developmentMenuRoot');
  if (!root) return;

  menuApi?.closeMenu?.();
  menuApi?.closePanel?.();

  root.hidden = false;
  document.body.classList.add('tz-modal-open');
}

export function initDevelopmentMenu({
  menuApi: menu,
  onForceDiscovery: onForce,
  openDevToolsPanel: openPanel,
} = {}) {
  menuApi = menu || null;
  onForceDiscovery = onForce || onForceDiscovery;
  openDevToolsPanel = openPanel || openDevToolsPanel;

  const root = $('developmentMenuRoot');
  if (!root) return null;

  $('menuDevelopmentBtn')?.addEventListener('click', () => {
    openDevelopmentMenu();
  });

  root.querySelector('.tz-development-root__backdrop')?.addEventListener('click', closeDevelopmentMenu);
  $('developmentMenuCloseBtn')?.addEventListener('click', closeDevelopmentMenu);

  $('developmentDevToolsBtn')?.addEventListener('click', () => {
    closeDevelopmentMenu();
    openDevToolsPanel();
  });

  $('developmentForceDiscoveryBtn')?.addEventListener('click', () => {
    menuApi?.closeMenu?.();
    closeDevelopmentMenu();
    onForceDiscovery();
  });

  $('developmentSwitchPlayerLink')?.addEventListener('click', () => {
    menuApi?.closeAll?.();
    closeDevelopmentMenu();
  });

  $('developmentTunersLink')?.addEventListener('click', () => {
    menuApi?.closeAll?.();
    closeDevelopmentMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeDevelopmentMenu();
  });

  return { openDevelopmentMenu, closeDevelopmentMenu, syncModalOpen };
}
