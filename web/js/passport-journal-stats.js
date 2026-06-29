/** Shared expedition report + community discoveries stats (login & logged-in journal pages). */

import { PROFILE_LAYOUT_MOCK } from './auth-screen-layout.js';
import { fetchSystemStats, formatPlayTime, formatStatNumber } from './system-info.js';

function setJournalSlot(root, slot, text) {
  if (text == null || text === '') return;
  root.querySelectorAll(`[data-profile-slot="${slot}"]`).forEach((el) => {
    if (el.tagName === 'IMG') return;
    el.textContent = text;
  });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDailyCsvDate(value) {
  const raw = String(value || '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!m) return raw;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

export async function fetchTodaysChallengeLevelId() {
  const today = todayIso();
  try {
    const csv = await fetch(`/data/daily_challenges_import.csv?t=${today}`, { cache: 'no-store' }).then((r) =>
      r.ok ? r.text() : '',
    );
    if (!csv) return null;
    const lines = csv.trim().split(/\r?\n/);
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;
      const [challengeDate, levelId] = line.split(',');
      const rowDate = parseDailyCsvDate(challengeDate?.trim()) || challengeDate?.trim();
      if (rowDate === today) {
        return (levelId || '').trim().replace(/\.json$/i, '') || null;
      }
    }
    const first = lines[1]?.split(',')?.[1];
    return first ? first.trim().replace(/\.json$/i, '') : null;
  } catch {
    return null;
  }
}

export function applyExpeditionReportStats(root, stats, { largestTwoLine = true } = {}) {
  if (!stats) return;
  setJournalSlot(root, 'explorersRegistered', formatStatNumber(stats.registeredUsers));
  setJournalSlot(root, 'totalAdventurePuzzles', formatStatNumber(stats.totalAdventurePuzzles));
  setJournalSlot(root, 'totalKnownRoutes', formatStatNumber(stats.totalKnownRoutes));
  const largest = stats.largestSolution;
  setJournalSlot(
    root,
    'largestSolution',
    largest
      ? largestTwoLine
        ? `${formatStatNumber(largest)}\nROUTES`
        : formatStatNumber(largest)
      : null,
  );
}

export function applyCommunityDiscoveryStats(root, values = {}) {
  const mock = PROFILE_LAYOUT_MOCK;
  setJournalSlot(root, 'recentPuzzleSolved', values.recentPuzzleSolved ?? mock.recentPuzzleSolved);
  setJournalSlot(root, 'recentDailyCompleted', values.recentDailyCompleted ?? mock.recentDailyCompleted);
  setJournalSlot(root, 'mostSolvedPuzzle', values.mostSolvedPuzzle ?? mock.mostSolvedPuzzle);
  setJournalSlot(root, 'latestDiscovery', values.latestDiscovery ?? mock.latestDiscovery);
  setJournalSlot(
    root,
    'totalPlayTime',
    values.totalPlayTime ?? (values.totalPlaySeconds != null ? formatPlayTime(values.totalPlaySeconds) : mock.totalPlayTime),
  );
}

/** Fill both journal pages on login / logged-in passport screens. */
export async function applyPassportJournalStats({ root = document } = {}) {
  const stats = await fetchSystemStats();
  applyExpeditionReportStats(root, stats, { largestTwoLine: true });
  const todaysChallenge = (await fetchTodaysChallengeLevelId()) || PROFILE_LAYOUT_MOCK.todaysChallenge;
  setJournalSlot(root, 'todaysChallenge', todaysChallenge);
  applyCommunityDiscoveryStats(root, {
    totalPlaySeconds: stats?.totalPlaySeconds,
  });
}
