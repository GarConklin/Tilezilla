/**
 * Tileset gallery — fullscreen scroll popup from Settings.
 */

import {
  TILESET_SAMPLE_TILES,
  formatTilesetDisplayName,
  listTilesetIds,
} from './tileset-preferences.js';
import { getTilesetBgSetup, toTileImgUrl } from './tile-bg-setup.js';

let getApp = () => null;
let menuApi = null;
let settingsApi = null;
let onTilesetEquipped = () => {};

function $(id) {
  return document.getElementById(id);
}

function tilesetTileSrc(tileSets, tilesetId, tileKey) {
  const rel = tileSets?.tilesets?.[tilesetId]?.[tileKey];
  return rel ? toTileImgUrl(rel) : '';
}

function renderGallery() {
  const list = $('tilesetPickerList');
  const app = getApp();
  if (!list || !app?.state?.tileSets) return;

  const tileSets = app.state.tileSets;
  const active = app.state.activeTileset;
  list.replaceChildren();

  for (const id of listTilesetIds(tileSets)) {
    const setup = getTilesetBgSetup(tileSets, id);
    const bgUrl = toTileImgUrl(setup.mbImage);
    const equipped = id === active;

    const card = document.createElement('article');
    card.className = 'tz-tileset-card';
    card.dataset.tilesetId = id;

    const name = document.createElement('h4');
    name.className = 'tz-tileset-card__name';
    name.textContent = formatTilesetDisplayName(id);

    const preview = document.createElement('div');
    preview.className = 'tz-tileset-card__preview';

    const bg = document.createElement('div');
    bg.className = 'tz-tileset-card__bg';
    if (bgUrl) bg.style.backgroundImage = `url("${bgUrl}")`;

    const tiles = document.createElement('div');
    tiles.className = 'tz-tileset-card__tiles';
    tiles.setAttribute('aria-label', 'Sample tiles');
    for (const key of TILESET_SAMPLE_TILES) {
      const src = tilesetTileSrc(tileSets, id, key);
      const wrap = document.createElement('span');
      wrap.className = 'tz-tileset-card__tile';
      wrap.title = key;
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = key;
        img.loading = 'lazy';
        wrap.appendChild(img);
      } else {
        wrap.textContent = key;
      }
      tiles.appendChild(wrap);
    }

    preview.appendChild(bg);
    preview.appendChild(tiles);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-tileset-card__action';
    if (equipped) {
      btn.classList.add('tz-tileset-card__action--equipped');
      btn.textContent = 'EQUIPPED';
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
    } else {
      btn.textContent = 'SELECT';
      btn.addEventListener('click', () => {
        void equipTileset(id);
      });
    }

    card.appendChild(name);
    card.appendChild(preview);
    card.appendChild(btn);
    list.appendChild(card);
  }
}

async function equipTileset(id) {
  const app = getApp();
  if (!app?.setActiveTileset) return;
  const ok = await app.setActiveTileset(id);
  if (!ok) return;
  onTilesetEquipped(id);
  renderGallery();
  settingsApi?.refreshTilesetLabel?.();
}

export function openTilesetPicker() {
  const root = $('tilesetPickerRoot');
  if (!root) return;

  settingsApi?.closeSettings?.();
  renderGallery();

  root.hidden = false;
  document.body.classList.add('tz-modal-open');

  const scroll = $('tilesetPickerScroll');
  if (scroll) scroll.scrollTop = 0;

  requestAnimationFrame(() => {
    $('tilesetPickerBackBtn')?.focus();
  });
}

export function closeTilesetPicker({ returnToSettings = false } = {}) {
  const root = $('tilesetPickerRoot');
  if (!root) return;
  root.hidden = true;

  if (returnToSettings) {
    settingsApi?.openSettings?.();
    return;
  }

  if (
    $('menuRoot')?.hidden !== false
    && $('menuPanelRoot')?.hidden !== false
    && $('settingsRoot')?.hidden !== false
    && $('hintRulesRoot')?.hidden !== false
    && $('hintMenuRoot')?.hidden !== false
    && $('stuckPopupRoot')?.hidden !== false
    && $('puzzleInfoRoot')?.hidden !== false
  ) {
    document.body.classList.remove('tz-modal-open');
  }
}

export function initTilesetPicker({
  getApp: getAppFn,
  menuApi: menu,
  settingsApi: settings,
  onEquipped,
} = {}) {
  getApp = getAppFn || (() => null);
  menuApi = menu || null;
  settingsApi = settings || null;
  onTilesetEquipped = onEquipped || onTilesetEquipped;

  const root = $('tilesetPickerRoot');
  if (!root) return null;

  $('tilesetPickerBackBtn')?.addEventListener('click', () => {
    closeTilesetPicker({ returnToSettings: true });
  });

  $('tilesetPickerCloseBtn')?.addEventListener('click', () => {
    closeTilesetPicker();
    menuApi?.closeAll?.();
  });

  root.querySelector('.tz-tileset-picker-root__backdrop')?.addEventListener('click', () => {
    closeTilesetPicker();
    menuApi?.closeAll?.();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeTilesetPicker({ returnToSettings: true });
  });

  return {
    openTilesetPicker,
    closeTilesetPicker,
    renderGallery,
  };
}
