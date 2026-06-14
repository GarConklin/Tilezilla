/**
 * Discovery / duplicate-solution plaques — overlays the preview after Check Solution.
 */

import {
  DEFAULT_DISCOVERY_TEXTS,
  applyDiscoveryPopupLayout,
  applyDiscoveryVariantClasses,
  getDiscoveryVariantKey,
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

export function setDiscoveryRecordLayout(layout) {
  discoveryLayout = layout;
}

export function applyRecordMode(root, mode, ids = DISCOVERY_RECORD_IDS, showAdvance = false) {
  if (!root) return;
  applyDiscoveryVariantClasses(root, mode, showAdvance);

  const note = fieldEl('note', ids);
  const viewFoundBtn = fieldEl('btnViewFound', ids);
  const bookBtn = fieldEl('btnBook', ids);
  const advanceBtn = fieldEl('btnAdvance', ids);

  if (note) note.hidden = mode !== 'duplicate';
  if (viewFoundBtn) viewFoundBtn.hidden = mode !== 'duplicate';
  if (bookBtn) bookBtn.hidden = false;
  if (advanceBtn) advanceBtn.hidden = !showAdvance;
}

/** Fill discovery plaque fields — same logic as in-game popup (shared with tuner). */
export function applyDiscoveryRecordContent(payload, ids = DISCOVERY_RECORD_IDS) {
  const root = fieldEl('root', ids);
  if (!root) return;

  const mode = payload?.mode === 'duplicate' ? 'duplicate' : 'new';
  const showAdvance = resolveShowAdvance(payload);
  applyRecordMode(root, mode, ids, showAdvance);
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
    const noteEl = fieldEl('note', ids);
    if (noteEl) noteEl.hidden = !noteText;
    setFieldText('solutionFound', payload.solutionNumber, ids);
    setFieldText('puzzleId', payload.levelId, ids);
    setFieldText('time', formatPreviouslyFoundLines(payload.foundAt ?? payload.previouslyFound), ids);

    const viewFoundBtn = fieldEl('btnViewFound', ids);
    if (viewFoundBtn) {
      viewFoundBtn.hidden = !Number.isFinite(payload.solutionIndex);
    }

    const advanceBtn = fieldEl('btnAdvance', ids);
    if (advanceBtn && ids === DISCOVERY_RECORD_IDS) {
      advanceBtn.setAttribute(
        'aria-label',
        showAdvance && isAdventureScreen()
          ? 'Adventure path — next puzzle'
          : 'Advance path',
      );
    }
  } else {
    const titleEl = fieldEl('title', ids);
    if (titleEl) titleEl.textContent = 'Discovery recorded';
    setFieldText('note', '', ids);
    setFieldText('solutionTotal', payload.challengeProgress, ids);
    setFieldText('puzzleId', payload.levelId, ids);
    setFieldText('solutionFound', payload.solutionNumber, ids);
    setFieldText('time', formatTime(payload.elapsedSec), ids);
    setFieldText('tokens', Math.max(0, payload.tokensEarned || 0), ids);

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

  const enriched = await enrichAdventurePayload(payload);
  applyDiscoveryRecordContent(enriched);
  pendingViewFoundIndex = enriched?.mode === 'duplicate' && Number.isFinite(enriched.solutionIndex)
    ? enriched.solutionIndex
    : null;

  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
  document.querySelector('.tz-app')?.classList.add('is-discovery-record');
  void onAdventureProgress();
}

function hideDiscoveryRecord() {
  const root = $('discoveryRecord');
  if (!root) return;
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  document.querySelector('.tz-app')?.classList.remove('is-discovery-record');
  pendingViewFoundIndex = null;
}

/** Player picked up a board tile while the plaque is open — restore preview + tile bag. */
function resumeForBoardEdit() {
  if (!document.querySelector('.tz-app')?.classList.contains('is-discovery-record')) return false;
  hideDiscoveryRecord();
  onResumeBoardEdit();
  return true;
}

async function handleContinueSearch() {
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
  hideDiscoveryRecord();
  await onOpenFoundSolutions();
}

function buildChallengeProgress(foundCount, totalKnown) {
  if (totalKnown > 0) return `${foundCount} of ${totalKnown}`;
  return String(foundCount);
}

function buildNewPayload(level, res, outcome, foundCount, totalKnown) {
  let showAdvancePath = isDailyChallengeScreen();
  if (isAdventureScreen()) {
    /* Resolved in enrichAdventurePayload — Records vs RecordsNoAdvance, or Already vs AlreadyNoADVPth. */
    showAdvancePath = false;
  }
  return {
    mode: 'new',
    showAdvancePath,
    levelId: level?.id || '—',
    challengeProgress: buildChallengeProgress(foundCount, totalKnown),
    solutionNumber: solutionLabel(res),
    elapsedSec: outcome?.elapsedSec ?? 0,
    tokensEarned: outcome?.tokensEarned ?? 0,
  };
}

function buildDuplicatePayload(level, res) {
  return {
    mode: 'duplicate',
    /** Adventure: enriched on show — NoADVPth until step complete, then AlreadyRecordsPlacqueBase. */
    showAdvancePath: false,
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

  $('discoveryContinueBtn')?.addEventListener('click', () => { void handleContinueSearch(); });
  $('discoveryAdvanceBtn')?.addEventListener('click', () => { void handleAdvancePath(); });
  $('discoveryViewFoundBtn')?.addEventListener('click', () => { void handleViewFoundSolve(); });
  $('discoveryFoundBookBtn')?.addEventListener('click', () => { void handleOpenFoundSolutions(); });

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
  formatTime,
  formatDateTime,
};
