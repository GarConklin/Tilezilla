/** Rank badge + sublevel on logged-in passport — layered badge v2. */

import {
  adventureLevelContext,
  getRankPanelState,
  loadAdventurePath,
  mergeServerAdventureRank,
} from './adventure-path.js';
import { resolvePassportProgress, ensurePassportDataHydrated } from './profile-passport-data.js';
import { romanForSubLevel } from './sublevel-icon.js';
import {
  applyRankBadgeV2Async,
  clearRankBadgeV2LayoutCache,
  ensureRankBadgeV2Stack,
} from './rank-badge-v2.js';

let ranksCache = null;

async function loadAdventureRanks() {
  if (!ranksCache) {
    const res = await fetch('/data/adventure_ranks.json');
    if (!res.ok) throw new Error('Failed to load adventure ranks');
    ranksCache = await res.json();
  }
  return ranksCache;
}

function rankStacks(root = document) {
  const out = [];
  for (const wrap of root.querySelectorAll('.auth-screen__profile-rank-stack')) {
    let stack =
      wrap.querySelector('.tz-rank-badge-stack')
      || wrap.querySelector('.tz-rank-badge-v2')
      || wrap.querySelector('.tz-preview-v2-user-data__badge-stack');
    if (!stack) continue;
    ensureRankBadgeV2Stack(stack);
    out.push(stack);
  }
  return out;
}

function setRankStacksReady(stacks, ready) {
  for (const stack of stacks) {
    const wrap = stack.closest('.auth-screen__profile-rank-stack') || stack;
    wrap.classList.toggle('is-rank-ready', ready);
  }
}

function syncPassportRankBadgeHeights(stacks) {
  for (const stack of stacks) {
    const wrap = stack.closest('.auth-screen__profile-rank-stack');
    const h = (wrap || stack).getBoundingClientRect().height;
    if (h > 0) {
      stack.style.setProperty('--tz-rank-badge-h', `${h}px`);
    }
  }
}

function waitForStackImages(stacks) {
  const imgs = stacks.flatMap((s) => [...s.querySelectorAll('img')]);
  return Promise.all(
    imgs.map(
      (el) =>
        el.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              el.addEventListener('load', resolve, { once: true });
              el.addEventListener('error', resolve, { once: true });
            }),
    ),
  );
}

async function resolveRankSublevel(progress) {
  const path = await loadAdventurePath();
  const prog = progress ?? window.__app?.progress ?? null;
  const ctx = adventureLevelContext(window.__app || {});
  const rankState = mergeServerAdventureRank(getRankPanelState(prog, path, ctx));
  const ranks = await loadAdventureRanks();
  const rank = ranks.find((r) => r.rank_id === rankState.rankId) || ranks[0];
  return { subLevel: rankState.subLevel, badge: rank.sublevel_badge, rank };
}

async function applyPassportRankState(stacks, progress) {
  const resolved = await resolveRankSublevel(progress);
  const opts = {
    rankId: resolved.rank?.rank_id || 1,
    subLevel: resolved.subLevel,
    romanStyle: resolved.badge || 'gld',
    rankName: resolved.rank?.rank_name || 'Wanderer',
  };

  // Size from the passport layout slot before first paint (not the stack's prior size).
  syncPassportRankBadgeHeights(stacks);

  for (const stack of stacks) {
    const ok = await applyRankBadgeV2Async(stack, opts);
    if (!ok && resolved.rank) {
      const tile = stack.querySelector('.badge-stack__tile') || stack.querySelector('.tz-rank-badge__img');
      const num = stack.querySelector('.badge-stack__num') || stack.querySelector('.tz-rank-sublevel__img');
      if (tile) {
        tile.src = resolved.rank.badge_image;
        tile.alt = `${resolved.rank.rank_name} rank`;
      }
      if (num) {
        const n = Math.max(1, Math.min(15, resolved.subLevel || 1));
        num.src = `/img/ranks/${resolved.badge || 'gld'}-${n}.png`;
        num.alt = `Sublevel ${romanForSubLevel(resolved.subLevel)}`;
      }
    }
  }

  await waitForStackImages(stacks);
  syncPassportRankBadgeHeights(stacks);
  // Remeasure scale after images/layout settle
  for (const stack of stacks) {
    await applyRankBadgeV2Async(stack, opts);
  }
}

/**
 * Update every passport rank badge / sublevel icon on the page.
 * @param {object} [progress] — adventure progress; falls back to window.__app?.progress
 * @param {Document|HTMLElement} [root]
 */
export async function refreshProfileRankIcons(progress, root = document) {
  const stacks = rankStacks(root);
  if (!stacks.length) return;

  if (!progress) await ensurePassportDataHydrated();

  const prog = progress ?? resolvePassportProgress();

  setRankStacksReady(stacks, false);

  try {
    await applyPassportRankState(stacks, prog);
  } catch (err) {
    console.warn('Profile rank icons:', err);
    for (const stack of stacks) {
      const tile = stack.querySelector('.badge-stack__tile');
      if (tile && !tile.getAttribute('src')) tile.src = '/img/ranks/1c.png';
    }
  } finally {
    setRankStacksReady(stacks, true);
    requestAnimationFrame(() => {
      syncPassportRankBadgeHeights(stacks);
      void applyPassportRankState(stacks, prog);
    });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('tilezilla:sublevel-layout-saved', () => {
    clearRankBadgeV2LayoutCache();
    void refreshProfileRankIcons();
  });
  window.addEventListener('tilezilla:rank-badge-v2-layout-saved', () => {
    clearRankBadgeV2LayoutCache();
    void refreshProfileRankIcons();
  });
}
