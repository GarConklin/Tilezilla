# Level ↔ solve tile bag matching

Generated: 2026-06-09T12:56:59.184Z

**Rule:** board size + tile multiset from **solve-1 placements** (or `solves.json` tiles if no placements) is the play bag. Catalog `tiles` should match that.

## Summary

| Metric | Count |
|--------|------:|
| Catalog levels | 6973 |
| Solve files | 6973 |
| Catalog bag ≠ play bag | 5 |
| Orphan solve (no catalog id) | 4 |
| Missing solve file | 0 |

## Catalog tiles wrong — correct owner by play bag

| Level (wrong catalog tiles) | Solve-1 bag | Should match catalog id(s) |
|-----------------------------|-------------|------------------------------|
| 2x4-0A-AAB | B2×1 ET×1 SH×1 VL×1 | *(none — fix catalog from solve)* |
| 2x4-0A-AAC | B1×2 ET×1 LC×1 SH×1 | *(none — fix catalog from solve)* |
| 2x4-0C-AAB | B1×1 E1×1 ET×1 LC×1 SH×1 | *(none — fix catalog from solve)* |
| 4x6-0C-ZZZ |  | *(none — fix catalog from solve)* |
| 5x5-0C-AAA |  | *(none — fix catalog from solve)* |

## Orphan solve files

- `4x5-basic-028.json` bag DB×1 ET×1 HL×1 RC×1 SH×1 UT×5 → catalog: 4x5-0A-ABB
- `4x5-basic-056.json` bag ET×1 HL×1 LL×1 RC×1 SH×1 UT×5 → catalog: 4x5-0A-ACC
- `migrate-apply-report.json` bag  → catalog: none
- `migrate-dry-run-report.json` bag  → catalog: none

