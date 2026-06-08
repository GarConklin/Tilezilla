#!/usr/bin/env bash
set -euo pipefail

PARALLEL="${PARALLEL:-8}"
MAX_TESTED="${MAX_TESTED:-0}"
PROGRESS_EVERY="${PROGRESS_EVERY:-50}"
MAX_SOL_PER_LEVEL="${MAX_SOL_PER_LEVEL:-1}"
PALETTE_SPEC="${PALETTE_SPEC:-data/levels/specs/create-levels-6x6-palette-v2.json}"

base_args=(
  --parallel "$PARALLEL"
  --progress-every "$PROGRESS_EVERY"
  --max-sol-per-level "$MAX_SOL_PER_LEVEL"
  --palette-spec "$PALETTE_SPEC"
)

if [[ "$MAX_TESTED" != "0" ]]; then
  base_args+=(--max-tested "$MAX_TESTED")
fi

echo "== 5x6 tier 0B =="
node scripts/generate-levels-5x6-0bc-from-palette.js --tier 0B "${base_args[@]}"

echo "== 5x6 tier 0C =="
node scripts/generate-levels-5x6-0bc-from-palette.js --tier 0C "${base_args[@]}"

echo "== 6x6 tier 0A =="
node scripts/generate-levels-6x6-from-palette.js --tier 0A "${base_args[@]}"

echo "== 6x6 tier 0B =="
node scripts/generate-levels-6x6-from-palette.js --tier 0B "${base_args[@]}"

echo "== 6x6 tier 0C =="
node scripts/generate-levels-6x6-from-palette.js --tier 0C "${base_args[@]}"

echo "All runs completed."
