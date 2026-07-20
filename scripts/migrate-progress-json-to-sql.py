#!/usr/bin/env python3
"""Migrate data/progress/users/*.json into MySQL user_found_solutions.

Idempotent — safe to re-run. Renames each imported file to {id}.migrated.json.

Usage (from repo root, with MySQL env vars set):
  python scripts/migrate-progress-json-to-sql.py
  python scripts/migrate-progress-json-to-sql.py --user 900004
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lib.progress_store import (  # noqa: E402
    migrate_user_json_file,
    progress_dir,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user", type=int, default=None, help="Migrate one user id only")
    parser.add_argument(
        "--no-rename",
        action="store_true",
        help="Keep .json in place (still writes SQL)",
    )
    args = parser.parse_args()

    users_dir = progress_dir(ROOT)
    if not users_dir.is_dir():
        print(f"No progress dir: {users_dir}")
        return 1

    if args.user is not None:
        ids = [args.user]
    else:
        ids = sorted(
            {
                int(p.stem.split(".")[0])
                for p in users_dir.glob("*.json")
                if p.stem.split(".")[0].isdigit()
            }
        )

    ok_n = 0
    fail_n = 0
    for uid in ids:
        result = migrate_user_json_file(ROOT, uid, rename_file=not args.no_rename)
        if result.get("ok"):
            ok_n += 1
            print(
                f"OK user={uid} inserted={result.get('inserted')} "
                f"levels={result.get('levels')} solves={result.get('solves')} "
                f"skipped={result.get('skipped', False)}"
            )
        else:
            fail_n += 1
            print(f"FAIL user={uid} error={result.get('error')}")

    print(f"Done. ok={ok_n} fail={fail_n}")
    return 0 if fail_n == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
