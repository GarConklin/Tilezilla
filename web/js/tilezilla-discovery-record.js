/**
 * Discovery / duplicate-solution plaques — overlays the preview after Check Solution.
 */

import {
  DEFAULT_DISCOVERY_LAYOUT,
  DEFAULT_DISCOVERY_TEXTS,
  applyDiscoveryPlaqueLayout,
  applyDiscoveryPopupLayout,
  applyDiscoveryVariantClasses,
  getDiscoveryVariantKey,
  loadDiscoveryRecordLayout,
  resolveShowAdvance,
} from './discovery-record-layout.js';
import {
  isAdventurePuzzleComplete,
  loadAdventurePath,
} from './adventure-path.js';

function $(id) {
  return document.getElementById(id);
}

let getApp = () => null;
let onContinueSearch = async () => {};
let onAdvancePath = async () => {};
let onViewFoundSolve = async () => {};
let onOpenFoundSolutions = async () => {};
let onResumeBoardEdit = () => {};
let onAdventureProgress = async () => {};
let pendingViewFoundIndex = null;
let pendingRecordMode = null;
let pendingDailyLeaderboardFlow = false;
let onDailyViewLeaderboard = async () => {};

function isDailyChallengeScreen() {
  return document.querySelector('.tz-app')?.dataset?.screen === 'daily-challenge';
}

function isAdventureScreen() {
  return document.querySelector('.tz-app')?.dataset?.screen === 'adventure';
}

function formatTime(sec) {
  const total = Math.max(0, Number(sec) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseFoundAt(value) {
  if (!value) return null;
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function formatDateTime(iso) {
  const d = parseFoundAt(iso);
  if (!d) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Date line + time line for the already-found plaque (FIRST FOUND area). */
export function formatPreviouslyFoundLines(foundAt) {
  const d = parseFoundAt(foundAt);
  if (!d) return '—';
  const dateLine = d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  const timeLine = d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  return `${dateLine}\n${timeLine}`;
}

function solutionLabel(res) {
  if (res?.bonus) return '★';
  if (Number.isFinite(res?.index)) return String(res.index + 1);
  return '—';
}

function duplicateTitle(res) {
  if (res?.bonus) return 'ROUTE ALREADY DOCUMENTED';
  return discoveryTexts.duplicateTitle ?? 'SOLUTION ALREADY DISCOVERED';
}

let discoveryTexts = { ...DEFAULT_DISCOVERY_TEXTS };

export function setDiscoveryRecordTexts(texts) {
  discoveryTexts = {
    duplicateNote: texts?.duplicateNote ?? DEFAULT_DISCOVERY_TEXTS.duplicateNote,
    duplicateTitle: texts?.duplicateTitle ?? DEFAULT_DISCOVERY_TEXTS.duplicateTitle,
  };
}

export function getDiscoveryRecordTexts() {
  return { ...discoveryTexts };
}

export const DISCOVERY_RECORD_IDS = {
  root: 'discoveryRecord',
  title: 'discoveryRecordTitle',
  note: 'discoveryRecordNote',
  solutionTotal: 'discoverySolutionTotal',
  puzzleId: 'discoveryPuzzleId',
  solutionFound: 'discoverySolutionFound',
  time: 'discoveryTime',
  tokens: 'discoveryTokens',
  btnContinue: 'discoveryContinueBtn',
  btnAdvance: 'discoveryAdvanceBtn',
  btnViewFound: 'discoveryViewFoundBtn',
  btnBook: 'discoveryFoundBookBtn',
};

function fieldEl(id, ids) {
  return document.getElementById(ids?.[id] ?? DISCOVERY_RECORD_IDS[id] ?? id);
}

function setFieldText(id, text, ids) {
  const el = fieldEl(id, ids);
  if (!el) return;
  el.replaceChildren(document.createTextNode(String(text ?? '—')));
}

let discoveryLayout = null;
let discoveryLayoutPromise = null;

export function setDiscoveryRecordLayout(layout) {
  discoveryLayout = layout;
}

/** Defaults immediately so first open never paints without positions. */
export function ensureDefaultDiscoveryRecordLayout() {
  if (discoveryLayout) return discoveryLayout;
  discoveryLayout = { ...DEFAULT_DISCOVERY_LAYOUT };
  applyDiscoveryPlaqueLayout(discoveryLayout);
  return discoveryLayout;
}

/** Resolve disk layout (or defaults) before showing the plaque. */
export async function ensureDiscoveryRecordLayout() {
  ensureDefaultDiscoveryRecordLayout();
  if (discoveryLayoutPromise) return discoveryLayoutPromise;
  discoveryLayoutPromise = (async () => {
    try {
      const layout = await loadDiscoveryRecordLayout();
      discoveryLayout = layout;
      applyDiscoveryPlaqueLayout(layout);
      return layout;
    } catch (err) {
      console.warn('Discovery record layout:', err);
      return discoveryLayout;
    } finally {
      discoveryLayoutPromise = null;
    }
  })();
  return discoveryLayoutPromise;
}

export function getDiscoveryRecordLayout() {
  return discoveryLayout;
}

export function applyRecordMode(root, mode, ids = DISCOVERY_RECORD_IDS, showAdvance = false, options = {}) {
  if (!root) return;
  applyDiscoveryVariantClasses(root, mode, showAdvance);

  const note = fieldEl('note', ids);
  const viewFoundBtn = fieldEl('btnViewFound', ids);
  const bookBtn = fieldEl('btnBook', ids);
  const advanceBtn = fieldEl('btnAdvance', ids);
  const continueBtn = fieldEl('btnContinue', ids);
  const showViewFound = options.showViewFound ?? (mode === 'duplicate');

  if (note) note.hidden = mode !== 'duplicate';
  if (viewFoundBtn) viewFoundBtn.hidden = !showViewFound;
  if (bookBtn) bookBtn.hidden = options.showFoundBook === false;
  if (bookBtn && !bookBtn.hidden) {
    bookBtn.setAttribute(
      'aria-label',
      mode === 'duplicate' ? 'View found solutions' : 'Chess piece — journal',
    );
  }
  if (advanceBtn) advanceBtn.hidden = !showAdvance;
  if (continueBtn) continueBtn.hidden = options.showContinueSearch === false;
  if (continueBtn && options.continueAriaLabel) {
    continueBtn.setAttribute('aria-label', options.continueAriaLabel);
  }
}

/** Fill discovery plaque fields — same logic as in-game popup (shared with tuner). */
export function applyDiscoveryRecordContent(payload, ids = DISCOVERY_RECORD_IDS) {
  const root = fieldEl('root', ids);
  if (!root) return;

  const mode = payload?.mode === 'duplicate' ? 'duplicate' : 'new';
  const showAdvance = resolveShowAdvance(payload);
  const showViewFound = payload.showViewFound ?? (
    mode === 'duplicate'
    || (mode === 'new' && Number.isFinite(payload?.solutionIndex))
  );
  const showContinueSearch = payload?.showContinueSearch !== false;
  const showFoundBook = payload?.showFoundBook !== false;
  const continueAriaLabel = payload?.continueAriaLabel
    || (payload?.dailyLeaderboardFlow ? 'View today\'s leaderboard' : 'Continue search');
  applyRecordMode(root, mode, ids, showAdvance, {
    showViewFound,
    showContinueSearch,
    showFoundBook,
    continueAriaLabel,
  });
  if (discoveryLayout) {
    applyDiscoveryPopupLayout(
      discoveryLayout,
      getDiscoveryVariantKey(mode, showAdvance),
      root,
    );
  }

  if (mode === 'duplicate') {
    const titleEl = fieldEl('title', ids);
    const noteText = payload.note ?? discoveryTexts.duplicateNote ?? '';
    if (titleEl) titleEl.textContent = payload.title ?? '';
    setFieldText('note', noteText, ids);
    setFieldText('solutionTotal', payload.challengeProgress, ids);
    const noteEl = fieldEl('note', ids);
    if (noteEl) noteEl.hidden = !noteText;
    setFieldText('solutionFound', payload.solutionNumber, ids);
    setFieldText('puzzleId', payload.levelId, ids);
    setFieldText('time', formatPreviouslyFoundLines(payload.foundAt ?? payload.previouslyFound), ids);

    const viewFoundBtn = fieldEl('btnViewFound', ids);
    if (viewFoundBtn) {
      const canView = Number.isFinite(payload.solutionIndex);
      viewFoundBtn.disabled = !canView;
      viewFoundBtn.setAttribute('aria-disabled', canView ? 'false' : 'true');
    }

    const advanceBtn = fieldEl('btnAdvance', ids);
    if (advanceBtn && ids === DISCOVERY_RECORD_IDS) {
      advanceBtn.setAttribute(
        'aria-label',
        showAdvance && isAdventureScreen()
          ? 'Adventure path — next puzzle'
          : 'Advance path — next adventure puzzle',
      );
    }
  } else {
    const titleEl = fieldEl('title', ids);
    if (titleEl) {
      titleEl.textContent = payload.title
        || (payload.dailyLeaderboardFlow ? 'Daily challenge complete!' : 'Discovery recorded');
    }
    setFieldText('note', '', ids);
    setFieldText('solutionTotal', payload.challengeProgress, ids);
    setFieldText('puzzleId', payload.levelId, ids);
    setFieldText('solutionFound', payload.solutionNumber, ids);
    setFieldText('time', formatTime(payload.elapsedSec), ids);
    setFieldText('tokens', Math.max(0, payload.tokensEarned || 0), ids);

    const viewFoundBtn = fieldEl('btnViewFound', ids);
    if (viewFoundBtn) {
      const canView = Number.isFinite(payload.solutionIndex);
      viewFoundBtn.disabled = !canView;
      viewFoundBtn.setAttribute('aria-disabled', canView ? 'false' : 'true');
    }

    const advanceBtn = fieldEl('btnAdvance', ids);
    if (advanceBtn && ids === DISCOVERY_RECORD_IDS) {
      advanceBtn.setAttribute(
        'aria-label',
        isDailyChallengeScreen() || isAdventureScreen()
          ? 'Advance path — next adventure puzzle'
          : 'Advance path',
      );
    }
  }
}

/** Adventure duplicate/new plaques: advance art only when this path step is fully cleared. */
async function enrichAdventurePayload(payload) {
  if (!isAdventureScreen()) return payload;
  const levelId = payload?.levelId;
  if (!levelId || levelId === '—') return payload;

  const app = getApp();
  const path = await loadAdventurePath();
  const stepComplete = isAdventurePuzzleComplete(app?.progress, path, levelId);

  return { ...payload, showAdvancePath: stepComplete };
}

function showDiscoveryRecord(payload) {
  void showDiscoveryRecordAsync(payload);
}

async function showDiscoveryRecordAsync(payload) {
  const root = $('discoveryRecord');
  if (!root) return;

  // Layout JSON is deferred at boot — wait (or use defaults) so fields/buttons align.
  await ensureDiscoveryRecordLayout();

  const appRoot = document.querySelector('.tz-app');
  appRoot?.classList.add('is-discovery-record');
  if (appRoot) appRoot.dataset.validation = '';
  $('previewCheckSolve')?.setAttribute('aria-hidden', 'true');
  window.__invalidSolve?.hide?.();

  // Apply content + positions before unhiding to avoid a misaligned first paint.
  applyDiscoveryRecordContent(payload);
  pendingRecordMode = payload?.mode === 'duplicate' ? 'duplicate' : 'new';
  pendingDailyLeaderboardFlow = !!payload?.dailyLeaderboardFlow;
  pendingViewFoundIndex = Number.isFinite(payload.solutionIndex) ? payload.solutionIndex : null;

  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');

  void onAdventureProgress();

  void enrichAdventurePayload(payload).then((enriched) => {
    if (!document.querySelector('.tz-app')?.classList.contains('is-discovery-record')) return;
    applyDiscoveryRecordContent(enriched);
    pendingRecordMode = enriched?.mode === 'duplicate' ? 'duplicate' : 'new';
    pendingDailyLeaderboardFlow = !!enriched?.dailyLeaderboardFlow;
    pendingViewFoundIndex = Number.isFinite(enriched.solutionIndex) ? enriched.solutionIndex : null;
  });
}

function hideDiscoveryRecord() {
  const root = $('discoveryRecord');
  if (!root) return;
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  document.querySelector('.tz-app')?.classList.remove('is-discovery-record');
  pendingViewFoundIndex = null;
  pendingRecordMode = null;
  pendingDailyLeaderboardFlow = false;
}

/** Player picked up a board tile while the plaque is open — restore preview + tile bag. */
function resumeForBoardEdit() {
  if (!document.querySelector('.tz-app')?.classList.contains('is-discovery-record')) return false;
  hideDiscoveryRecord();
  onResumeBoardEdit();
  return true;
}

async function handleContinueSearch() {
  if (pendingDailyLeaderboardFlow) {
    hideDiscoveryRecord();
    await onDailyViewLeaderboard();
    return;
  }
  if (await onContinueSearch() === false) return;
  hideDiscoveryRecord();
}

async function handleAdvancePath() {
  if (isDailyChallengeScreen() || isAdventureScreen()) {
    await onAdvancePath();
  } else if (await onContinueSearch() === false) {
    return;
  }
  hideDiscoveryRecord();
}

async function handleViewFoundSolve() {
  const index = pendingViewFoundIndex;
  hideDiscoveryRecord();
  if (Number.isFinite(index)) {
    await onViewFoundSolve(index);
  }
}

async function handleOpenFoundSolutions() {
  const mode = pendingRecordMode;
  const index = pendingViewFoundIndex;
  hideDiscoveryRecord();
  if (mode === 'new' && Number.isFinite(index)) {
    await onViewFoundSolve(index);
    return;
  }
  await onOpenFoundSolutions();
}

function buildChallengeProgress(foundCount, totalKnown) {
  if (totalKnown > 0) return `${foundCount} of ${totalKnown}`;
  return String(foundCount);
}

function puzzleSearchComplete(foundCount, totalKnown) {
  const total = Math.max(0, Number(totalKnown) || 0);
  if (total <= 0) return false;
  return Math.max(0, Number(foundCount) || 0) >= total;
}

function dailyDiscoveryOptions(foundCount, totalKnown) {
  if (!isDailyChallengeScreen()) return null;
  return {
    showAdvancePath: false,
    showFoundBook: false,
    showContinueSearch: true,
    dailyLeaderboardFlow: true,
    continueAriaLabel: 'View today\'s leaderboard',
    showViewFound: false,
  };
}

function buildNewPayload(level, res, outcome, foundCount, totalKnown) {
  const daily = dailyDiscoveryOptions(foundCount, totalKnown);
  let showAdvancePath = daily?.showAdvancePath ?? isDailyChallengeScreen();
  if (isAdventureScreen()) {
    /* Resolved in enrichAdventurePayload when the step is fully cleared. */
    showAdvancePath = false;
  }
  return {
    mode: 'new',
    showAdvancePath,
    showContinueSearch: daily ? true : !puzzleSearchComplete(foundCount, totalKnown),
    ...(daily || {}),
    levelId: level?.id || '—',
    challengeProgress: buildChallengeProgress(foundCount, totalKnown),
    solutionNumber: solutionLabel(res),
    solutionIndex: Number.isFinite(res?.index) ? res.index : null,
    elapsedSec: outcome?.elapsedSec ?? 0,
    tokensEarned: outcome?.tokensEarned ?? 0,
  };
}

function buildDuplicatePayload(level, res, foundCount = 0, totalKnown = 0) {
  const daily = dailyDiscoveryOptions(foundCount, totalKnown);
  return {
    mode: 'duplicate',
    /** Adventure: enriched on show. Daily: leaderboard after fanfare. */
    showAdvancePath: daily ? false : false,
    showContinueSearch: daily ? true : !puzzleSearchComplete(foundCount, totalKnown),
    ...(daily ? {
      dailyLeaderboardFlow: true,
      continueAriaLabel: 'View today\'s leaderboard',
      showFoundBook: false,
    } : {}),
    challengeProgress: buildChallengeProgress(foundCount, totalKnown),
    title: duplicateTitle(res),
    note: discoveryTexts.duplicateNote,
    levelId: level?.id || '—',
    solutionNumber: solutionLabel(res),
    foundAt: res?.foundAt ?? null,
    solutionIndex: Number.isFinite(res?.index) ? res.index : null,
  };
}

export function buildPreviewPayload(showAdvance = true) {
  const app = getApp();
  const lv = app?.state?.currentLevel;
  return {
    mode: 'new',
    showAdvancePath: showAdvance,
    showContinueSearch: true,
    levelId: lv?.id || '5x6-0A-CPZ',
    challengeProgress: buildChallengeProgress(364, 365),
    solutionNumber: '364',
    elapsedSec: 222,
    tokensEarned: 1,
  };
}

export function buildPreviewDuplicatePayload(texts = discoveryTexts, showAdvance = false) {
  return {
    mode: 'duplicate',
    showAdvancePath: showAdvance,
    showContinueSearch: true,
    challengeProgress: buildChallengeProgress(3, 12),
    title: texts.duplicateTitle ?? '',
    note: texts.duplicateNote ?? '',
    levelId: '5x6-0A-CPZ',
    solutionNumber: '364',
    foundAt: new Date().toISOString(),
    solutionIndex: 363,
  };
}

export function initDiscoveryRecord(options = {}) {
  getApp = options.getApp || getApp;
  onContinueSearch = options.onContinueSearch || onContinueSearch;
  onAdvancePath = options.onAdvancePath || onAdvancePath;
  onViewFoundSolve = options.onViewFoundSolve || onViewFoundSolve;
  onOpenFoundSolutions = options.onOpenFoundSolutions || onOpenFoundSolutions;
  onResumeBoardEdit = options.onResumeBoardEdit || onResumeBoardEdit;
  onAdventureProgress = options.onAdventureProgress || onAdventureProgress;
  onDailyViewLeaderboard = options.onDailyViewLeaderboard || onDailyViewLeaderboard;

  $('discoveryContinueBtn')?.addEventListener('click', () => { void handleContinueSearch(); });
  $('discoveryAdvanceBtn')?.addEventListener('click', () => { void handleAdvancePath(); });
  $('discoveryViewFoundBtn')?.addEventListener('click', () => { void handleViewFoundSolve(); });
  $('discoveryFoundBookBtn')?.addEventListener('click', () => { void handleOpenFoundSolutions(); });

  ensureDefaultDiscoveryRecordLayout();
  void ensureDiscoveryRecordLayout();

  window.__discoveryRecord = {
    show: showDiscoveryRecord,
    hide: hideDiscoveryRecord,
    resumeForBoardEdit,
    buildPayload: buildNewPayload,
    buildDuplicatePayload,
    showPreview: () => showDiscoveryRecord(buildPreviewPayload()),
    showPreviewDuplicate: () => showDiscoveryRecord(buildPreviewDuplicatePayload()),
  };
}

export {
  showDiscoveryRecord,
  hideDiscoveryRecord,
  resumeForBoardEdit,
  buildChallengeProgress,
  buildNewPayload,
  buildDuplicatePayload,
  formatTime,
  formatDateTime,
};
