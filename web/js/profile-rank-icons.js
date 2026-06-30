/** Rank badge + sublevel on logged-in passport — same model as rank-sublevel-tuner. */

import {
  adventureLevelContext,
  getRankPanelState,
  loadAdventurePath,
} from './adventure-path.js';
import { resolvePassportProgress, ensurePassportDataHydrated } from './profile-passport-data.js';
import {
  applySublevelIconOnBadgeStack,
  clearSublevelLayoutCache,
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
    const badge =
      stack.querySelector('.tz-rank-badge__img')
      || stack.querySelector('.tz-preview-v2-user-data__badge');
    const sub =
      stack.querySelector('.tz-rank-sublevel__img')
      || stack.querySelector('.tz-preview-v2-user-data__sublevel');
    if (badge) badges.push(badge);
    if (sub) subs.push(sub);
  }
  return { badges, subs, stacks };
}

function setRankStacksReady(stacks, ready) {
  for (const stack of stacks) {
    stack.classList.toggle('is-rank-ready', ready);
  }
}

/** Match --tz-rank-badge-h to rendered badge height (anchor point = rank-sublevel-tuner). */
function syncPassportRankBadgeHeights(stacks) {
  for (const stack of stacks) {
    const rankBubble = stack.querySelector('.tz-rank-badge-stack');
    const badgeImg = stack.querySelector('.tz-rank-badge__img');
    if (!rankBubble || !badgeImg) continue;
    const h = badgeImg.getBoundingClientRect().height;
    if (h > 0) {
      rankBubble.style.setProperty('--tz-rank-badge-h', `${h}px`);
    }
  }
}

function waitForRankImages(badges, subs) {
  const imgs = [...badges, ...subs].filter(Boolean);
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

function syncBadgeFromPreview(badges) {
  const refBadge = document.getElementById('previewV2RankBadge');
  if (!refBadge?.getAttribute('src')) return false;
  for (const el of badges) {
    el.src = refBadge.src;
    el.alt = refBadge.alt || '';
  }
  return true;
}

async function resolveRankSublevel(progress) {
  const path = await loadAdventurePath();
  const prog = progress ?? window.__app?.progress ?? null;
  const ctx = adventureLevelContext(window.__app || {});
  const rankState = getRankPanelState(prog, path, ctx);
  const ranks = await loadAdventureRanks();
  const rank = ranks.find((r) => r.rank_id === rankState.rankId) || ranks[0];
  return { subLevel: rankState.subLevel, badge: rank.sublevel_badge, rank };
}

async function applyPassportSublevels(subs, progress, layout) {
  const resolved = await resolveRankSublevel(progress);
  const roman = romanForSubLevel(resolved.subLevel);
  for (const el of subs) {
    applySublevelIconOnBadgeStack(el, resolved.subLevel, resolved.badge, layout);
    el.alt = `Sublevel ${roman}`;
  }
  return resolved;
}

async function rescalePassportSublevels(stacks, subs, progress) {
  syncPassportRankBadgeHeights(stacks);
  let layout = null;
  try {
    layout = await loadSublevelIconLayout();
  } catch {
    /* defaults in applySublevelIconOnBadgeStack */
  }
  const resolved = await resolveRankSublevel(progress);
  for (const el of subs) {
    if (!el.closest('.auth-screen__profile-rank-stack')) continue;
    const subLevel = Number(el.dataset.sublevel) || resolved.subLevel || 1;
    const badge = el.dataset.sublevelBadge || resolved.badge || 'gld';
    applySublevelIconOnBadgeStack(el, subLevel, badge, layout);
  }
}

async function applyPassportRankState(badges, subs, stacks, progress) {
  let layout = null;
  try {
    layout = await loadSublevelIconLayout();
  } catch {
    /* defaults */
  }

  const syncedBadge = !progress && !window.__app?.progress && syncBadgeFromPreview(badges);
  const resolved = await applyPassportSublevels(subs, progress, layout);

  if (!syncedBadge && resolved.rank) {
    for (const el of badges) {
      el.src = resolved.rank.badge_image;
      el.alt = `${resolved.rank.rank_name} rank`;
    }
  }

  await waitForRankImages(badges, subs);
  syncPassportRankBadgeHeights(stacks);
  await applyPassportSublevels(subs, progress, layout);
}

/**
 * Update every passport rank badge / sublevel icon on the page.
 * @param {object} [progress] — adventure progress; falls back to window.__app?.progress
 * @param {Document|HTMLElement} [root]
 */
export async function refreshProfileRankIcons(progress, root = document) {
  const { badges, subs, stacks } = rankElements(root);
  if (!badges.length && !subs.length) return;

  if (!progress) await ensurePassportDataHydrated();

  let prog = progress ?? resolvePassportProgress();

  setRankStacksReady(stacks, false);

  try {
    await applyPassportRankState(badges, subs, stacks, prog);
  } catch (err) {
    console.warn('Profile rank icons:', err);
    let layout = null;
    try {
      layout = await loadSublevelIconLayout();
    } catch {
      /* defaults */
    }
    for (const el of badges) {
      if (!el.getAttribute('src')) el.src = '/img/ranks/Wanderer.png';
    }
    for (const el of subs) {
      applySublevelIconOnBadgeStack(el, 1, 'gld', layout);
      if (!el.alt) el.alt = 'Sublevel I';
    }
  } finally {
    setRankStacksReady(stacks, true);
    requestAnimationFrame(() => {
      syncPassportRankBadgeHeights(stacks);
      void rescalePassportSublevels(stacks, subs, prog);
      requestAnimationFrame(() => {
        syncPassportRankBadgeHeights(stacks);
        void rescalePassportSublevels(stacks, subs, prog);
      });
    });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('tilezilla:sublevel-layout-saved', () => {
    clearSublevelLayoutCache();
    void refreshProfileRankIcons();
  });
}
