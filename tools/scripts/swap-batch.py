#!/usr/bin/env python3
"""Name the next 25 new bags from one swap row, and record finished counts.

One row of the named sets is worked at a time. A new bag is recorded once.
The same source puzzle is used again only when a different swap builds a
different bag.

    python tools/scripts/swap-batch.py prepare --count 25
    python tools/scripts/swap-batch.py record --id 3x4-0B-0000 --solutions 2 --exit 0
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "tools" / "data" / "solver-runs" / "swap-named"
LEDGER = OUT / "ledger.json"
# Board sizes not in the game yet; no new puzzles are named on them.
SKIP_SIZES = ("6x6-",)
BATCH = OUT / "batch.json"

_spec = importlib.util.spec_from_file_location("sample_one_swap", HERE / "sample-one-swap.py")
sample = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sample)
q = sample.q


def set_label(index):
    row = q.USER_PAIRS[index]
    parts = ["+".join(bag) for bag in row]
    return f"{index + 1}/{len(q.USER_PAIRS)}  " + " | ".join(parts)


def file_sort_key(path):
    size = path.name.split("-", 1)[0]
    try:
        a, b = size.split("x")
        cells = int(a) * int(b)
    except ValueError:
        cells = 10**9
    return (cells, path.name)


def bag_token(found):
    tiles = [[name, count] for name, count in q.bag_key(found["tiles"])]
    blockers = found["blockers"] or []
    return json.dumps(
        [found["rows"], found["cols"], blockers, tiles],
        separators=(",", ":"),
    )


def empty_ledger():
    return {
        "setIndex": 0,
        "resumeFile": "",
        "nextCode": {},
        "bags": [],
        "pending": [],
        "done": {},
    }


def load_ledger():
    if not LEDGER.exists():
        return empty_ledger()
    return json.loads(LEDGER.read_text(encoding="utf-8"))


def save_ledger(doc):
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = LEDGER.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    tmp.replace(LEDGER)


def write_batch(doc, specs):
    payload = {
        "setIndex": doc["setIndex"],
        "setLabel": set_label(doc["setIndex"]) if doc["setIndex"] < len(q.USER_PAIRS) else "",
        "specs": specs,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    BATCH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def assign_id(doc, found):
    size = q.size_prefix(found["rows"], found["cols"])
    tier = q.tier_of(found["tiles"])
    bucket = f"{size}|{tier}"
    number = int(doc["nextCode"].get(bucket, 0))
    puzzle_id = f"{size}-{tier}-{q.to_code(number)}"
    doc["nextCode"][bucket] = number + 1
    return puzzle_id, size, tier


def write_spec(puzzle_id, size, tier, found):
    tiles_out = {k: int(found["tiles"][k]) for k in sorted(found["tiles"])}
    spec = {
        "id": puzzle_id,
        "levelId": puzzle_id,
        "board": {
            "rows": found["rows"],
            "cols": found["cols"],
            "cells": found["cells"],
        },
        "tileSet": "tiles-live-edges.json",
        "tiles": tiles_out,
        "tier": tier,
        "size": size,
        "pathMode": "single",
        "from": found["level"],
        "swapOut": found["swapOut"],
        "swapIn": found["swapIn"],
        "set": None if found.get("family") is None else found["family"] + 1,
        "note": (
            "Named swap on the same squares and the same openings. "
            "Solution count has not been run."
        ),
    }
    if found["blockers"]:
        spec["blockers"] = found["blockers"]
    spec_dir = OUT / "specs"
    witness_dir = OUT / "witnesses"
    spec_dir.mkdir(parents=True, exist_ok=True)
    witness_dir.mkdir(parents=True, exist_ok=True)
    (spec_dir / f"{puzzle_id}.json").write_text(
        json.dumps(spec, indent=2) + "\n", encoding="utf-8"
    )
    witness = {
        "id": puzzle_id,
        "from": found["level"],
        "solution": found["solution"],
        "swapOut": found["swapOut"],
        "swapIn": found["swapIn"],
        "squares": found["squares"],
        "tiles": tiles_out,
        "placements": found["witness"],
    }
    (witness_dir / f"{puzzle_id}.json").write_text(
        json.dumps(witness, indent=2) + "\n", encoding="utf-8"
    )
    return {
        "id": puzzle_id,
        "from": found["level"],
        "swapOut": found["swapOut"],
        "swapIn": found["swapIn"],
    }


def print_totals(doc):
    named = len(doc.get("bags") or [])
    solved = len(doc.get("done") or {})
    waiting = len(doc.get("pending") or [])
    complete = int(doc.get("setIndex") or 0) >= len(q.USER_PAIRS)
    print(f"named {named}", flush=True)
    print(f"solved {solved}", flush=True)
    print(f"waiting {waiting}", flush=True)
    if complete:
        print("list complete", flush=True)
    else:
        print(f"list incomplete  next {set_label(int(doc['setIndex']))}", flush=True)


def prepare(count, find_all=False):
    doc = load_ledger()
    if doc["pending"] and not find_all:
        specs = []
        take = doc["pending"][:count]
        for puzzle_id in take:
            spec = json.loads((OUT / "specs" / f"{puzzle_id}.json").read_text(encoding="utf-8"))
            specs.append(
                {
                    "id": puzzle_id,
                    "from": spec.get("from"),
                    "swapOut": spec.get("swapOut"),
                    "swapIn": spec.get("swapIn"),
                }
            )
        write_batch(doc, specs)
        label = set_label(doc["setIndex"]) if doc["setIndex"] < len(q.USER_PAIRS) else ""
        print(f"resume {len(specs)} already named  {label}", flush=True)
        for row in specs:
            print(
                f"{row['id']}  from {row['from']}  {'+'.join(row['swapOut'])} -> {'+'.join(row['swapIn'])}",
                flush=True,
            )
        print_totals(doc)
        return 0

    if doc.get("setDone"):
        doc["setIndex"] = int(doc["setIndex"]) + 1
        doc["setDone"] = False
        doc["resumeFile"] = ""
        save_ledger(doc)

    if doc["setIndex"] >= len(q.USER_PAIRS):
        print("All swap sets are recorded.", flush=True)
        write_batch(doc, [])
        return 2

    print("building classes", flush=True)
    usable, by_anchor = sample.build_named()
    catalog, blockers = sample.load_catalog()
    known = set(doc["bags"])
    files = sorted(
        (p for p in q.SOLVES.glob("*.json") if not p.name.startswith(SKIP_SIZES)),
        key=file_sort_key,
    )
    names = [path.name for path in files]

    while doc["setIndex"] < len(q.USER_PAIRS):
        index = doc["setIndex"]
        print(f"set {set_label(index)}", flush=True)
        start = 0
        resume = doc.get("resumeFile") or ""
        if resume in names:
            start = names.index(resume)
        found_rows = []
        scanned = 0
        finished_set = True
        for path in files[start:]:
            scanned += 1
            if scanned % 500 == 0:
                print(f"scanned {scanned} named {len(found_rows)}", flush=True)
            for found in sample.iter_swaps_in_file(
                path, usable, by_anchor, catalog, blockers, family=index
            ):
                token = bag_token(found)
                if token in known:
                    continue
                puzzle_id, size, tier = assign_id(doc, found)
                row = write_spec(puzzle_id, size, tier, found)
                known.add(token)
                doc["bags"].append(token)
                doc["pending"].append(puzzle_id)
                doc["resumeFile"] = path.name
                found_rows.append(row)
                save_ledger(doc)
                print(
                    f"{puzzle_id}  from {found['level']}  {'+'.join(found['swapOut'])} -> {'+'.join(found['swapIn'])}",
                    flush=True,
                )
                if len(found_rows) >= count:
                    finished_set = False
                    break
            if len(found_rows) >= count:
                break
        if found_rows:
            if finished_set:
                doc["setDone"] = True
                doc["resumeFile"] = ""
                save_ledger(doc)
                print(f"set {set_label(index)} finished", flush=True)
            write_batch(doc, found_rows)
            print(f"batch {len(found_rows)}", flush=True)
            return 0
        print(f"set {set_label(index)} none left", flush=True)
        doc["setIndex"] = index + 1
        doc["resumeFile"] = ""
        doc["setDone"] = False
        save_ledger(doc)

    print("All swap sets are recorded.", flush=True)
    write_batch(doc, [])
    return 2


def write_manifest(doc):
    spec_dir = OUT / "specs"
    puzzles = []
    by_set = {}
    if spec_dir.exists():
        print("summary: listing puzzle files...", flush=True)
        paths = sorted(spec_dir.glob("*.json"))
        total = len(paths)
        began = time.monotonic()
        print(f"summary: reading {total} puzzles", flush=True)
        for n, path in enumerate(paths, 1):
            if n % 10000 == 0 or n == total:
                elapsed = time.monotonic() - began
                left = elapsed / n * (total - n)
                print(
                    f"summary: read {n} of {total} ({n * 100 // total}%)"
                    f" elapsed {int(elapsed // 60)}m{int(elapsed % 60):02d}s"
                    f" left about {int(left // 60)}m{int(left % 60):02d}s",
                    flush=True,
                )
            spec = json.loads(path.read_text(encoding="utf-8"))
            puzzle_id = spec["id"]
            swap_out = list(spec.get("swapOut") or [])
            set_number = spec.get("set")
            if set_number is None:
                family = q.PAIR_FAMILY.get(tuple(sorted(swap_out)))
                set_number = None if family is None else int(family) + 1
            done = doc.get("done") or {}
            solved = puzzle_id in done
            row = {
                "id": puzzle_id,
                "from": spec.get("from"),
                "swapOut": swap_out,
                "swapIn": list(spec.get("swapIn") or []),
                "set": set_number,
                "done": solved,
                "solutions": done.get(puzzle_id, {}).get("solutions") if solved else None,
            }
            puzzles.append(row)
            key = row["set"] if row["set"] is not None else 0
            bucket = by_set.setdefault(key, {"named": 0, "solved": 0})
            bucket["named"] += 1
            if solved:
                bucket["solved"] += 1
    block_size = 25
    blocks = []
    for start in range(0, len(puzzles), block_size):
        chunk = puzzles[start : start + block_size]
        number = start // block_size + 1
        waiting = sum(1 for row in chunk if not row["done"])
        for row in chunk:
            row["block"] = number
        blocks.append(
            {
                "block": number,
                "count": len(chunk),
                "waiting": waiting,
                "first": chunk[0]["id"],
                "last": chunk[-1]["id"],
            }
        )
    manifest = {
        "puzzleCount": len(puzzles),
        "solved": len(doc.get("done") or {}),
        "waiting": len(puzzles) - len(doc.get("done") or {}),
        "blockSize": block_size,
        "blockCount": len(blocks),
        "sets": [
            {"set": key, "label": set_label(key - 1) if key else "", **by_set[key]}
            for key in sorted(by_set)
        ],
        "blocks": blocks,
        "puzzles": puzzles,
    }
    print("summary: writing manifest.json...", flush=True)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"named {manifest['puzzleCount']}", flush=True)
    print(f"solved {manifest['solved']}", flush=True)
    print(f"waiting {manifest['waiting']}", flush=True)
    print(f"blocks {manifest['blockCount']} of {block_size}", flush=True)
    for row in manifest["sets"]:
        print(
            f"set {row['set']} named {row['named']} solved {row['solved']} waiting {row['named'] - row['solved']}",
            flush=True,
        )
    return manifest


def build_list():
    doc = load_ledger()
    print("building classes", flush=True)
    usable, by_anchor = sample.build_named()
    catalog, blockers = sample.load_catalog()
    known = set(doc["bags"])
    print(f"named bags already kept {len(known)}", flush=True)
    files = sorted(
        (p for p in q.SOLVES.glob("*.json") if not p.name.startswith(SKIP_SIZES)),
        key=file_sort_key,
    )
    names = [path.name for path in files]
    start = 0
    resume = doc.get("listResume") or ""
    if resume in names:
        start = names.index(resume)
    print(f"scanning {len(files) - start} solve files", flush=True)
    fresh = list(doc.get("runNewIds") or []) if start else []
    added = 0
    scanned = 0
    for path in files[start:]:
        scanned += 1
        if scanned % 500 == 0:
            print(f"scanned {scanned} new {added} named {len(known)}", flush=True)
        for found in sample.iter_swaps_in_file(
            path, usable, by_anchor, catalog, blockers
        ):
            token = bag_token(found)
            if token in known:
                continue
            puzzle_id, size, tier = assign_id(doc, found)
            write_spec(puzzle_id, size, tier, found)
            known.add(token)
            doc["bags"].append(token)
            doc["pending"].append(puzzle_id)
            fresh.append(puzzle_id)
            added += 1
        doc["listResume"] = path.name
        if scanned % 25 == 0:
            doc["runNewIds"] = fresh
            save_ledger(doc)
    doc["listResume"] = ""
    doc["runNewIds"] = []
    doc["newIds"] = fresh
    doc["setIndex"] = len(q.USER_PAIRS)
    doc["setDone"] = False
    doc["resumeFile"] = ""
    save_ledger(doc)
    print(f"new bags {added}", flush=True)
    write_manifest(doc)


def build_next(only_new=False, last=0):
    """Name further bags by swapping inside the puzzles already named.

    Uses the swapped placement saved with each named puzzle. A second swap
    in that placement becomes its own new bag. Does not solve.

    only_new scans just the puzzles the previous build-list/build-next added
    (saved as newIds). That is only complete if the run before it scanned the
    whole list with the current swap classes. last=N uses the last N pending
    ids instead, for runs made before newIds was saved.
    """
    doc = load_ledger()
    print("building classes", flush=True)
    usable, by_anchor = sample.build_named()
    catalog, _blockers = sample.load_catalog()
    known = set(doc["bags"])
    print(f"named bags already kept {len(known)}", flush=True)
    witness_dir = OUT / "witnesses"
    spec_dir = OUT / "specs"
    if only_new:
        if last > 0:
            wanted = list(doc["pending"][-last:])
        elif "newIds" in doc:
            wanted = list(doc["newIds"])
        else:
            raise SystemExit("no newIds saved yet; use --last N with the last run's new bags count")
        candidates = (pid for pid in set(wanted) if not pid.startswith(SKIP_SIZES))
    else:
        candidates = (p.stem for p in spec_dir.glob("*.json") if not p.stem.startswith(SKIP_SIZES))
    ids = sorted(
        pid
        for pid in candidates
        if (spec_dir / f"{pid}.json").exists() and (witness_dir / f"{pid}.json").exists()
    )
    start = 0
    resume = doc.get("witnessResume") or ""
    fresh = []
    if resume in ids:
        start = ids.index(resume)
        fresh = list(doc.get("runNewIds") or [])
    print(f"scanning {len(ids) - start} named puzzles", flush=True)
    added = 0
    scanned = 0
    for puzzle_id in ids[start:]:
        scanned += 1
        if scanned % 500 == 0:
            print(f"scanned {scanned} new {added} named {len(known)}", flush=True)
        spec = json.loads((spec_dir / f"{puzzle_id}.json").read_text(encoding="utf-8"))
        witness = json.loads((witness_dir / f"{puzzle_id}.json").read_text(encoding="utf-8"))
        placements = witness.get("placements") or []
        if not placements:
            doc["witnessResume"] = puzzle_id
            continue
        puzzle = {
            "levelId": puzzle_id,
            "board": spec.get("board") or {},
            "tiles": spec.get("tiles") or {},
            "blockers": spec.get("blockers") or [],
            "solutions": [{"placements": placements}],
        }
        for found in sample.iter_swaps_in_doc(
            puzzle, puzzle_id, usable, by_anchor, catalog, {}
        ):
            token = bag_token(found)
            if token in known:
                continue
            new_id, size, tier = assign_id(doc, found)
            write_spec(new_id, size, tier, found)
            known.add(token)
            doc["bags"].append(token)
            doc["pending"].append(new_id)
            fresh.append(new_id)
            added += 1
        doc["witnessResume"] = puzzle_id
        if scanned % 25 == 0:
            doc["runNewIds"] = fresh
            save_ledger(doc)
    doc["witnessResume"] = ""
    doc["runNewIds"] = []
    doc["newIds"] = fresh
    save_ledger(doc)
    print(f"new bags {added}", flush=True)
    if only_new:
        print(f"named {len(known)}", flush=True)
        print("summary not rebuilt; run: python tools/scripts/swap-batch.py manifest", flush=True)
        return
    write_manifest(doc)


def build_from_solved():
    """Name new bags found in every solution of the solved puzzles.

    build-next only looks inside the one saved layout per puzzle. A solved
    puzzle has all its solutions in enumerated/, and swaps in those can build
    bags nobody has named. Each solved puzzle is scanned once (solvedScanned).
    The new ones are saved as newIds, so build-next --only-new follows on.
    """
    doc = load_ledger()
    print("building classes", flush=True)
    usable, by_anchor = sample.build_named()
    catalog, blockers = sample.load_catalog()
    known = set(doc["bags"])
    print(f"named bags already kept {len(known)}", flush=True)
    scanned_before = set(doc.get("solvedScanned") or [])
    ids = sorted(
        pid
        for pid in doc["done"]
        if pid not in scanned_before and (OUT / "enumerated" / f"{pid}.json").exists()
    )
    print(f"scanning all solutions of {len(ids)} solved puzzles", flush=True)
    fresh = []
    for n, pid in enumerate(ids, 1):
        if n % 50 == 0 or n == len(ids):
            print(f"scanned {n} of {len(ids)} new {len(fresh)} named {len(known)}", flush=True)
        spec = json.loads((OUT / "specs" / f"{pid}.json").read_text(encoding="utf-8"))
        sols = json.loads((OUT / "enumerated" / f"{pid}.json").read_text(encoding="utf-8")).get("solutions") or []
        puzzle = {
            "levelId": pid,
            "board": spec.get("board") or {},
            "tiles": spec.get("tiles") or {},
            "blockers": spec.get("blockers") or [],
            "solutions": sols,
        }
        for found in sample.iter_swaps_in_doc(puzzle, pid, usable, by_anchor, catalog, blockers):
            token = bag_token(found)
            if token in known:
                continue
            new_id, size, tier = assign_id(doc, found)
            write_spec(new_id, size, tier, found)
            known.add(token)
            doc["bags"].append(token)
            doc["pending"].append(new_id)
            fresh.append(new_id)
        scanned_before.add(pid)
    doc["solvedScanned"] = sorted(scanned_before)
    doc["newIds"] = fresh
    save_ledger(doc)
    print(f"new bags {len(fresh)}", flush=True)
    print(f"named {len(known)}", flush=True)
    print("next: python tools/scripts/swap-batch.py build-next --only-new", flush=True)


def from_code(code):
    n = 0
    for ch in code:
        n = n * 36 + q.ALPH.index(ch)
    return n


def renumber(really):
    """Close the gaps in the names: in each size+tier, number 0000, 0001, ... in the old order.

    Preview first. With really=True, new copies of specs/, witnesses/ and
    enumerated/ are written with the new names (and the new id and "from"
    inside), then swapped in. The old folders and ledger are kept as
    *.before-renumber until you delete them.
    """
    import shutil

    doc = load_ledger()
    ids = list(doc["pending"]) + list(doc["done"])
    buckets = {}
    for pid in ids:
        size, tier, code = pid.split("-")
        buckets.setdefault((size, tier), []).append((from_code(code), pid))
    mapping = {}
    print("bucket       puzzles   highest code before   gaps", flush=True)
    for (size, tier), rows in sorted(buckets.items()):
        rows.sort()
        for n, (_old, pid) in enumerate(rows):
            mapping[pid] = f"{size}-{tier}-{q.to_code(n)}"
        gaps = rows[-1][0] + 1 - len(rows)
        print(f"{size}-{tier:<4}  {len(rows):>9}   {rows[-1][1]:<20}  {gaps:>6}", flush=True)
    changed = {old: new for old, new in mapping.items() if old != new}
    print(f"puzzles {len(mapping)}  names that change {len(changed)}", flush=True)
    for old, new in list(changed.items())[:5]:
        print(f"  e.g. {old} -> {new}", flush=True)
    if not changed:
        print("no gaps; nothing to do", flush=True)
        return
    if not really:
        print("preview only; add --yes to rename", flush=True)
        return

    def m(value):
        return mapping.get(value, value)

    total = len(mapping)
    began = time.monotonic()
    for folder in ("specs", "witnesses", "enumerated"):
        src = OUT / folder
        dst = OUT / f"{folder}.renumbered"
        if dst.exists():
            shutil.rmtree(dst)
        dst.mkdir(parents=True)
        print(f"writing {folder} with new names...", flush=True)
        n = 0
        for old, new in mapping.items():
            path = src / f"{old}.json"
            if not path.exists():
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            if folder in ("specs", "witnesses"):
                data["id"] = new
                if "levelId" in data:
                    data["levelId"] = new
                if "from" in data:
                    data["from"] = m(data["from"])
            else:
                data["levelId"] = new
                if "id" in data:
                    data["id"] = new
                for sol in data.get("solutions") or []:
                    if isinstance(sol.get("label"), str):
                        sol["label"] = sol["label"].replace(old, new)
            (dst / f"{new}.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
            n += 1
            if n % 20000 == 0:
                spent = time.monotonic() - began
                print(f"  {folder}: {n} of up to {total}  elapsed {int(spent // 60)}m{int(spent % 60):02d}s", flush=True)
        print(f"  {folder}: wrote {n}", flush=True)

    doc["pending"] = [m(p) for p in doc["pending"]]
    doc["done"] = {m(k): v for k, v in doc["done"].items()}
    if "requeued" in doc:
        doc["requeued"] = {m(k): v for k, v in doc["requeued"].items()}
    for key in ("newIds", "runNewIds", "solvedScanned"):
        if key in doc:
            doc[key] = [m(p) for p in doc[key] or []]
    doc["witnessResume"] = m(doc.get("witnessResume") or "")
    next_code = {}
    for (size, tier), rows in buckets.items():
        next_code[f"{size}|{tier}"] = len(rows)
    for bucket in doc.get("nextCode") or {}:
        next_code.setdefault(bucket, 0)
    doc["nextCode"] = next_code

    print("swapping folders in...", flush=True)
    shutil.copyfile(LEDGER, OUT / "ledger.before-renumber.json")
    for folder in ("specs", "witnesses", "enumerated"):
        old_dir = OUT / f"{folder}.before-renumber"
        if old_dir.exists():
            shutil.rmtree(old_dir)
        (OUT / folder).rename(old_dir)
        (OUT / f"{folder}.renumbered").rename(OUT / folder)
    save_ledger(doc)
    (OUT / "mapping-renumber.json").write_text(json.dumps(changed, indent=0) + "\n", encoding="utf-8")
    if BATCH.exists():
        BATCH.unlink()
    print(f"renamed {len(changed)} puzzles; old to new list: {OUT / 'mapping-renumber.json'}", flush=True)
    print("old copies kept: specs/witnesses/enumerated.before-renumber and ledger.before-renumber.json", flush=True)
    print("next: python tools/scripts/swap-batch.py manifest", flush=True)


def prepare_range(first, last):
    manifest_path = OUT / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("No list yet. From Tilezilla: python tools/scripts/swap-batch.py build-list")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    doc = load_ledger()
    done = set(doc.get("done") or {})
    specs = []
    for row in manifest.get("puzzles") or []:
        block = int(row.get("block") or 0)
        if block < first or block > last:
            continue
        if row["id"] in done:
            continue
        specs.append(
            {
                "id": row["id"],
                "from": row.get("from"),
                "swapOut": row.get("swapOut"),
                "swapIn": row.get("swapIn"),
            }
        )
    write_batch(doc, specs)
    print(f"blocks {first}..{last} waiting {len(specs)}", flush=True)
    for row in specs:
        print(
            f"{row['id']}  from {row['from']}  {'+'.join(row['swapOut'])} -> {'+'.join(row['swapIn'])}",
            flush=True,
        )
    if not specs:
        return 2
    return 0


def record(puzzle_id, solutions, exit_code):
    doc = load_ledger()
    doc["pending"] = [item for item in doc["pending"] if item != puzzle_id]
    doc["done"][puzzle_id] = {
        "solutions": solutions,
        "exit": exit_code,
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    save_ledger(doc)
    print(f"recorded {puzzle_id} solutions={solutions}", flush=True)


def record_many(paths):
    """Record solver results from files of lines: <id> <solutions> <exit>."""
    doc = load_ledger()
    results = {}
    for path in paths:
        for line in Path(path).read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if len(parts) == 3:
                results[parts[0]] = (int(parts[1]), int(parts[2]))
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for puzzle_id, (solutions, exit_code) in results.items():
        doc["done"][puzzle_id] = {"solutions": solutions, "exit": exit_code, "ts": stamp}
    doc["pending"] = [p for p in doc["pending"] if p not in results]
    save_ledger(doc)
    zero = sum(1 for solutions, _ in results.values() if solutions == 0)
    print(f"recorded {len(results)} results ({zero} with 0 solutions)", flush=True)


def status():
    """Solved and waiting per board size, plus solver runs not yet written to the ledger."""
    doc = load_ledger()
    sizes = {}
    for puzzle_id in doc["done"]:
        sizes.setdefault(puzzle_id.split("-")[0], [0, 0])[0] += 1
    for puzzle_id in doc["pending"]:
        sizes.setdefault(puzzle_id.split("-")[0], [0, 0])[1] += 1

    def area(size):
        rows, cols = size.split("x")
        return int(rows) * int(cols), size

    print("size     solved    waiting", flush=True)
    for size in sorted(sizes, key=area):
        solved, waiting = sizes[size]
        print(f"{size:<6} {solved:>8} {waiting:>10}", flush=True)
    print(f"total  {len(doc['done']):>8} {len(doc['pending']):>10}", flush=True)

    lists = OUT / "status"
    lists.mkdir(exist_ok=True)
    order = lambda puzzle_id: (area(puzzle_id.split("-")[0]), puzzle_id)
    solved_lines = [f"{p} {doc['done'][p].get('solutions')}" for p in sorted(doc["done"], key=order)]
    (lists / "solved.txt").write_text("\n".join(solved_lines) + "\n", encoding="utf-8")
    (lists / "waiting.txt").write_text("\n".join(sorted(doc["pending"], key=order)) + "\n", encoding="utf-8")
    print(f"lists: {lists / 'solved.txt'} (name and solutions), {lists / 'waiting.txt'}", flush=True)

    runs = OUT.parent / "swap-parallel"
    if not runs.exists():
        return
    print("", flush=True)
    print("solver runs (newest last)        finished   not in ledger yet", flush=True)
    for run in sorted(p for p in runs.iterdir() if p.is_dir())[-5:]:
        ids = set()
        for path in run.glob("worker-*.txt"):
            for line in path.read_text(encoding="utf-8").splitlines():
                parts = line.split()
                if len(parts) == 3:
                    ids.add(parts[0])
        missing = sum(1 for puzzle_id in ids if puzzle_id not in doc["done"])
        print(f"{run.name:<32} {len(ids):>8}   {missing:>8}", flush=True)
    print("a run still going shows its results in 'not in ledger yet' until it stops", flush=True)


def requeue_tiles(tiles, really):
    """Put solved puzzles that hold any of these tiles back at the front of pending."""
    want = {t.strip() for t in tiles.split(",") if t.strip()}
    doc = load_ledger()
    ids = []
    for puzzle_id in doc["done"]:
        spec = json.loads((OUT / "specs" / f"{puzzle_id}.json").read_text(encoding="utf-8"))
        if want & set(spec.get("tiles") or {}):
            ids.append(puzzle_id)
    zero = sum(1 for puzzle_id in ids if not doc["done"][puzzle_id].get("solutions"))
    print(f"solved puzzles with {','.join(sorted(want))}: {len(ids)} of {len(doc['done'])} ({zero} recorded with 0)", flush=True)
    if not really:
        print("preview only; add --yes to put them back on the waiting list", flush=True)
        return
    previous = doc.setdefault("requeued", {})
    for puzzle_id in ids:
        previous[puzzle_id] = doc["done"].pop(puzzle_id)
    queued = set(ids)
    doc["pending"] = ids + [p for p in doc["pending"] if p not in queued]
    save_ledger(doc)
    print(f"requeued {len(ids)}; old counts kept under requeued in the ledger", flush=True)


def add_layout(path, rows, cols):
    """Name a hand-made layout (a game solve export) as a new puzzle on the list."""
    from collections import Counter

    data = json.loads(Path(path).read_text(encoding="utf-8"))
    solves = data if isinstance(data, list) else [data]
    doc = load_ledger()
    known = set(doc["bags"])
    catalog, _blockers = sample.load_catalog()
    for solve in solves:
        placements = [
            {"tile": p["tile"], "deg": int(p["deg"]) % 360, "r": int(p["r"]), "c": int(p["c"])}
            for p in solve.get("placements") or []
        ]
        tiles = dict(Counter(p["tile"] for p in placements))
        found = {
            "level": "handmade",
            "solution": 1,
            "rows": rows,
            "cols": cols,
            "cells": rows * cols,
            "blockers": [],
            "tiles": tiles,
            "swapOut": [],
            "swapIn": [],
            "squares": [],
            "witness": placements,
        }
        token = bag_token(found)
        if token in known:
            print("already on the list", flush=True)
            continue
        if (rows, cols, q.bag_key(tiles)) in catalog:
            print("already a game puzzle", flush=True)
            continue
        puzzle_id, size, tier = assign_id(doc, found)
        write_spec(puzzle_id, size, tier, found)
        known.add(token)
        doc["bags"].append(token)
        doc["pending"].append(puzzle_id)
        print(f"added {puzzle_id}", flush=True)
    save_ledger(doc)


def move_size(size, really):
    """Move every named puzzle of one board size into its own list. Lists first; moves only with --yes."""
    prefix = f"{size}-"
    dest = OUT.parent / f"swap-named-{size}"
    doc = load_ledger()
    done = doc.get("done") or {}
    pending_ids = [i for i in doc.get("pending") or [] if i.startswith(prefix)]
    done_ids = [i for i in done if i.startswith(prefix)]
    print(f"{size} puzzles on the current list: {len(pending_ids) + len(done_ids)} (already solved {len(done_ids)})", flush=True)
    print(f"left on the current list: {len(doc.get('pending') or []) + len(done) - len(pending_ids) - len(done_ids)}", flush=True)
    print(f"would go to: {dest}", flush=True)
    if not really:
        print("nothing moved. Add --yes to move them.", flush=True)
        return

    dest_ledger_path = dest / "ledger.json"
    if dest_ledger_path.exists():
        moved = json.loads(dest_ledger_path.read_text(encoding="utf-8"))
    else:
        moved = empty_ledger()
    moved_bags = set(moved["bags"])
    tokens = set()
    for folder in ("specs", "witnesses", "enumerated"):
        (dest / folder).mkdir(parents=True, exist_ok=True)
    ids = pending_ids + done_ids
    for n, puzzle_id in enumerate(ids, start=1):
        src_spec = OUT / "specs" / f"{puzzle_id}.json"
        spec_path = src_spec if src_spec.exists() else dest / "specs" / f"{puzzle_id}.json"
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        tokens.add(
            bag_token(
                {
                    "rows": spec["board"]["rows"],
                    "cols": spec["board"]["cols"],
                    "blockers": spec.get("blockers") or [],
                    "tiles": spec.get("tiles") or {},
                }
            )
        )
        for folder in ("specs", "witnesses", "enumerated"):
            src = OUT / folder / f"{puzzle_id}.json"
            if src.exists():
                src.replace(dest / folder / f"{puzzle_id}.json")
        if n % 10000 == 0:
            print(f"moved {n} of {len(ids)}", flush=True)

    for token in tokens:
        if token not in moved_bags:
            moved["bags"].append(token)
    moved["pending"] = list(dict.fromkeys(list(moved["pending"]) + pending_ids))
    moved["done"].update({i: done[i] for i in done_ids})
    for bucket, number in (doc.get("nextCode") or {}).items():
        if bucket.startswith(f"{size}|"):
            moved["nextCode"][bucket] = max(int(number), int(moved["nextCode"].get(bucket, 0)))
    tmp = dest_ledger_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(moved, indent=2) + "\n", encoding="utf-8")
    tmp.replace(dest_ledger_path)

    gone = set(ids)
    doc["bags"] = [token for token in doc["bags"] if token not in tokens]
    doc["pending"] = [i for i in doc["pending"] if i not in gone]
    doc["done"] = {k: v for k, v in done.items() if k not in gone}
    save_ledger(doc)
    print(f"moved {len(ids)} to {dest}", flush=True)
    print(f"current list now {len(doc['pending']) + len(doc['done'])}", flush=True)


def purge_tile(tile, really):
    """Remove every named puzzle whose bag holds this tile. Lists first; deletes only with --yes."""
    doc = load_ledger()
    ids = list(doc.get("pending") or []) + list((doc.get("done") or {}).keys())
    print(f"reading {len(ids)} named puzzles", flush=True)
    spec_dir = OUT / "specs"
    drop_ids = set()
    drop_tokens = set()
    solved = 0
    for n, puzzle_id in enumerate(ids, start=1):
        if n % 50000 == 0:
            print(f"read {n} found {len(drop_ids)}", flush=True)
        path = spec_dir / f"{puzzle_id}.json"
        if not path.exists():
            continue
        spec = json.loads(path.read_text(encoding="utf-8"))
        tiles = spec.get("tiles") or {}
        if int(tiles.get(tile, 0)) <= 0:
            continue
        drop_ids.add(puzzle_id)
        if puzzle_id in (doc.get("done") or {}):
            solved += 1
        drop_tokens.add(
            bag_token(
                {
                    "rows": spec["board"]["rows"],
                    "cols": spec["board"]["cols"],
                    "blockers": spec.get("blockers") or [],
                    "tiles": tiles,
                }
            )
        )
    print(f"named puzzles with {tile}: {len(drop_ids)} (already solved {solved})", flush=True)
    print(f"named puzzles kept: {len(ids) - len(drop_ids)}", flush=True)
    if not really:
        print("nothing deleted. Add --yes to delete them.", flush=True)
        return
    doc["bags"] = [token for token in doc["bags"] if token not in drop_tokens]
    doc["pending"] = [item for item in doc["pending"] if item not in drop_ids]
    doc["done"] = {k: v for k, v in doc["done"].items() if k not in drop_ids}
    doc["witnessResume"] = ""
    save_ledger(doc)
    for n, puzzle_id in enumerate(sorted(drop_ids), start=1):
        for folder in ("specs", "witnesses", "enumerated"):
            (OUT / folder / f"{puzzle_id}.json").unlink(missing_ok=True)
        if n % 50000 == 0:
            print(f"deleted {n} of {len(drop_ids)}", flush=True)
    print(f"deleted {len(drop_ids)}", flush=True)
    write_manifest(doc)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "cmd",
        choices=(
            "prepare",
            "record",
            "build-list",
            "build-next",
            "prepare-range",
            "purge-tile",
            "add-layout",
            "move-size",
            "manifest",
            "requeue-tiles",
            "record-many",
            "build-from-solved",
            "renumber",
            "status",
        ),
    )
    parser.add_argument("--size", default="")
    parser.add_argument("--tile", default="")
    parser.add_argument("--file", default="")
    parser.add_argument("--rows", type=int, default=0)
    parser.add_argument("--cols", type=int, default=0)
    parser.add_argument("--yes", action="store_true")
    parser.add_argument("--count", type=int, default=25)
    parser.add_argument("--from-block", type=int, default=0)
    parser.add_argument("--to-block", type=int, default=0)
    parser.add_argument("--id", default="")
    parser.add_argument("--solutions", type=int, default=-1)
    parser.add_argument("--exit", type=int, default=0)
    parser.add_argument("--only-new", action="store_true")
    parser.add_argument("--last", type=int, default=0)
    args = parser.parse_args()
    if args.cmd == "build-list":
        build_list()
        return
    if args.cmd == "build-next":
        build_next(args.only_new, args.last)
        return
    if args.cmd == "manifest":
        write_manifest(load_ledger())
        return
    if args.cmd == "status":
        status()
        return
    if args.cmd == "renumber":
        renumber(args.yes)
        return
    if args.cmd == "build-from-solved":
        build_from_solved()
        return
    if args.cmd == "record-many":
        files = sorted(Path(args.file).glob("worker-*.txt")) if Path(args.file).is_dir() else [Path(args.file)]
        record_many(files)
        return
    if args.cmd == "requeue-tiles":
        if not args.tile:
            raise SystemExit("requeue-tiles requires --tile, for example --tile DB,DC,DS,QC,QS,QZ")
        requeue_tiles(args.tile, args.yes)
        return
    if args.cmd == "move-size":
        if not args.size:
            raise SystemExit("move-size requires --size, for example --size 6x6")
        move_size(args.size, args.yes)
        return
    if args.cmd == "add-layout":
        if not args.file or args.rows < 1 or args.cols < 1:
            raise SystemExit("add-layout requires --file, --rows and --cols")
        add_layout(args.file, args.rows, args.cols)
        return
    if args.cmd == "purge-tile":
        if not args.tile:
            raise SystemExit("purge-tile requires --tile")
        purge_tile(args.tile, args.yes)
        return
    if args.cmd == "prepare-range":
        if args.from_block < 1 or args.to_block < args.from_block:
            raise SystemExit("prepare-range requires --from-block and --to-block")
        raise SystemExit(prepare_range(args.from_block, args.to_block))
    if args.cmd == "prepare":
        raise SystemExit(prepare(max(1, args.count)))
    if not args.id:
        raise SystemExit("record requires --id")
    solutions = None if args.solutions < 0 else args.solutions
    record(args.id, solutions, args.exit)


if __name__ == "__main__":
    main()
