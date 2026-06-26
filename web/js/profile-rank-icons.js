/** Rank badge + sublevel roman icon on logged-in passport (profile screen & overlay). */

import {
  adventureLevelContext,
  getRankPanelState,
  loadAdventurePath,
} from './adventure-path.js';
import {
  applySublevelIconElement,
  loadSublevelIconLayout,
  romanForSubLevel,
} from './sublevel-icon.js';

let ranksCache = null;

async function loadAdventureRanks() {
  if (!ranksCache) {
    const res = await fetch('/data/adventure_ranks.json');
    if (!res.ok) throw new Error('Failed to load adventure ranks');
    ranksCache = await res.json();
  }
  return ranksCache;
}

function rankElements(root = document) {
  const stacks = root.querySelectorAll('.auth-screen__profile-rank-stack');
  const badges = [];
  const subs = [];
  for (const stack of stacks) {
    const badge = stack.querySelector('.auth-screen__profile-rank-badge');
    const sub = stack.querySelector('.auth-screen__profile-rank-sublevel');
    if (badge) badges.push(badge);
    if (sub) subs.push(sub);
  }
  badges.push(...root.querySelectorAll('[data-profile-slot="rankBadge"]:not(.auth-screen__profile-rank-badge)'));
  subs.push(...root.querySelectorAll('[data-profile-slot="sublevelIcon"]:not(.auth-screen__profile-rank-sublevel)'));
  return { badges, subs };
}

/**
 * Update every passport rank badge / sublevel icon on the page.
 * @param {object} [progress] — adventure progress; falls back to window.__app?.progress
 * @param {Document|HTMLElement} [root]
 */
export async function refreshProfileRankIcons(progress, root = document) {
  const { badges, subs } = rankElements(root);
  if (!badges.length && !subs.length) return;

  let layout = null;
  try {
    layout = await loadSublevelIconLayout();
  } catch {
    /* defaults in applySublevelIconElement */
  }

  try {
    const path = await loadAdventurePath();
    const prog = progress ?? window.__app?.progress ?? null;
    const ctx = adventureLevelContext(window.__app || {});
    const rankState = getRankPanelState(prog, path, ctx);
    const ranks = await loadAdventureRanks();
    const rank = ranks.find((r) => r.rank_id === rankState.rankId) || ranks[0];
    const roman = romanForSubLevel(rankState.subLevel);

    for (const el of badges) {
      el.src = rank.badge_image;
      el.alt = `${rank.rank_name} rank`;
    }
    for (const el of subs) {
      applySublevelIconElement(el, rankState.subLevel, rank.sublevel_badge, layout);
      el.alt = `Sublevel ${roman}`;
    }
  } catch (err) {
    console.warn('Profile rank icons:', err);
    for (const el of badges) {
      if (!el.getAttribute('src')) el.src = '/img/ranks/Wanderer.png';
    }
    for (const el of subs) {
      applySublevelIconElement(el, 1, 'gld', layout);
      if (!el.alt) el.alt = 'Sublevel I';
    }
  }
}
