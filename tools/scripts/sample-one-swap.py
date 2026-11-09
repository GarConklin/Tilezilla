#!/usr/bin/env python3
"""Write one swap spec from a saved solution.

A swap is kept only when all of these are true:
- both sets are in the same row of the sets you named
- the source tiles sit together in a saved solution
- the replacement covers those same squares
- the outside openings are the same
- the puzzle has no CQ, CR, or CT tile
- the new bag is not already in the catalog

The witness is the old solution with those tiles replaced. That layout uses
the new bag, so the solver count has to be at least 1.
"""
from __future__ import annotations

import importlib.util
import itertools
import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "tools" / "data" / "solver-runs" / "swap-sample"
# Small boards so the sample solve finishes. 3x4, 3x5, 4x4.
SIZE_PREFIXES = ("3x4-", "3x5-", "4x4-")
CROSS = {"CQ", "CR", "CT"}

_spec = importlib.util.spec_from_file_location(
    "swapq", HERE / "build-swap-solve-queue.py"
)
q = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(q)


def unique_perms(items):
    seen = set()
    for perm in itertools.permutations(items):
        if perm in seen:
            continue
        seen.add(perm)
        yield perm


def board_cells(group, dr, dc):
    cells = []
    for _tile, _deg, _anchor, cells_ in group:
        for rr, cc in cells_:
            cells.append((rr + dr, cc + dc))
    return cells


def build_named():
    """Patterns for the named sets only, grouped by squares and openings."""
    coverings = [
        ("2", [[(0, 0), (1, 0)], [(0, 1), (1, 1)]]),
        ("2", [[(0, 0), (0, 1)], [(1, 0), (1, 1)]]),
        ("3", [[(0, 0), (1, 0)], [(0, 1), (1, 1)], [(0, 2), (1, 2)]]),
        ("3", [[(0, 0), (0, 1)], [(1, 0), (1, 1)], [(0, 2), (1, 2)]]),
        ("3", [[(0, 0), (1, 0)], [(0, 1), (0, 2)], [(1, 1), (1, 2)]]),
        ("3", [[(0, 0), (0, 1)], [(1, 0), (1, 1)], [(2, 0), (2, 1)]]),
        ("3", [[(0, 0), (1, 0)], [(0, 1), (1, 1)], [(2, 0), (2, 1)]]),
        ("3", [[(0, 0), (0, 1)], [(1, 0), (2, 0)], [(1, 1), (2, 1)]]),
    ]
    by_key = {}
    by_anchor = defaultdict(list)
    for family, row in enumerate(q.USER_PAIRS):
        for bag in row:
            bag = tuple(sorted(bag))
            cover = q.make_cover(list(dict.fromkeys(bag)))
            for _kind, parts in coverings:
                if len(parts) != len(bag):
                    continue
                occupied = [cell for part in parts for cell in part]
                footprint = tuple(sorted(occupied))
                for assignment in unique_perms(bag):
                    choices = []
                    ok = True
                    for tile, part in zip(assignment, parts):
                        opts = [
                            p
                            for p in cover.get(frozenset(part), ())
                            if p[0] == tile
                        ]
                        if not opts:
                            ok = False
                            break
                        choices.append(opts)
                    if not ok:
                        continue
                    for group in itertools.product(*choices):
                        sig = q.gadget(group, occupied)
                        if not sig:
                            continue
                        if set(board_cells(group, 0, 0)) != set(footprint):
                            continue
                        key = (family, footprint, sig)
                        rec = by_key.get(key)
                        if rec is None:
                            rec = {}
                            by_key[key] = rec
                        pats = rec.setdefault(bag, [])
                        if group not in pats:
                            pats.append(group)
    usable = {}
    for key, bags in by_key.items():
        if len(bags) < 2:
            continue
        usable[key] = bags
        for bag, groups in bags.items():
            for group in groups:
                tile, deg, anchor, _cells = group[0]
                # Key is the tile and rotation only. The anchor is local to the
                # 2x2 template. Board position is applied later as a shift.
                by_anchor[(tile, deg)].append((anchor[0], anchor[1], key, bag, group))
    print(
        f"named swap classes {len(usable)}",
        flush=True,
    )
    return usable, by_anchor


def load_catalog():
    catalog = set()
    blockers = {}
    for path in q.LEVELS.glob("*.json"):
        if path.name in {"levels.json", "index.json"}:
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        for lv in doc.get("levels") or []:
            board = lv.get("board") or {}
            rows, cols = int(board.get("rows") or 0), int(board.get("cols") or 0)
            td = lv.get("tiles") or {}
            lid = lv.get("id") or lv.get("levelId")
            if lid:
                blockers[lid] = lv.get("blockers") or []
            if rows and cols and td:
                catalog.add((rows, cols, q.bag_key(td)))
    print(f"catalog bags {len(catalog)}", flush=True)
    return catalog, blockers


def placement_key(p):
    return (
        p["tile"],
        int(p["deg"]) % 360,
        int(p["r"]),
        int(p["c"]),
    )


def iter_swaps_in_doc(
    doc, level, usable, by_anchor, catalog, blockers, family=None, max_cells=None, all_hits=False
):
    """Yield each new bag in one puzzle document.

    family limits the yield to one row of named sets. max_cells limits board size.
    The same new bag is yielded once, from the first solution that holds the swap,
    unless all_hits is set: then every solution and every spot that holds it is yielded.
    """
    sols = doc.get("solutions") or []
    if not sols:
        return
    board = doc.get("board") or {}
    rows, cols = int(board.get("rows") or 0), int(board.get("cols") or 0)
    if rows < 2 or cols < 2:
        return
    if max_cells is not None and rows * cols > max_cells:
        return
    td = {k: int(v) for k, v in (doc.get("tiles") or {}).items() if int(v) > 0}
    if not td or td.get("SH") != 1 or td.get("ET") != 1:
        return
    if set(td) & CROSS or set(td) & {"2SH", "2ET"}:
        return
    if family is not None:
        row_bags = [tuple(sorted(b)) for b in q.USER_PAIRS[family]]
        if not any(q.covers(td, bag) for bag in row_bags):
            return
    level_blockers = blockers.get(level) or doc.get("blockers") or []
    seen_bags = set()

    for sol_index, sol in enumerate(sols, start=1):
        pl = sol.get("placements") or []
        if not pl:
            continue
        placed = {placement_key(p) for p in pl}
        for tile, deg, r, c in placed:
            for lr, lc, key, src_bag, group in by_anchor.get((tile, deg), ()):
                if family is not None and key[0] != family:
                    continue
                if not q.covers(td, src_bag):
                    continue
                dr, dc = r - lr, c - lc
                shifted = []
                for t, d, anchor, _cells in group:
                    shifted.append((t, d, anchor[0] + dr, anchor[1] + dc))
                if any(item not in placed for item in shifted):
                    continue
                footprint = key[1]
                src_cells = {(rr + dr, cc + dc) for rr, cc in footprint}
                if set(board_cells(group, dr, dc)) != src_cells:
                    continue
                for dst_bag, dst_groups in usable[key].items():
                    if dst_bag == src_bag:
                        continue
                    if family is not None and q.PAIR_FAMILY.get(tuple(sorted(dst_bag))) != family:
                        continue
                    dst = dst_groups[0]
                    if set(board_cells(dst, dr, dc)) != src_cells:
                        continue
                    new_td = q.apply_delta(td, Counter(src_bag), Counter(dst_bag))
                    if new_td is None:
                        continue
                    if set(new_td) & CROSS or new_td.get("SH") != 1 or new_td.get("ET") != 1:
                        continue
                    new_key = q.bag_key(new_td)
                    if new_key == q.bag_key(td) or (not all_hits and new_key in seen_bags):
                        continue
                    if (rows, cols, new_key) in catalog:
                        continue
                    needed = Counter(shifted)
                    rest = []
                    for p in pl:
                        k = placement_key(p)
                        if needed[k] > 0:
                            needed[k] -= 1
                            continue
                        rest.append(
                            {
                                "tile": k[0],
                                "deg": k[1],
                                "r": k[2],
                                "c": k[3],
                            }
                        )
                    if any(needed.values()):
                        continue
                    inn = []
                    for t, d, anchor, _cells in dst:
                        inn.append(
                            {
                                "tile": t,
                                "deg": d,
                                "r": anchor[0] + dr,
                                "c": anchor[1] + dc,
                            }
                        )
                    witness = rest + inn
                    got = Counter(p["tile"] for p in witness)
                    if got != Counter(new_td):
                        continue
                    seen_bags.add(new_key)
                    yield {
                        "family": key[0],
                        "level": level,
                        "solution": sol_index,
                        "rows": rows,
                        "cols": cols,
                        "cells": int(board.get("cells") or rows * cols),
                        "blockers": level_blockers,
                        "tiles": new_td,
                        "swapOut": list(src_bag),
                        "swapIn": list(dst_bag),
                        "squares": [[rr, cc] for rr, cc in sorted(src_cells)],
                        "witness": witness,
                    }


def iter_swaps_in_file(
    path, usable, by_anchor, catalog, blockers, family=None, max_cells=None
):
    doc = json.loads(path.read_text(encoding="utf-8"))
    level = doc.get("levelId") or path.stem
    yield from iter_swaps_in_doc(
        doc, level, usable, by_anchor, catalog, blockers, family, max_cells
    )


def try_file(path, usable, by_anchor, catalog, blockers):
    for found in iter_swaps_in_file(
        path, usable, by_anchor, catalog, blockers, max_cells=16
    ):
        return found
    return None


def main():
    usable, by_anchor = build_named()
    catalog, blockers = load_catalog()
    found = None
    scanned = 0
    for prefix in SIZE_PREFIXES:
        print(f"scanning {prefix}*", flush=True)
        for path in sorted(q.SOLVES.glob(prefix + "*.json")):
            scanned += 1
            if scanned % 200 == 0:
                print(f"scanned {scanned}", flush=True)
            found = try_file(path, usable, by_anchor, catalog, blockers)
            if found:
                break
        if found:
            break
    if not found:
        raise SystemExit(
            f"No named swap on a 3x4, 3x5, or 4x4 board after {scanned} files."
        )

    OUT.mkdir(parents=True, exist_ok=True)
    tier = q.tier_of(found["tiles"])
    size = q.size_prefix(found["rows"], found["cols"])
    tiles_out = {k: int(found["tiles"][k]) for k in sorted(found["tiles"])}
    spec = {
        "id": "sample-swap",
        "levelId": "sample-swap",
        "board": {"rows": found["rows"], "cols": found["cols"], "cells": found["cells"]},
        "tileSet": "tiles-live-edges.json",
        "tiles": tiles_out,
        "tier": tier,
        "size": size,
        "pathMode": "single",
        "from": found["level"],
        "swapOut": found["swapOut"],
        "swapIn": found["swapIn"],
        "note": (
            "One named swap on the same squares and the same openings. "
            "The count must be at least 1."
        ),
    }
    if found["blockers"]:
        spec["blockers"] = found["blockers"]
    witness = {
        "from": found["level"],
        "solution": found["solution"],
        "swapOut": found["swapOut"],
        "swapIn": found["swapIn"],
        "squares": found["squares"],
        "tiles": tiles_out,
        "placements": found["witness"],
    }
    (OUT / "spec.json").write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    (OUT / "witness.json").write_text(json.dumps(witness, indent=2) + "\n", encoding="utf-8")
    print(
        f"sample from {found['level']} solution {found['solution']}",
        flush=True,
    )
    print(
        f"swap out {'+'.join(found['swapOut'])}  swap in {'+'.join(found['swapIn'])}",
        flush=True,
    )
    print(f"spec {OUT / 'spec.json'}", flush=True)


if __name__ == "__main__":
    main()
