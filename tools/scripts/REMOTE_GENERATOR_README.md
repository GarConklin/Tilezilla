# Remote palette generators (5x6 only)

Run from **repo root**. Needs `solves/solve-level.js`, `data/tiles/`, palette + live buckets.

## Critical: solver must exist after clone

On `release/v0.99.264+`, `solves/*.js` is in git. On older branches:

```bash
unzip -o solves.zip
test -f solves/solve-level.js || exit 1
```

## 3-VM plan (parallel **2** — do not use 8 on small VMs)

All jobs are **5x6** only. Bags already in the live bucket are **skipped** (same tile match = no re-solve). IDs reserved from the live bucket.

| VM | Job | Command |
|----|-----|---------|
| 1 | **0B** | `bash tools/scripts/remote-run-5x6-0b.sh` |
| 2 | **0C** QS/E1/E2 only (no CR/CQ/CT) | `bash tools/scripts/remote-run-5x6-0c-qse1e2.sh` |
| 3 | **0C** CR/CQ/CT | `bash tools/scripts/remote-run-5x6-0c-crcqct.sh` |

PowerShell equivalents: `remote-run-5x6-0b.ps1`, `remote-run-5x6-0c-qse1e2.ps1`, `remote-run-5x6-0c-crcqct.ps1`.

Default `PARALLEL=2`. Override only if the VM can take it: `PARALLEL=4 bash …`.

### Outputs (no overlap)

| VM | Levels | Solves |
|----|--------|--------|
| 1 | `data/levels/generated/5x6-0B.generated.json` | `solves/generated/5x6-0B/` |
| 2 | `data/levels/generated/5x6-0C-qse1e2.generated.json` | `solves/generated/5x6-0C-qse1e2/` |
| 3 | `data/levels/generated/5x6-0C-crcqct.generated.json` | `solves/generated/5x6-0C-crcqct/` |

### Mandatory smoke (each VM, before overnight)

```bash
MAX_TESTED=50 bash tools/scripts/remote-run-5x6-0b.sh          # VM1
MAX_TESTED=50 bash tools/scripts/remote-run-5x6-0c-qse1e2.sh   # VM2
MAX_TESTED=50 bash tools/scripts/remote-run-5x6-0c-crcqct.sh   # VM3
```

Must see `found` ≥ 1 (or only `skippedKnown` climbing if the first bags are already catalogued — then raise `MAX_TESTED` a bit). If `errors` climb and `found` stays 0 with missing solver text, stop.

### Before every overnight

Re-sync from hub:

- `data/levels/5x6-0B.json`
- `data/levels/5x6-0C.json`

`--reserve-codes-from` both reserves IDs and skips existing tile bags.

### Setup checklist

1. Node.js LTS + git  
2. `git clone` → checkout branch with solver JS (`release/v0.99.264+`)  
3. Confirm `test -f solves/solve-level.js`  
4. Smoke with `MAX_TESTED=50`  
5. Overnight with default parallel 2  

No Docker/MySQL required on generator VMs.

## ID suffix fix (2026-06-01)

Codes: `AAA` … `AZZ` → `ABA` … (not Excel wrap). Always pass `--reserve-codes-from` for the matching bucket.

## Do not use `remote-run-all` for these VMs

`remote-run-all` also walks **6x6** tiers. For the 3-VM split above, use only the three `remote-run-5x6-*` scripts.
