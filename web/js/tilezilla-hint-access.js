/**
 * Shared checks — hints and example route require token balance (server-backed when registered).
 */

import { applyHintBalanceToApp, fetchHintBalance, usesServerHints } from './tilezilla-hints-sync.js';

const BOARD_HINT_TYPES = ['random', 'start', 'end'];

export async function refreshHintBalanceForApp(app) {
  if (!app) return 0;
  if (usesServerHints()) {
    try {
      const balance = await fetchHintBalance();
      return applyHintBalanceToApp(app, balance, app.state?.userId);
    } catch (err) {
      console.warn('Hint balance refresh:', err);
    }
  }
  return Math.max(0, Number(app.getGlobalHintTokens?.()) || 0);
}

export function hasAffordableBoardHint(app) {
  if (!app) return false;
  if (!(app.boardAllowsHints?.(app.state?.tiles) ?? true)) return false;
  if ((app.hintsRemainingThisPuzzle?.() ?? 0) <= 0) return false;
  return BOARD_HINT_TYPES.some((type) => {
    const cost = app.getHintCost?.(type) ?? 0;
    return app.canAffordHint?.(cost);
  });
}

export function canOpenExampleRoute(app) {
  if (!app) return false;
  const levelId = app.state?.currentLevel?.id;
  if (levelId && app.hasViewedExampleRoute?.(levelId)) return true;
  return app.canAffordExampleRoute?.() ?? false;
}

/**
 * Random in-game hint — allowed with tiles on the board (smart match); token + per-puzzle limits only.
 * @returns {{ blocked: boolean, message?: string, offerBuyHints?: boolean }}
 */
export function randomHintBlockReason(app) {
  if (!app?.state?.currentLevel?.id) {
    return { blocked: true, message: 'Load a puzzle first.' };
  }
  if ((app.randomHintsRemainingThisPuzzle?.() ?? 0) <= 0) {
    return { blocked: true, message: 'No random hints remaining for this puzzle (2 per puzzle).' };
  }
  if ((app.hintsRemainingThisPuzzle?.() ?? 0) <= 0) {
    return { blocked: true, message: 'No hints remaining for this puzzle.' };
  }
  const cost = app.getHintCost?.('random') ?? 1;
  const tokens = app.getGlobalHintTokens?.() ?? 0;
  if (tokens < cost) {
    return {
      blocked: true,
      message: `Need ${cost} hint token${cost === 1 ? '' : 's'} to use a random tile hint.`,
      offerBuyHints: true,
    };
  }
  return { blocked: false };
}

/**
 * @returns {{ blocked: boolean, message?: string, offerBuyHints?: boolean }}
 */
export function boardHintBlockReason(app) {
  if (!app) return { blocked: true, message: 'Game not ready.' };
  if (!(app.boardAllowsHints?.(app.state?.tiles) ?? true)) {
    return {
      blocked: true,
      message: 'Hints only work on an empty board or a board with hint tiles only.',
    };
  }
  if ((app.hintsRemainingThisPuzzle?.() ?? 0) <= 0) {
    return { blocked: true, message: 'No hints remaining for this puzzle.' };
  }
  const tokens = app.getGlobalHintTokens?.() ?? 0;
  if (tokens <= 0) {
    return {
      blocked: true,
      message: 'You have no hint tokens.',
      offerBuyHints: true,
    };
  }
  if (!hasAffordableBoardHint(app)) {
    const cheapest = Math.min(
      ...BOARD_HINT_TYPES.map((t) => app.getHintCost?.(t) ?? 99),
    );
    return {
      blocked: true,
      message: tokens < cheapest
        ? `Need at least ${cheapest} hint token${cheapest === 1 ? '' : 's'} for the cheapest hint.`
        : 'Not enough hint tokens for any hint on this puzzle.',
      offerBuyHints: true,
    };
  }
  return { blocked: false };
}

/**
 * @returns {{ blocked: boolean, message?: string, offerBuyHints?: boolean }}
 */
export function exampleRouteBlockReason(app) {
  if (!app?.state?.currentLevel?.id) {
    return { blocked: true, message: 'Load a puzzle first.' };
  }
  if (canOpenExampleRoute(app)) return { blocked: false };
  const cost = app.getExampleRouteTokenCost?.() ?? 1;
  return {
    blocked: true,
    message: `Need ${cost} hint token${cost === 1 ? '' : 's'} to view an example route.`,
    offerBuyHints: true,
  };
}
