/**
 * Sync encountered tile types with tilegame DB (guest + registered).
 */

import { AUTH_API } from './tilezilla-auth.js';
import { getGuestCode } from './tilezilla-guest.js';

const LOCAL_KEY_PREFIX = 'tilezilla_encountered_v1_';

export function encounteredTilesLocalKey(userId) {
  if (!userId) return null;
  return `${LOCAL_KEY_PREFIX}${userId}`;
}

export function readEncounteredTilesLocal(userId) {
  const key = encounteredTilesLocalKey(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeEncounteredTilesLocal(userId, tiles) {
  const key = encounteredTilesLocalKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify([...new Set(tiles.filter(Boolean))]));
  } catch {
    /* quota */
  }
}

export async function fetchEncounteredTilesFromServer() {
  const guestCode = getGuestCode();
  const url = guestCode
    ? `${AUTH_API}/encountered-tiles.php?guest_code=${encodeURIComponent(guestCode)}`
    : `${AUTH_API}/encountered-tiles.php`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success || !Array.isArray(data.tiles)) {
      return null;
    }
    return data.tiles.filter(Boolean);
  } catch {
    return null;
  }
}

export async function postEncounteredTilesToServer(tileIds) {
  if (!Array.isArray(tileIds) || !tileIds.length) return null;
  const body = { tiles: tileIds };
  const guestCode = getGuestCode();
  if (guestCode) body.guest_code = guestCode;
  try {
    const res = await fetch(`${AUTH_API}/encountered-tiles.php`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) return null;
    return {
      newTiles: Array.isArray(data.new_tiles) ? data.new_tiles : [],
      tiles: Array.isArray(data.tiles) ? data.tiles : null,
    };
  } catch {
    return null;
  }
}

export async function hydrateEncounteredTiles(progress, userId) {
  if (!progress || !userId) return;

  const local = readEncounteredTilesLocal(userId);
  const remote = await fetchEncounteredTilesFromServer();
  const merged = [...new Set([...(remote || []), ...local])];
  if (!merged.length && !local.length) return;

  progress.setEncounteredTileTypes(merged, { persist: true });
  writeEncounteredTilesLocal(userId, merged);
}

export function queueEncounteredTilesServerSync(tileIds) {
  if (!Array.isArray(tileIds) || !tileIds.length) return;
  postEncounteredTilesToServer(tileIds).then((result) => {
    if (result?.tiles?.length) {
      const userId = window.__app?.state?.userId;
      if (userId) writeEncounteredTilesLocal(userId, result.tiles);
    }
  });
}
