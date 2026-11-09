#!/usr/bin/env python3
"""Build an interruptible solve queue from swap-set bags.

Scans Tilezilla solves, keeps every new bag that is not already in the
published catalog, and writes blocks of 50 solver specs.

Ids are 4-character base36 per size and tier: 0000 .. ZZZZ.
They do not collide with catalog ids AAA .. ZZZ (17,576 per bucket).

Output (gitignored with other solver runs):
  tools/data/solver-runs/swap-solve-queue/
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TILES_PATH = ROOT / "data" / "tiles" / "tiles-live-edges.json"
LEVELS = ROOT / "data" / "levels"
SOLVES = ROOT / "solves"
OUT = ROOT / "tools" / "data" / "solver-runs" / "swap-solve-queue"
BLOCK_SIZE = 50
ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

SKIP = {"SH", "ET", "2SH", "2ET", "B1", "B2", "OB", "ES", "E1", "E2"}
CROSS = {"CR", "CT", "CQ"}
# Sets the user named. A swap is kept only when both sides are in the same row.
USER_PAIRS = (
    (("QC", "UT"), ("QZ", "SS"), ("SS", "SZ"), ("VL", "VL")),
    (("DB", "UT"), ("LC", "RC"), ("LL", "LR")),
    (("DC", "UT"), ("LC", "VL"), ("LL", "SS")),
    (("LR", "RC"), ("QZ", "VL"), ("SZ", "VL")),
    (("DS", "UT"), ("LR", "QZ"), ("LR", "SZ"), ("RC", "VL")),
    (("LC", "LL"), ("SS", "VL")),
    (("DS", "DC"), ("HL", "UT")),
    (("DC", "VL"), ("HL", "RC")),
    (("DS", "VL"), ("HL", "LC")),
    # Five combinations. Any one can replace any other.
    (("LC", "QZ"), ("LC", "SZ"), ("LL", "VL"), ("LR", "VL"), ("RC", "SS")),
    # Straight trio, north in and south out.
    (
        ("VL", "VL", "VL"),
        # Three orders: SS SZ VL, SS VL SZ, VL SS SZ. The reverse of each is the same stack.
        ("SS", "SZ", "VL"),
        # Three orders: VL SS QZ, SS VL QZ, SS QZ VL. The reverse of each is the same stack.
        ("QZ", "SS", "VL"),
        ("QC", "UT", "VL"),
        ("LC", "LL", "SZ"),
        ("LC", "LL", "QZ"),
        ("LR", "RC", "SS"),
    ),
    # U-turn trio: three tiles filling two columns by three rows, in and out on the same side.
    (
        ("DC", "RC", "UT"),
        ("DS", "LC", "UT"),
        ("LC", "LL", "SZ"),
        ("LC", "LR", "SZ"),
        ("LC", "RC", "VL"),
        ("LL", "LL", "VL"),
        ("LL", "LR", "VL"),
        ("LL", "RC", "SS"),
        ("LR", "LR", "VL"),
        ("LR", "RC", "SS"),
    ),
)
# A bag can sit in more than one set; specs record their own set, this is the fallback.
PAIR_FAMILY = {}
for _i, _fam in enumerate(USER_PAIRS):
    for _bag in _fam:
        PAIR_FAMILY.setdefault(tuple(sorted(_bag)), _i)
TIER_0C = {"CR", "CT", "CQ", "E1", "E2", "B2", "2SH", "2ET"}
TIER_0B = {"SZ", "SS", "DS", "QC", "QS", "QZ", "DC"}

tiles = json.loads(TILES_PATH.read_text(encoding="utf-8"))
ALL = [
    n
    for n, t in tiles.items()
    if isinstance(t, dict) and "r0" in t and n not in SKIP and len(t.get("shape") or []) == 2
]


def target_cells(r, c, deg):
    rot = deg % 360
    if rot == 0:
        return [(r, c), (r, c + 1)]
    if rot == 90:
        return [(r, c), (r + 1, c)]
    if rot == 180:
        return [(r, c), (r, c - 1)]
    return [(r, c), (r - 1, c)]


D = {"N": (-1, 0), "S": (1, 0), "E": (0, 1), "W": (0, -1)}
OPP = {"N": "S", "S": "N", "E": "W", "W": "E"}


def make_cover(names):
    cover = defaultdict(list)
    for tile in names:
        for deg in (0, 90, 180, 270):
            for r in range(-1, 5):
                for c in range(-1, 5):
                    cells = target_cells(r, c, deg)
                    if any(rr < 0 or cc < 0 or rr > 3 or cc > 3 for rr, cc in cells):
                        continue
                    cover[frozenset(cells)].append((tile, deg, (r, c), tuple(cells)))
    return cover


def gadget(placements, occupied):
    occ = set(occupied)
    internal = {}
    board = {}
    all_edges = []
    for tile, deg, anchor, cells in placements:
        sp = tiles[tile][f"r{deg % 360}"]
        paths = sp.get("paths")
        for i, (rr, cc) in enumerate(cells):
            es = list(sp["A" if i == 0 else "B"])
            board[(rr, cc)] = es
            for d in es:
                all_edges.append(((rr, cc), d))
        if paths:
            for p in paths:
                (w1, d1), (w2, d2) = p["ends"]
                c1 = cells[0 if w1 == "A" else 1]
                c2 = cells[0 if w2 == "A" else 1]
                a = (c1, d1)
                b = (c2, d2)
                if a in internal or b in internal:
                    return None
                internal[a] = b
                internal[b] = a
        else:
            ones = []
            for i, (rr, cc) in enumerate(cells):
                es = list(sp["A" if i == 0 else "B"])
                if len(es) == 2:
                    a = ((rr, cc), es[0])
                    b = ((rr, cc), es[1])
                    internal[a] = b
                    internal[b] = a
                elif len(es) == 1:
                    ones.append(((rr, cc), es[0]))
                elif len(es) > 2:
                    return None
            if len(ones) == 2:
                internal[ones[0]] = ones[1]
                internal[ones[1]] = ones[0]
            elif ones:
                return None
    ports = []
    for (rr, cc), es in board.items():
        for d in es:
            dr, dc = D[d]
            nr, nc = rr + dr, cc + dc
            if (nr, nc) in occ:
                if OPP[d] not in board.get((nr, nc), []):
                    return None
            else:
                ports.append(((rr, cc), d))
    port_set = set(ports)
    pairs = []
    seen = set()
    used = set()
    for p0 in port_set:
        if p0 in seen:
            continue
        seen.add(p0)
        used.add(p0)
        cur = p0
        for _ in range(20):
            if cur not in internal:
                return None
            m = internal[cur]
            used.add(cur)
            used.add(m)
            dr, dc = D[m[1]]
            nr, nc = m[0][0] + dr, m[0][1] + dc
            if (nr, nc) not in occ:
                seen.add(m)
                pairs.append(
                    tuple(
                        sorted(
                            (
                                (p0[0][0], p0[0][1], p0[1]),
                                (m[0][0], m[0][1], m[1]),
                            )
                        )
                    )
                )
                break
            cur = ((nr, nc), OPP[m[1]])
            used.add(cur)
        else:
            return None
    if len(pairs) * 2 != len(port_set) or not port_set:
        return None
    if len(used) != len(all_edges):
        return None
    return (len(pairs), tuple(sorted(pairs)))


def build(names, min_paths, max_paths):
    cover = make_cover(names)
    coverings = [
        ("2", [[(0, 0), (1, 0)], [(0, 1), (1, 1)]], 2, 2),
        ("2", [[(0, 0), (0, 1)], [(1, 0), (1, 1)]], 2, 2),
        ("3", [[(0, 0), (1, 0)], [(0, 1), (1, 1)], [(0, 2), (1, 2)]], 2, 3),
        ("3", [[(0, 0), (0, 1)], [(1, 0), (1, 1)], [(0, 2), (1, 2)]], 2, 3),
        ("3", [[(0, 0), (1, 0)], [(0, 1), (0, 2)], [(1, 1), (1, 2)]], 2, 3),
        ("3", [[(0, 0), (0, 1)], [(1, 0), (1, 1)], [(2, 0), (2, 1)]], 3, 2),
        ("3", [[(0, 0), (1, 0)], [(0, 1), (1, 1)], [(2, 0), (2, 1)]], 3, 2),
        ("3", [[(0, 0), (0, 1)], [(1, 0), (2, 0)], [(1, 1), (2, 1)]], 3, 2),
    ]
    classes = {}
    by_anchor = defaultdict(list)
    seen = set()
    for kind, parts, rows, cols in coverings:
        opts = [cover[frozenset(p)] for p in parts]
        if any(not o for o in opts):
            continue
        occupied = [cell for part in parts for cell in part]
        if len(parts) == 2:
            groups = [(a, b) for a in opts[0] for b in opts[1]]
        else:
            groups = [(a, b, c) for a in opts[0] for b in opts[1] for c in opts[2]]
        for group in groups:
            sig = gadget(group, occupied)
            if not sig or not (min_paths <= sig[0] <= max_paths):
                continue
            # Same squares and the same plugs. A rotated copy covers different
            # plugs, so it must not share this key.
            footprint = tuple(sorted(occupied))
            key = (kind, footprint, sig)
            bag = tuple(sorted(p[0] for p in group))
            pat = tuple(sorted((p[0], p[1], p[2][0], p[2][1]) for p in group))
            minr = min(x[2] for x in pat)
            minc = min(x[3] for x in pat)
            pat = tuple(sorted((t, d, r - minr, c - minc) for t, d, r, c in pat))
            rec = classes.get(key)
            if rec is None:
                rec = {"bags": {}}
                classes[key] = rec
            if (key, pat) in seen:
                continue
            seen.add((key, pat))
            rec["bags"].setdefault(bag, []).append(pat)
    usable = {}
    for key, v in classes.items():
        if len(v["bags"]) < 2:
            continue
        usable[key] = v
        for bag, pats in v["bags"].items():
            for pat in pats:
                t, d, r, c = pat[0]
                by_anchor[(t, d, r, c)].append((pat, key, bag))
    return usable, by_anchor


def bag_key(td):
    return tuple(sorted((k, int(v)) for k, v in td.items() if int(v) > 0))


def apply_delta(td, remove, add):
    out = {k: int(v) for k, v in td.items() if int(v) > 0}
    for k, n in remove.items():
        out[k] = out.get(k, 0) - n
        if out[k] < 0:
            return None
        if out[k] == 0:
            del out[k]
    for k, n in add.items():
        out[k] = out.get(k, 0) + n
    return out


def covers(td, bag):
    need = Counter(bag)
    return all(td.get(k, 0) >= n for k, n in need.items())


def size_prefix(rows, cols):
    if rows == 6 and cols == 5:
        return "5x6"
    return f"{rows}x{cols}"


def tier_of(td):
    keys = set(td)
    if keys & TIER_0C:
        return "0C"
    if keys & TIER_0B:
        return "0B"
    return "0A"


def to_code(index):
    if index < 0 or index >= 36 ** 4:
        raise RuntimeError(f"base36 code overflow: {index}")
    chars = []
    x = index
    for _ in range(4):
        chars.append(ALPH[x % 36])
        x //= 36
    return "".join(reversed(chars))


def main():
    print("building classes", flush=True)
    single, single_anchor = build([n for n in ALL if n not in CROSS], 1, 1)
    multi, multi_anchor = build(ALL, 2, 9)
    print(f"single families {len(single)} multi families {len(multi)}", flush=True)

    catalog = set()
    catalog_counts = Counter()
    catalog_blockers = {}
    for p in LEVELS.glob("*.json"):
        if p.name in {"levels.json", "index.json"}:
            continue
        doc = json.loads(p.read_text(encoding="utf-8"))
        for lv in doc.get("levels") or []:
            b = lv.get("board") or {}
            rows, cols = int(b.get("rows") or 0), int(b.get("cols") or 0)
            td = lv.get("tiles") or {}
            lid = lv.get("id") or lv.get("levelId")
            if lid:
                catalog_blockers[lid] = lv.get("blockers") or []
            if rows and cols and td:
                catalog.add((rows, cols, bag_key(td)))
                catalog_counts[(size_prefix(rows, cols), tier_of({k: int(v) for k, v in td.items()}))] += 1
    print(f"catalog bags {len(catalog)}", flush=True)

    found = {}
    files = 0
    for pth in SOLVES.glob("*.json"):
        files += 1
        doc = json.loads(pth.read_text(encoding="utf-8"))
        sols = doc.get("solutions") or []
        if not sols:
            continue
        b = doc.get("board") or {}
        rows, cols = int(b.get("rows") or 0), int(b.get("cols") or 0)
        if rows < 2 or cols < 2:
            continue
        td = {k: int(v) for k, v in (doc.get("tiles") or {}).items() if int(v) > 0}
        if not td:
            continue
        level = doc.get("levelId") or pth.stem
        board = {"rows": rows, "cols": cols, "cells": int(b.get("cells") or rows * cols)}
        blockers = catalog_blockers.get(level) or doc.get("blockers") or []
        want_s = defaultdict(set)
        want_m = defaultdict(set)
        for key, v in single.items():
            for src in v["bags"]:
                if covers(td, src):
                    want_s[key].add(src)
        for key, v in multi.items():
            for src in v["bags"]:
                if covers(td, src):
                    want_m[key].add(src)
        if not want_s and not want_m:
            continue
        hit_s = defaultdict(set)
        hit_m = defaultdict(set)
        for sol in sols:
            pl = sol.get("placements") or []
            if not pl:
                continue
            placed = {(x["tile"], int(x["deg"]) % 360, int(x["r"]), int(x["c"])) for x in pl}
            for tile, deg, r, c in placed:
                for dr in range(0, 4):
                    for dc in range(0, 4):
                        orr, occ = r - dr, c - dc
                        for pat, key, bag in single_anchor.get((tile, deg, dr, dc), ()):
                            if bag not in PAIR_FAMILY or bag not in want_s.get(key, ()):
                                continue
                            if all((t, d, orr + rr, occ + cc) in placed for t, d, rr, cc in pat):
                                hit_s[key].add(bag)
                        for pat, key, bag in multi_anchor.get((tile, deg, dr, dc), ()):
                            if bag not in PAIR_FAMILY or bag not in want_m.get(key, ()):
                                continue
                            if all((t, d, orr + rr, occ + cc) in placed for t, d, rr, cc in pat):
                                hit_m[key].add(bag)

        def absorb(hits, usable, via):
            for key, srcs in hits.items():
                options = usable[key]["bags"]
                for src in srcs:
                    src_family = PAIR_FAMILY.get(tuple(sorted(src)))
                    if src_family is None:
                        continue
                    src_c = Counter(src)
                    for dst in options:
                        if dst == src or PAIR_FAMILY.get(tuple(sorted(dst))) != src_family:
                            continue
                        new_td = apply_delta(td, src_c, Counter(dst))
                        if new_td is None:
                            continue
                        bk = (rows, cols, tuple(tuple(x) for x in blockers), bag_key(new_td))
                        if (rows, cols, bag_key(new_td)) in catalog or bk in found:
                            continue
                        found[bk] = {
                            "tiles": new_td,
                            "board": board,
                            "blockers": blockers,
                            "from": level,
                            "via": via,
                            "swapOut": list(src),
                            "swapIn": list(dst),
                        }

        absorb(hit_s, single, "1")
        absorb(hit_m, multi, "2+")
        if files % 2000 == 0:
            print(f"scanned {files} new {len(found)}", flush=True)

    print(f"files {files} new bags {len(found)}", flush=True)
    by_bucket = defaultdict(list)
    for (rows, cols, _blockers, _bk), rec in found.items():
        size = size_prefix(rows, cols)
        tier = tier_of(rec["tiles"])
        by_bucket[(size, tier)].append(rec)

    specs = []
    bucket_summary = []
    for (size, tier) in sorted(by_bucket):
        group = by_bucket[(size, tier)]
        group.sort(key=lambda rec: bag_key(rec["tiles"]))
        for i, rec in enumerate(group):
            code = to_code(i)
            puzzle_id = f"{size}-{tier}-{code}"
            tiles_out = {k: int(rec["tiles"][k]) for k in sorted(rec["tiles"])}
            spec = {
                "id": puzzle_id,
                "levelId": puzzle_id,
                "board": rec["board"],
                "tileSet": "tiles-live-edges.json",
                "tiles": tiles_out,
                "tier": tier,
                "size": size,
                "note": "Swap-set bag. Not in the published catalog. Solution count has not been run.",
                "from": rec["from"],
                "strands": rec["via"],
                "swapOut": rec["swapOut"],
                "swapIn": rec["swapIn"],
            }
            if rec.get("blockers"):
                spec["blockers"] = rec["blockers"]
            specs.append(spec)
            rec["id"] = puzzle_id
        bucket_summary.append(
            {
                "size": size,
                "tier": tier,
                "new": len(group),
                "catalog": catalog_counts[(size, tier)],
                "catalogLimit3Letter": 17576,
                "first": f"{size}-{tier}-0000",
                "last": f"{size}-{tier}-{to_code(len(group) - 1)}",
            }
        )

    specs.sort(key=lambda s: s["id"])
    block_dir = OUT / "blocks"
    # Ids are assigned from this scan. A previous queue's results belong to
    # different bags, so they must not be reused.
    for folder in ("results", "enumerated", "claims", "work"):
        d = OUT / folder
        if not d.exists():
            continue
        for old in d.glob("*"):
            if old.is_file():
                old.unlink()
    block_dir.mkdir(parents=True, exist_ok=True)
    (OUT / "claims").mkdir(exist_ok=True)
    (OUT / "enumerated").mkdir(exist_ok=True)
    (OUT / "results").mkdir(exist_ok=True)

    blocks = []
    for start in range(0, len(specs), BLOCK_SIZE):
        chunk = specs[start : start + BLOCK_SIZE]
        number = start // BLOCK_SIZE + 1
        name = f"block-{number:05d}"
        doc = {"block": number, "blockId": name, "count": len(chunk), "specs": chunk}
        (block_dir / f"{name}.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
        blocks.append(
            {
                "block": number,
                "file": f"blocks/{name}.json",
                "count": len(chunk),
                "first": chunk[0]["id"],
                "last": chunk[-1]["id"],
            }
        )

    # Drop leftover block files from a longer previous build.
    keep = {f"block-{b['block']:05d}.json" for b in blocks}
    for old in block_dir.glob("block-*.json"):
        if old.name not in keep:
            old.unlink()

    manifest = {
        "blockSize": BLOCK_SIZE,
        "puzzleCount": len(specs),
        "blockCount": len(blocks),
        "idScheme": "base36-4",
        "idAlphabet": ALPH,
        "idNote": "Per size and tier, 0000 through ZZZZ. Catalog ids stay AAA through ZZZ.",
        "buckets": bucket_summary,
        "blocks": blocks,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(specs)} puzzles in {len(blocks)} blocks -> {OUT}", flush=True)
    for row in bucket_summary:
        if row["new"] > row["catalogLimit3Letter"] - row["catalog"]:
            print(
                f"  {row['size']}-{row['tier']}: new {row['new']} catalog {row['catalog']} "
                f"(3-letter room {row['catalogLimit3Letter'] - row['catalog']}) {row['first']}..{row['last']}",
                flush=True,
            )


if __name__ == "__main__":
    main()
