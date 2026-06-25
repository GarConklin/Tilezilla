#!/usr/bin/env python3
"""Summarize Jun 18 full enumeration progress NDJSON files."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "data" / "solver-runs"


def load_ndjson(path: Path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        if row.get("levelId"):
            rows.append(row)
    return rows


def main():
    files = sorted(RUNS.glob("jun18-enumerate-Batch*-*.ndjson"))
    if not files:
        print("No jun18-enumerate-*.ndjson files found", file=sys.stderr)
        sys.exit(1)

    # Use latest file per batch phase
    by_phase = {}
    for p in files:
        parts = p.stem.split("-")
        # jun18-enumerate-Batch1-20260620-212724
        phase = parts[2] if len(parts) > 2 else p.stem
        by_phase[phase] = p

    all_rows = []
    for phase in sorted(by_phase):
        rows = load_ndjson(by_phase[phase])
        all_rows.extend(rows)
        print(f"{phase}: {len(rows)} levels ({by_phase[phase].name})")

    sols = [r["totalUniqueSolutions"] for r in all_rows]
    multi = [r for r in all_rows if r["totalUniqueSolutions"] > 1]

    print()
    print(f"Total enumerated: {len(all_rows)}")
    print(f"Sum of unique solutions: {sum(sols):,}")
    print(f"Exactly 1 solution: {sum(1 for s in sols if s == 1)}")
    print(f"2+ solutions: {len(multi)}")
    print(f"10+ solutions: {sum(1 for s in sols if s >= 10)}")
    print(f"50+ solutions: {sum(1 for s in sols if s >= 50)}")
    print(f"100+ solutions: {sum(1 for s in sols if s >= 100)}")
    print(f"Max: {max(sols)}")
    print()
    print("Top multi-solution levels:")
    for r in sorted(multi, key=lambda x: -x["totalUniqueSolutions"])[:20]:
        print(f"  {r['levelId']}: {r['totalUniqueSolutions']}")


if __name__ == "__main__":
    main()
