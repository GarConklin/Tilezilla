# Level Catalog

## ID Scheme

`<size>-<tier>-<seq>.json`

- `size`: board size (examples: `2x4`, `3x5`, `4x4`)
- `tier`:
  - `0A` = Base tiles only
  - `0B` = Uses at least one of `SZ/SS/DS/QC/DC`
  - `0C` = Uses at least one of `CC/CR/CT/E1/E2/B2/2SH/2ET`
- `seq`: 3-letter sequence within `(size, tier)` (`AAA`, `AAB`, `AAC` ...)

Examples:

- `3x5-0A-AAA.json`
- `3x5-0B-AAA.json`
- `3x5-0C-ZZZ.json` (sandbox palette tray)

---

## Tile Families

- Base tiles: `SH, ET, UT, RC, LC, DB, HL, VL, LL, LR`
- Advanced tiles: `SZ, SS, DS, QC, DC`
- Superior tiles: `CC, CR, CT, E1, E2, B2, 2SH, 2ET`

---

## Catalog Fields

Each row should include:

- `New ID` (e.g. `3x5-0A-AAA`)
- `Legacy ID` (e.g. `3x5-A`)
- `Board`
- `Tiles`
- `Blockers` (typed, e.g. `[0,0,"B1"]`)
- `Notes` (optional)

---

## 0A - Base-Only Levels

| New ID | Legacy ID | Board | Tiles | Blockers | Notes |
|---|---|---|---|---|---|
| 2x4-0A-AAA | 2x4-A | 2x4 | SH, ET, UT, HL | - | |
| 3x3-0A-AAA | 3x3-A | 3x3 | SH, ET, RC, UT | [0,0,"B1"] | |
| 3x3-0A-AAB | 3x3-C | 3x3 | SH, ET, LRx2 | [1,1,"B1"] | |
| 3x4-0A-AAA | 3x4-A | 3x4 | SH, ET, UT, RC, LL, LR | - | |
| 3x4-0A-AAB | 3x4-B | 3x4 | SH, ET, UT, VL, LL, LR | - | |
| 3x4-0A-AAC | 3x4-D | 3x4 | SH, ET, RC, LR, LL, VL | - | |
| 3x5-0A-AAA | 3x5-B | 3x5 | SH, ET, UTx2, LR, HL, LL | [0,0,"B1"] | |

---

## 0B - Advanced Levels

| New ID | Legacy ID | Board | Advanced Used | Blockers | Notes |
|---|---|---|---|---|---|
| 3x3-0B-AAA | 3x3-B | 3x3 | SZ | [0,0,"B1"] | |
| 3x4-0B-AAA | 3x4-C | 3x4 | SZ | - | |
| 3x4-0B-AAB | 3x4-F | 3x4 | SZ, DC | - | |
| 3x4-0B-AAC | 3x4-G | 3x4 | DC | - | |
| 3x5-0B-AAA | 3x5-A | 3x5 | SZ | [0,0,"B1"] | |
| 3x5-0B-AAB | 3x5-C | 3x5 | DC | [0,0,"B1"] | |

---

## 0C - Superior Levels

| New ID | Legacy ID | Board | Superior Used | Blockers | Notes |
|---|---|---|---|---|---|
| 4x4-0C-AAA | 4x4-CAA | 4x4 | CR, QC | - | seed example |
| 4x4-0C-AAB | (new) | 4x4 | CR, QC | - | from solve 2026-04-26T04:34:02.927Z-c771c5a25a6928 |

---

## Migration Rules

1. Keep `Legacy ID` in metadata for traceability.
2. All blockers must be typed as `[r,c,"B1"]` (or other explicit blocker type).
3. Sequence `AAA..` resets per `(size, tier)`.
4. Decide and document whether variants are encoded as new `seq` values or a separate variant field.
5. When importing solves into the catalog, infer missing blockers from unoccupied board cells.
6. Runtime safety fallback: if a level has `B1`/`B2` in `tiles` but `blockers` is empty, load the level `solvesFile` and infer blocker positions from `B1`/`B2` placements in the first solution.
7. After inference, blockers are treated as fixed board cells and should not remain in palette inventory counts for authored level data.

