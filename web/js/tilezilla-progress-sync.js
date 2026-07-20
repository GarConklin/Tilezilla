/**
 * Server-backed progress for registered users (PHP session required).
 */

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
  const res = await fetch('/api/progress', { credentials: 'include', cache: 'no-store' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.ok === false) {
    return { ok: false, error: payload?.error || `HTTP ${res.status}` };
  }
  return { ok: true, data: payload.data || {}, updatedAt: payload.updatedAt || null };
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
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.ok) {
        window.__passportServerProgressHydrated = true;
        window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'migrated-local' } }));
        return { ok: true, source: 'migrated-local', levels: localLevels, solves: localSolves };
      }
      if (payload?.skipped) {
        const merged = await mergeProgressToServer(localData);
        if (merged.ok && merged.data) {
          progress.importSnapshot({ data: merged.data });
          progress.save();
          window.__passportServerProgressHydrated = true;
          window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'merged-after-race' } }));
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
  return { ok: true, source: 'server', levels: serverLevels, solves: serverSolves };
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
 */
export async function syncSolveToServer({
  levelId,
  placements,
  check,
  meta = {},
} = {}) {
  if (!levelId || !Array.isArray(placements) || !placements.length) {
    return { ok: false, reason: 'missing-fields' };
  }

  try {
    const res = await fetch('/api/progress/solve', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        levelId,
        placements,
        check: check || {},
        meta,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok === false) {
      console.warn('Progress solve sync:', payload?.error || res.status);
      return { ok: false, ...payload };
    }
    return { ok: true, ...payload };
  } catch (err) {
    console.warn('Progress solve sync failed:', err);
    return { ok: false, error: String(err) };
  }
}
