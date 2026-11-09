#!/usr/bin/env python3
"""Check that every named swap puzzle solves, using its saved swapped layout.

Each layout is walked from SH to ET. Every opening must meet a matching
opening, every tile edge must be on the one snake, and the tiles placed must
match the bag. Only puzzles that fail are listed. Does not count solutions.

    python tools/scripts/check-swap-witnesses.py
"""
from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TILES = json.loads((ROOT / "data" / "tiles" / "tiles-live-edges.json").read_text(encoding="utf-8"))
OUT = ROOT / "tools" / "data" / "solver-runs" / "swap-named"
SPECS = OUT / "specs"
WITNESSES = OUT / "witnesses"
REPORT = OUT / "check-flags.json"

CROSS = {"CR", "CT", "CQ"}
D = {"N": (-1, 0), "S": (1, 0), "E": (0, 1), "W": (0, -1)}
OPP = {"N": "S", "S": "N", "E": "W", "W": "E"}


def target_cells(r, c, deg):
    if deg == 0:
        return [(r, c), (r, c + 1)]
    if deg == 90:
        return [(r, c), (r + 1, c)]
    if deg == 180:
        return [(r, c), (r, c - 1)]
    return [(r, c), (r - 1, c)]


def blocker_cells(blockers):
    cells = set()
    for b in blockers or []:
        if isinstance(b, dict) and "r" in b and "c" in b:
            cells.add((int(b["r"]), int(b["c"])))
        elif isinstance(b, (list, tuple)) and len(b) >= 2:
            r, c = int(b[0]), int(b[1])
            name = b[2] if len(b) > 2 else "B1"
            deg = int(b[3]) % 360 if len(b) > 3 else 0
            size = len((TILES.get(name) or {}).get("shape") or [None])
            cells.update(target_cells(r, c, deg)[:size])
    return cells


def check(spec, witness):
    board = spec.get("board") or {}
    rows, cols = int(board.get("rows") or 0), int(board.get("cols") or 0)
    bag = {k: int(v) for k, v in (spec.get("tiles") or {}).items() if int(v) > 0}
    placements = witness.get("placements") or []
    if not placements:
        return "no saved layout"
    got = Counter(p["tile"] for p in placements)
    if got != Counter(bag):
        return "tiles in layout do not match the bag"
    if bag.get("SH") != 1 or bag.get("ET") != 1:
        return "not exactly one SH and one ET"

    blocked = blocker_cells(spec.get("blockers"))
    edges = {}
    internal = {}
    start = end = None
    for p in placements:
        tile, deg, r, c = p["tile"], int(p["deg"]) % 360, int(p["r"]), int(p["c"])
        shape = (TILES.get(tile) or {}).get(f"r{deg}")
        if shape is None:
            return f"unknown tile or turn {tile} {deg}"
        cells = target_cells(r, c, deg)[: len(TILES[tile].get("shape") or [None, None])]
        for cell in cells:
            if not (0 <= cell[0] < rows and 0 <= cell[1] < cols):
                return f"{tile} off the board at {cell}"
            if cell in blocked:
                return f"{tile} on a blocker at {cell}"
            if cell in edges:
                return f"two tiles on {cell}"
            edges[cell] = []
        ones = []
        for i, cell in enumerate(cells):
            es = list(shape["A" if i == 0 else "B"])
            edges[cell] = es
            if len(es) == 2 and not shape.get("paths"):
                internal[(cell, es[0])] = (cell, es[1])
                internal[(cell, es[1])] = (cell, es[0])
            elif len(es) == 1:
                ones.append((cell, es[0]))
            elif len(es) > 2 and not shape.get("paths"):
                return f"{tile} has more than two openings in one square"
        if shape.get("paths"):
            for path in shape["paths"]:
                (w1, d1), (w2, d2) = path["ends"]
                a = (cells[0 if w1 == "A" else 1], d1)
                b = (cells[0 if w2 == "A" else 1], d2)
                internal[a] = b
                internal[b] = a
        elif tile == "SH":
            start = ones[0]
        elif tile == "ET":
            end = ones[0]
        elif len(ones) == 2:
            internal[ones[0]] = ones[1]
            internal[ones[1]] = ones[0]
        elif ones:
            return f"{tile} has a loose opening"

    total = sum(len(es) for es in edges.values())
    used = {start}
    cur = start
    for _ in range(total + 2):
        cell, d = cur
        nxt_cell = (cell[0] + D[d][0], cell[1] + D[d][1])
        if OPP[d] not in edges.get(nxt_cell, []):
            return f"opening at {cell} {d} meets nothing"
        nxt = (nxt_cell, OPP[d])
        if nxt in used:
            return f"snake runs into itself at {nxt_cell}"
        used.add(nxt)
        if nxt == end:
            break
        cur = internal.get(nxt)
        if cur is None or cur in used:
            return f"snake breaks at {nxt_cell}"
        used.add(cur)
    else:
        return "snake never reaches ET"
    if len(used) != total:
        return f"{total - len(used)} openings not on the snake"
    return None


def clock(seconds):
    seconds = int(seconds)
    return f"{seconds // 3600}:{seconds // 60 % 60:02d}:{seconds % 60:02d}"


def main():
    print("listing named puzzles...", flush=True)
    ids = sorted(p.stem for p in SPECS.glob("*.json"))
    total = len(ids)
    print(f"checking {total} named puzzles", flush=True)
    flags = []
    cross = 0
    shown = 0
    began = time.monotonic()
    for n, pid in enumerate(ids, start=1):
        if n % 2000 == 0 or n == total:
            spent = time.monotonic() - began
            left = spent / n * (total - n)
            print(
                f"checked {n} of {total} ({n * 100 / total:.1f}%)  flagged {len(flags)}"
                f"  elapsed {clock(spent)}  left {clock(left)}",
                flush=True,
            )
        try:
            spec = json.loads((SPECS / f"{pid}.json").read_text(encoding="utf-8"))
            witness = json.loads((WITNESSES / f"{pid}.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            flags.append({"id": pid, "reason": f"cannot read files: {exc}"})
            continue
        if set(spec.get("tiles") or {}) & CROSS:
            cross += 1
        reason = check(spec, witness)
        if reason:
            if shown < 50:
                shown += 1
                print(f"  FLAG {pid}  from {spec.get('from')}  {reason}", flush=True)
            elif shown == 50:
                shown += 1
                print("  more flags are in the list file", flush=True)
            flags.append(
                {
                    "id": pid,
                    "from": spec.get("from"),
                    "swapOut": spec.get("swapOut"),
                    "swapIn": spec.get("swapIn"),
                    "reason": reason,
                }
            )
    REPORT.write_text(json.dumps({"checked": len(ids), "flagged": flags}, indent=2) + "\n", encoding="utf-8")
    print(f"checked {len(ids)}", flush=True)
    print(f"with CR, CT or CQ {cross}", flush=True)
    print(f"flagged {len(flags)}", flush=True)
    for reason, count in Counter(f["reason"].split(" at ")[0] for f in flags).most_common():
        print(f"  {count}  {reason}", flush=True)
    print(f"list: {REPORT}", flush=True)


if __name__ == "__main__":
    main()
