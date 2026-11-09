"""Count swap hits for sets that produced no new bags. Does not write the list."""
import importlib.util
from collections import Counter
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "sample_one_swap", Path(__file__).resolve().parent / "sample-one-swap.py"
)
sample = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sample)
q = sample.q

usable, by_anchor = sample.build_named()
catalog, blockers = sample.load_catalog()
files = sorted(q.SOLVES.glob("*.json"), key=lambda p: p.name)
new_bags = Counter()
catalog_bags = Counter()
directions = Counter()
seen_new = set()
seen_cat = set()
scanned = 0
for path in files:
    scanned += 1
    if scanned % 2000 == 0:
        print(f"scanned {scanned}", flush=True)
    for found in sample.iter_swaps_in_file(
        path, usable, by_anchor, set(), blockers
    ):
        fam = found["family"] + 1
        key = (found["rows"], found["cols"], q.bag_key(found["tiles"]))
        direction = (fam, "+".join(found["swapOut"]), "+".join(found["swapIn"]))
        directions[direction] += 1
        if key in catalog:
            if key not in seen_cat:
                seen_cat.add(key)
                catalog_bags[fam] += 1
        elif key not in seen_new:
            seen_new.add(key)
            new_bags[fam] += 1

print("done", flush=True)
for i, row in enumerate(q.USER_PAIRS, start=1):
    label = " | ".join("+".join(b) for b in row)
    print(
        f"set {i} new {new_bags[i]} already_in_catalog {catalog_bags[i]}  {label}",
        flush=True,
    )
print("directions for zero-list sets", flush=True)
for (fam, out_name, in_name), n in sorted(directions.items()):
    if fam in (1, 4, 6, 7, 8, 9):
        print(f"  set {fam} {out_name} -> {in_name} hits {n}", flush=True)
