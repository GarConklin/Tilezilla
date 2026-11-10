# Nightly solver run (this PC)

Solves the waiting swap puzzles with the fast solver, on this Windows PC, in plain Node.
No Docker, no containers, no network ports, so it can't clash with anything else that is running
(the old copy's run, the game containers, MySQL, auth).

## The one command

Open PowerShell and run:

```powershell
cd C:\Tilezilla-Test
.\tools\scripts\run-nightly-solves.ps1 -Workers 8 -Until "2026-11-11 07:00"
```

Change the `-Until` date and time each night. It means: **stop starting new puzzles at that time.**
Puzzles still running then get 10 more minutes to finish (`-GraceMinutes`), after that they go back
in the queue for next night.

What it does each time:

1. **Imports the waiting list from the old copy** (`C:\Users\~Gar\Tile-Puzzle\Tilezilla`), read-only.
   It takes every pending puzzle and its spec, skipping everything the old ledger already has as done.
   The first time it copies about 270,000 spec files (about 5 minutes); after that it only copies new ones.
2. **Solves in this order:** the 4,237 pair-swap drafts first, then the old waiting list smallest first
   (5x6-0A, then 5x6-0B). No 6x6.
3. **Saves every result the moment it finishes.** Closing the window, Ctrl+C, a crash or a reboot loses only
   the puzzles that were in progress. Run the same command again and it carries on where it stopped.

The window shows live: solved / waiting / failed per group, puzzles per hour, time left for the
current group, what each worker is doing, and the last results.

## Watch, stop, resume

| You want to | Do this |
|---|---|
| Watch from a second window | `.\tools\scripts\watch-nightly-solves.ps1` (close it any time) |
| Totals only | `.\tools\scripts\watch-nightly-solves.ps1 -Totals` |
| Stop now | Ctrl+C in the run window (puzzles in progress go back in the queue) |
| Finish what's running, then stop | `.\tools\scripts\run-nightly-solves.ps1 -Stop` from another window |
| Resume | Run the nightly command again |
| Retry puzzles that failed twice | add `-RetryFailed` |

A puzzle that fails is tried once more at the end of the run; after two failures it is skipped until you
use `-RetryFailed`. A puzzle running longer than 60 minutes (`-TimeoutMinutes`) is stopped and skipped.
Results that hit the 500,000 solution cap are marked **CAPPED** (the count is then a lower bound).

## Where results go

All of this is git-ignored. Don't commit it.

| What | Where |
|---|---|
| Pair-swap draft solutions | `tools\data\swap-candidates\pair-swap-drafts\results\<id>.json` (same as `run-candidate-queue.ps1`) |
| Old waiting-list solutions | `tools\data\solver-runs\nightly\enumerated\<id>.json` (same format as the old `enumerated\`) |
| One line per result (count, capped, time) | `tools\data\solver-runs\nightly\results.ndjson` |
| Run logs | `tools\data\solver-runs\nightly\logs\` |

Puzzles with 0 solutions get a line in `results.ndjson` but no solutions file (same as the solver always did).

## Getting results back into the old copy

```powershell
cd C:\Tilezilla-Test
.\tools\scripts\export-nightly-solves.ps1
```

This writes a folder `tools\data\solver-runs\nightly\export\<time>\` with `worker-nightly.txt` (the
`<id> <solutions> <exit>` lines `swap-batch.py record-many` reads) and prints the two commands to run
**in the old copy** while no old run is going: a `robocopy` that copies the new solution files into its
`enumerated\` folder, then `python tools/scripts/swap-batch.py record-many --file <export folder>`.
The export never writes to the old copy itself.

### Counts are often half of the old runner's counts

A layout and the same layout turned 180 degrees are one solution (the live catalog's rule). The old copy
meant to do the same but compared tile positions instead of the filled board, so on most non-square boards
it counted every layout twice. Whether it did depended on the tiles in the bag (in the check below,
every puzzle with HL, DB, SS or SZ was doubled). On 217 puzzles re-checked, the layouts found were identical
every time; 180 of the counts were exactly double in the old ledger and the rest equal. Square boards (5x5)
were not affected.

So the old ledger's counts on non-square boards (checked: 4x5, 4x6, 5x6) are mostly double. The export
writes the correct (catalog) counts. They can't be converted to the old copy's numbers with a simple rule.

## The old copy's run

Don't run the old `run-swap-parallel.ps1` and this at the same time on the same puzzles; it just wastes
CPU. The import already picks up puzzles the old runs finished but never recorded. It solves them
again, since that only takes minutes and gives correct counts. If you still want the old numbers in the
ledger, record that run folder from the old copy as usual (`swap-batch.py record-many --file <run folder>`);
a later export overwrites those entries with the new counts.

## Speed

Measured on this 12-thread PC (Nov 2026). "Per puzzle" is the typical (median) time for one puzzle.
The old runner's time includes starting a container per puzzle.

| Group | Old runner, per puzzle | Fast solver, per puzzle (8 running) | 8 workers | Left (Nov 10) | Time to finish |
|---|---|---|---|---|---|
| pair-swap drafts | - | about 30 s (some 3 min) | about 500 / hour | 4,100 | about 1 night |
| 5x6-0A | about 20 min | about 22 s | about 1,200 / hour | 8,700 | about 1 night |
| 5x6-0B | about 23 min | about 46 s | about 550 / hour | 261,000 | about 480 hours (60 nights of 8 h) |

## Checking the solver

`.\tools\scripts\verify-fast-solver.ps1` re-solves a sample of puzzles the old copy already solved and
compares the counts and layouts.
