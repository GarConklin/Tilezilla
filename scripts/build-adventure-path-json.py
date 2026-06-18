#!/usr/bin/env python3
"""Export adventure path JSON for web fallback (MySQL → JSON → CSV).

Reads data/adventure_solution_distribution.csv and writes data/adventure_path.json.

  python scripts/build-adventure-path-json.py
  python scripts/build-adventure-path-json.py --from-mysql
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.adventure_path_build import (  # noqa: E402
    build_adventure_path_from_csv,
    load_adventure_path_from_mysql,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "adventure_solution_distribution.csv"
DEFAULT_OUT = ROOT / "data" / "adventure_path.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build data/adventure_path.json")
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help="Adventure map CSV (default: data/adventure_solution_distribution.csv)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Output JSON path (default: data/adventure_path.json)",
    )
    parser.add_argument(
        "--from-mysql",
        action="store_true",
        help="Export from MySQL adventure_puzzle tables instead of CSV",
    )
    args = parser.parse_args()

    if args.from_mysql:
        doc = load_adventure_path_from_mysql(ROOT)
        if not doc:
            print("MySQL export failed (connection, empty tables, or pymysql missing).", file=sys.stderr)
            return 1
    else:
        if not args.csv.is_file():
            print(f"CSV not found: {args.csv}", file=sys.stderr)
            return 1
        doc = build_adventure_path_from_csv(args.csv)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)
        f.write("\n")

    print(
        f"Wrote {args.out} — {doc['stepCount']} steps, "
        f"{len(doc['flat'])} ranked puzzles, {len(doc['postgame'])} postgame"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
