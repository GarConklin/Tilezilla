#!/usr/bin/env bash
# VM1: 5x6-0B — parallel 2 (safe for small VMs). Run from repo root.
#   bash tools/scripts/remote-run-5x6-0b.sh
#   MAX_TESTED=50 bash tools/scripts/remote-run-5x6-0b.sh

set -euo pipefail

PARALLEL="${PARALLEL:-2}"
MAX_TESTED="${MAX_TESTED:-0}"
PROGRESS_EVERY="${PROGRESS_EVERY:-50}"
MAX_SOL_PER_LEVEL="${MAX_SOL_PER_LEVEL:-1}"
PALETTE_SPEC="${PALETTE_SPEC:-data/levels/specs/create-levels-6x6-palette-v2.json}"
RESERVE_CODES_FROM="${RESERVE_CODES_FROM:-data/levels/5x6-0B.json}"

args=(
  --tier 0B
  --parallel "$PARALLEL"
  --progress-every "$PROGRESS_EVERY"
  --max-sol-per-level "$MAX_SOL_PER_LEVEL"
  --palette-spec "$PALETTE_SPEC"
  --reserve-codes-from "$RESERVE_CODES_FROM"
)
if [[ "$MAX_TESTED" != "0" ]]; then
  args+=(--max-tested "$MAX_TESTED")
fi

echo "== 5x6-0B (parallel=$PARALLEL) =="
echo "node tools/scripts/generate-levels-5x6-0bc-from-palette.js ${args[*]}"
node tools/scripts/generate-levels-5x6-0bc-from-palette.js "${args[@]}"

echo ""
echo "Done."
echo "  Levels: data/levels/generated/5x6-0B.generated.json"
echo "  Solves: solves/generated/5x6-0B/"
