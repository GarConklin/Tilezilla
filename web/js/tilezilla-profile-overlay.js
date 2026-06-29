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

async function waitForAppLevels(maxMs = 12000) {
  if (window.__app?.state?.allLevels?.length) return;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (window.__app?.state?.allLevels?.length) return;
  }
}

async function refreshProfileOverlayStats(root) {
  clearAdventureCatalogStatsCache();
  await waitForAppLevels();
  await refreshProfileRankIcons(window.__app?.progress ?? null, root);
  await refreshProfilePassportStats({ root });
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
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
}

function closeProfileOverlayPopup() {
  const root = $('profileOverlayRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove('tz-modal-open');
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
  await ensureProfileOverlayLayout(document);
  refreshProfileFields();
  await refreshProfileOverlayStats(overlayRoot || document);
  await ensureProfileOverlayLayout(document);
  openProfileOverlayPopup();
  requestAnimationFrame(() => {
    void refreshProfileOverlayStats(overlayRoot || document);
    void ensureProfileOverlayLayout(document);
  });
}

export function initProfileOverlay({
  menuApi: menu,
  onDaily: dailyFn,
  onAdventure: adventureFn,
  onRandom: randomFn,
} = {}) {
  menuApi = menu || null;
  onDaily = dailyFn || null;
  onAdventure = adventureFn || null;
  onRandom = randomFn || null;

  const root = $('profileOverlayRoot');
  if (!root) return null;

  $('profileOverlayBackdrop')?.addEventListener('click', closeProfileOverlayPopup);
  $('profileOverlayClose')?.addEventListener('click', closeProfileOverlayPopup);
  $('profileOverlayBack')?.addEventListener('click', closeProfileOverlayPopup);

  $('profileOverlayNavDaily')?.addEventListener('click', () => {
    closeProfileOverlayPopup();
    void onDaily?.();
  });

  $('profileOverlayNavAdventure')?.addEventListener('click', () => {
    if (isGuestUser()) {
      closeProfileOverlayPopup();
      showLoginRequired({ source: 'adventure' });
      return;
    }
    closeProfileOverlayPopup();
    void onAdventure?.();
  });

  $('profileOverlayNavRandom')?.addEventListener('click', () => {
    if (isGuestUser()) {
      closeProfileOverlayPopup();
      showLoginRequired({ source: 'random' });
      return;
    }
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

  void ensureProfileOverlayLayout(document);

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

// Apply tuned layout as soon as overlay markup exists (tilezilla-v2.html body is parsed before modules run).
if (document.getElementById('profileOverlayRoot')) {
  void refreshProfileOverlayLayoutFromDisk();
}
