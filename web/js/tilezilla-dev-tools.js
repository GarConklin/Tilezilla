/**
 * Dev-only tools in the Tilezilla shell — known solutions, load board, level jump.
 */

import { isDevUser, syncDevUserUi } from './tilezilla-dev-user.js';

function $(id) {
  return document.getElementById(id);
}

let getApp = () => null;
let menuApi = null;
let onForceDiscovery = () => {};
let selectedKnownIndex = null;

async function renderRoutePreview(canvas, level, placements, app) {
  if (!canvas || !app?.renderSolutionPreview) return;
  await app.renderSolutionPreview(canvas, placements, { level });
}

function mountLevelPickers() {
  const host = $('devLevelPickerHost');
  if (!host || host.dataset.mounted === '1') return;
  const specs = [
    ['boardSizeSelect', 'Board size'],
    ['tierSelect', 'Tier'],
    ['levelSelect', 'Level'],
  ];
  for (const [id, label] of specs) {
    const el = $(id);
    if (!el) continue;
    const wrap = document.createElement('label');
    wrap.className = 'tz-dev-level-pick';
    const span = document.createElement('span');
    span.className = 'tz-dev-level-pick__label';
    span.textContent = label;
    wrap.appendChild(span);
    wrap.appendChild(el);
    host.appendChild(wrap);
  }
  host.dataset.mounted = '1';
}

async function selectKnownSolution(entry, level, app) {
  selectedKnownIndex = entry.index;
  $('devKnownPreviewWrap').hidden = false;
  $('devKnownPreviewLabel').textContent = entry.label;
  await renderRoutePreview($('devKnownPreview'), level, entry.placements, app);

  $('devKnownList')?.querySelectorAll('.tz-found-list__item').forEach((btn) => {
    btn.classList.toggle('tz-found-list__item--active', btn.dataset.index === String(entry.index));
  });
}

export async function refreshDevToolsPanel() {
  if (!isDevUser(getApp()?.state?.userId)) return;

  mountLevelPickers();
  selectedKnownIndex = null;
  $('devKnownPreviewWrap').hidden = true;

  const app = getApp();
  const data = app ? await app.getDevKnownSolutions() : { entries: [], total: 0, level: null };
  const { entries, total, level } = data;

  $('devKnownSummary').textContent = total
    ? `${total} known solution${total === 1 ? '' : 's'} for ${level?.id || 'this puzzle'}`
    : 'No known solutions loaded for this puzzle.';

  const list = $('devKnownList');
  list.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'tz-found-list__empty';
    empty.textContent = 'Solve file missing or empty for this level.';
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
    btn.addEventListener('click', () => { void selectKnownSolution(entry, level, app); });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function loadSelectedKnownOnBoard() {
  const app = getApp();
  if (!app || !Number.isFinite(selectedKnownIndex)) return;
  const ok = await app.applyKnownSolutionToBoard(selectedKnownIndex);
  if (ok) {
    menuApi?.closeAll?.();
    app.setCheckMessage?.(`Loaded known solution #${selectedKnownIndex + 1} on board.`, 'checkWarn');
  }
}

async function loadFirstValidKnown() {
  const app = getApp();
  if (!app) return;
  const ok = await app.loadFirstValidKnownSolution();
  if (ok) {
    menuApi?.closeAll?.();
    app.setCheckMessage?.('Loaded first valid known solution on board.', 'checkWarn');
  } else {
    app.setCheckMessage?.('No valid known solution found for this puzzle.', 'checkError');
  }
}

async function clearBoardForDev() {
  const app = getApp();
  if (!app?.clearBoard) return;
  await app.clearBoard();
  menuApi?.closeAll?.();
  app.setCheckMessage?.('Board cleared.', 'checkWarn');
}

export function initDevTools(options = {}) {
  getApp = options.getApp || getApp;
  menuApi = options.menuApi || null;
  onForceDiscovery = options.onForceDiscovery || onForceDiscovery;

  const userId = getApp()?.state?.userId;
  syncDevUserUi(userId);

  $('menuDevToolsBtn')?.addEventListener('click', () => menuApi?.openPanel?.('dev-tools'));
  $('menuDevForceDiscoveryBtn')?.addEventListener('click', () => {
    menuApi?.closeMenu?.();
    onForceDiscovery();
  });
  $('devForceDiscoveryPopupBtn')?.addEventListener('click', onForceDiscovery);

  $('devLoadKnownBtn')?.addEventListener('click', () => { void loadSelectedKnownOnBoard(); });
  $('devLoadFirstValidBtn')?.addEventListener('click', () => { void loadFirstValidKnown(); });
  $('devClearBoardBtn')?.addEventListener('click', () => { void clearBoardForDev(); });

  return { refreshDevToolsPanel, syncDevUserUi: () => syncDevUserUi(getApp()?.state?.userId) };
}
