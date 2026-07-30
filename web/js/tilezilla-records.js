/** Puzzle Journal — Records tab (daily / adventure leaderboard + personal best). */

import { initFancyScroller } from './fancy-scroller.js';
import {
  applyRecordsLayout,
  applyRecordsLayoutEverywhere,
  applyRecordsTabArt,
  loadRecordsLayout,
  syncRecordsItemVisibility,
} from './records-layout.js';
import { getActiveUsername } from './tilezilla-guest.js';
import {
  buildAdventureRankedEntries,
  buildRankedEntries,
  fetchAdventureLeaderboardRows,
  fetchLeaderboardRows,
  fetchPersonalBestPartitions,
  getGuestLeaderboardPreview,
  partitionLeaderboardByHints,
  renderRecordsList,
  resolveDailyChallengeHeader,
  resolveGuestPlacementSummary,
  resolveLastDailyCompletion,
  setGuestPlacementBanner,
  setRecordsHeaderFields,
  syncRecordsHeaderVisibility,
  todayChallengeDateIso,
} from './records-data.js';

const $ = (id) => document.getElementById(id);

let recordsLayout = null;
let activeSubTab = 'leaderboard';
let scrollers = {};
let getApp = () => null;
let onBack = null;
let onClose = null;
let onSubTabChange = null;
let getChallengeDate = () => null;
let getPostDailyLeaderboard = () => false;

function recordsChallengeDateIso() {
  const fromJournal = typeof getChallengeDate === 'function' ? getChallengeDate() : null;
  const iso = String(fromJournal || '').trim().slice(0, 10);
  return iso || todayChallengeDateIso();
}

function recordsModeForTab(tab) {
  if (tab === 'adventure') return 'adventure';
  if (tab === 'personalBest') return 'personal';
  return 'leaderboard';
}

function syncSubTabViews() {
  const panel = $('journalRecordsPanel');
  if (!panel) return;
  panel.dataset.recordsMode = recordsModeForTab(activeSubTab);
  syncRecordsHeaderVisibility(document, { showTime: activeSubTab === 'personalBest' });
  applyRecordsTabArt(recordsLayout, document, activeSubTab);
  if (recordsLayout) {
    const mode = recordsModeForTab(activeSubTab);
    applyRecordsLayoutEverywhere(recordsLayout, document, mode);
    syncRecordsItemVisibility(recordsLayout, document, mode);
  }
  const postDaily = getPostDailyLeaderboard();
  panel.querySelector('[data-records-tab="personalBest"]')
    ?.toggleAttribute('hidden', postDaily);
  panel.querySelector('[data-records-tab="adventure"]')
    ?.toggleAttribute('hidden', postDaily);
}

async function renderLeaderboardLists(progress) {
  const challengeDate = recordsChallengeDateIso();
  const rows = await fetchLeaderboardRows(progress, challengeDate);
  const partitions = partitionLeaderboardByHints(rows);
  const app = getApp();
  const rankOpts = {
    currentUserId: app?.state?.userId,
    currentUsername: getActiveUsername(),
  };
  const zeroEntries = buildRankedEntries(partitions.zero, rankOpts);
  const oneEntries = buildRankedEntries(partitions.one, rankOpts);
  const twoEntries = buildRankedEntries(partitions.two, rankOpts);
  renderRecordsList($('recordsListTop'), zeroEntries);
  renderRecordsList($('recordsListBl'), oneEntries, { emptyText: 'No 1-hint times yet.' });
  renderRecordsList($('recordsListBr'), twoEntries, { emptyText: 'No 2-hint times yet.' });

  const preview = getGuestLeaderboardPreview();
  const placement = resolveGuestPlacementSummary(partitions, preview);
  setGuestPlacementBanner(document, placement);

  const bucket = placement?.hintBucket ?? 0;
  const listId = bucket >= 2 ? 'recordsListBr' : bucket === 1 ? 'recordsListBl' : 'recordsListTop';
  requestAnimationFrame(() => {
    const guestRow = $(listId)?.querySelector('.tz-records-list__row--guest-you');
    guestRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

async function renderAdventureLeaderboardLists() {
  const rows = await fetchAdventureLeaderboardRows();
  const app = getApp();
  const rankOpts = {
    currentUserId: app?.state?.userId,
    currentUsername: getActiveUsername(),
  };
  const all = buildAdventureRankedEntries(rows, rankOpts);
  const top10 = all.slice(0, 10);
  const rest = all.slice(10);
  renderRecordsList($('recordsListTop'), top10, {
    mode: 'adventure',
    emptyText: 'No adventure times yet.',
  });
  renderRecordsList($('recordsListBl'), rest, {
    mode: 'adventure',
    emptyText: rest.length ? '' : 'No rankings beyond top 10 yet.',
  });
  renderRecordsList($('recordsListBr'), [], {
    mode: 'adventure',
    emptyText: '',
  });
  setGuestPlacementBanner(document, null);
}

function renderPersonalBestLists(app) {
  const { zero, one, two } = fetchPersonalBestPartitions(app);
  renderRecordsList($('recordsListTop'), zero, { mode: 'personal', emptyText: 'No 0-hint bests yet.' });
  renderRecordsList($('recordsListBl'), one, { mode: 'personal', emptyText: 'No 1-hint bests yet.' });
  renderRecordsList($('recordsListBr'), two, { mode: 'personal', emptyText: 'No 2-hint bests yet.' });
}

export async function refreshRecordsView() {
  const app = getApp();
  const progress = app?.progress;

  if (app?.state && !app.state.levelStatsById) {
    const { loadLevelStatsIndex } = await import('./level-catalog.js');
    app.state.levelStatsById = (await loadLevelStatsIndex())?.byId || {};
  }

  if (activeSubTab === 'leaderboard') {
    const challengeDate = recordsChallengeDateIso();
    await renderLeaderboardLists(progress);
    const header = await resolveDailyChallengeHeader({ challengeDate });
    setRecordsHeaderFields(document, { ...header, showTime: false });
  } else if (activeSubTab === 'adventure') {
    await renderAdventureLeaderboardLists();
    setRecordsHeaderFields(document, {
      date: 'Adventure',
      puzzleId: 'Paths · Time · Hints',
      time: '—',
      showTime: false,
    });
  } else {
    renderPersonalBestLists(app);
    const last = resolveLastDailyCompletion(app);
    setRecordsHeaderFields(document, {
      ...(last || { date: '—', puzzleId: '—', time: '—' }),
      showTime: true,
    });
    setGuestPlacementBanner(document, null);
  }

  for (const scroller of Object.values(scrollers)) {
    scroller?.sync?.();
  }
}

export async function applyRecordsLayoutFromDisk({ force = false } = {}) {
  recordsLayout = await loadRecordsLayout({ force });
  const mode = recordsModeForTab(activeSubTab);
  applyRecordsLayoutEverywhere(recordsLayout, document, mode);
  syncRecordsItemVisibility(recordsLayout, document, mode);
  syncRecordsHeaderVisibility(document, { showTime: activeSubTab === 'personalBest' });
  applyRecordsTabArt(recordsLayout, document, activeSubTab);
  for (const scroller of Object.values(scrollers)) {
    scroller?.sync?.();
  }
  return recordsLayout;
}

function activateRecordsSubTab(tab) {
  activeSubTab = tab;
  syncSubTabViews();
  if (typeof onSubTabChange === 'function') onSubTabChange(tab);
  refreshRecordsView();
}

function wireScroller(key, scrollId, scrollerId, trackId, pinId) {
  scrollers[key] = initFancyScroller({
    scrollEl: $(scrollId),
    scrollerRoot: $(scrollerId),
    trackEl: $(trackId),
    pinEl: $(pinId),
    alwaysVisible: true,
  });
}

export function initRecordsPanel({
  getApp: getAppFn,
  getPostDailyLeaderboard: getPostDailyLeaderboardFn,
  getChallengeDate: getChallengeDateFn,
  onBack: onBackFn,
  onClose: onCloseFn,
  onSubTabChange: onSubTabChangeFn,
} = {}) {
  getApp = getAppFn || (() => null);
  getPostDailyLeaderboard = getPostDailyLeaderboardFn || (() => false);
  getChallengeDate = getChallengeDateFn || (() => null);
  onBack = onBackFn || null;
  onClose = onCloseFn || null;
  onSubTabChange = onSubTabChangeFn || null;

  const panel = $('journalRecordsPanel');
  if (!panel) return null;

  wireScroller('top', 'recordsListTop', 'recordsScrollerTop', 'recordsScrollerTopTrack', 'recordsScrollerTopPin');
  wireScroller('bl', 'recordsListBl', 'recordsScrollerBl', 'recordsScrollerBlTrack', 'recordsScrollerBlPin');
  wireScroller('br', 'recordsListBr', 'recordsScrollerBr', 'recordsScrollerBrTrack', 'recordsScrollerBrPin');

  panel.querySelector('[data-records-tab="leaderboard"]')?.addEventListener('click', () => {
    activateRecordsSubTab('leaderboard');
  });
  panel.querySelector('[data-records-tab="adventure"]')?.addEventListener('click', () => {
    activateRecordsSubTab('adventure');
  });
  panel.querySelector('[data-records-tab="personalBest"]')?.addEventListener('click', () => {
    activateRecordsSubTab('personalBest');
  });

  $('recordsBtnBack')?.addEventListener('click', () => {
    if (typeof onBack === 'function') onBack();
  });
  $('recordsBtnClose')?.addEventListener('click', () => {
    if (typeof onClose === 'function') onClose();
  });

  window.addEventListener('tilezilla:records-layout-saved', () => {
    void applyRecordsLayoutFromDisk({ force: true });
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'tilezilla:records-layout-version') {
      void applyRecordsLayoutFromDisk({ force: true });
    }
  });

  void applyRecordsLayoutFromDisk();
  syncSubTabViews();

  return {
    refreshRecordsView,
    applyRecordsLayoutFromDisk,
    setRecordsSubTab: activateRecordsSubTab,
    showRecordsPanel(show) {
      panel.toggleAttribute('hidden', !show);
      if (show) {
        void applyRecordsLayoutFromDisk({ force: true }).then(() => refreshRecordsView());
      }
    },
  };
}
