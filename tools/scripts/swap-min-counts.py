#!/usr/bin/env python3
"""Minimum solution counts for every named swap puzzle, from parent solutions.

Every solution of a parent that holds the swap tiles in place becomes a
solution of the child. Starting from the game puzzles, those solutions are
carried down the whole list. The result is a minimum: the full solver can find
more, never fewer. Layouts are counted once per board turn, like the solver.

For puzzles already fully solved, every carried solution must be in the full
solve; any that are missing are listed.

    python tools/scripts/swap-min-counts.py
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import time
from collections import Counter, deque
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "tools" / "data" / "solver-runs" / "swap-named"
REPORT = OUT / "min-counts.json"
SKIP_SIZES = ("6x6-",)

_spec = importlib.util.spec_from_file_location("sample_one_swap", HERE / "sample-one-swap.py")
sample = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sample)
q = sample.q

TILES = json.loads((ROOT / "data" / "tiles" / "tiles-live-edges.json").read_text(encoding="utf-8"))
TURN90 = {"N": "E", "E": "S", "S": "W", "W": "N"}


def target_cells(r, c, deg):
    if deg == 0:
        return [(r, c), (r, c + 1)]
    if deg == 90:
        return [(r, c), (r + 1, c)]
    if deg == 180:
        return [(r, c), (r, c - 1)]
    return [(r, c), (r - 1, c)]


def bag_token(rows, cols, blockers, tiles):
    return json.dumps(
        [rows, cols, blockers or [], [[name, count] for name, count in q.bag_key(tiles)]],
        separators=(",", ":"),
    )


def cell_layout(placements):
    """Each tile as the squares it covers and the openings in each square."""
    out = []
    for p in placements:
        tile, deg = p["tile"], int(p["deg"]) % 360
        size = len(TILES[tile].get("shape") or [None, None])
        shape = TILES[tile][f"r{deg}"]
        squares = []
        for i, cell in enumerate(target_cells(int(p["r"]), int(p["c"]), deg)[:size]):
            squares.append((cell, tuple(sorted(shape["A" if i == 0 else "B"]))))
        out.append((tile, tuple(sorted(squares))))
    return out


def canon(placements, rows, cols):
    """The same key for a layout and its turned copies (half turn; quarter turns on square boards)."""
    layout = cell_layout(placements)
    turns = [2] if rows != cols else [1, 2, 3]
    best = tuple(sorted(layout))
    for k in turns:
        cur = layout
        r_n, c_n = rows, cols
        for _ in range(k):
            cur = [
                (tile, tuple(sorted(((c, r_n - 1 - r), tuple(sorted(TURN90[e] for e in edges))) for (r, c), edges in squares)))
                for tile, squares in cur
            ]
            r_n, c_n = c_n, r_n
        key = tuple(sorted(cur))
        if key < best:
            best = key
    return hashlib.blake2b(repr(best).encode(), digest_size=12).digest()


def compact(placements):
    return tuple((p["tile"], int(p["deg"]) % 360, int(p["r"]), int(p["c"])) for p in placements)


def expand(placements):
    return [{"tile": t, "deg": d, "r": r, "c": c} for t, d, r, c in placements]


def clock(seconds):
    seconds = int(seconds)
    return f"{seconds // 3600}:{seconds // 60 % 60:02d}:{seconds % 60:02d}"


def main():
    began = time.monotonic()
    print("building classes", flush=True)
    usable, by_anchor = sample.build_named()
    catalog, blockers = sample.load_catalog()
    ledger = json.loads((OUT / "ledger.json").read_text(encoding="utf-8"))
    done = ledger.get("done") or {}
    ids = [i for i in list(ledger.get("pending") or []) + list(done) if not i.startswith(SKIP_SIZES)]
    total = len(ids)

    print(f"reading {total} puzzles", flush=True)
    by_token, info, children, found = {}, {}, {}, {}
    for n, pid in enumerate(ids, 1):
        if n % 10000 == 0 or n == total:
            spent = time.monotonic() - began
            print(f"read {n} of {total} ({n * 100 // total}%)  elapsed {clock(spent)}", flush=True)
        spec = json.loads((OUT / "specs" / f"{pid}.json").read_text(encoding="utf-8"))
        board = spec.get("board") or {}
        rows, cols = int(board["rows"]), int(board["cols"])
        by_token[bag_token(rows, cols, spec.get("blockers"), spec.get("tiles") or {})] = pid
        info[pid] = {"board": board, "tiles": spec.get("tiles") or {}, "blockers": spec.get("blockers") or [], "rows": rows, "cols": cols}
        children.setdefault(spec.get("from") or "", []).append(pid)
        w = json.loads((OUT / "witnesses" / f"{pid}.json").read_text(encoding="utf-8"))
        found[pid] = {}
        if w.get("placements"):
            found[pid][canon(w["placements"], rows, cols)] = compact(w["placements"])

    def carry(doc, level):
        for hit in sample.iter_swaps_in_doc(doc, level, usable, by_anchor, catalog, blockers, all_hits=True):
            child = by_token.get(bag_token(hit["rows"], hit["cols"], hit["blockers"], hit["tiles"]))
            if child is not None:
                found[child].setdefault(canon(hit["witness"], hit["rows"], hit["cols"]), compact(hit["witness"]))

    roots = [r for r in children if r not in info]
    print(f"carrying from {len(roots)} game puzzles", flush=True)
    for n, level in enumerate(roots, 1):
        path = ROOT / "solves" / f"{level}.json"
        if path.exists():
            carry(json.loads(path.read_text(encoding="utf-8")), level)
        if n % 1000 == 0 or n == len(roots):
            print(f"game puzzles {n} of {len(roots)}", flush=True)

    order = deque(pid for r in roots for pid in children.get(r, []))
    seen = set(order)
    for pid in ids:
        if pid not in seen:
            order.append(pid)
            seen.add(pid)

    counts, checked, missing = {}, 0, []
    print(f"carrying through {total} named puzzles", flush=True)
    n = 0
    while order:
        pid = order.popleft()
        n += 1
        if n % 10000 == 0 or n == total:
            spent = time.monotonic() - began
            print(f"carried {n} of {total} ({n * 100 // total}%)  elapsed {clock(spent)}", flush=True)
        meta = info[pid]
        sols = [expand(s) for s in found[pid].values()]
        counts[pid] = len(found[pid])
        enum_path = OUT / "enumerated" / f"{pid}.json"
        if pid in done and enum_path.exists():
            full = json.loads(enum_path.read_text(encoding="utf-8")).get("solutions") or []
            full_keys = {canon(s["placements"], meta["rows"], meta["cols"]) for s in full}
            checked += 1
            lost = [k for k in found[pid] if k not in full_keys]
            if lost:
                missing.append({"id": pid, "carried": len(found[pid]), "fullSolve": done[pid].get("solutions"), "notInFullSolve": len(lost)})
            sols = [s["placements"] for s in full]
        doc = {"board": meta["board"], "tiles": meta["tiles"], "blockers": meta["blockers"], "solutions": [{"placements": s} for s in sols]}
        carry(doc, pid)
        for child in children.get(pid, []):
            if child not in seen:
                order.append(child)
                seen.add(child)
        found[pid] = None

    buckets = Counter()
    for c in counts.values():
        buckets["0" if c == 0 else "1" if c == 1 else "2-5" if c <= 5 else "6-20" if c <= 20 else "21-100" if c <= 100 else "over 100"] += 1
    REPORT.write_text(json.dumps({"counts": counts, "checked": checked, "missing": missing}, indent=1) + "\n", encoding="utf-8")
    print(f"puzzles {len(counts)}  carried solutions {sum(counts.values())}", flush=True)
    for label in ("0", "1", "2-5", "6-20", "21-100", "over 100"):
        print(f"  minimum {label}: {buckets[label]}", flush=True)
    print(f"fully solved puzzles checked {checked}, with carried solutions missing from the full solve {len(missing)}", flush=True)
    for row in missing[:20]:
        print(f"  {row['id']}  carried {row['carried']}  full solve {row['fullSolve']}  missing {row['notInFullSolve']}", flush=True)
    print(f"list: {REPORT}  time {clock(time.monotonic() - began)}", flush=True)


if __name__ == "__main__":
    main()
