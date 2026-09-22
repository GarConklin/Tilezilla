/**
 * Per-puzzle attempt stats: moves (place from preview, or rotate while on board).
 */

let attemptMoveCount = 0;
let attemptPlayCounted = false;

export function resetAttemptStats() {
  attemptMoveCount = 0;
  attemptPlayCounted = false;
}

export function recordBoardMove() {
  attemptMoveCount += 1;
  return attemptMoveCount;
}

export function getAttemptMoveCount() {
  return Math.max(0, attemptMoveCount | 0);
}

/** True once per attempt when the player starts the clock (first placement). */
export function markAttemptPlayStarted() {
  if (attemptPlayCounted) return false;
  attemptPlayCounted = true;
  return true;
}

export function wasAttemptPlayStarted() {
  return attemptPlayCounted;
}
