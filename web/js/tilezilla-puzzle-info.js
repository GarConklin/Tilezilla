/**

 * Puzzle Info art popup — blank parchment + positioned data fields.

 * Dialog size is CSS-only (art aspect ratio); fields align to the filled background.

 */



import { romanForSubLevel } from './sublevel-icon.js';



const DEV_PLAYER_ADVENTURE = {

  gar: { rankId: 1, subLevel: 1 },

  Arn: { rankId: 4, subLevel: 1 },

  dev: { rankId: 1, subLevel: 1 },

};



let getApp = () => null;

let menuApi = null;

let ranksCache = null;



function $(id) {

  return document.getElementById(id);

}



async function loadAdventureRanks() {

  if (!ranksCache) {

    const res = await fetch('/data/adventure_ranks.json');

    if (!res.ok) throw new Error('Failed to load adventure ranks');

    ranksCache = await res.json();

  }

  return ranksCache;

}



function resolveDevAdventureProfile(userId) {

  const key = userId || 'gar';

  return DEV_PLAYER_ADVENTURE[key] || DEV_PLAYER_ADVENTURE.gar;

}



function formatBestTime(sec) {

  if (!Number.isFinite(sec) || sec <= 0) return '—';

  const m = Math.floor(sec / 60);

  const s = sec % 60;

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

}



function formatFirstSolved(iso) {

  if (!iso) return '—';

  try {

    return new Date(iso).toLocaleDateString(undefined, {

      month: 'short',

      day: 'numeric',

      year: 'numeric',

    });

  } catch {

    return '—';

  }

}



function renderSolutionsBar(container, found, total) {

  if (!container) return;

  container.replaceChildren();

  const maxSeg = 20;

  const segments = total > 0 ? Math.min(total, maxSeg) : maxSeg;

  const filled = total > 0 ? Math.round((found / total) * segments) : 0;

  for (let i = 0; i < segments; i++) {

    const sq = document.createElement('span');

    sq.className = `tz-pinfo-sq${i < filled ? ' tz-pinfo-sq--filled' : ''}`;

    sq.setAttribute('aria-hidden', 'true');

    container.appendChild(sq);

  }

}



function resetPuzzleInfoDialogLayout() {

  const dialog = document.querySelector('.tz-pinfo-dialog');

  if (!dialog) return;

  dialog.style.removeProperty('width');

  dialog.style.removeProperty('height');

  dialog.style.removeProperty('aspect-ratio');

}



async function refreshPuzzleInfoFields() {

  const app = getApp();

  const info = app ? await app.getMenuPuzzleInfo() : null;



  $('pinfoPuzzleId').textContent = info?.id || '—';

  $('pinfoBoardSize').textContent = info?.size || '—';

  $('pinfoType').textContent = info?.challengeStatus || '—';



  const found = info?.solutionsFound ?? 0;

  const total = info?.totalSolutions ?? 0;

  if (info?.hasKnownTotal && total > 0) {

    $('pinfoSolutionsFound').textContent = `${found} of ${total}`;

    renderSolutionsBar($('pinfoSolutionsBar'), found, total);

  } else if (found > 0) {

    $('pinfoSolutionsFound').textContent = `${found} / ?`;

    renderSolutionsBar($('pinfoSolutionsBar'), found, 0);

  } else {

    $('pinfoSolutionsFound').textContent = info?.hasKnownTotal && total > 0 ? `0 of ${total}` : '0 / ?';

    renderSolutionsBar($('pinfoSolutionsBar'), 0, total > 0 ? total : 0);

  }



  const hintsUsed = info?.hintsUsed ?? 0;

  const hintsMax = info?.hintsMax ?? 2;

  $('pinfoHintsUsed').textContent = `${hintsUsed} / ${hintsMax}`;

  $('pinfoBestTime').textContent = formatBestTime(info?.bestTimeSeconds);

  $('pinfoFirstSolved').textContent = formatFirstSolved(info?.firstSolvedAt);



  const badge = $('pinfoRankBadge');

  const roman = $('pinfoRankRoman');

  try {

    const profile = resolveDevAdventureProfile(app?.state?.userId);

    const ranks = await loadAdventureRanks();

    const rank = ranks.find((r) => r.rank_id === profile.rankId) || ranks[0];

    if (badge && rank?.badge_image) {

      badge.src = rank.badge_image;

      badge.alt = `${rank.rank_name || 'Rank'} badge`;

      badge.hidden = false;

    }

    if (roman) roman.textContent = romanForSubLevel(profile.subLevel);

  } catch {

    if (badge) badge.hidden = true;

    if (roman) roman.textContent = '';

  }

}



function openPuzzleInfoPopup() {

  const root = $('puzzleInfoRoot');

  if (!root) return;

  menuApi?.closeAll?.();

  resetPuzzleInfoDialogLayout();

  root.hidden = false;

  document.body.classList.add('tz-modal-open');

  root.scrollTop = 0;

}



function closePuzzleInfoPopup() {

  const root = $('puzzleInfoRoot');

  if (!root) return;

  root.hidden = true;

  resetPuzzleInfoDialogLayout();

  if (

    $('menuRoot')?.hidden !== false

    && $('menuPanelRoot')?.hidden !== false

    && $('settingsRoot')?.hidden !== false

    && $('hintMenuRoot')?.hidden !== false

    && $('stuckPopupRoot')?.hidden !== false

  ) {

    document.body.classList.remove('tz-modal-open');

  }

}



export async function openPuzzleInfo() {

  await refreshPuzzleInfoFields();

  openPuzzleInfoPopup();

}



export function initPuzzleInfoPopup({ getApp: getAppFn, menuApi: menu }) {

  getApp = getAppFn || (() => null);

  menuApi = menu || null;



  const root = $('puzzleInfoRoot');

  if (!root) return null;



  $('puzzleInfoCloseX')?.addEventListener('click', closePuzzleInfoPopup);

  $('puzzleInfoBackdrop')?.addEventListener('click', closePuzzleInfoPopup);



  document.addEventListener('keydown', (e) => {

    if (e.key !== 'Escape') return;

    if (root.hidden) return;

    closePuzzleInfoPopup();

  });



  return { openPuzzleInfo, closePuzzleInfoPopup };

}


