# Dev-only data (Phase 3) — not shipped to VPS.

Solver logs, enumeration streams, TilePz batch paste files, and solve queues live here.

## Layout

```
tools/data/
  batches/           TilePz paste files, enumerate queues, batch splits, handmade solves
  solver-runs/       Enumeration logs, streams, ingest reports, audit JSON, CSV exports
  solve-queue.json   Pending solve jobs (regenerate via refresh-solve-queue.js)
  solution-loop-audit*.json
```

Production `data/` holds only player-facing catalog, layouts, and daily schedule.

## Common paths

| Old path | New path |
|---|---|
| `data/solver-runs/` | `tools/data/solver-runs/` |
| `data/*tilepz*solves*.txt` | `tools/data/batches/` |
| `data/*-enumerate-queue.txt` | `tools/data/batches/` |
| `data/levels/solve-queue.json` | `tools/data/solve-queue.json` |

Scripts accept legacy `data/...` paths when the file was moved (see `Resolve-TilezillaDevDataPath` in `tools/scripts/_repo-data.ps1`).
