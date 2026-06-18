/**
 * Dev tool: Page Up / Page Down through every catalog solution on the adventure path.
 */

import { loadAdventurePath } from './adventure-path.js';

const $ = (id) => document.getElementById(id);

const ui = {
  loading: $('auditLoading'),
  status: $('auditStatus'),
  step: $('auditStep'),
  advId: $('auditAdvId'),
  levelId: $('auditLevelId'),
  puzzleInStep: $('auditPuzzleInStep'),
  solution: $('auditSolution'),
  flatIndex: $('auditFlatIndex'),
  progress: $('auditProgress'),
  canvas: $('auditCanvas'),
  levelInput: $('auditLevelInput'),
  gotoForm: $('auditGotoForm'),
  gotoMsg: $('auditGotoMsg'),
};

const solveCache = new Map();
let app = null;
let pathDoc = null;
let puzzles = [];
let levelById = new Map();
let rankNames = new Map();

/** @type {{ flatIndex: number, solutionIndex: number, directLevelId?: string }} */
let nav = { flatIndex: 0, solutionIndex: 0 };
let busy = false;

function normalizeLevelId(raw) {
  return String(raw || '').trim();
}

function puzzleAtNav() {
  if (nav.directLevelId) {
    return { levelId: nav.directLevelId, direct: true };
  }
  return puzzles[nav.flatIndex] || null;
}

function showGotoMsg(text) {
  if (!ui.gotoMsg) return;
  if (!text) {
    ui.gotoMsg.hidden = true;
    ui.gotoMsg.textContent = '';
    return;
  }
  ui.gotoMsg.hidden = false;
  ui.gotoMsg.textContent = text;
}

function syncLevelInput() {
  if (!ui.levelInput || document.activeElement === ui.levelInput) return;
  const puzzle = puzzleAtNav();
  ui.levelInput.value = puzzle?.levelId || '';
}

function updateLocationQuery() {
  const puzzle = puzzleAtNav();
  if (!puzzle?.levelId) return;
  const qs = new URLSearchParams(location.search);
  qs.set('level', puzzle.levelId);
  qs.delete('step');
  const next = `${location.pathname}?${qs.toString()}`;
  history.replaceState(null, '', next);
}

function rankLabel(rankId) {
  const name = rankNames.get(rankId);
  return name ? `L${rankId} ${name}` : `L${rankId}`;
}

function stepLabel(puzzle) {
  if (!puzzle) return '—';
  return `${rankLabel(puzzle.rankId)}-${puzzle.subLevel}`;
}

function puzzlesInStep(puzzle) {
  if (!puzzle || !pathDoc?.steps) return 0;
  const step = pathDoc.steps.find((s) => s.stepIndex === puzzle.stepIndex);
  return step?.puzzles?.length || 0;
}

function setStatus(kind, text) {
  ui.status.className = `audit-status is-${kind}`;
  ui.status.textContent = text;
}

async function waitForApp() {
  for (let i = 0; i < 600; i += 1) {
    if (window.__app?.ready && window.__app?.loadKnownSolutionsForLevel && window.__app?.state?.allLevels?.length) {
      return window.__app;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Game engine failed to initialize');
}

async function loadRankNames() {
  try {
    const res = await fetch('/data/adventure_ranks.json');
    if (!res.ok) return;
    const rows = await res.json();
    for (const row of rows || []) {
      if (row?.rank_id) rankNames.set(Number(row.rank_id), row.rank_name || row.rank_code || '');
    }
  } catch {
    /* optional */
  }
}

function levelForPuzzle(puzzle) {
  return levelById.get(puzzle?.levelId) || null;
}

async function solutionsForLevel(level) {
  if (!level?.id) return [];
  if (solveCache.has(level.id)) return solveCache.get(level.id);
  await app.applyLevel(level);
  const sols = await app.loadKnownSolutionsForLevel(level);
  const list = Array.isArray(sols) ? sols.filter((s) => Array.isArray(s?.placements) && s.placements.length) : [];
  solveCache.set(level.id, list);
  return list;
}

async function renderFrame() {
  const puzzle = puzzleAtNav();
  if (!puzzle) {
    setStatus('fail', 'No puzzle selected.');
    return;
  }

  const isDirect = !!puzzle.direct;
  if (!isDirect && !puzzles.length) {
    setStatus('fail', 'No ranked adventure puzzles in path.');
    return;
  }

  if (!isDirect) {
    nav.flatIndex = Math.max(0, Math.min(nav.flatIndex, puzzles.length - 1));
  }

  const level = levelById.get(puzzle.levelId) || null;

  if (!level) {
    setStatus('fail', `Level not in catalog: ${puzzle.levelId}`);
    ui.step.textContent = isDirect ? '—' : stepLabel(puzzle);
    ui.advId.textContent = isDirect ? '—' : String(puzzle.advId ?? '—');
    ui.levelId.textContent = puzzle.levelId;
    ui.puzzleInStep.textContent = isDirect ? 'not on adventure path' : `${puzzle.puzzleOrder} / ${puzzlesInStep(puzzle)}`;
    ui.solution.textContent = '—';
    ui.flatIndex.textContent = isDirect ? '—' : String(nav.flatIndex);
    syncLevelInput();
    return;
  }

  const sols = await solutionsForLevel(level);
  if (!sols.length) {
    setStatus('fail', `No solve file entries for ${level.id}`);
    nav.solutionIndex = 0;
  } else {
    nav.solutionIndex = Math.max(0, Math.min(nav.solutionIndex, sols.length - 1));
    const sol = sols[nav.solutionIndex];
    await app.applyLevel(level);
    await app.applyPlacementsToBoard(sol.placements);
    const v = app.validateBoard();
    const challengeTag = !isDirect && puzzle.isChallenge ? ' · CHALLENGE' : '';
    if (v.ok) {
      setStatus('ok', `Valid board${challengeTag}${v.msg && v.msg !== 'OK' ? ` — ${v.msg}` : ''}`);
    } else {
      setStatus('fail', `INVALID${challengeTag}: ${v.msg || 'validateBoard failed'}`);
    }
    await app.renderSolutionPreview(ui.canvas, sol.placements, { level, maxPx: 920 });
    ui.solution.textContent = `${nav.solutionIndex + 1} / ${sols.length}`;
  }

  if (isDirect) {
    ui.step.textContent = '—';
    ui.advId.textContent = '—';
    ui.puzzleInStep.textContent = 'not on adventure path';
    ui.flatIndex.textContent = '—';
  } else {
    ui.step.textContent = stepLabel(puzzle);
    ui.advId.textContent = String(puzzle.advId ?? '—');
    ui.puzzleInStep.textContent = `${puzzle.puzzleOrder} / ${puzzlesInStep(puzzle)}${puzzle.isChallenge ? ' (challenge)' : ''}`;
    ui.flatIndex.textContent = `${nav.flatIndex + 1} / ${puzzles.length}`;
  }
  ui.levelId.textContent = puzzle.levelId;
  ui.progress.textContent = isDirect
    ? `Direct load · solution ${nav.solutionIndex + 1}`
    : `Frame ${describeGlobalFrame()}`;
  syncLevelInput();
  showGotoMsg('');
}

function describeGlobalFrame() {
  let n = 0;
  for (let i = 0; i <= nav.flatIndex; i += 1) {
    const pid = puzzles[i]?.levelId;
    const count = solveCache.get(pid)?.length;
    if (i < nav.flatIndex) {
      n += count || 1;
    } else {
      n += nav.solutionIndex + 1;
    }
  }
  return `~${n} (solutions loaded on demand)`;
}

async function move(delta) {
  if (busy) return;
  if (nav.directLevelId) {
    const level = levelById.get(nav.directLevelId);
    if (!level) return;
    busy = true;
    try {
      const sols = await solutionsForLevel(level);
      if (!sols.length) return;
      nav.solutionIndex = Math.max(0, Math.min(nav.solutionIndex + delta, sols.length - 1));
      await renderFrame();
    } finally {
      busy = false;
    }
    return;
  }
  if (!puzzles.length) return;
  busy = true;
  try {
    let { flatIndex, solutionIndex } = nav;

    if (delta > 0) {
      while (flatIndex < puzzles.length) {
        const level = levelForPuzzle(puzzles[flatIndex]);
        const sols = level ? await solutionsForLevel(level) : [];
        if (sols.length && solutionIndex + 1 < sols.length) {
          solutionIndex += 1;
          break;
        }
        flatIndex += 1;
        solutionIndex = 0;
        if (flatIndex >= puzzles.length) break;
        const nextLevel = levelForPuzzle(puzzles[flatIndex]);
        const nextSols = nextLevel ? await solutionsForLevel(nextLevel) : [];
        if (nextSols.length) break;
      }
      flatIndex = Math.min(flatIndex, puzzles.length - 1);
    } else if (delta < 0) {
      while (true) {
        const level = levelForPuzzle(puzzles[flatIndex]);
        const sols = level ? await solutionsForLevel(level) : [];
        if (sols.length && solutionIndex > 0) {
          solutionIndex -= 1;
          break;
        }
        if (flatIndex <= 0) {
          flatIndex = 0;
          solutionIndex = 0;
          break;
        }
        flatIndex -= 1;
        const prevLevel = levelForPuzzle(puzzles[flatIndex]);
        const prevSols = prevLevel ? await solutionsForLevel(prevLevel) : [];
        solutionIndex = Math.max(0, (prevSols.length || 1) - 1);
        if (prevSols.length) break;
      }
    }

    nav = { flatIndex, solutionIndex };
    await renderFrame();
  } finally {
    busy = false;
  }
}

async function jumpToLevelId(levelId, { solutionIndex = 0 } = {}) {
  const id = normalizeLevelId(levelId);
  if (!id) {
    showGotoMsg('Enter a puzzle id (e.g. 3x4-0B-AAA).');
    return false;
  }

  if (!levelById.has(id)) {
    showGotoMsg(`Unknown level: ${id}`);
    setStatus('fail', `Level not in catalog: ${id}`);
    return false;
  }

  const flatIndex = puzzles.findIndex((p) => p.levelId === id);
  if (flatIndex >= 0) {
    nav = { flatIndex, solutionIndex: Math.max(0, solutionIndex) };
  } else {
    nav = { flatIndex: 0, solutionIndex: Math.max(0, solutionIndex), directLevelId: id };
  }

  await renderFrame();
  updateLocationQuery();
  return true;
}

async function jumpToStep(stepIndex, { lastSolution = false } = {}) {
  if (!pathDoc?.steps?.length) return;
  const step = pathDoc.steps.find((s) => s.stepIndex === stepIndex);
  if (!step?.puzzles?.length) return;
  const first = step.puzzles[0];
  const flatIndex = puzzles.findIndex((p) => p.flatIndex === first.flatIndex);
  if (flatIndex < 0) return;
  nav = { flatIndex, solutionIndex: 0 };
  delete nav.directLevelId;
  if (lastSolution) {
    const last = step.puzzles[step.puzzles.length - 1];
    const li = puzzles.findIndex((p) => p.flatIndex === last.flatIndex);
    if (li >= 0) {
      nav.flatIndex = li;
      const level = levelForPuzzle(puzzles[li]);
      const sols = level ? await solutionsForLevel(level) : [];
      nav.solutionIndex = Math.max(0, sols.length - 1);
    }
  }
  await renderFrame();
}

function currentStepIndex() {
  return puzzles[nav.flatIndex]?.stepIndex ?? 0;
}

async function jumpEnds(toEnd) {
  if (nav.directLevelId) {
    const level = levelById.get(nav.directLevelId);
    const sols = level ? await solutionsForLevel(level) : [];
    nav.solutionIndex = toEnd ? Math.max(0, sols.length - 1) : 0;
    await renderFrame();
    return;
  }
  if (!puzzles.length) return;
  if (toEnd) {
    nav = {
      flatIndex: puzzles.length - 1,
      solutionIndex: 0,
    };
    const level = levelForPuzzle(puzzles[nav.flatIndex]);
    const sols = level ? await solutionsForLevel(level) : [];
    nav.solutionIndex = Math.max(0, sols.length - 1);
  } else {
    nav = { flatIndex: 0, solutionIndex: 0 };
  }
  await renderFrame();
}

function parseLevelFromQuery() {
  const qs = new URLSearchParams(location.search);
  return normalizeLevelId(qs.get('level') || qs.get('puzzle') || '');
}

function parseStartFromQuery() {
  const qs = new URLSearchParams(location.search);
  const step = qs.get('step');
  if (step == null) return null;
  const m = String(step).match(/^L?(\d+)-(\d+)$/i);
  if (!m) return Number(step);
  const rankId = Number(m[1]);
  const sub = Number(m[2]);
  if (!rankId || !sub) return null;
  return (rankId - 1) * 10 + (sub - 1);
}

async function init() {
  try {
    await loadRankNames();
    app = await waitForApp();
    for (const lv of app.state.allLevels || []) {
      if (lv?.id) levelById.set(lv.id, lv);
    }

    pathDoc = await loadAdventurePath();
    puzzles = Array.isArray(pathDoc?.flat) ? [...pathDoc.flat] : [];
    puzzles.sort((a, b) => (a.flatIndex ?? 0) - (b.flatIndex ?? 0));

    if (!puzzles.length) {
      setStatus('fail', 'Adventure path is empty. Check adventure_path.json or CSV.');
      ui.loading.hidden = true;
      return;
    }

    const levelId = parseLevelFromQuery();
    const startStep = parseStartFromQuery();
    if (levelId) {
      await jumpToLevelId(levelId);
    } else if (startStep != null && Number.isFinite(startStep)) {
      await jumpToStep(startStep);
    } else {
      await renderFrame();
    }

    ui.gotoForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      void jumpToLevelId(ui.levelInput?.value);
    });

    ui.loading.hidden = true;
  } catch (e) {
    console.error(e);
    setStatus('fail', e?.message || String(e));
    ui.loading.hidden = true;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'PageDown') {
    e.preventDefault();
    void move(1);
  } else if (e.key === 'PageUp') {
    e.preventDefault();
    void move(-1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    void jumpEnds(false);
  } else if (e.key === 'End') {
    e.preventDefault();
    void jumpEnds(true);
  } else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    const next = currentStepIndex() + (e.shiftKey ? -1 : 1);
    if (next >= 0 && next < (pathDoc?.stepCount || 0)) {
      void jumpToStep(next, { lastSolution: e.shiftKey });
    }
  } else if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    ui.levelInput?.focus();
    ui.levelInput?.select();
  }
});

void init();
