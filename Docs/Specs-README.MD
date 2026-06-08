# Snake Tile Specs

This document defines how tile edge wiring is interpreted from `data/tiles/tiles-live-edges.json`.

Tile logic uses stable tile IDs (`SH`, `ET`, `UT`, etc.). Visual assets are selected via `data/tiles/tilesets.json` (for example, `gray-backs` maps to `*-Snake-G-Tile.png`, while `og` maps to legacy names).

## External vs Internal Wiring

- **`A` / `B` edge arrays** are the tile's **external (boundary) live edges**.
- These are the edges that may connect to neighbor cells on the board.

## `paths` Field (Optional)

- `paths` defines **internal wiring** inside a tile.
- `paths` is **not required** unless a tile needs explicit internal routing (for example, crossover behavior).
- When present, each item in `paths` defines one internal route using:
  - `ends`: two endpoints in the form `["A"|"B", "N"|"E"|"S"|"W"]`.
- Optional display metadata can be included per path:
  - `id`: stable identifier like `"p1"`, `"p2"` (recommended when multiple paths exist).
  - `color`: preferred UI color for that internal route (hex string, e.g. `"#ff6b6b"`).

Example:

```json
"r0": {
  "A": ["N","S"],
  "B": ["N","S"],
  "paths": [
    { "id": "p1", "color": "#ff6b6b", "ends": [["A","N"], ["B","S"]] },
    { "id": "p2", "color": "#4dabf7", "ends": [["A","S"], ["B","N"]] }
  ]
}
```

## Implied Behavior When `paths` Is Missing

- If a rotation has no `paths`, wiring is **implied** by legacy behavior.
- Legacy implied behavior keeps compatibility with existing tiles:
  - For tiles with per-cell continuity (e.g. DB), routing is assumed within each cell lane (A-with-A, B-with-B).
  - Existing tiles continue working without adding `paths`.
- If `paths` exists but `color` is omitted, renderer uses default edge color rules.

## Path Color Rules (Optional UI Contract)

- Path colors are a rendering hint only; they do not change solver validity.
- Recommended fallback precedence for edge color:
  1. `paths[i].color` (explicit per-path)
  2. app-level default palette by `paths[i].id` / index
  3. existing single-color live-edge rendering
- Backward compatibility:
  - Old tiles (no `paths`) remain unchanged.
  - Tiles with `paths` but no colors remain valid and use fallback colors.

## Compatibility Rule

- **Backward compatible by default**: old tiles do not need changes.
- **Forward explicitness**: new special tiles may include `paths` to override ambiguous internal routing.

---

## Integrated Project README Content

This project is structured as:

- `web/index.html` for layout
- `web/css/styles.css` for styling
- `web/js/app_v16.js` (current app module) for UI and placement behavior
- `web/js/solver.js` for solver behavior and logs
- `web/js/solutions.js` for solution save/load flows

Run with Docker:

```bash
docker compose up --build
```

Expected tile assets in `web/img/` include:

- Tile image files (`web/img/*.png`)
- `web/img/tiles.json` (if used by current loader)
- `data/tiles/tiles-live-edges.json` (authoritative edge + wiring spec)

---

## Integrated Tile Anchor & Shape Specification

### Purpose

Tile definitions are anchor-based so current 2-cell dominoes and future larger tiles can share one engine model.

### Core Definitions

- A tile is composed of one or more cells (`A`, `B`, `C`, ...)
- A cell is one occupied board square
- `A` is the anchor reference cell

### Anchor Rule (authoritative)

- `A` must always be `{ "dr": 0, "dc": 0 }`
- Tile placement coordinate `(r, c)` always refers to anchor `A`

### Shape Rules

- `shape` entries use `{ "id": "...", "dr": <int>, "dc": <int> }`
- `A` must exist
- Offsets are integers
- No duplicate `(dr, dc)` coordinates in one shape
- Runtime footprint/placement size is derived from `shape` (cell count + offsets), not from a hardcoded `A+B` domino assumption.

### Rotation Rules

- Rotations are `r0`, `r90`, `r180`, `r270`
- Clockwise order: `N -> E -> S -> W -> N`
- Every cell listed in `shape` must have edge definitions for each rotation

### Live Edge Rules

- Valid edge values: `N`, `E`, `S`, `W`
- Empty list `[]` means no live edges
- `A`/`B` edge arrays describe external boundary connectivity
- Optional `paths` entries describe explicit internal routing

### Metadata Keys

- `_meta` for file-level notes
- `_comment` for tile-level notes
- Metadata keys are ignored by engine logic

### JSON Style Preference (Authoritative)

Use a hybrid JSON layout for tile logic files (especially `data/tiles/tiles-live-edges.json`):

- Keep tile entries readable as multi-line blocks.
- Keep `shape` as a short multi-line array of compact objects.
- Keep rotation rows inline when simple, e.g. `"r0": { "A": [], "B": ["E"] }`.
- Avoid both extremes: do not fully minify and do not overly spread small objects.

## Tile Definition Template (Copy/Paste)

Use this when adding or updating a tile in `data/tiles/tiles-live-edges.json`:

```json
"CR-Snake-G-Tile.png": {
  "shape": [
    { "id": "A", "dr": 0, "dc": 0 },
    { "id": "B", "dr": 0, "dc": 1 }
  ],
  "count": 1,
  "r0": {
    "A": ["N", "S"],
    "B": ["N", "S"],
    "paths": [
      { "id": "p1", "color": "#ff6b6b", "ends": [["A", "N"], ["B", "S"]] },
      { "id": "p2", "color": "#4dabf7", "ends": [["A", "S"], ["B", "N"]] }
    ]
  },
  "r90": { "A": ["E", "W"], "B": ["E", "W"], "paths": [] },
  "r180": { "A": ["N", "S"], "B": ["N", "S"], "paths": [] },
  "r270": { "A": ["E", "W"], "B": ["E", "W"], "paths": [] }
}
```

Notes:
- Use `paths` only when explicit internal routing is needed.
- If a rotation has no explicit internal routing, omit `paths` or keep it empty.

### Level + Solve Posting Template (Copy/Paste)


- Levels and solve payloads should use tile IDs (`SH`, `ET`, `UT`, etc.), not filename-based tile keys.
When adding a new level, update `data/levels/levels.json` like this:

```json
{
  "id": "4x4-Dbl-A",
  "name": "Dbl 6A",
  "board": { "rows": 4, "cols": 4 },
  "tiles": {
    "SH": 2,
    "ET": 2,
    "DB": 1,
    "LR": 1,
    "UT": 1,
    "LL": 1
  },
  "pathMode": "multi",
  "pathCount": 2,
  "solvesFile": "4x4-Dbl-A.json"
}
```

And save solves in `solves/<file>.json` like this:

```json
{
  "board": { "rows": 4, "cols": 4 },
  "tiles": {
    "SH": 2,
    "ET": 2,
    "DB": 1,
    "LR": 1,
    "UT": 1,
    "LL": 1
  },
  "totalUniqueSolutions": 1,
  "solutions": [
    {
      "id": "<timestamp-or-guid>",
      "label": "Solve 1",
      "placements": [
        { "tile": "SH", "r": 0, "c": 0, "deg": 0 }
      ]
    }
  ]
}
```

Quick rule:
- **One snake:** `"pathMode": "single", "pathCount": 1`
- **Extra snakes (2×SH, 2×ET, …):** `"pathMode": "multi", "pathCount": <snakes on board>` (usually `min(SH, ET)`)
- **Library size:** `"totalUniqueSolutions": <N>` on the level row, synced from `solves/<file>.json` (not stored in `pathCount`)

### New Level Checklist (5 Steps)

1. Add level entry in `data/levels/levels.json` (`id`, `name`, `board`, `tiles`, `pathMode`, `pathCount`, `totalUniqueSolutions`, `solvesFile`).
2. Create/append solve data in `solves/<solvesFile>` using the `solutions[].placements` format.
3. Run solver for that level: `node solves/solve-level.js <level-id>`.
4. Open the level in UI and click Validate to confirm board rules pass.
5. Refresh/reload the app so the level dropdown reads latest `data/levels/levels.json`.

---

## Integrated Tile Placement Rules

### Board & Tile Fundamentals

- Grid is configured per level; the wide “5×6” family uses **rows=6, cols=5** with ids/files prefixed **`5x6-`**
- Domino tiles occupy 2 cells
- Rotations define `B` offset from `A`:
  - `r0`: `(r, c+1)`
  - `r90`: `(r+1, c)`
  - `r180`: `(r, c-1)`
  - `r270`: `(r-1, c)`

### Core Placement Constraints

1. Tile count availability must permit placement
2. Live edges must not point off-board
3. Tile footprint cannot overlap occupied cells
4. Neighbor edge matching must be valid (live-live and dead-dead expectations)
5. Non-initial placements must connect to active path (no floating islands)

### Advanced Validation / Pruning

- Prevent isolated single empty cells
- Require even-sized empty regions for domino fillability
- Verify adjacent empty cells remain satisfiable by remaining tile inventory
- Deep-check both cells of candidate tile against local neighbor requirements
- Ensure snake tip can still reach ET entry through reachable empties
- Reject dead-end states with remaining required placements

### Connectivity and Dedup

- Solutions are deduped by effective edge-state board hash
- Hashing handles interchangeable identical tiles and rotational equivalence
- Validation flow is ordered from cheap checks to expensive pruning for performance

### Special Behavior Notes

- DB tiles expose two parallel lanes (high branching impact)
- VL uses one live cell lane with one dead cell
- SH/ET act as single-entry/exit endpoints for classic single-snake mode
- solves/solve-level.js uses exhaustive SH/ET start placement by default (interior + edge cells) to avoid missing valid solutions like 3x6-G; edge-only endpoint search is heuristic-only and must stay opt-in.

### Solver Gotchas (Do Not Forget)

- Keep SH/ET start search exhaustive by default (interior + edge cells).
- Treat edge-only SH/ET placement as an opt-in speed heuristic, never default correctness mode.
- For tiles with explicit paths, follow internal route mapping first; only use legacy implied routing when paths is absent.

### Zero-Solution Debug Checklist

- Replay one known-good placement set from solves/<level>.json and confirm each placement passes canPlace + wouldCreateHole.
- Verify SH/ET seed generation includes interior positions (no implicit edge-only pruning).
- Confirm tile rotation data exists for all used tiles in data/tiles/tiles-live-edges.json, including any paths definitions.
- Temporarily disable aggressive heuristics/pruning and compare counts; if solutions reappear, the regression is in pruning logic.

## Paths + Color Coding Update

To support multi-route tiles, `paths` may include optional display metadata:

- `id` (recommended): stable route identifier like `"p1"`, `"p2"`
- `color` (optional): hex color hint for that route, e.g. `"#ff6b6b"`

Example:

```json
"r0": {
  "A": ["N","S"],
  "B": ["N","S"],
  "paths": [
    { "id": "p1", "color": "#ff6b6b", "ends": [["A","N"], ["B","S"]] },
    { "id": "p2", "color": "#4dabf7", "ends": [["A","S"], ["B","N"]] }
  ]
}
```

### Rendering contract (backward compatible)

- Path colors are **UI hints only**; they do not affect solver validity.
- Fallback precedence:
  1. `paths[i].color`
  2. app default palette by path index/id
  3. existing single-color live-edge rendering
- Tiles without `paths` keep implied legacy wiring behavior.
- Tiles with `paths` but no `color` remain valid and use fallback colors.

---

## Blocker Types

- `B1`: solid blocker cell (impassable blocker tile).
- `B2`: blank blocker-style cell (type-two blocker visual/semantic variant).
- Blocker visuals come from `data/tiles/tilesets.json` by active tileset.

### Level Fields

- `blockerType` (optional): default blocker tile ID for all blocker cells in that level.
  - Example: `"blockerType": "B1"`
- `blockers` supports two forms:
  - `[r, c]` -> uses level default `blockerType` (or fallback `B1`).
  - `[r, c, "B2"]` -> per-cell blocker type override.

### Example

```json
{
  "id": "3x3-A",
  "board": {"rows":3,"cols":3},
  "blockerType": "B1",
  "blockers": [[0,0],[1,1,"B2"]]
}
```

## Blocker Cells Spec (Integrated)

### Concept

- Blockers are 1x1 impassable cells.
- Tiles cannot be placed on blocker cells.
- Blockers behave like board boundaries for edge validation (live edge into blocker is invalid).

### Why

- Enables odd-cell playable layouts by reducing open cells to an even count.
- Increases puzzle variety by changing topology without changing board size.
- Supports corridor and maze-like puzzle layouts.

### Level Schema

- Levels may include optional `blockers` array:
  - `"blockers": [[r, c], ...]`
- `blockers` coordinates are board-cell positions in level space.

### Engine Rules

1. **Rendering**: blocked cells use a distinct blocked style (e.g. `.cell.blocked`).
2. **Placement**: footprint overlap with a blocker is invalid.
3. **Edge validity**: any live edge pointing into blocker is invalid (same as out-of-bounds).
4. **Occupancy model**: blocker cells are pre-marked blocked.
5. **Solver**: blocked cells are excluded from placement and path expansion.

### Example Use Case

- `3x3` board with one blocker gives 8 playable cells (4 domino tiles).
- Blocker position changes difficulty:
  - corner blocker = more open
  - edge blocker = medium
  - center blocker = tightest routing

### Notes

- Multi-blocker levels are supported by the same schema.
- Two-snake mode remains a separate future feature.

---

## Scripts Reference

### `solves/solve-level.js`

Exhaustive solver / enumerator. Finds all unique solutions for a given level.

```bash
node solves/solve-level.js 5x6-0A-AAA
node solves/solve-level.js 5x6-0A-AAA --compare solves/5x6-0A-AAA.json
```

- Square boards: solutions deduped up to 90° rotation (C4).
- Non-square boards: half-turn (180°) only.
- Writes output to `solves/<level-id>.json`.

### `scripts/audit-solve-dedup.js`

Audits solve files for rotational duplicates the solver missed. Uses cell-level edge fingerprints (not anchor tuples) to catch tiles like SS/SZ where 180° board rotation produces a physically identical placement with a different anchor/deg representation.

```bash
node scripts/audit-solve-dedup.js                          # audit all solve files
node scripts/audit-solve-dedup.js solves/4x5-0B-AAB.json   # audit one file
node scripts/audit-solve-dedup.js --fix                     # remove duplicates in-place
```

- Non-square boards: checks 180° rotation.
- Square boards (3x3, 4x4, 5x5, 6x6): checks 90°, 180°, 270° rotations.
- `--fix` removes duplicates, renumbers solution IDs, and updates `totalUniqueSolutions`.
- Run `backfill-path-counts.js` after `--fix` to sync manifest counts.

### `scripts/backfill-path-counts.js`

Reads solve files and updates `pathCount` in level bucket files (`data/levels/*.json`).

```bash
node scripts/backfill-path-counts.js            # update missing pathCounts
node scripts/backfill-path-counts.js --force     # re-derive all counts
node scripts/backfill-path-counts.js --dry-run   # preview without writing
```

### `scripts/audit-solves-tile-bag.js`

Validates that solve file tile bags match their level definitions.

### `scripts/audit-enumerator-vs-catalog.js`

Cross-checks the enumerator output against the level catalog for consistency.

### `scripts/ingest-external-solve-docs.js`

Imports solve documents from external sources with validation (tile count, in-bounds checks).
