#!/usr/bin/env python3
"""Propose a LevelSystem.csv with challenge gates that stay easy.

Why not a flat every-N Adv_ID grid?
  Challenge rows use required_solution_count = total_unique_solutions.
  Landing CH-lvl=T on a 9- or 20-route puzzle forces that many solves.
  The old LevelSystem varied step length so each gate could sit on a
  low-route puzzle (typically 2–4 unique solutions).

This script walks adventure_solution_distribution.csv and, for each of
55 ranks × 15 sublevels, aims for ~target_spacing puzzles then picks the
next puzzle whose unique-solution count is in [min_sols, max_sols].

  python tools/scripts/propose-level-system.py
  python tools/scripts/propose-level-system.py --max-sols 3 --target 15
  python tools/scripts/propose-level-system.py --write data/LevelSystem.proposed.csv
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAP_CSV = ROOT / "data" / "adventure_solution_distribution.csv"


def load_map(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    out = []
    for raw in rows:
        adv = (raw.get("Adv_ID") or "").strip()
        if not adv.isdigit():
            continue
        sols = int((raw.get("total_unique_solutions") or "1").strip() or 1)
        out.append(
            {
                "adv_id": int(adv),
                "level_id": (raw.get("level_id") or "").strip(),
                "sols": sols,
                "was_challenge": (raw.get("CH-lvl") or "").strip().upper() == "T",
            }
        )
    out.sort(key=lambda r: r["adv_id"])
    return out


def propose(
    entries: list[dict],
    *,
    ranks: int,
    subs: int,
    target: int,
    min_sols: int,
    max_sols: int,
    soft_max_step: int,
) -> tuple[list[dict], list[str]]:
    warnings: list[str] = []
    by_adv = {e["adv_id"]: e for e in entries}
    adv_list = [e["adv_id"] for e in entries]
    adv_index = {a: i for i, a in enumerate(adv_list)}

    steps: list[dict] = []
    cursor_i = 0  # index into adv_list; next step starts here

    for rank in range(1, ranks + 1):
        for sub in range(1, subs + 1):
            if cursor_i >= len(adv_list):
                warnings.append(
                    f"Ran out of map puzzles before L{rank}-{sub} "
                    f"({len(steps)} steps done)"
                )
                return steps, warnings

            start_adv = adv_list[cursor_i]
            # Prefer a gate near start + target - 1
            ideal_i = min(cursor_i + target - 1, len(adv_list) - 1)
            hard_i = min(cursor_i + soft_max_step - 1, len(adv_list) - 1)

            chosen_i = None
            # Search forward from ideal, then backward toward start+min_sols window
            search_order = list(range(ideal_i, hard_i + 1)) + list(
                range(ideal_i - 1, cursor_i, -1)
            )
            for i in search_order:
                e = entries[i]
                if min_sols <= e["sols"] <= max_sols:
                    chosen_i = i
                    break

            if chosen_i is None:
                # Last resort: nearest within hard window with any sols >= 2, else any
                fallback = None
                for i in range(cursor_i + 1, hard_i + 1):
                    e = entries[i]
                    if e["sols"] >= 2 and (fallback is None or e["sols"] < fallback[1]):
                        fallback = (i, e["sols"])
                if fallback:
                    chosen_i = fallback[0]
                    warnings.append(
                        f"L{rank}-{sub}: no {min_sols}-{max_sols} sol gate; "
                        f"used sols={fallback[1]} at Adv {adv_list[chosen_i]}"
                    )
                else:
                    chosen_i = hard_i
                    warnings.append(
                        f"L{rank}-{sub}: no multi-sol gate in window; "
                        f"forced Adv {adv_list[chosen_i]} "
                        f"(sols={entries[chosen_i]['sols']})"
                    )

            end_adv = adv_list[chosen_i]
            amt = chosen_i - cursor_i + 1
            gate = entries[chosen_i]
            steps.append(
                {
                    "Base_Lvl": f"L{rank}",
                    "Sub_Lvl": sub,
                    "pzzle_amt": amt,
                    "Adv_ID_Start": start_adv,
                    "Challenge_Adv_ID": end_adv,
                    "challenge_level_id": gate["level_id"],
                    "challenge_sols": gate["sols"],
                }
            )
            cursor_i = chosen_i + 1

    remaining = len(adv_list) - cursor_i
    if remaining:
        warnings.append(
            f"{remaining} map puzzles remain after L{ranks}-{subs} "
            f"(Adv {adv_list[cursor_i]}…{adv_list[-1]}) → postgame candidates"
        )
    return steps, warnings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--map", type=Path, default=MAP_CSV)
    ap.add_argument("--ranks", type=int, default=55)
    ap.add_argument("--subs", type=int, default=15)
    ap.add_argument("--target", type=int, default=15, help="Aim ~N puzzles per roman step")
    ap.add_argument("--min-sols", type=int, default=2)
    ap.add_argument("--max-sols", type=int, default=3, help="Cap challenge unique solutions")
    ap.add_argument(
        "--soft-max-step",
        type=int,
        default=28,
        help="Do not stretch a step past this many puzzles while hunting a gate",
    )
    ap.add_argument(
        "--write",
        type=Path,
        default=ROOT / "data" / "LevelSystem.proposed.csv",
        help="Output CSV path (does not overwrite LevelSystem.csv)",
    )
    args = ap.parse_args()

    entries = load_map(args.map)
    steps, warnings = propose(
        entries,
        ranks=args.ranks,
        subs=args.subs,
        target=args.target,
        min_sols=args.min_sols,
        max_sols=args.max_sols,
        soft_max_step=args.soft_max_step,
    )

    args.write.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "Base_Lvl",
        "Sub_Lvl",
        "pzzle_amt",
        "Adv_ID_Start",
        "Challenge_Adv_ID",
        "challenge_level_id",
        "challenge_sols",
    ]
    with args.write.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(steps)

    amts = [s["pzzle_amt"] for s in steps]
    sols = [s["challenge_sols"] for s in steps]
    print(f"Wrote {args.write}")
    print(f"steps={len(steps)}  total_puzzles={sum(amts)}")
    if amts:
        print(f"pzzle_amt range {min(amts)}–{max(amts)}  avg={sum(amts)/len(amts):.1f}")
        print(f"challenge_sols range {min(sols)}–{max(sols)}")
        from collections import Counter

        print("challenge_sols histogram:", dict(sorted(Counter(sols).items())))
    for msg in warnings[:20]:
        print("WARN:", msg)
    if len(warnings) > 20:
        print(f"WARN: … {len(warnings) - 20} more")
    print(
        "\nReview this file, then copy over data/LevelSystem.csv when ready. "
        "Map CH-lvl=T markers still need to match Challenge_Adv_ID."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
