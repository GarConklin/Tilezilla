#!/usr/bin/env python3
"""Reorder daily_challenges_import.csv so each week peaks on Monday.

Within each ISO week (Mon–Sun), sort that week's puzzles by total_solutions
descending and assign Mon = most solutions … Sun = fewest.

Past weeks before --from are left unchanged (leaderboard history).
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "data" / "daily_challenges_import.csv"


def parse_date(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def fmt_date(d: datetime) -> str:
    # Keep existing CSV style M/D/YYYY
    return f"{d.month}/{d.day}/{d.year}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--from",
        dest="from_date",
        default="2026-09-21",
        help="First date to rewrite (YYYY-MM-DD). Default: next Mon after reported issue.",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    from_dt = datetime.strptime(args.from_date, "%Y-%m-%d")

    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig", newline="")))
    fieldnames = list(rows[0].keys())

    parsed = []
    for r in rows:
        d = parse_date(r["challenge_date"])
        if not d:
            raise SystemExit(f"Bad date: {r['challenge_date']!r}")
        sols = int(float(r.get("total_solutions") or 0))
        parsed.append({"date": d, "sols": sols, "row": r})

    # Group by ISO week
    weeks: dict[tuple[int, int], list] = {}
    for item in parsed:
        key = item["date"].isocalendar()[:2]
        weeks.setdefault(key, []).append(item)

    changed_weeks = 0
    out_by_date: dict[datetime, dict] = {}

    for item in parsed:
        if item["date"] < from_dt:
            out_by_date[item["date"]] = {
                "challenge_date": fmt_date(item["date"]),
                "level_id": item["row"]["level_id"],
                "total_solutions": item["row"]["total_solutions"],
                "notes": item["row"].get("notes", ""),
            }

    for key, items in weeks.items():
        items = sorted(items, key=lambda x: x["date"])
        # Only rewrite weeks that are fully on/after from_dt, or partially —
        # if any day in week is < from_dt, only rewrite days >= from_dt using
        # the puzzle pool from days >= from_dt in that week.
        future = [x for x in items if x["date"] >= from_dt]
        if not future:
            continue

        # Monday of this ISO week
        # isocalendar week: Mon is day 1
        sample = items[0]["date"]
        monday = sample - timedelta(days=sample.weekday())

        # Full week rewrite only when the whole week is in range
        if items[0]["date"] >= from_dt and len(items) == 7:
            pool = sorted(items, key=lambda x: (-x["sols"], x["row"]["level_id"]))
            for i, src in enumerate(pool):
                day = monday + timedelta(days=i)
                out_by_date[day] = {
                    "challenge_date": fmt_date(day),
                    "level_id": src["row"]["level_id"],
                    "total_solutions": src["row"]["total_solutions"],
                    "notes": src["row"].get("notes", ""),
                }
            changed_weeks += 1
            print(
                f"week {key}: Mon={pool[0]['sols']} … Sun={pool[-1]['sols']} "
                f"(was peak {max(items, key=lambda x: x['sols'])['date'].strftime('%a')} "
                f"{max(items, key=lambda x: x['sols'])['sols']})"
            )
        else:
            # Partial week: reorder only future days among themselves by sols desc
            # onto those same calendar dates sorted ascending
            days = sorted(x["date"] for x in future)
            pool = sorted(future, key=lambda x: (-x["sols"], x["row"]["level_id"]))
            for day, src in zip(days, pool):
                out_by_date[day] = {
                    "challenge_date": fmt_date(day),
                    "level_id": src["row"]["level_id"],
                    "total_solutions": src["row"]["total_solutions"],
                    "notes": src["row"].get("notes", ""),
                }
            print(f"week {key}: partial reorder {len(future)} day(s) from {from_dt.date()}")

    # Emit in original chronological order of all dates
    all_dates = sorted(out_by_date)
    out_rows = [out_by_date[d] for d in all_dates]

    if args.dry_run:
        print(f"dry-run: would write {len(out_rows)} rows, changed weeks≈{changed_weeks}")
        return

    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)
    print(f"wrote {CSV_PATH} ({len(out_rows)} rows, {changed_weeks} full weeks reordered)")


if __name__ == "__main__":
    main()
