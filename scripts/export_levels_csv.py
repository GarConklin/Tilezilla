#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path
from typing import Dict, List, Tuple


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_size(size: str) -> Tuple[int, int]:
    try:
        a, b = size.split("x", 1)
        return int(a), int(b)
    except Exception:
        return (999, 999)


def parse_level_id(level_id: str) -> Tuple[Tuple[int, int], str]:
    # Expected: 4x4-0C-AAA
    parts = level_id.split("-")
    if len(parts) < 3:
        return (999, 999), level_id
    return parse_size(parts[0]), level_id


def tilebag_key(tiles: Dict[str, int]) -> str:
    return "_".join(
        f"{k}x{int(v)}" if int(v) != 1 else k
        for k, v in sorted((str(k), int(v)) for k, v in (tiles or {}).items())
    )


def solve_count_for_level(root: Path, solves_file: str) -> int:
    p = root / "solves" / solves_file
    if not p.exists():
        return 0
    doc = read_json(p)
    if isinstance(doc.get("totalUniqueSolutions"), int):
        return int(doc["totalUniqueSolutions"])
    sols = doc.get("solutions")
    if isinstance(sols, list):
        return len(sols)
    return 0


def snakes_on_board(tiles: Dict[str, int]) -> int:
    sh = int((tiles or {}).get("SH") or 0)
    et = int((tiles or {}).get("ET") or 0)
    if sh > 0 and et > 0:
        return min(sh, et)
    return 1


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Export levels catalog to CSV ordered by size then level ID."
    )
    ap.add_argument(
        "--out",
        default="data/solver-runs/levels-solution-counts.csv",
        help="Output CSV path (default: data/solver-runs/levels-solution-counts.csv)",
    )
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    levels_path = root / "data" / "levels" / "levels.json"
    levels_doc = read_json(levels_path)
    levels: List[Dict] = list(levels_doc.get("levels", []))

    levels.sort(key=lambda lv: parse_level_id(str(lv.get("id", ""))))

    out_path = (root / args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")

    with tmp_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "size",
                "level_id",
                "name",
                "tier",
                "snakes",
                "path_mode",
                "path_count",
                "total_unique_solutions",
                "solves_file",
                "solve_count",
                "tilebag_key",
                "tiles_json",
            ]
        )
        for lv in levels:
            level_id = str(lv.get("id", ""))
            parts = level_id.split("-")
            size = parts[0] if len(parts) >= 1 else ""
            tier = parts[1] if len(parts) >= 2 else ""
            tiles = lv.get("tiles", {}) or {}
            solves_file = str(lv.get("solvesFile", ""))
            solve_count = solve_count_for_level(root, solves_file) if solves_file else 0
            catalog_path_count = int(lv.get("pathCount", 0) or 0)
            catalog_lib = int(lv.get("totalUniqueSolutions", 0) or 0)
            w.writerow(
                [
                    size,
                    level_id,
                    str(lv.get("name", "")),
                    tier,
                    snakes_on_board(tiles),
                    str(lv.get("pathMode", "")),
                    catalog_path_count,
                    catalog_lib,
                    solves_file,
                    solve_count,
                    tilebag_key(tiles),
                    json.dumps(dict(sorted((str(k), int(v)) for k, v in tiles.items())), ensure_ascii=True),
                ]
            )

    tmp_path.replace(out_path)
    print(str(out_path))


if __name__ == "__main__":
    main()

