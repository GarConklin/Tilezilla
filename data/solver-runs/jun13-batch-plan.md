# Jun 13 solve batch plan

Source files:
- **5x6 (150 levels):** `data/tilepz solves 5x6 13 jun 2026.txt` — `5x6-0B-AUA` … `5x6-0B-BAT`
- **6x6 (17 levels):** `data/tilepz solves 6x6 13 jun 2026.txt` — **defer enumeration**

## 5x6 split (4 parallel batches)

| Batch | File | Count | First | Last |
|-------|------|------:|-------|------|
| 1 | `data/tilepz solves 5x6 13 jun 2026 - batch1.txt` | 38 | AUA | AVL |
| 2 | `data/tilepz solves 5x6 13 jun 2026 - batch2.txt` | 38 | AVM | AXX |
| 3 | `data/tilepz solves 5x6 13 jun 2026 - batch3.txt` | 38 | AXY | AZJ |
| 4 | `data/tilepz solves 5x6 13 jun 2026 - batch4.txt` | 36 | AZK | BAT |

## Commands (Docker Desktop must be running)

```powershell
# 1) Ingest once (merges solve-1 seeds into catalog + solves/)
.\scripts\ingest-solve-batch.ps1 -BatchFile "data\tilepz solves 5x6 13 jun 2026.txt"

# 2) Run four batches in parallel (separate terminals)
.\scripts\run-jun13-enumerate.ps1 -Phase Batch1 -NoTty -ContinueOnError
.\scripts\run-jun13-enumerate.ps1 -Phase Batch2 -NoTty -ContinueOnError
.\scripts\run-jun13-enumerate.ps1 -Phase Batch3 -NoTty -ContinueOnError
.\scripts\run-jun13-enumerate.ps1 -Phase Batch4 -NoTty -ContinueOnError

# Or one-shot (ingest + 4 background jobs):
.\scripts\run-jun13-start-all.ps1

# 3) After all batches finish — sync catalog counts
.\scripts\run-jun13-enumerate.ps1 -Phase All -SyncCatalogOnly -NoTty

# Status / stop
.\scripts\show-solve-runs-status.ps1 -Watch
.\scripts\stop-solve-docker-runs.ps1
```

## 6x6 (later)

```powershell
docker compose run --rm web node scripts/list-jun13-6x6-level-ids.js
# When ready: ingest then enumerate (no batch split yet — only 17 levels)
.\scripts\ingest-solve-batch.ps1 -BatchFile "data\tilepz solves 6x6 13 jun 2026.txt"
```
