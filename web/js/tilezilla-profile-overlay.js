/**
 * In-game Explorer profile overlay (Logged-in.png) — registered or guest.
 */

import {
  ACTIVE_USER_KEY,
  getConvertedGuestCode,
  getGuestCode,
  isGuestUser,
  isRegisteredUser,
  logoutRegisteredUser,
  showLoginRequired,
} from './tilezilla-guest.js';
import { refreshProfileOverlayLayoutFromDisk } from './auth-screen-layout.js';
import { clearAdventureCatalogStatsCache } from './passport-catalog-stats.js';
import { refreshProfilePassportStats } from './profile-passport-data.js';
import { refreshProfileRankIcons } from './profile-rank-icons.js';

function $(id) {
  return document.getElementById(id);
}

let menuApi = null;
let onDaily = null;
let onAdventure = null;
let onRandom = null;
let onDeferredBootFallback = null;
let deferBootPuzzle = false;
let profilePathChosen = false;

async function waitForCatalogReady(maxMs = 12000) {
  const { isCatalogReady } = await import('./level-catalog.js');
  if (isCatalogReady()) return;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (isCatalogReady()) return;
  }
}

async function reloadAppProgress() {
  const app = window.__app;
  if (app?.progress?.load) {
    app.progress.data = app.progress.load();
  }
  return app?.progress ?? null;
}

async function refreshProfileOverlayStats(root) {
  clearAdventureCatalogStatsCache();
  await waitForCatalogReady();
  const app = window.__app;
  if (app?.state && !app.state.levelStatsById) {
    const { loadLevelStatsIndex } = await import('./level-catalog.js');
    const stats = await loadLevelStatsIndex();
    app.state.levelStatsById = stats?.byId || {};
  }
  const progress = await reloadAppProgress();
  await refreshProfileRankIcons(progress, root);
  await refreshProfilePassportStats({ root });
  await window.__syncPlayerChrome?.();
}

function refreshProfileFields() {
  const nameEl = $('profileOverlayName');
  const guestNote = $('profileOverlayGuestNote');
  const logoutBtn = $('profileOverlayNavLogout');
  if (!nameEl) return;

  if (isRegisteredUser()) {
    nameEl.textContent = localStorage.getItem(ACTIVE_USER_KEY) || 'Explorer';
    const converted = getConvertedGuestCode();
    if (guestNote) {
      if (converted) {
        guestNote.hidden = false;
        guestNote.textContent = `Former guest: ${converted}`;
      } else {
        guestNote.hidden = true;
      }
    }
    if (logoutBtn) logoutBtn.hidden = false;
    return;
  }

  const code = getGuestCode() || 'Guest';
  nameEl.textContent = code;
  if (guestNote) {
    guestNote.hidden = false;
    guestNote.textContent = 'Playing as guest — progress is not saved.';
  }
  if (logoutBtn) logoutBtn.hidden = true;
}

function openProfileOverlayPopup() {
  const root = $('profileOverlayRoot');
  if (!root) return;
  const pinfo = $('puzzleInfoRoot');
  if (pinfo) pinfo.hidden = true;
  menuApi?.closeAll?.();
  root.removeAttribute('hidden');
  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('tz-modal-open');
}

function closeProfileOverlayPopup() {
  const root = $('profileOverlayRoot');
  if (!root || root.hidden) return;
  const needsFallback = deferBootPuzzle && !profilePathChosen;
  root.hidden = true;
  document.body.classList.remove('tz-modal-open');
  if (needsFallback) {
    deferBootPuzzle = false;
    void onDeferredBootFallback?.();
  }
}

async function ensureProfileOverlayLayout(root = document) {
  try {
    await refreshProfileOverlayLayoutFromDisk(root);
  } catch (err) {
    console.warn('Profile overlay layout:', err);
  }
}

export async function openProfileOverlay() {
  const overlayRoot = document.getElementById('profileOverlayRoot');
  refreshProfileFields();
  openProfileOverlayPopup();
  void ensureProfileOverlayLayout(document);
  void refreshProfileOverlayStats(overlayRoot || document).then(() => {
    void ensureProfileOverlayLayout(document);
  });
}

export function initProfileOverlay({
  menuApi: menu,
  onDaily: dailyFn,
  onAdventure: adventureFn,
  onRandom: randomFn,
  deferBootPuzzle: deferBoot,
  onDeferredBootFallback: deferredFallback,
} = {}) {
  menuApi = menu || null;
  onDaily = dailyFn || null;
  onAdventure = adventureFn || null;
  onRandom = randomFn || null;
  onDeferredBootFallback = deferredFallback || null;
  deferBootPuzzle = !!deferBoot;
  profilePathChosen = false;

  const root = $('profileOverlayRoot');
  if (!root) return null;

  $('profileOverlayBackdrop')?.addEventListener('click', closeProfileOverlayPopup);
  $('profileOverlayClose')?.addEventListener('click', closeProfileOverlayPopup);
  $('profileOverlayBack')?.addEventListener('click', closeProfileOverlayPopup);

  $('profileOverlayNavDaily')?.addEventListener('click', () => {
    profilePathChosen = true;
    deferBootPuzzle = false;
    closeProfileOverlayPopup();
    void onDaily?.();
  });

  $('profileOverlayNavAdventure')?.addEventListener('click', () => {
    if (isGuestUser()) {
      closeProfileOverlayPopup();
      showLoginRequired({ source: 'adventure' });
      return;
    }
    profilePathChosen = true;
    deferBootPuzzle = false;
    closeProfileOverlayPopup();
    void onAdventure?.();
  });

  $('profileOverlayNavRandom')?.addEventListener('click', () => {
    if (isGuestUser()) {
      closeProfileOverlayPopup();
      showLoginRequired({ source: 'random' });
      return;
    }
    profilePathChosen = true;
    deferBootPuzzle = false;
    closeProfileOverlayPopup();
    onRandom?.();
  });

  $('profileOverlayNavLogout')?.addEventListener('click', () => {
    void logoutRegisteredUser();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (root.hidden) return;
    closeProfileOverlayPopup();
  });

  // iOS Safari has no requestIdleCallback — bare identifier throws ReferenceError
  // (optional chaining does not protect undeclared globals) and aborts shell wiring.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      void ensureProfileOverlayLayout(document);
    });
  } else {
    setTimeout(() => {
      void ensureProfileOverlayLayout(document);
    }, 0);
  }

  window.addEventListener('tilezilla:auth-screen-layout-saved', () => {
    void ensureProfileOverlayLayout(document);
  });

  window.addEventListener('focus', () => {
    if (!root.hidden) {
      void ensureProfileOverlayLayout(document);
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'tilezilla:auth-screen-layout-version') {
      void ensureProfileOverlayLayout(document);
    }
  });

  return { openProfileOverlay, closeProfileOverlayPopup };
}
