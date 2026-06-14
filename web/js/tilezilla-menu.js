/**
 * Hamburger menu navigation and informational panels.
 */

import { openPuzzleInfo } from './tilezilla-puzzle-info.js';
import { refreshDevToolsPanel } from './tilezilla-dev-tools.js';
import { openJournal } from './tilezilla-journal.js';

const PANELS = {
  'found-solutions': {
    title: 'Found Solutions',
    elId: 'menuPanelFoundSolutions',
    refresh: refreshFoundSolutions,
  },
  'dev-tools': {
    title: 'Dev Tools',
    elId: 'menuPanelDevTools',
    refresh: refreshDevToolsPanel,
  },
};

let getApp = () => null;
let openStuckFlow = () => {};
let settingsEntry = 'toolbar';
let activePanel = null;
let selectedFoundEntry = null;
let closePanelFn = () => {};
let closeMenuFn = () => {};
let openPanelFn = async () => {};

function $(id) {
  return document.getElementById(id);
}

async function renderRoutePreview(canvas, level, placements, app) {
  if (!canvas || !app?.renderSolutionPreview) return;
  await app.renderSolutionPreview(canvas, placements, { level });
}

async function refreshFoundSolutions() {
  selectedFoundEntry = null;
  $('menuFoundPreviewWrap').hidden = true;

  const app = getApp();
  const data = app ? await app.getMenuFoundSolutions() : { entries: [], total: 0, foundCount: 0 };
  const { entries, total, foundCount, hasKnownTotal } = data;

  if (hasKnownTotal && total > 0) {
    $('menuFoundSummary').textContent = `${foundCount} of ${total} Found`;
  } else {
    $('menuFoundSummary').textContent = foundCount ? `${foundCount} Found` : 'No solutions found yet';
  }

  const list = $('menuFoundList');
  list.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'tz-found-list__empty';
    empty.textContent = 'Solve the puzzle to add solutions here.';
    list.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-found-list__item';
    btn.textContent = entry.label;
    btn.dataset.index = String(entry.index);
    btn.addEventListener('click', () => { void selectFoundSolution(entry, data.level, app); });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function selectFoundSolution(entry, level, app) {
  selectedFoundEntry = entry;
  $('menuFoundPreviewWrap').hidden = false;
  $('menuFoundPreviewLabel').textContent = `${entry.label} — click preview to load on board`;
  await renderRoutePreview($('menuFoundPreview'), level, entry.placements, app);

  $('menuFoundList').querySelectorAll('.tz-found-list__item').forEach((btn) => {
    btn.classList.toggle('tz-found-list__item--active', btn.dataset.index === String(entry.index));
  });
}

async function loadSelectedFoundToBoard(app, { closeMenuAfter = true } = {}) {
  const entry = selectedFoundEntry;
  if (!entry?.placements?.length || !app?.applyPlacementsToBoard) return false;
  const ok = await app.applyPlacementsToBoard(entry.placements, {
    message: `Loaded ${entry.label} onto the board.`,
  });
  if (ok && closeMenuAfter) {
    closePanelFn();
    closeMenuFn();
  }
  return ok;
}

async function openFoundSolutionAt(solutionIndex) {
  const app = getApp();
  const data = app ? await app.getMenuFoundSolutions() : { entries: [], level: null };
  const entry = data.entries.find((e) => e.index === solutionIndex);
  await openPanelFn('found-solutions');
  if (entry && data.level) {
    await selectFoundSolution(entry, data.level, app);
  }
}

export function initMenuUi({ getApp: getAppFn, openStuckFlow: openStuck }) {
  getApp = getAppFn || (() => null);
  openStuckFlow = openStuck || (() => {});

  const menuRoot = $('menuRoot');
  const menuPanelRoot = $('menuPanelRoot');
  const settingsRoot = $('settingsRoot');
  if (!menuRoot || !menuPanelRoot) return null;

  const setModalOpen = (on) => {
    document.body.classList.toggle('tz-modal-open', on);
  };

  const anySheetOpen = () =>
    !menuRoot.hidden || !menuPanelRoot.hidden || (settingsRoot && !settingsRoot.hidden);

  const openMenu = () => {
    menuRoot.hidden = false;
    setModalOpen(true);
  };

  const closeMenu = () => {
    menuRoot.hidden = true;
    if (!anySheetOpen() || (menuPanelRoot.hidden && settingsRoot?.hidden)) {
      setModalOpen(false);
    }
  };

  const closePanel = () => {
    menuPanelRoot.hidden = true;
    activePanel = null;
    if (!anySheetOpen()) setModalOpen(false);
  };

  closeMenuFn = closeMenu;
  closePanelFn = closePanel;

  const openPanel = async (panelId) => {
    const panel = PANELS[panelId];
    if (!panel) return;

    window.__discoveryRecord?.hide?.();
    menuRoot.hidden = true;
    menuPanelRoot.hidden = false;
    activePanel = panelId;
    $('menuPanelTitle').textContent = panel.title;

    Object.values(PANELS).forEach((p) => {
      const el = $(p.elId);
      if (el) el.hidden = p.elId !== panel.elId;
    });

    setModalOpen(true);
    await panel.refresh();
  };

  openPanelFn = openPanel;

  const backFromPanel = () => {
    closePanel();
    openMenu();
  };

  const closeAll = () => {
    closePanel();
    closeMenu();
    if (settingsRoot) settingsRoot.hidden = true;
    setModalOpen(false);
  };

  document.querySelector('.tz-menu-btn')?.addEventListener('click', openMenu);
  $('menuCloseBtn')?.addEventListener('click', closeAll);
  menuRoot.querySelector('.tz-sheet-backdrop')?.addEventListener('click', closeAll);

  $('menuPuzzleInfoBtn')?.addEventListener('click', () => {
    closeMenu();
    void openPuzzleInfo();
  });
  $('menuFoundSolutionsBtn')?.addEventListener('click', () => {
    closeMenu();
    void openJournal({
      mode: 'record',
      levelId: getApp()?.state?.currentLevel?.id,
    });
  });
  $('menuStuckBtn')?.addEventListener('click', () => {
    closeAll();
    void openStuckFlow();
  });
  const api = {
    openSettings: () => {},
  };

  $('menuOpenSettingsBtn')?.addEventListener('click', () => {
    settingsEntry = 'menu';
    menuRoot.hidden = true;
    api.openSettings();
  });

  menuRoot.querySelector('.tz-menu-plaque__hit--switch-player')?.addEventListener('click', () => {
    closeAll();
  });

  $('menuPanelBackBtn')?.addEventListener('click', backFromPanel);
  $('menuPanelCloseBtn')?.addEventListener('click', closeAll);
  menuPanelRoot.querySelector('.tz-sheet-backdrop')?.addEventListener('click', closeAll);

  const previewCanvas = $('menuFoundPreview');
  previewCanvas?.classList.add('tz-route-preview--clickable');
  previewCanvas?.setAttribute('role', 'button');
  previewCanvas?.setAttribute('tabindex', '0');
  previewCanvas?.setAttribute('title', 'Load this solution on the board');
  previewCanvas?.addEventListener('click', () => {
    void loadSelectedFoundToBoard(getApp());
  });
  previewCanvas?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    void loadSelectedFoundToBoard(getApp());
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('stuckPopupRoot') && !$('stuckPopupRoot').hidden) return;
    if ($('puzzleInfoRoot') && !$('puzzleInfoRoot').hidden) return;
    if ($('hintRulesRoot') && !$('hintRulesRoot').hidden) return;
    if (settingsRoot && !settingsRoot.hidden) return;
    if (!menuPanelRoot.hidden) {
      backFromPanel();
      return;
    }
    if (!menuRoot.hidden) closeAll();
  });

  api.openMenu = openMenu;
  api.closeMenu = closeMenu;
  api.closeAll = closeAll;
  api.closePanel = closePanel;
  api.openPanel = openPanel;
  api.openFoundSolutionAt = openFoundSolutionAt;
  api.settingsEntry = () => settingsEntry;
  api.setSettingsEntry = (entry) => { settingsEntry = entry; };
  return api;
}
