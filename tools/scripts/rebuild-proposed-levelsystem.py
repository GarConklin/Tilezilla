#!/usr/bin/env python3
"""Rebuild LevelSystem.proposed.csv with contiguous Adv ranges.

Keeps the user's chosen challenge_level_id for each rank's sublevel 15 (XV),
then auto-fills roman I–XIV inside each rank span with low-sol gates.
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROPOSED = ROOT / "data" / "LevelSystem.proposed.csv"
MAP = ROOT / "data" / "adventure_solution_distribution.csv"

TARGET = 15
MIN_SOLS = 2
MAX_SOLS = 3
SOFT_MAX = 28
SUBS = 15


def load_map():
    entries = []
    by_level = {}
    with MAP.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            adv = int(r["Adv_ID"])
            lid = (r.get("level_id") or "").strip()
            sols = int((r.get("total_unique_solutions") or "1") or 1)
            e = {"adv_id": adv, "level_id": lid, "sols": sols}
            entries.append(e)
            if lid and lid not in by_level:
                by_level[lid] = adv
    entries.sort(key=lambda x: x["adv_id"])
    return entries, by_level


def fill_span(entries, start_i, end_i, rank: int, force_last_adv: int) -> list[dict]:
    """Create up to SUBS steps covering entries[start_i..end_i] inclusive.
    Last step must end at force_last_adv (== entries[end_i].adv_id).
    """
    assert entries[end_i]["adv_id"] == force_last_adv
    steps = []
    cursor = start_i
    remaining_subs = SUBS

    while remaining_subs > 1 and cursor <= end_i:
        # Leave enough room for remaining steps (at least 1 puzzle each)
        hard_end = end_i - (remaining_subs - 1)
        if hard_end < cursor:
            break
        ideal = min(cursor + TARGET - 1, hard_end)
        soft = min(cursor + SOFT_MAX - 1, hard_end)

        chosen = None
        for i in list(range(ideal, soft + 1)) + list(range(ideal - 1, cursor, -1)):
            if cursor < i <= soft and MIN_SOLS <= entries[i]["sols"] <= MAX_SOLS:
                chosen = i
                break
        if chosen is None:
            # prefer any multi-sol, else soft end
            best = None
            for i in range(cursor + 1, soft + 1):
                if entries[i]["sols"] >= 2 and (best is None or entries[i]["sols"] < best[1]):
                    best = (i, entries[i]["sols"])
            chosen = best[0] if best else soft

        end = entries[chosen]
        start_adv = entries[cursor]["adv_id"]
        steps.append({
            "Base_Lvl": f"L{rank}",
            "Sub_Lvl": len(steps) + 1,
            "pzzle_amt": end["adv_id"] - start_adv + 1,
            "Adv_ID_Start": start_adv,
            "Challenge_Adv_ID": end["adv_id"],
            "challenge_level_id": end["level_id"],
            "challenge_sols": end["sols"],
        })
        cursor = chosen + 1
        remaining_subs -= 1

    # Final XV step: everything left through end_i
    if cursor > end_i:
        # last auto step ate the XV puzzle — merge into previous and retarget
        if not steps:
            raise RuntimeError(f"L{rank}: empty span")
        # extend previous step to XV
        start_adv = steps[-1]["Adv_ID_Start"]
        end = entries[end_i]
        steps[-1] = {
            "Base_Lvl": f"L{rank}",
            "Sub_Lvl": steps[-1]["Sub_Lvl"],
            "pzzle_amt": end["adv_id"] - start_adv + 1,
            "Adv_ID_Start": start_adv,
            "Challenge_Adv_ID": end["adv_id"],
            "challenge_level_id": end["level_id"],
            "challenge_sols": end["sols"],
        }
        # renumber — we wanted 15 but span was too short
    else:
        end = entries[end_i]
        start_adv = entries[cursor]["adv_id"]
        steps.append({
            "Base_Lvl": f"L{rank}",
            "Sub_Lvl": len(steps) + 1,
            "pzzle_amt": end["adv_id"] - start_adv + 1,
            "Adv_ID_Start": start_adv,
            "Challenge_Adv_ID": end["adv_id"],
            "challenge_level_id": end["level_id"],
            "challenge_sols": end["sols"],
        })

    # Ensure last is XV numbering if we have 15 steps; if fewer, last is still the XV puzzle
    for i, s in enumerate(steps, start=1):
        s["Sub_Lvl"] = i
    if steps and steps[-1]["Challenge_Adv_ID"] != force_last_adv:
        raise RuntimeError(f"L{rank}: last gate {steps[-1]['Challenge_Adv_ID']} != {force_last_adv}")
    return steps


def main() -> None:
    entries, by_level = load_map()
    adv_index = {e["adv_id"]: i for i, e in enumerate(entries)}

    user_rows = list(csv.DictReader(PROPOSED.open(encoding="utf-8-sig", newline="")))
    xv_level = {}
    for r in user_rows:
        if int(r["Sub_Lvl"]) == 15:
            rank = int(r["Base_Lvl"][1:])
            xv_level[rank] = (r["challenge_level_id"] or "").strip()

    xv_gates = []  # (rank, adv_id, level_id)
    for rank in sorted(xv_level):
        lid = xv_level[rank]
        adv = by_level.get(lid)
        if adv is None:
            raise SystemExit(f"XV gate for L{rank} level {lid} not in map")
        xv_gates.append((rank, adv, lid))

    # Must increase
    for i in range(1, len(xv_gates)):
        if xv_gates[i][1] <= xv_gates[i - 1][1]:
            raise SystemExit(
                f"XV gates out of Adv order: L{xv_gates[i-1][0]} Adv {xv_gates[i-1][1]} "
                f"then L{xv_gates[i][0]} Adv {xv_gates[i][1]} ({xv_gates[i][2]})"
            )

    print("XV gates (kept from your file):")
    for rank, adv, lid in xv_gates:
        sols = entries[adv_index[adv]]["sols"]
        print(f"  L{rank}-15 -> Adv {adv} {lid} sols={sols}")

    all_steps = []
    prev_adv = 0
    for rank, xv_adv, _lid in xv_gates:
        start_i = adv_index[prev_adv + 1] if prev_adv else 0
        end_i = adv_index[xv_adv]
        span_steps = fill_span(entries, start_i, end_i, rank, xv_adv)
        print(f"L{rank}: {len(span_steps)} subs, Adv {entries[start_i]['adv_id']}-{xv_adv}")
        all_steps.extend(span_steps)
        prev_adv = xv_adv

    # Remainder after last XV -> continue ranks
    if prev_adv < entries[-1]["adv_id"]:
        start_i = adv_index[prev_adv + 1]
        end_i = len(entries) - 1
        rank = xv_gates[-1][0] + 1
        # fill as many full 15-sub ranks as possible with auto XV (low-sol near end of each chunk)
        cursor = start_i
        while cursor <= end_i:
            # estimate chunk for one rank ~ 15*TARGET puzzles
            ideal_end = min(cursor + SUBS * TARGET - 1, end_i)
            # pick XV gate near ideal_end
            hard = min(cursor + SUBS * SOFT_MAX - 1, end_i)
            xv_i = None
            for i in list(range(ideal_end, hard + 1)) + list(range(ideal_end - 1, cursor, -1)):
                if MIN_SOLS <= entries[i]["sols"] <= MAX_SOLS:
                    xv_i = i
                    break
            if xv_i is None:
                xv_i = hard
            span = fill_span(entries, cursor, xv_i, rank, entries[xv_i]["adv_id"])
            print(f"L{rank} (auto remainder): {len(span)} subs, Adv {entries[cursor]['adv_id']}-{entries[xv_i]['adv_id']}")
            all_steps.extend(span)
            cursor = xv_i + 1
            rank += 1

    # Validate contiguity
    p = 0
    for s in all_steps:
        assert s["Adv_ID_Start"] == p + 1, (s, p)
        assert s["Challenge_Adv_ID"] == s["Adv_ID_Start"] + s["pzzle_amt"] - 1
        p = s["Challenge_Adv_ID"]
    assert p == entries[-1]["adv_id"]

    fieldnames = [
        "Base_Lvl", "Sub_Lvl", "pzzle_amt", "Adv_ID_Start", "Challenge_Adv_ID",
        "challenge_level_id", "challenge_sols",
    ]
    with PROPOSED.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(all_steps)

    print(f"\nwrote {PROPOSED}")
    print(f"steps={len(all_steps)} total_puzzles={sum(s['pzzle_amt'] for s in all_steps)}")
    print("XV check:")
    for s in all_steps:
        if s["Sub_Lvl"] == 15 or (
            # short ranks: last sub is the XV puzzle for that rank
            s is all_steps[-1] or True
        ):
            pass
    for s in all_steps:
        rank = int(s["Base_Lvl"][1:])
        if rank in xv_level and s["Sub_Lvl"] == max(
            x["Sub_Lvl"] for x in all_steps if x["Base_Lvl"] == s["Base_Lvl"]
        ):
            if s["Sub_Lvl"] == 15:
                want = xv_level[rank]
                got = s["challenge_level_id"]
                mark = "OK" if got == want else f"MISMATCH want {want}"
                print(f"  {s['Base_Lvl']}-15 {got} sols={s['challenge_sols']} {mark}")


if __name__ == "__main__":
    main()
