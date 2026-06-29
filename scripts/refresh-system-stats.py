#!/usr/bin/env python3
"""Refresh cached global stats in tilegame.system_info (run hourly)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from lib.system_stats import refresh_system_stats  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh tilegame.system_info global stats")
    parser.add_argument("--force", action="store_true", help="Ignore stats_updated_at age")
    args = parser.parse_args()

    stats = refresh_system_stats(force=args.force)
    if not stats:
        print("system_info row missing (id=1)", file=sys.stderr)
        return 1
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
