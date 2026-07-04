#!/usr/bin/env python3
"""Refresh total_solutions in daily_challenges_import.csv from catalog levels.json.

After rotation dedupe + catalog sync, daily schedule counts must match
level.totalUniqueSolutions or the challenge panel shows wrong totals.

  python scripts/sync-daily-csv-from-catalog.py
  python scripts/sync-daily-csv-from-catalog.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEVELS_PATH = ROOT / "data" / "levels" / "levels.json"
DAILY_CSV = ROOT / "data" / "daily_challenges_import.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not LEVELS_PATH.exists():
        raise SystemExit(f"Missing {LEVELS_PATH}")
    if not DAILY_CSV.exists():
        raise SystemExit(f"Missing {DAILY_CSV}")

    doc = json.loads(LEVELS_PATH.read_text(encoding="utf-8"))
    by_id = {
        str(l["id"]): int(l.get("totalUniqueSolutions") or 0)
        for l in doc.get("levels") or []
        if l.get("id")
    }

    with DAILY_CSV.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or [
            "challenge_date",
            "level_id",
            "total_solutions",
            "notes",
        ]
        rows = list(reader)

    changed = 0
    missing = 0
    for row in rows:
        lid = str(row.get("level_id") or "").strip().replace(".json", "")
        if not lid:
            continue
        want = by_id.get(lid)
        if want is None:
            missing += 1
            continue
        old = int(str(row.get("total_solutions") or "0").strip() or 0)
        if old != want:
            row["total_solutions"] = str(want)
            changed += 1

    print(f"Daily rows: {len(rows)}  updated: {changed}  level_id not in catalog: {missing}")

    if args.dry_run:
        print("[dry-run] no file written")
        return

    with DAILY_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {DAILY_CSV}")


if __name__ == "__main__":
    main()
