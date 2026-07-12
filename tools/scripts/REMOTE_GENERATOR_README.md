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

## Per-tier (Docker — same as `Docs/find solves-levels.txt`)

```bash
docker compose run --rm web node scripts/generate-levels-5x6-0bc-from-palette.js --tier 0B --parallel 8 --max-tested 1000 --progress-every 50
docker compose run --rm web node scripts/generate-levels-5x6-0bc-from-palette.js --tier 0C --parallel 8
docker compose run --rm web node scripts/generate-levels-6x6-from-palette.js --tier 0C --parallel 8
docker compose run --rm web node scripts/generate-levels-6x6-from-palette.js --tier 0B --parallel 8
docker compose run --rm web node scripts/generate-levels-6x6-from-palette.js --tier 0A --parallel 8
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
