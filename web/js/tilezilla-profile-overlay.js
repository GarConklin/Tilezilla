/**
 * In-game Explorer profile overlay (Logged-in.png) — registered or guest.
 */

import {
  ACTIVE_USER_KEY,
  getGuestCode,
  isGuestUser,
  isRegisteredUser,
  logoutRegisteredUser,
  showLoginRequired,
} from './tilezilla-guest.js';
import { applyAuthScreenLayout, getProfileOverlayLayoutTarget, loadAuthScreenLayout } from './auth-screen-layout.js';
import { refreshProfilePassportStats } from './profile-passport-data.js';
import { refreshProfileRankIcons } from './profile-rank-icons.js';

function $(id) {
  return document.getElementById(id);
}

let menuApi = null;
let onDaily = null;
let onAdventure = null;
let onRandom = null;

function refreshProfileFields() {
  const nameEl = $('profileOverlayName');
  const guestNote = $('profileOverlayGuestNote');
  const logoutBtn = $('profileOverlayNavLogout');
  if (!nameEl) return;

  if (isRegisteredUser()) {
    nameEl.textContent = localStorage.getItem(ACTIVE_USER_KEY) || 'Explorer';
    if (guestNote) guestNote.hidden = true;
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

export async function openProfileOverlay() {
  try {
    const layout = await loadAuthScreenLayout({ preferFile: true, screenKey: 'profile' });
    const target = getProfileOverlayLayoutTarget(document);
    if (target) applyAuthScreenLayout(layout, 'profile', target);
  } catch (err) {
    console.warn('Profile overlay layout:', err);
  }
  refreshProfileFields();
  void refreshProfileRankIcons();
  void refreshProfilePassportStats({ root: document.getElementById('profileOverlayRoot') || document });
  openProfileOverlayPopup();
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
      showLoginRequired();
      return;
    }
    closeProfileOverlayPopup();
    void onAdventure?.();
  });

  $('profileOverlayNavRandom')?.addEventListener('click', () => {
    if (isGuestUser()) {
      closeProfileOverlayPopup();
      showLoginRequired();
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

  return { openProfileOverlay, closeProfileOverlayPopup };
}
