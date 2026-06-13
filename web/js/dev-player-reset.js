/** Dev-only: wipe per-player local progress so puzzles can be re-tested. */

const DEFAULT_HINT_TOKENS = {
  gar: 5,
  Arn: 18,
  dev: 99,
};

function progressKey(userId) {
  return `snake_progress_v1_${userId}`;
}

function hintTokensKey(userId) {
  return `snake_hint_tokens_v1_${userId}`;
}

function puzzleBestPrefix(userId) {
  return `snake_puzzle_best_v1_${userId}_`;
}

/**
 * Remove saved solutions, best times, hint balance, and daily rows for one dev player.
 * @returns {{ removedKeys: string[], hintTokens: number }}
 */
export function resetDevPlayerProgress(userId) {
  if (!userId) throw new Error('userId required');

  const removedKeys = [];

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key === progressKey(userId)
      || key === hintTokensKey(userId)
      || key.startsWith(puzzleBestPrefix(userId))
    ) {
      localStorage.removeItem(key);
      removedKeys.push(key);
    }
  }

  try {
    const dailyKey = 'snake_daily_results_v1';
    const raw = localStorage.getItem(dailyKey);
    if (raw) {
      const store = JSON.parse(raw);
      if (store && typeof store === 'object') {
        let changed = false;
        for (const [rowKey, row] of Object.entries(store)) {
          if (row?.userId === userId) {
            delete store[rowKey];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem(dailyKey, JSON.stringify(store));
          removedKeys.push(`${dailyKey} (filtered)`);
        }
      }
    }
  } catch { /* ignore */ }

  const hintTokens = DEFAULT_HINT_TOKENS[userId] ?? 18;
  localStorage.setItem(hintTokensKey(userId), String(hintTokens));
  removedKeys.push(`${hintTokensKey(userId)}=${hintTokens}`);

  return { removedKeys, hintTokens };
}
