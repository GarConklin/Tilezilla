/**
 * In-game Explorer profile overlay (Logged-in.png) — registered or guest.
 */

import {
  ACTIVE_USER_KEY,
  REGISTERED_USER_ID_KEY,
  getConvertedGuestCode,
  getGuestCode,
  isGuestUser,
  isRegisteredUser,
  logoutRegisteredUser,
  showLoginRequired,
} from './tilezilla-guest.js';
import { refreshProfileOverlayLayoutFromDisk } from './auth-screen-layout.js';
import { refreshProfilePassportStats } from './profile-passport-data.js';
import { refreshProfileRankIcons } from './profile-rank-icons.js';

function $(id) {
  return document.getElementById(id);
}

const DAILY_RESULTS_KEY = 'snake_daily_results_v1';

function readLocalDailyResults() {
  try {
    const raw = localStorage.getItem(DAILY_RESULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function formatDailyExportPayload() {
  const store = readLocalDailyResults();
  const rows = Object.values(store)
    .filter((row) => row && typeof row === 'object')
    .sort((a, b) => String(a.challengeDate || '').localeCompare(String(b.challengeDate || '')));

  const activeUser = localStorage.getItem(ACTIVE_USER_KEY) || '';
  const userId = localStorage.getItem(REGISTERED_USER_ID_KEY) || '';
  const summaryLines = rows.map((row) => {
    const sec = Math.max(0, Number(row.completionTimeSeconds) || 0);
    const mm = Math.floor(sec / 60);
    const ss = String(sec % 60).padStart(2, '0');
    const pending = row.serverSyncPending ? ' PENDING' : '';
    return `${row.challengeDate || '?'}  ${row.levelId || '?'}  ${mm}:${ss}  hints=${row.hintsUsedCount ?? 0}  user=${row.username || row.userId || '?'}${pending}`;
  });

  return {
    exportedAt: new Date().toISOString(),
    deviceHint: 'phone-local-storage',
    activeUser,
    userId,
    count: rows.length,
    summary: summaryLines,
    dailyResults: store,
  };
}

function setDailyExportStatus(text) {
  const el = $('dailyExportStatus');
  if (el) el.textContent = text || '';
}

export function openLocalDailyExport() {
  const root = $('dailyExportRoot');
  const ta = $('dailyExportText');
  if (!root || !ta) return;

  const payload = formatDailyExportPayload();
  ta.value = JSON.stringify(payload, null, 2);
  root.hidden = false;
  document.body.classList.add('tz-modal-open');
  setDailyExportStatus(
    payload.count
      ? `${payload.count} local daily score(s) found for this phone.`
      : 'No local daily scores found on this phone (storage empty or already cleared).',
  );

  // Heal any pending rows while the user copies the dump.
  void import('./tilezilla-progress-sync.js')
    .then(({ submitPendingDailyLeaderboard }) => {
      const progress = window.__app?.progress;
      if (!progress) return null;
      return submitPendingDailyLeaderboard(progress, { includeConfirmedMissing: true });
    })
    .then((result) => {
      if (result?.flushed) {
        setDailyExportStatus(
          `Exported ${payload.count} score(s). Also pushed ${result.flushed} to the server.`,
        );
      }
    })
    .catch(() => { /* optional */ });

  requestAnimationFrame(() => {
    ta.focus();
    ta.select();
  });
}

function closeLocalDailyExport() {
  const root = $('dailyExportRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  if ($('profileOverlayRoot')?.hidden) {
    document.body.classList.remove('tz-modal-open');
  }
  setDailyExportStatus('');
}

function syncExportDailyButton() {
  const btn = $('profileOverlayExportDaily');
  if (!btn) return;
  btn.hidden = !isRegisteredUser();
}

async function copyDailyExportText() {
  const ta = $('dailyExportText');
  if (!ta) return;
  ta.focus();
  ta.select();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(ta.value);
      setDailyExportStatus('Copied. Paste into Messages/Email and send to Gar / Cursor.');
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    const ok = document.execCommand('copy');
    setDailyExportStatus(
      ok
        ? 'Copied. Paste into Messages/Email and send to Gar / Cursor.'
        : 'Copy failed — use Select all, then Copy from the phone menu.',
    );
  } catch {
    setDailyExportStatus('Copy failed — use Select all, then Copy from the phone menu.');
  }
}

function wireDailyExportUi() {
  $('dailyExportBackdrop')?.addEventListener('click', closeLocalDailyExport);
  $('dailyExportClose')?.addEventListener('click', closeLocalDailyExport);
  $('dailyExportSelectAll')?.addEventListener('click', () => {
    const ta = $('dailyExportText');
    if (!ta) return;
    ta.focus();
    ta.select();
    setDailyExportStatus('Selected — use Copy, or the phone Copy menu.');
  });
  $('dailyExportCopy')?.addEventListener('click', () => {
    void copyDailyExportText();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('dailyExportRoot')?.hidden) return;
    closeLocalDailyExport();
  });
  if (typeof window !== 'undefined') {
    window.__exportLocalDailyResults = openLocalDailyExport;
  }
}

let menuApi = null;
let onDaily = null;
let onAdventure = null;
let onRandom = null;
let onDeferredBootFallback = null;
let deferBootPuzzle = false;
let profilePathChosen = false;
let profileStatsPromise = null;

async function waitForCatalogReady(maxMs = 30000) {
  const { ensureCatalogReady, isCatalogReady } = await import('./level-catalog.js');
  if (isCatalogReady()) return;
  await ensureCatalogReady(maxMs);
}

async function reloadAppProgress() {
  const app = window.__app;
  if (app?.progress?.load) {
    app.progress.data = app.progress.load();
  }
  return app?.progress ?? null;
}

async function refreshProfileOverlayStats(root) {
  if (profileStatsPromise) return profileStatsPromise;

  profileStatsPromise = (async () => {
    await waitForCatalogReady();
    const app = window.__app;
    if (app?.state && !app.state.levelStatsById) {
      const { loadLevelStatsIndex } = await import('./level-catalog.js');
      const stats = await loadLevelStatsIndex();
      app.state.levelStatsById = stats?.byId || {};
    }
    const progress = await reloadAppProgress();
    // Rank icons and passport slots are independent after progress is local.
    await Promise.all([
      refreshProfileRankIcons(progress, root),
      refreshProfilePassportStats({ root }),
    ]);
  })();

  try {
    await profileStatsPromise;
  } finally {
    profileStatsPromise = null;
  }
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
  syncExportDailyButton();
  // Apply saved tuner layout before the overlay is visible so the badge/slots
  // do not jump from CSS defaults into place a minute later.
  await ensureProfileOverlayLayout(document);
  openProfileOverlayPopup();
  void refreshProfileOverlayStats(overlayRoot || document).catch((err) => {
    console.warn('Profile overlay stats:', err);
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

  $('profileOverlayExportDaily')?.addEventListener('click', () => {
    openLocalDailyExport();
  });
  wireDailyExportUi();
  syncExportDailyButton();

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
