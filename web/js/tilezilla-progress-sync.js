/**
 * Server-backed progress for registered users (PHP session required).
 */

import { networkFetchTimeoutMs } from './level-catalog.js';

function countProgressLevels(data) {
  if (!data || typeof data !== 'object') return 0;
  return Object.keys(data).filter((k) => !k.startsWith('_')).length;
}

function countFoundSolutions(data) {
  if (!data || typeof data !== 'object') return 0;
  let n = 0;
  for (const [key, entry] of Object.entries(data)) {
    if (key.startsWith('_')) continue;
    n += (entry?.found || []).length;
  }
  return n;
}

/** Local additive merge — used if /api/progress/merge is unavailable. */
export function mergeProgressData(base, incoming) {
  const out = base && typeof base === 'object' ? structuredClone(base) : {};
  if (!incoming || typeof incoming !== 'object') return out;

  for (const [levelId, entry] of Object.entries(incoming)) {
    if (levelId.startsWith('_')) {
      if (!out[levelId]) out[levelId] = entry;
      else if (entry && typeof entry === 'object' && typeof out[levelId] === 'object') {
        out[levelId] = { ...out[levelId], ...entry };
      }
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const existing = out[levelId];
    if (!existing || typeof existing !== 'object') {
      out[levelId] = structuredClone(entry);
      continue;
    }
    const found = Array.isArray(existing.found) ? [...existing.found] : [];
    const seen = new Set(
      found.map((f) => `${f?.index ?? ''}|${f?.bonus ? 1 : 0}|${JSON.stringify(f?.placements || [])}`),
    );
    for (const f of entry.found || []) {
      const key = `${f?.index ?? ''}|${f?.bonus ? 1 : 0}|${JSON.stringify(f?.placements || [])}`;
      if (seen.has(key)) continue;
      found.push(f);
      seen.add(key);
    }
    out[levelId] = { ...existing, ...entry, found };
  }
  return out;
}

export async function fetchServerProgress() {
  try {
    const res = await fetch('/api/progress', {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(networkFetchTimeoutMs(12000)),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok === false) {
      return { ok: false, error: payload?.error || `HTTP ${res.status}` };
    }
    return { ok: true, data: payload.data || {}, updatedAt: payload.updatedAt || null };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function mergeProgressToServer(localData) {
  if (!localData || typeof localData !== 'object') {
    return { ok: false, reason: 'missing-data' };
  }
  try {
    const res = await fetch('/api/progress/merge', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: localData }),
      signal: AbortSignal.timeout(20000),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok === false) {
      return { ok: false, error: payload?.error || `HTTP ${res.status}` };
    }
    return { ok: true, ...payload };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * On login: load server progress and union with local so neither side loses solves.
 * @param {import('./progress.js').Progress} progress
 */
export async function hydrateProgressFromServer(progress) {
  if (!progress) return { ok: false, reason: 'no-progress' };

  const remote = await fetchServerProgress();
  if (!remote.ok) {
    console.warn('Server progress load:', remote.error);
    return remote;
  }

  const serverData = remote.data || {};
  const localData = progress.data || {};
  const serverLevels = countProgressLevels(serverData);
  const localLevels = countProgressLevels(localData);
  const serverSolves = countFoundSolutions(serverData);
  const localSolves = countFoundSolutions(localData);

  // Both sides empty
  if (!serverLevels && !serverSolves && !localLevels && !localSolves) {
    window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'empty' } }));
    return { ok: true, source: 'empty' };
  }

  // Server empty → migrate local once
  if (!serverLevels && !serverSolves && (localLevels > 0 || localSolves > 0)) {
    try {
      const res = await fetch('/api/progress/migrate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: localData }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.ok) {
        window.__passportServerProgressHydrated = true;
        window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'migrated-local' } }));
        void flushPendingSolves();
        return { ok: true, source: 'migrated-local', levels: localLevels, solves: localSolves };
      }
      if (payload?.skipped) {
        const merged = await mergeProgressToServer(localData);
        if (merged.ok && merged.data) {
          progress.importSnapshot({ data: merged.data });
          progress.save();
          window.__passportServerProgressHydrated = true;
          window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'merged-after-race' } }));
          void flushPendingSolves();
          return { ok: true, source: 'merged-after-race', levels: countProgressLevels(merged.data), solves: countFoundSolutions(merged.data) };
        }
      }
      console.warn('Progress migrate:', payload?.error || res.status);
    } catch (err) {
      console.warn('Progress migrate failed:', err);
    }
  }

  // Server has data — merge local into server (additive), never replace-wipe.
  if (localLevels > 0 || localSolves > 0) {
    const merged = await mergeProgressToServer(localData);
    if (merged.ok && merged.data) {
      progress.importSnapshot({ data: merged.data });
      progress.save();
      window.__passportServerProgressHydrated = true;
      window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'merged' } }));
      void flushPendingSolves();
      return {
        ok: true,
        source: 'merged',
        levels: countProgressLevels(merged.data),
        solves: countFoundSolutions(merged.data),
      };
    }
    // Offline / merge failed: keep union in the browser at least.
    const localMerged = mergeProgressData(serverData, localData);
    progress.importSnapshot({ data: localMerged });
    progress.save();
    console.warn('Progress merge failed; using local union:', merged.error);
    window.__passportServerProgressHydrated = true;
    window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'local-union' } }));
    void flushPendingSolves();
    return {
      ok: true,
      source: 'local-union',
      levels: countProgressLevels(localMerged),
      solves: countFoundSolutions(localMerged),
    };
  }

  progress.importSnapshot({ data: serverData });
  progress.save();
  window.__passportServerProgressHydrated = true;
  window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'server' } }));
  void flushPendingSolves();
  return { ok: true, source: 'server', levels: serverLevels, solves: serverSolves };
}

/**
 * Refresh an already-hydrated browser from the server without re-uploading the
 * entire local progress blob. Pending solve POSTs are flushed separately before
 * this runs. Server metadata wins while found solutions remain an additive
 * union, so an offline local find is never hidden.
 *
 * @param {import('./progress.js').Progress} progress
 */
export async function refreshProgressFromServer(progress) {
  if (!progress) return { ok: false, reason: 'no-progress' };
  const remote = await fetchServerProgress();
  if (!remote.ok) {
    console.warn('Server progress refresh:', remote.error);
    return remote;
  }

  const merged = mergeProgressData(progress.data || {}, remote.data || {});
  progress.importSnapshot({ data: merged });
  progress.save();
  window.__passportServerProgressHydrated = true;
  window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', {
    detail: { source: 'server-refresh' },
  }));
  return {
    ok: true,
    source: 'server-refresh',
    levels: countProgressLevels(merged),
    solves: countFoundSolutions(merged),
  };
}

/**
 * Record server-side daily attempt start (registered users, today's daily only).
 */
export async function startDailyAttemptOnServer({
  challengeDate,
  levelId,
} = {}) {
  if (!challengeDate || !levelId) {
    return { ok: false, reason: 'missing-fields' };
  }

  try {
    const res = await fetch('/api/daily-attempt/start', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeDate, levelId }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok === false) {
      console.warn('Daily attempt start:', payload?.error || res.status);
      return { ok: false, ...payload };
    }
    return { ok: true, ...payload };
  } catch (err) {
    console.warn('Daily attempt start failed:', err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Persist a newly found solution (registered users only).
 * On failure, queues the payload and retries later so SQL stays the source of truth.
 */
const PENDING_SOLVES_KEY = 'tilezilla_pending_solves_v1';

function readPendingSolves() {
  try {
    const raw = localStorage.getItem(PENDING_SOLVES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePendingSolves(list) {
  try {
    if (!list.length) localStorage.removeItem(PENDING_SOLVES_KEY);
    else localStorage.setItem(PENDING_SOLVES_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* quota */
  }
}

function pendingSolveKey(payload) {
  const levelId = payload?.levelId || '';
  const placements = JSON.stringify(payload?.placements || []);
  return `${levelId}|${placements}`;
}

function enqueuePendingSolve(payload) {
  const list = readPendingSolves();
  const key = pendingSolveKey(payload);
  if (list.some((p) => pendingSolveKey(p) === key)) return;
  list.push({
    levelId: payload.levelId,
    placements: payload.placements,
    check: payload.check || {},
    meta: payload.meta || {},
    queuedAt: new Date().toISOString(),
  });
  writePendingSolves(list);
}

function dequeuePendingSolve(payload) {
  const key = pendingSolveKey(payload);
  writePendingSolves(readPendingSolves().filter((p) => pendingSolveKey(p) !== key));
}

function solveRequestBody(payload) {
  return JSON.stringify({
    levelId: payload.levelId,
    placements: payload.placements,
    check: payload.check || {},
    meta: payload.meta || {},
  });
}

async function postSolveToServer(payload, { keepalive = false } = {}) {
  const res = await fetch('/api/progress/solve', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: solveRequestBody(payload),
    keepalive: !!keepalive,
    signal: keepalive ? undefined : AbortSignal.timeout(10000),
  });
  // On pagehide keepalive, prefer not to read the body — status is enough to dequeue.
  if (keepalive) {
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) {
    return { ok: false, error: body?.error || `HTTP ${res.status}`, ...body };
  }
  return { ok: true, ...body };
}

export async function syncSolveToServer({
  levelId,
  placements,
  check,
  meta = {},
} = {}) {
  if (!levelId || !Array.isArray(placements) || !placements.length) {
    return { ok: false, reason: 'missing-fields' };
  }

  const payload = { levelId, placements, check: check || {}, meta };
  // Queue first so an iOS page kill mid-await still leaves a retryable payload.
  enqueuePendingSolve(payload);
  try {
    const result = await postSolveToServer(payload);
    if (result.ok) {
      dequeuePendingSolve(payload);
      return result;
    }
    console.warn('Progress solve sync:', result.error || result);
    return result;
  } catch (err) {
    console.warn('Progress solve sync failed:', err);
    return { ok: false, error: String(err) };
  }
}

/** Retry any solves that failed to reach SQL (network / auth blip). */
export async function flushPendingSolves() {
  const pending = readPendingSolves();
  if (!pending.length) return { ok: true, flushed: 0, remaining: 0 };
  let flushed = 0;
  const still = [];
  for (const payload of pending) {
    try {
      const result = await postSolveToServer(payload);
      if (result.ok) flushed += 1;
      else still.push(payload);
    } catch {
      still.push(payload);
    }
  }
  writePendingSolves(still);
  return { ok: still.length === 0, flushed, remaining: still.length };
}

/**
 * Fire-and-forget flush for pagehide / backgrounding.
 * Safari often cancels awaited fetch on hide; keepalive stays in flight briefly.
 */
export function flushPendingSolvesOnLeave() {
  const pending = readPendingSolves();
  if (!pending.length) return { ok: true, flushed: 0, remaining: 0 };
  for (const payload of pending) {
    try {
      void postSolveToServer(payload, { keepalive: true })
        .then((result) => {
          if (result?.ok) dequeuePendingSolve(payload);
        })
        .catch(() => { /* retry on next resume */ });
    } catch {
      /* ignore */
    }
  }
  return { ok: true, flushed: 0, remaining: pending.length };
}

let pendingFlushBound = false;
let resumeSyncInFlight = null;
let lastResumeSyncAt = 0;
const RESUME_SYNC_THROTTLE_MS = 5000;
const VISIBLE_SYNC_INTERVAL_MS = 30000;

/**
 * Bind progress synchronization to browser lifecycle events.
 *
 * A player may leave this page open while solving on another device. Pull the
 * server union whenever this game becomes active again so a stale tab does not
 * require a hard refresh. The throttle collapses the focus + visibilitychange
 * pair that browsers commonly emit together.
 *
 * @param {import('./progress.js').Progress} [progress]
 */
export function bindPendingSolveFlush(progress = null) {
  if (pendingFlushBound || typeof window === 'undefined') return;
  pendingFlushBound = true;

  const run = () => {
    const now = Date.now();
    if (resumeSyncInFlight || now - lastResumeSyncAt < RESUME_SYNC_THROTTLE_MS) return;
    lastResumeSyncAt = now;
    resumeSyncInFlight = (async () => {
      await flushPendingSolves();
      if (progress) await refreshProgressFromServer(progress);
    })()
      .catch((err) => console.warn('Progress resume sync failed:', err))
      .finally(() => { resumeSyncInFlight = null; });
  };

  const flushOnLeave = () => {
    flushPendingSolvesOnLeave();
  };

  window.addEventListener('online', run);
  window.addEventListener('focus', run);
  window.addEventListener('pageshow', run);
  window.addEventListener('pagehide', flushOnLeave);
  window.addEventListener('freeze', flushOnLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnLeave();
    else if (document.visibilityState === 'visible') run();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') run();
  }, VISIBLE_SYNC_INTERVAL_MS);
}
