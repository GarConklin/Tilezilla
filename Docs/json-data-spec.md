# JSON Data Specification — Garz Tile Puzzle

Reference for every JSON artifact the game, catalog, and solver use. Use this when authoring levels, exporting from TilePz, or building external tools.

**Related docs:** tile wiring detail in [`Specs-README.MD`](Specs-README.MD); catalog tiers/IDs in [`level-catalog.md`](level-catalog.md).

---

## 1. File map

| Path | Role | In git? |
|------|------|---------|
| `data/levels/index.json` | Manifest: lists bucket files by size/tier | Yes |
| `data/levels/<size>-<tier>.json` | Level bucket (e.g. `5x6-0B.json`) | Yes |
| `data/levels/levels.json` | Flat aggregate of all levels (`schema: levels-v1`) | Yes |
| `solves/<levelId>.json` | Canonical solve library for one level | No (folder gitignored; shipped as `solves.zip`) |
| `solves.zip` | Archive of `solves/*.json` | Yes |
| `data/tiles/tiles-live-edges.json` | Tile geometry + live edges + optional `paths` | Yes |
| `data/tiles/tilesets.json` | PNG filename map per visual theme | Yes |
| `data/tilepz solves *.txt` | **Import only:** concatenated solve docs from TilePz paste | No |

Runtime (Docker web server) serves `/data/*` and `/solves/*` from repo root.

---

## 2. Level ID convention

```
<size>-<tier>-<code>
```

| Part | Meaning | Examples |
|------|---------|----------|
| `size` | Board family as **rows×cols** in data, except **5×6 boards use `5x6`** (rows=6, cols=5) | `3x4`, `5x6`, `6x6` |
| `tier` | Tile palette tier | `0A`, `0B`, `0C`, `1A`, … |
| `code` | Three-letter sequence within bucket | `AAA` … `ZZZ` |

Examples: `5x6-0B-AXV`, `6x6-0B-ACP`.

**Tiers (summary):**

- **0A** — base tiles only (`SH`, `ET`, `UT`, `RC`, `LC`, `DB`, `HL`, `VL`, `LL`, `LR`)
- **0B** — uses at least one advanced tile (`SZ`, `SS`, `DS`, `QC`, `DC`)
- **0C** — uses at least one superior tile (`CC`, `CR`, `CT`, `CQ`, `E1`, `E2`, `B2`, …)

---

## 3. Level bucket — `data/levels/<size>-<tier>.json`

```json
{
  "schema": "levels-bucket-v1",
  "size": "6x6",
  "tier": "0B",
  "count": 77,
  "levels": [ /* level objects */ ]
}
```

### Level object (required fields)

```json
{
  "id": "6x6-0B-ACP",
  "name": "ACP",
  "board": { "rows": 6, "cols": 6 },
  "tiles": {
    "SH": 1,
    "ET": 1,
    "UT": 5,
    "RC": 2,
    "LR": 2,
    "QS": 1,
    "SS": 1,
    "SZ": 1,
    "VL": 4
  },
  "blockers": [],
  "solvesFile": "6x6-0B-ACP.json",
  "pathMode": "single",
  "pathCount": 1,
  "totalUniqueSolutions": 8
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique level id (see §2) |
| `name` | string | Three-letter code (suffix of `id`) |
| `board.rows` | number | Row count |
| `board.cols` | number | Column count |
| `tiles` | object | Map **tile id → count** in the level bag. Must include exactly one `SH` and one `ET` for single-snake levels. |
| `blockers` | array | Fixed impassable cells (see §7). May be `[]`. |
| `solvesFile` | string | Filename under `solves/` (usually `<id>.json`) |
| `pathMode` | string | `"single"` = one snake (SH→ET). Multi-path not implemented in enumerator. |
| `pathCount` | number | Number of distinct snake paths implied by tile bag (usually `1` for catalog levels) |
| `totalUniqueSolutions` | number | Count of unique layouts in `solvesFile` (synced from solver/ingest) |

Optional: `blockerType` (default blocker tile id, usually `"B1"`).

### Blockers

Each entry is either:

- `[row, col]` — uses `blockerType` or `"B1"`
- `[row, col, "B1"]` or `[row, col, "B2"]` — explicit blocker tile

```json
"blockers": [[0, 0], [1, 1, "B2"]]
```

Coordinates are **0-based**; `(0,0)` is top-left.

---

## 4. Level index — `data/levels/index.json`

```json
{
  "schema": "levels-index-v1",
  "buckets": [
    {
      "size": "5x6",
      "tier": "0B",
      "file": "5x6-0B.json",
      "count": 653
    }
  ]
}
```

The web app loads `index.json`, then fetches each `file` under `data/levels/`.

`data/levels/levels.json` duplicates all level objects in one array (`schema: levels-v1`) for scripts/CSV export; same level shape as §3.

---

## 5. Solve document — `solves/<levelId>.json`

One file per level. Loaded at `/solves/<solvesFile>`.

```json
{
  "board": { "rows": 6, "cols": 6, "cells": 36 },
  "tileSet": "tiles-live-edges.json",
  "tiles": {
    "ET": 1,
    "LR": 2,
    "QS": 1,
    "RC": 2,
    "SH": 1,
    "SS": 1,
    "SZ": 1,
    "UT": 5,
    "VL": 4
  },
  "totalUniqueSolutions": 8,
  "solverMeta": {
    "seedsTotal": 9888,
    "seedsUsed": 9888,
    "seedsDominoNonOverlap": 12976,
    "viableSeedsOnly": true,
    "totalIters": 262822272,
    "pruning": "full",
    "enumerateNote": "tiles-live-edges + level bag; single SH/ET; dedupe square layouts up to 90° rotation (C4)"
  },
  "levelId": "6x6-0B-ACP",
  "generatedAt": "2026-06-06T06:15:57.803Z",
  "solutions": [
    {
      "id": "solve-1",
      "label": "6x6-0B-ACP solver 1",
      "placements": [ /* see §6 */ ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `board` | object | `rows`, `cols`; optional `cells` (= rows×cols) |
| `tileSet` | string | Always `"tiles-live-edges.json"` for current engine |
| `tiles` | object | Tile bag (must match level catalog bag after ingest) |
| `totalUniqueSolutions` | number | Must equal `solutions.length` |
| `solverMeta` | object | Optional enumeration stats (see below) |
| `levelId` | string | Canonical catalog id (added on write/merge) |
| `generatedAt` | string | ISO-8601 timestamp |
| `solutions` | array | Unique layouts, rotation-deduped |

### `solverMeta` (optional, from enumerator)

| Field | Meaning |
|-------|---------|
| `seedsTotal` / `seedsUsed` | SH×ET seed pairs considered |
| `seedsDominoNonOverlap` | Raw domino placements before viability filter |
| `viableSeedsOnly` | `true` if non-viable seeds were skipped |
| `totalIters` | DFS iteration count |
| `pruning` | `"full"`, `"isolated"`, or `"none"` |
| `enumerateNote` | Human-readable dedup rule |

### Solution dedup rules (canonical counts)

- **Square boards** (`rows === cols`): layouts equivalent under **90° rotation** count as one solution.
- **Rectangle boards** (e.g. 5×6): **180° rotation** only.

---

## 6. Placement format

Each solution is a list of placements. **Anchor cell `(r,c)` is always tile cell `A`** (see tile `shape` in tiles spec).

```json
{
  "tile": "SH",
  "r": 0,
  "c": 2,
  "deg": 180
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tile` | string | Tile id from `tiles-live-edges.json` (`SH`, `UT`, `RC`, …) — **not** PNG filename |
| `r` | number | Row of anchor cell `A` (0-based) |
| `c` | number | Column of anchor cell `A` (0-based) |
| `deg` | number | Rotation in degrees: `0`, `90`, `180`, or `270` clockwise |

Domino tiles occupy two cells: `A` at `(r,c)`, `B` at offset determined by `deg` (see `Specs-README.MD`).

**Tile bag rule:** sum of placements per tile id must equal the level `tiles` counts (including `SH`/`ET`).

---

## 7. Tile definitions — `data/tiles/tiles-live-edges.json`

Top-level keys are tile ids. Each tile:

```json
"UT": {
  "count": 6,
  "shape": [
    { "id": "A", "dr": 0, "dc": 0 },
    { "id": "B", "dr": 0, "dc": 1 }
  ],
  "r0":   { "A": ["S"], "B": ["S"] },
  "r90":  { "A": ["W"], "B": ["W"] },
  "r180": { "A": ["N"], "B": ["N"] },
  "r270": { "A": ["E"], "B": ["E"] }
}
```

| Field | Description |
|-------|-------------|
| `count` | Default inventory hint (level bag overrides) |
| `shape` | Cells occupied; **`A` must be `{dr:0, dc:0}`** |
| `r0`…`r270` | Per rotation: `A`/`B` **external** live edges (`N`,`E`,`S`,`W` or `[]`) |
| `paths` | Optional internal routes (see `Specs-README.MD`) |

Keys starting with `_` (e.g. `_comment`) are ignored by the solver.

---

## 8. Tile visuals — `data/tiles/tilesets.json`

```json
{
  "activeTileset": "gray-backs",
  "tilesets": {
    "gray-backs": {
      "SH": "SH-Snake-G-Tile.png",
      "ET": "ET-Snake-G-Tile.png",
      "B1": "B1-Blocker-G-Tile.png"
    }
  }
}
```

Maps **tile id → PNG** under `web/img/`. Does not affect solver logic.

---

## 9. TilePz export batch (import format)

External paste files (e.g. `data/tilepz solves 05 June  2026.txt`) are **multiple JSON objects concatenated**, one per level:

```json
{
  "board": { "rows": 6, "cols": 5, "cells": 30 },
  "tileSet": "tiles-live-edges.json",
  "tiles": { "SH": 1, "ET": 1, "...": 1 },
  "totalUniqueSolutions": 1,
  "solverMeta": { "...": "..." },
  "solutions": [
    {
      "id": "solve-1",
      "label": "5x6-0B-AMJ solver 1",
      "placements": [ /* ... */ ]
    }
  ]
}
```

**Important for ingest:**

- `solutions[0].label` often embeds a **pasted id** (e.g. `5x6-0B-AMJ`) that may **not** match the repo catalog bag.
- Ingest (`scripts/ingest-solve-batch.ps1`) **remaps by tile bag** to the next free code in the correct bucket; do not rename ids by hand.
- Wrong tier in label (e.g. `6x6-0C-*` for a `0B` bag) is normal; merge assigns `6x6-0B-*`.

Ingest command:

```powershell
.\scripts\ingest-solve-batch.ps1 -BatchFile "data\tilepz solves 05 June  2026.txt"
```

---

## 10. Stream enumeration artifacts (transient)

During heavy enumeration, layouts may be written incrementally:

```
data/solver-runs/streams/<levelId>/solve-00000001.json
data/solver-runs/streams/<levelId>/_meta.json
```

Each stream file:

```json
{
  "id": "6x6-0B-ACP-solve-00000001",
  "label": "Solve 1",
  "placements": [ /* same as §6 */ ],
  "levelId": "6x6-0B-ACP",
  "index": 1
}
```

On successful completion, enumerator assembles these into `solves/<levelId>.json`. Stream folders are **not** part of the shipped game catalog.

---

## 11. Minimal valid examples

### Minimal level (catalog)

```json
{
  "id": "2x4-0A-AAA",
  "name": "AAA",
  "board": { "rows": 2, "cols": 4 },
  "tiles": { "SH": 1, "ET": 1, "UT": 1, "HL": 1 },
  "blockers": [],
  "solvesFile": "2x4-0A-AAA.json",
  "pathMode": "single",
  "pathCount": 1,
  "totalUniqueSolutions": 1
}
```

### Minimal solve (one layout)

```json
{
  "board": { "rows": 2, "cols": 4, "cells": 8 },
  "tileSet": "tiles-live-edges.json",
  "tiles": { "SH": 1, "ET": 1, "UT": 1, "HL": 1 },
  "totalUniqueSolutions": 1,
  "solutions": [
    {
      "id": "solve-1",
      "label": "2x4-0A-AAA solver 1",
      "placements": [
        { "tile": "SH", "r": 0, "c": 0, "deg": 0 },
        { "tile": "ET", "r": 0, "c": 2, "deg": 0 },
        { "tile": "UT", "r": 1, "c": 0, "deg": 0 },
        { "tile": "HL", "r": 1, "c": 2, "deg": 0 }
      ]
    }
  ]
}
```

*(Placements above are illustrative; validate with the in-game solver.)*

---

## 12. Validation checklist

Before treating a JSON file as “working”:

1. **Level id** matches `board` size and tier tile rules.
2. **`tiles`** counts match board area: playable cells = `rows×cols − blockers`; domino tiles fill an even number of cells.
3. Exactly **one `SH` and one `ET`** for `pathMode: "single"`.
4. Every **placement** uses a known tile id; `(r,c,deg)` stays in bounds; bags balance.
5. **`totalUniqueSolutions`** equals `solutions.length`; no rotational duplicates within file (square: 90°/180°/270°; rectangle: 180°).
6. **`solvesFile`** in catalog matches actual file name under `solves/`.
7. Tile definitions exist in `tiles-live-edges.json` for every id in the bag.

Tools: `docker compose run --rm web node scripts/audit-solve-dedup.js --summary`, `scripts/verify-batch-ingest.js`, in-game load via web UI.

---

## 13. Size naming note (5×6)

Data stores **rows=6, cols=5**. The catalog size key is **`5x6`** (not `6x5`). Legacy `6x5` may appear in old UI filters; treat as alias for `5x6`.
