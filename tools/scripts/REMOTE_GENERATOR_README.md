# Remote palette generators

Run from **repo root** on the remote machine (needs `solves/solve-level.js`, `data/tiles/`, palette spec).

## ID suffix fix (2026-06-01)

Generator core no longer uses broken `toAlpha()` (Excel-style ids that reused `AAA` after `AAZ`). New codes follow catalog order: `AAA` … `AZZ` → `ABA` …

Optional when merging into an existing bucket:

`--reserve-codes-from data/levels/5x6-0B.json`

## One-command launchers

```powershell
.\scripts\remote-run-all.ps1
```

```bash
bash scripts/remote-run-all.sh
```

### 5x6-0C with CR / CQ / CT only (remote overnight)

Bags must include at least one of **CR**, **CQ**, or **CT** (QS/E1/E2 alone do not qualify). IDs are reserved against the live `5x6-0C` bucket.

```powershell
.\tools\scripts\remote-run-5x6-0c-crcqct.ps1
# or
.\scripts\remote-run-5x6-0c-crcqct.ps1 -Parallel 12
```

```bash
bash tools/scripts/remote-run-5x6-0c-crcqct.sh
# or
PARALLEL=12 bash tools/scripts/remote-run-5x6-0c-crcqct.sh
```

Direct node (same as the launcher):

```bash
node tools/scripts/generate-levels-5x6-0c-crcqct-from-palette.js --tier 0C --parallel 8 \
  --reserve-codes-from data/levels/5x6-0C.json --progress-every 50
```

## Per-tier (Docker — same as `Docs/find solves-levels.txt`)

```bash
docker compose run --rm web node tools/scripts/generate-levels-5x6-0bc-from-palette.js --tier 0B --parallel 8 --max-tested 1000 --progress-every 50
docker compose run --rm web node tools/scripts/generate-levels-5x6-0bc-from-palette.js --tier 0C --parallel 8
docker compose run --rm web node tools/scripts/generate-levels-5x6-0c-crcqct-from-palette.js --tier 0C --parallel 8 --reserve-codes-from data/levels/5x6-0C.json
docker compose run --rm web node tools/scripts/generate-levels-6x6-from-palette.js --tier 0C --parallel 8
docker compose run --rm web node tools/scripts/generate-levels-6x6-from-palette.js --tier 0B --parallel 8
docker compose run --rm web node tools/scripts/generate-levels-6x6-from-palette.js --tier 0A --parallel 8
```

## Output

- `data/levels/generated/<size>-<tier>.generated.json`
- `solves/generated/<size>-<tier>/`
- `data/levels/reports/generate-<size>-<tier>-<timestamp>.ndjson`

## Bad export batches

```bash
docker compose run --rm web node scripts/recode-batch-fresh-ids.js --size 5x6 --bucket 5x6-0B.json in.txt out.txt
```

Then ingest with `.\scripts\ingest-solve-batch.ps1 -BatchFile "..."`.
