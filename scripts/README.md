# scripts/ — game runtime (production)

These files ship on the VPS via `build-game-bundle.ps1`:

- `server.py` — game API
- `lib/` — progress, catalog lookup, auth helpers
- `sql/` — version bumps and schema patches
- `health-check-production.sh`, `restore-on-ubuntu.sh`, etc.

## Dev / solver / ingest

Solver, enumerate, ingest, and catalog import tools moved to **`tools/scripts/`** (Phase 2).

Backward-compatible wrappers remain here for common PowerShell commands:

```powershell
.\scripts\dedupe-solve-rotations.ps1      # → tools/scripts/
.\scripts\ingest-solve-batch.ps1          # → tools/scripts/
```

Prefer the explicit path for new work: `.\tools\scripts\...` — see [tools/README.md](../tools/README.md).
