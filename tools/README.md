# Tilezilla dev tools (Phase 2)

Solver, ingest, catalog import, and enumeration live here — **not** on the production VPS.

Production deploy uses `scripts/build-game-bundle.ps1`, which copies only runtime files from `scripts/` (see `game/README.md`).

## Layout

```
tools/
  scripts/          Solver, ingest, import, audit, dev stack helpers
  scripts/lib/      Docker helpers, path-mode JS, dev Python libs
  README.md         This file
```

Runtime game server code stays in repo-root `scripts/` (`server.py`, progress libs, SQL, health checks).

## Common commands

```powershell
# From repo root — wrappers in scripts/ still work, or call tools directly:

.\tools\scripts\ingest-solve-batch.ps1 -BatchFile "data\5x6 tilepz solves 10 July 2026.txt"
.\tools\scripts\run-enumerate-levels.ps1 -LevelListFile "data\july10-enumerate-queue.txt" -SyncCatalog
.\tools\scripts\dedupe-solve-rotations.ps1
.\tools\scripts\import-catalog-to-mysql.ps1
.\tools\scripts\import-adventure-map.ps1
```

Docker helpers run scripts inside the `web` container at `/app/tools/scripts/...`.

## Production bundle

```powershell
.\scripts\build-game-bundle.ps1
```

The `tools/` folder is excluded from the VPS bundle automatically.
