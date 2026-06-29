/** Shared expedition report + community discoveries stats (login & logged-in journal pages). */

import { PROFILE_LAYOUT_MOCK } from './auth-screen-layout.js';
import { formatCatalogStatNumber, loadAdventureCatalogStats } from './passport-catalog-stats.js';
import { clearSystemInfoCache, fetchSystemStats, formatPlayTime, formatStatNumber } from './system-info.js';

function setJournalSlot(root, slot, text) {
  const value = text == null || text === '' ? '—' : String(text);
  root.querySelectorAll(`[data-profile-slot="${slot}"]`).forEach((el) => {
    if (el.tagName === 'IMG') return;
    el.textContent = value;
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

function pickStatNumber(systemVal, catalogVal, mockVal) {
  const sys = Number(systemVal);
  if (Number.isFinite(sys) && sys > 0) return formatStatNumber(sys);
  const cat = Number(catalogVal);
  if (Number.isFinite(cat) && cat > 0) return formatCatalogStatNumber(cat);
  if (mockVal == null || mockVal === '' || mockVal === '—') return '—';
  return mockVal;
}

/** Best available expedition report numbers (system cache → live catalog → mock). */
export async function resolveExpeditionReportDisplay(app = window.__app) {
  const mock = PROFILE_LAYOUT_MOCK;
  clearSystemInfoCache();
  const [systemStats, catalog] = await Promise.all([
    fetchSystemStats(),
    loadAdventureCatalogStats(app),
  ]);

  const largestSys = Number(systemStats?.largestSolution);
  const largestCat = Number(catalog?.largestSolution);
  let largestSolution = mock.largestSolution;
  if (Number.isFinite(largestSys) && largestSys > 0) {
    largestSolution = `${formatStatNumber(largestSys)}\nROUTES`;
  } else if (Number.isFinite(largestCat) && largestCat > 0) {
    largestSolution = `${formatCatalogStatNumber(largestCat)}\nROUTES`;
  }

  return {
    systemStats,
    explorersRegistered: pickStatNumber(systemStats?.registeredUsers, null, mock.explorersRegistered),
    totalAdventurePuzzles: pickStatNumber(
      systemStats?.totalAdventurePuzzles,
      catalog?.totalAdventurePuzzles,
      mock.totalAdventurePuzzles,
    ),
    totalKnownRoutes: pickStatNumber(
      systemStats?.totalKnownRoutes,
      catalog?.totalKnownRoutes,
      mock.totalKnownRoutes,
    ),
    largestSolution,
  };
}

export function applyExpeditionReportDisplay(root, display) {
  if (!display) return;
  setJournalSlot(root, 'explorersRegistered', display.explorersRegistered);
  setJournalSlot(root, 'totalAdventurePuzzles', display.totalAdventurePuzzles);
  setJournalSlot(root, 'totalKnownRoutes', display.totalKnownRoutes);
  setJournalSlot(root, 'largestSolution', display.largestSolution);
}

export function applyExpeditionReportStats(root, stats, { largestTwoLine = true } = {}) {
  if (!stats) return;
  const mock = PROFILE_LAYOUT_MOCK;
  setJournalSlot(root, 'explorersRegistered', pickStatNumber(stats.registeredUsers, null, mock.explorersRegistered));
  setJournalSlot(
    root,
    'totalAdventurePuzzles',
    pickStatNumber(stats.totalAdventurePuzzles, null, mock.totalAdventurePuzzles),
  );
  setJournalSlot(root, 'totalKnownRoutes', pickStatNumber(stats.totalKnownRoutes, null, mock.totalKnownRoutes));
  const largest = stats.largestSolution;
  setJournalSlot(
    root,
    'largestSolution',
    largest
      ? largestTwoLine
        ? `${formatStatNumber(largest)}\nROUTES`
        : formatStatNumber(largest)
      : '—',
  );
}

/** Left journal panel when system stats API / MySQL cache is unavailable (login offline dev). */
export async function applyExpeditionReportStatsFallback(root, { largestTwoLine = true } = {}) {
  const mock = PROFILE_LAYOUT_MOCK;
  const catalog = await loadAdventureCatalogStats(window.__app);

  setJournalSlot(root, 'explorersRegistered', mock.explorersRegistered);
  setJournalSlot(
    root,
    'totalAdventurePuzzles',
    catalog ? formatCatalogStatNumber(catalog.totalAdventurePuzzles) : mock.totalAdventurePuzzles,
  );
  setJournalSlot(
    root,
    'totalKnownRoutes',
    pickStatNumber(null, catalog?.totalKnownRoutes, mock.totalKnownRoutes),
  );
  const largest = catalog?.largestSolution;
  setJournalSlot(
    root,
    'largestSolution',
    largest
      ? largestTwoLine
        ? `${formatCatalogStatNumber(largest)}\nROUTES`
        : formatCatalogStatNumber(largest)
      : mock.largestSolution,
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
  const mock = PROFILE_LAYOUT_MOCK;
  const display = await resolveExpeditionReportDisplay(window.__app);
  applyExpeditionReportDisplay(root, display);
  const todaysChallenge = (await fetchTodaysChallengeLevelId()) || mock.todaysChallenge;
  setJournalSlot(root, 'todaysChallenge', todaysChallenge);
  applyCommunityDiscoveryStats(root, {
    totalPlaySeconds: display.systemStats?.totalPlaySeconds,
  });
}
