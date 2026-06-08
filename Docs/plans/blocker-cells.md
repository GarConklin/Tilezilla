# Blocker Cells Plan

## Concept
Add 1x1 blocker cells to the board that act as impassable obstacles.
Tiles cannot be placed on them and they behave like board edges (no live edges).
The snake path must route around them.

## Why
- Enables odd-cell boards (e.g., 3x3 with 1 blocker = 8 cells = 4 tiles)
- Same board size can have totally different puzzles by moving blockers
- Increases difficulty and path variety
- Opens up corridor/maze-like board layouts

## Target: 3x3 Board
- 3x3 = 9 cells, need 1 blocker to get 8 playable cells (4 tiles)
- Smallest possible puzzle board
- Blocker placement changes the puzzle entirely:
  - Corner blocker: easier, more open routing
  - Center blocker: hardest, forces edge-hugging path
  - Edge blocker: medium difficulty

## Level Definition
- Add optional typed blockers array: `[[r, c, "B1"], ...]` (or `B2` where needed)
- Load into state.blockers during loadLevel()
- Runtime fallback: if `tiles` includes `B1`/`B2` and `blockers` is missing, derive blocker coordinates from `solvesFile` placements.

## Implementation Steps
1. Board Rendering: dark/gray cells with wall pattern, CSS .cell.blocked
2. Placement Validation: treat blockers same as out-of-bounds
3. Live edge pointing at blocker = invalid (same as board edge)
4. Occupancy Grid: pre-mark blocker cells as BLOCKED
5. Solver: mark blocked cells, skip in placement checks
6. Sandbox Mode (future): click cells to toggle blockers before playing

## Multi-Blocker Ideas
- 4x4 with 2 blockers = 14 cells = 7 tiles
- 5x5 with 1 blocker = 24 cells = 12 tiles
- Asymmetric placement prevents mirror solutions naturally

## Future: Two-Snake Mode (Separate Feature)
- 2 SH + 2 ET on one board, each snake independent path
- Examples found: 2S x 3x6 (9 tiles), 2S x 4x6 (12 tiles)
- Requires solver changes for two independent path chains