/**
 * Gameplay display preferences — presentation only (localStorage until account sync).
 */

export const GAMEPLAY_DEFAULTS = {
  liveEdgeValidation: 'OFF',
  showTileBorders: 'ON',
  usedTileBehavior: 'REMOVE',
};

const STORAGE_KEY = 'tilezilla-gameplay-settings';

export function loadGameplaySettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...GAMEPLAY_DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      liveEdgeValidation: parsed.liveEdgeValidation === 'ON' ? 'ON' : 'OFF',
      showTileBorders: parsed.showTileBorders === 'OFF' ? 'OFF' : 'ON',
      usedTileBehavior: parsed.usedTileBehavior === 'GREY_OUT' ? 'GREY_OUT' : 'REMOVE',
    };
  } catch {
    return { ...GAMEPLAY_DEFAULTS };
  }
}

export function saveGameplaySettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function syncSegment(group, value) {
  group.querySelectorAll('[data-value]').forEach((btn) => {
    const on = btn.dataset.value === value;
    btn.classList.toggle('tz-segment--active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function readPanel(panel) {
  const read = (name) => panel.querySelector(`[data-setting="${name}"] .tz-segment--active`)?.dataset.value;
  return {
    liveEdgeValidation: read('liveEdgeValidation') === 'ON' ? 'ON' : 'OFF',
    showTileBorders: read('showTileBorders') === 'OFF' ? 'OFF' : 'ON',
    usedTileBehavior: read('usedTileBehavior') === 'GREY_OUT' ? 'GREY_OUT' : 'REMOVE',
  };
}

function bindSegment(root, onChange) {
  root.querySelectorAll('.tz-segment[data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.closest('[data-setting]');
      if (!group) return;
      syncSegment(group, btn.dataset.value);
      onChange(readPanel(root));
    });
  });
}

function renderPanel(root, settings) {
  root.querySelectorAll('[data-setting]').forEach((group) => {
    const key = group.dataset.setting;
    syncSegment(group, settings[key] ?? GAMEPLAY_DEFAULTS[key]);
  });
}

export function initSettingsUi({ onChange }) {
  const menuRoot = document.getElementById('menuRoot');
  const settingsRoot = document.getElementById('settingsRoot');
  const gameplayPanel = document.getElementById('settingsGameplay');
  if (!menuRoot || !settingsRoot || !gameplayPanel) return;

  let current = loadGameplaySettings();
  renderPanel(gameplayPanel, current);

  const openMenu = () => {
    menuRoot.hidden = false;
    document.body.classList.add('tz-modal-open');
  };
  const closeMenu = () => {
    menuRoot.hidden = true;
    if (settingsRoot.hidden) document.body.classList.remove('tz-modal-open');
  };
  const openSettings = () => {
    menuRoot.hidden = true;
    settingsRoot.hidden = false;
    document.body.classList.add('tz-modal-open');
  };
  const closeSettings = () => {
    settingsRoot.hidden = true;
    document.body.classList.remove('tz-modal-open');
  };

  const apply = (next) => {
    current = { ...current, ...next };
    saveGameplaySettings(current);
    renderPanel(gameplayPanel, current);
    onChange(current);
  };

  bindSegment(gameplayPanel, apply);

  document.querySelector('.tz-menu-btn')?.addEventListener('click', openMenu);
  document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
  document.getElementById('menuCloseBtn')?.addEventListener('click', closeMenu);
  document.getElementById('menuOpenSettingsBtn')?.addEventListener('click', openSettings);
  document.getElementById('settingsBackBtn')?.addEventListener('click', closeSettings);
  document.getElementById('settingsCloseBtn')?.addEventListener('click', closeSettings);

  menuRoot.querySelector('.tz-sheet-backdrop')?.addEventListener('click', closeMenu);
  settingsRoot.querySelector('.tz-sheet-backdrop')?.addEventListener('click', closeSettings);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!settingsRoot.hidden) closeSettings();
    else if (!menuRoot.hidden) closeMenu();
  });

  return {
    getSettings: () => ({ ...current }),
    openSettings,
    openMenu,
  };
}
