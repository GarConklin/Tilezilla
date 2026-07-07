/**
 * Lazy level catalog — index at boot, full level rows on demand.
 * Passport / adventure metadata uses stats-index.json (no tile bags).
 */

const STATS_URL = '/data/levels/stats-index.json';
const INDEX_URL = '/data/levels/index.json';

let catalogReady = false;
let levelBuckets = null;
let bucketByFile = new Map();
let levelById = new Map();
let bucketLoadPromises = new Map();
let statsIndex = null;
let statsLoadPromise = null;

async function fetchJson(url, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/** Parse level id → bucket filename, e.g. 5x6-0B-AAC → 5x6-0B.json */
export function bucketFileForLevelId(levelId) {
  const m = /^(\d+x\d+)-(\d[A-Z])-/i.exec(String(levelId || '').trim());
  return m ? `${m[1]}-${m[2]}.json` : null;
}

function registerLevelInState(state, level) {
  if (!level?.id || !state) return;
  levelById.set(level.id, level);
  if (!Array.isArray(state.allLevels)) state.allLevels = [];
  if (!state.allLevels.some((l) => l.id === level.id)) {
    state.allLevels.push(level);
  }
}

function ingestBucketDoc(state, doc) {
  for (const level of doc?.levels || []) {
    if (level?.id) registerLevelInState(state, level);
  }
}

async function loadBucketFile(file, state) {
  if (bucketByFile.has(file)) return bucketByFile.get(file);
  if (bucketLoadPromises.has(file)) return bucketLoadPromises.get(file);

  const promise = (async () => {
    const doc = await fetchJson(`/data/levels/${file}`);
    bucketByFile.set(file, doc);
    ingestBucketDoc(state, doc);
    return doc;
  })().finally(() => {
    bucketLoadPromises.delete(file);
  });

  bucketLoadPromises.set(file, promise);
  return promise;
}

/**
 * Load levels/index.json only. Sets state.levelBuckets and marks catalog ready.
 * @param {object} [state] app state
 */
export async function initLevelCatalog(state = null) {
  if (catalogReady) return { buckets: levelBuckets || [] };

  const idx = await fetchJson(INDEX_URL);
  levelBuckets = (idx?.buckets || [])
    .filter((b) => b && typeof b.size === 'string' && typeof b.tier === 'string')
    .map((b) => ({
      size: b.size,
      tier: b.tier,
      file: b.file,
      count: Number(b.count || 0),
    }));

  if (state) {
    state.levelBuckets = levelBuckets;
    state.allLevels = [];
  }

  catalogReady = true;
  return { buckets: levelBuckets };
}

export function isCatalogReady() {
  return catalogReady;
}

/** Lightweight stats for passport / adventure (lazy). */
export async function loadLevelStatsIndex() {
  if (statsIndex) return statsIndex;
  if (statsLoadPromise) return statsLoadPromise;

  statsLoadPromise = (async () => {
    try {
      statsIndex = await fetchJson(STATS_URL);
    } catch (e) {
      console.warn('level stats index unavailable', e);
      statsIndex = { schema: 'levels-stats-v1', byId: {} };
    }
    return statsIndex;
  })().finally(() => {
    statsLoadPromise = null;
  });

  return statsLoadPromise;
}

export function levelFromStats(levelId, statsDoc = statsIndex) {
  const raw = statsDoc?.byId?.[levelId];
  if (!raw) return null;
  return {
    id: levelId,
    totalUniqueSolutions: Number(raw.t) || 0,
    board: { rows: Number(raw.r) || 0, cols: Number(raw.c) || 0 },
  };
}

export function getCachedLevel(levelId) {
  return levelById.get(levelId) || null;
}

/**
 * Load the bucket containing levelId if needed; return full catalog row.
 * @param {string} levelId
 * @param {object} [state] app state — levels appended to state.allLevels
 */
export async function ensureLevel(levelId, state = null) {
  const id = String(levelId || '').trim().replace(/\.json$/i, '');
  if (!id) return null;

  const cached = levelById.get(id);
  if (cached) return cached;

  const file = bucketFileForLevelId(id);
  if (!file) return null;

  await loadBucketFile(file, state);
  return levelById.get(id) || null;
}

/** Batch-load buckets for several level ids (deduped by file). */
export async function ensureLevels(levelIds, state = null) {
  const files = new Set();
  for (const levelId of levelIds || []) {
    const id = String(levelId || '').trim().replace(/\.json$/i, '');
    if (!id || levelById.has(id)) continue;
    const file = bucketFileForLevelId(id);
    if (file) files.add(file);
  }
  await Promise.all([...files].map((file) => loadBucketFile(file, state)));
  return (levelIds || [])
    .map((levelId) => levelById.get(String(levelId || '').trim().replace(/\.json$/i, '')))
    .filter(Boolean);
}

/** Dev / editor: load every bucket (legacy behaviour). */
export async function loadAllLevelBuckets(state = null) {
  await initLevelCatalog(state);
  await Promise.all((levelBuckets || []).map((b) => loadBucketFile(b.file, state)));
  return [...levelById.values()];
}
