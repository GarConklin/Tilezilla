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

export async function fetchServerProgress() {
  const res = await fetch('/api/progress', { credentials: 'include', cache: 'no-store' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.ok) {
    return { ok: false, error: payload?.error || `HTTP ${res.status}` };
  }
  return { ok: true, data: payload.data || {}, updatedAt: payload.updatedAt || null };
}

/**
 * On login: load server progress; migrate local blob if server is empty.
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

  if (serverLevels > 0 || serverSolves > 0) {
    progress.importSnapshot({ data: serverData });
    progress.save();
    window.__passportServerProgressHydrated = true;
    window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'server' } }));
    return { ok: true, source: 'server', levels: serverLevels, solves: serverSolves };
  }

  if (localLevels > 0 || localSolves > 0) {
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
        const retry = await fetchServerProgress();
        if (retry.ok && countProgressLevels(retry.data) > 0) {
          progress.importSnapshot({ data: retry.data });
          progress.save();
          window.__passportServerProgressHydrated = true;
        }
        window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'server-after-race' } }));
        return { ok: true, source: 'server-after-race', ...retry };
      }
      console.warn('Progress migrate:', payload?.error || res.status);
    } catch (err) {
      console.warn('Progress migrate failed:', err);
    }
  }

  window.dispatchEvent(new CustomEvent('tilezilla:progress-ready', { detail: { source: 'empty' } }));
  return { ok: true, source: 'empty' };
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
