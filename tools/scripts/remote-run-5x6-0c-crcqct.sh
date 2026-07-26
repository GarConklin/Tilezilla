#!/usr/bin/env bash
# Remote overnight run: generate 5x6-0C levels that include CR, CQ, or CT.
# Run from repo root on the remote host.
#
#   bash tools/scripts/remote-run-5x6-0c-crcqct.sh
#   PARALLEL=12 MAX_TESTED=5000 bash tools/scripts/remote-run-5x6-0c-crcqct.sh

set -euo pipefail

PARALLEL="${PARALLEL:-8}"
MAX_TESTED="${MAX_TESTED:-0}"
PROGRESS_EVERY="${PROGRESS_EVERY:-50}"
MAX_SOL_PER_LEVEL="${MAX_SOL_PER_LEVEL:-1}"
PALETTE_SPEC="${PALETTE_SPEC:-data/levels/specs/create-levels-6x6-palette-v2.json}"
RESERVE_CODES_FROM="${RESERVE_CODES_FROM:-data/levels/5x6-0C.json}"

args=(
  --tier 0C
  --parallel "$PARALLEL"
  --progress-every "$PROGRESS_EVERY"
  --max-sol-per-level "$MAX_SOL_PER_LEVEL"
  --palette-spec "$PALETTE_SPEC"
  --reserve-codes-from "$RESERVE_CODES_FROM"
)

if [[ "$MAX_TESTED" != "0" ]]; then
  args+=(--max-tested "$MAX_TESTED")
fi

echo "== 5x6-0C with CR/CQ/CT (parallel=$PARALLEL) =="
echo "node tools/scripts/generate-levels-5x6-0c-crcqct-from-palette.js ${args[*]}"
node tools/scripts/generate-levels-5x6-0c-crcqct-from-palette.js "${args[@]}"

echo ""
echo "Done."
echo "  Levels: data/levels/generated/5x6-0C.generated.json"
echo "  Solves: solves/generated/5x6-0C/"
echo "Promote later with: node tools/scripts/promote-0c-generated.js"
