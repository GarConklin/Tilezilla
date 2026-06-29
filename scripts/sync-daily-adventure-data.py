#!/usr/bin/env python3
"""Normalize daily/adventure CSVs for app + MySQL import.

Reads:
  data/daily_challenges_import-org.csv  -> data/daily_challenges_import.csv
  data/adventure_solution_distribution.csv (unchanged; validated)
  data/LevelSystem.csv (validated against adventure T markers)

  python scripts/sync-daily-adventure-data.py
  python scripts/sync-daily-adventure-data.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
DAILY_ORG = ROOT / "data" / "daily_challenges_import-org.csv"
DAILY_OUT = ROOT / "data" / "daily_challenges_import.csv"
ADVENTURE_CSV = ROOT / "data" / "adventure_solution_distribution.csv"
LEVEL_SYSTEM = ROOT / "data" / "LevelSystem.csv"
DOCS_DAILY = ROOT / "Docs" / "daily_challenges_import-org.csv"
DOCS_ADVENTURE = ROOT / "Docs" / "adventure_solution_distribution.csv"


def parse_challenge_date(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        raise ValueError("empty challenge_date")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    for fmt in ("%d-%b-%y", "%d-%b-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date: {s!r}")


def normalize_daily(dry_run: bool) -> int:
    if not DAILY_ORG.exists():
        raise SystemExit(f"Missing {DAILY_ORG}")
    rows_out: list[list[str]] = []
    with DAILY_ORG.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lid = str(row.get("level_id") or "").strip().replace(".json", "")
            if not lid:
                continue
            iso = parse_challenge_date(row.get("challenge_date", ""))
            total = int(str(row.get("total_solutions") or "0").strip() or 0)
            notes = (row.get("notes") or "").strip()
            rows_out.append([iso, lid, str(total), notes])

    if dry_run:
        print(f"[dry-run] would write {len(rows_out)} daily rows -> {DAILY_OUT}")
        if rows_out:
            print(f"  first: {rows_out[0]}")
            print(f"  last:  {rows_out[-1]}")
        return len(rows_out)

    with DAILY_OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["challenge_date", "level_id", "total_solutions", "notes"])
        w.writerows(rows_out)
    print(f"Wrote {len(rows_out)} rows -> {DAILY_OUT}")
    return len(rows_out)


def load_adventure_entries(path: Path) -> list[dict]:
    entries: list[dict] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        for line_no, raw in enumerate(csv.DictReader(f)):
            adv_raw = (raw.get("Adv_ID") or "").strip()
            level_id = (raw.get("level_id") or "").strip()
            if not adv_raw or not level_id:
                continue
            entries.append(
                {
                    "adv_id": int(adv_raw),
                    "line": line_no,
                    "level_id": level_id,
                    "is_challenge": (raw.get("CH-lvl") or "").strip().upper() == "T",
                }
            )
    entries.sort(key=lambda e: (e["adv_id"], e["line"]))
    return entries


def validate_adventure_and_level_system() -> None:
    if not ADVENTURE_CSV.exists():
        raise SystemExit(f"Missing {ADVENTURE_CSV}")
    entries = load_adventure_entries(ADVENTURE_CSV)
    t_ids = sorted(e["adv_id"] for e in entries if e["is_challenge"])
    print(f"Adventure entries: {len(entries)}")
    print(f"CH-lvl=T steps: {len(t_ids)}")
    if t_ids:
        print(f"  last step ends Adv_ID {t_ids[-1]}")
    post = [e for e in entries if e["adv_id"] > t_ids[-1]] if t_ids else []
    print(f"Postgame puzzles (after last T): {len(post)}")

    if not LEVEL_SYSTEM.exists():
        print(f"WARN: {LEVEL_SYSTEM} not found — skip LevelSystem validation")
        return

    ls = list(csv.DictReader(LEVEL_SYSTEM.open(encoding="utf-8-sig")))
    if len(ls) < len(t_ids):
        print(
            f"WARN: LevelSystem has {len(ls)} rows but adventure has {len(t_ids)} steps "
            f"(L{ls[-1]['Base_Lvl']}-{ls[-1]['Sub_Lvl']} planned vs CSV)"
        )
    prev = 0
    mismatches = 0
    for row, end_adv in zip(ls[: len(t_ids)], t_ids):
        step = [e for e in entries if prev < e["adv_id"] <= end_adv]
        expect = int(row["pzzle_amt"])
        if len(step) != expect:
            mismatches += 1
            if mismatches <= 5:
                print(
                    f"WARN: {row['Base_Lvl']}-{row['Sub_Lvl']} "
                    f"LevelSystem pzzle_amt={expect} actual={len(step)}"
                )
        prev = end_adv
    if mismatches:
        print(f"LevelSystem step-size mismatches: {mismatches}")
    else:
        print("LevelSystem pzzle_amt matches adventure steps (for defined T rows)")


def sync_docs_copies(dry_run: bool) -> None:
    import shutil

    pairs = [
        (DAILY_ORG, DOCS_DAILY),
        (ADVENTURE_CSV, DOCS_ADVENTURE),
    ]
    for src, dest in pairs:
        if not src.exists():
            continue
        if dry_run:
            print(f"[dry-run] copy {src.name} -> {dest}")
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            print(f"Copied {src.name} -> {dest}")


def rebuild_adventure_path_json(dry_run: bool) -> None:
    from lib.adventure_path_build import build_adventure_path_from_csv

    out = ROOT / "data" / "adventure_path.json"
    if dry_run:
        print(f"[dry-run] would rebuild {out} from {ADVENTURE_CSV.name}")
        return
    doc = build_adventure_path_from_csv(ADVENTURE_CSV)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)
        f.write("\n")
    print(
        f"Wrote {out.name} — {doc['stepCount']} steps, "
        f"{len(doc['flat'])} ranked puzzles, {len(doc['postgame'])} postgame"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    normalize_daily(args.dry_run)
    validate_adventure_and_level_system()
    rebuild_adventure_path_json(args.dry_run)
    sync_docs_copies(args.dry_run)


if __name__ == "__main__":
    main()
