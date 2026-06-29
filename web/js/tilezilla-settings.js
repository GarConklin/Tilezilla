/**
 * Gameplay display preferences — presentation only (localStorage until account sync).
 */

export const GAMEPLAY_DEFAULTS = {
  liveEdgeValidation: 'OFF',
  showTileBorders: 'ON',
  usedTileBehavior: 'REMOVE',
  phonePreview: 'OFF',
  previewPlacementAnchor: 'ON',
  previewPlacementAnchorStyle: 'LIGHT',
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
      phonePreview: parsed.phonePreview === 'ON' ? 'ON' : 'OFF',
      previewPlacementAnchor: parsed.previewPlacementAnchor === 'OFF' ? 'OFF' : 'ON',
      previewPlacementAnchorStyle: parsed.previewPlacementAnchorStyle === 'DARK' ? 'DARK' : 'LIGHT',
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
    phonePreview: read('phonePreview') === 'ON' ? 'ON' : 'OFF',
    previewPlacementAnchor: read('previewPlacementAnchor') === 'OFF' ? 'OFF' : 'ON',
    previewPlacementAnchorStyle: read('previewPlacementAnchorStyle') === 'DARK' ? 'DARK' : 'LIGHT',
  };
}

function syncAnchorStyleRowVisibility(panel, settings) {
  const row = panel.querySelector('[data-setting="previewPlacementAnchorStyle"]');
  if (row) row.hidden = settings.previewPlacementAnchor === 'OFF';
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
  syncAnchorStyleRowVisibility(root, settings);
}

export function isPhonePreviewMode() {
  return document.documentElement.classList.contains('tz-phone-preview');
}

export function applyPhonePreviewMode(on) {
  document.documentElement.classList.toggle('tz-phone-preview', on);
  window.dispatchEvent(new CustomEvent('tilezilla:phone-preview-changed', {
    detail: { on: Boolean(on) },
  }));
}

export function initSettingsUi({ onChange, menuApi, onOpenTileset, getTilesetLabel }) {
  const settingsRoot = document.getElementById('settingsRoot');
  const gameplayPanel = document.getElementById('settingsGameplay');
  if (!settingsRoot || !gameplayPanel) return;

  let current = loadGameplaySettings();
  renderPanel(gameplayPanel, current);

  const refreshTilesetLabel = () => {
    const el = document.getElementById('settingsTilesetName');
    if (!el || !getTilesetLabel) return;
    el.textContent = getTilesetLabel();
  };

  const openSettings = () => {
    refreshTilesetLabel();
    settingsRoot.hidden = false;
    document.body.classList.add('tz-modal-open');
  };
  const closeSettings = () => {
    settingsRoot.hidden = true;
    const menuRoot = document.getElementById('menuRoot');
    const menuPanelRoot = document.getElementById('menuPanelRoot');
    const tilesetPickerRoot = document.getElementById('tilesetPickerRoot');
    const menuOpen = menuRoot && !menuRoot.hidden;
    const panelOpen = menuPanelRoot && !menuPanelRoot.hidden;
    const tilesetOpen = tilesetPickerRoot && !tilesetPickerRoot.hidden;
    if (!menuOpen && !panelOpen && !tilesetOpen) document.body.classList.remove('tz-modal-open');
  };

  const apply = (next) => {
    current = { ...current, ...next };
    saveGameplaySettings(current);
    renderPanel(gameplayPanel, current);
    onChange(current);
  };

  bindSegment(gameplayPanel, apply);

  const closeFromBack = () => {
    closeSettings();
    if (menuApi?.settingsEntry?.() === 'menu') menuApi?.openMenu?.();
  };
  const closeFromExit = () => {
    closeSettings();
    menuApi?.closeAll?.();
  };

  document.getElementById('settingsBackBtn')?.addEventListener('click', closeFromBack);
  document.getElementById('settingsCloseBtn')?.addEventListener('click', closeFromExit);

  document.getElementById('settingsOpenTilesetBtn')?.addEventListener('click', () => {
    onOpenTileset?.();
  });

  settingsRoot.querySelector('.tz-settings-root__backdrop')?.addEventListener('click', closeFromExit);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!settingsRoot.hidden) {
      closeSettings();
      if (menuApi?.settingsEntry?.() === 'menu') menuApi?.openMenu?.();
    }
  });

  return {
    getSettings: () => ({ ...current }),
    openSettings,
    closeSettings,
    refreshTilesetLabel,
  };
}
