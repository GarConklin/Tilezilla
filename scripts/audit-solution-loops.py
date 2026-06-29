#!/usr/bin/env python3
"""Audit solve files for path loops / branch junctions.

A valid single-path solution must be a simple SH→ET path: every live-edge cell is
degree 1 (endpoint) or 2 (corridor). Branches and cycles are reported.

  python scripts/audit-solution-loops.py
  python scripts/audit-solution-loops.py --size 3x4
  python scripts/audit-solution-loops.py --level 3x4-0B-AAA
  python scripts/audit-solution-loops.py --fix --size 3x4
  python scripts/audit-solution-loops.py --max-size 4x5
  python scripts/audit-solution-loops.py --fix --max-size 4x5
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.solution_path_graph import (  # noqa: E402
    analyze_placements,
    board_size_from_level_id,
    load_live_edges,
)

ROOT = Path(__file__).resolve().parents[1]
SOLVES = ROOT / "solves"
LEVELS_DIR = ROOT / "data" / "levels"


def level_bucket_path(level_id: str) -> Optional[Path]:
    m = re.match(r"^(\d+x\d+)-(\d[A-Z])-", level_id)
    if not m:
        return None
    return LEVELS_DIR / f"{m.group(1)}-{m.group(2)}.json"


def load_level_meta(level_id: str) -> dict:
    bucket = level_bucket_path(level_id)
    if not bucket or not bucket.is_file():
        return {}
    with bucket.open(encoding="utf-8") as f:
        doc = json.load(f)
    for lv in doc.get("levels", []):
        if lv.get("id") == level_id:
            return lv
    return {}


def parse_board_size(size: str) -> tuple[int, int, int]:
    m = re.match(r"^(\d+)x(\d+)$", size or "")
    if not m:
        raise ValueError(f"Invalid board size: {size!r}")
    rows, cols = int(m.group(1)), int(m.group(2))
    return rows * cols, rows, cols


def size_sort_key(size: str) -> tuple[int, int, int]:
    try:
        return parse_board_size(size)
    except ValueError:
        return (999999, 999, 999)


def size_in_range(size: Optional[str], *, min_size: Optional[str], max_size: Optional[str]) -> bool:
    if not size:
        return False
    key = size_sort_key(size)
    if min_size and key < size_sort_key(min_size):
        return False
    if max_size and key > size_sort_key(max_size):
        return False
    return True


def iter_solve_files(
    *,
    size: Optional[str] = None,
    level_id: Optional[str] = None,
    min_size: Optional[str] = None,
    max_size: Optional[str] = None,
) -> List[Path]:
    if level_id:
        path = SOLVES / f"{level_id}.json"
        if not path.is_file():
            return []
        if min_size or max_size:
            bucket = board_size_from_level_id(level_id)
            if not size_in_range(bucket, min_size=min_size, max_size=max_size):
                return []
        return [path]
    if size:
        if min_size or max_size:
            if not size_in_range(size, min_size=min_size, max_size=max_size):
                return []
        pattern = f"{size}-*.json"
    else:
        pattern = "*.json"
    files = sorted(SOLVES.glob(pattern))
    if not min_size and not max_size:
        return files
    kept: List[Path] = []
    for path in files:
        bucket = board_size_from_level_id(path.stem)
        if size_in_range(bucket, min_size=min_size, max_size=max_size):
            kept.append(path)
    return kept


def audit_file(path: Path, live_edges: dict) -> List[dict]:
    with path.open(encoding="utf-8") as f:
        doc = json.load(f)

    level_id = doc.get("levelId") or path.stem
    board = doc.get("board") or {}
    rows = int(board.get("rows") or 0)
    cols = int(board.get("cols") or 0)
    if not rows or not cols:
        return []

    meta = load_level_meta(level_id)
    path_mode = meta.get("pathMode") or doc.get("pathMode")
    path_count = int(meta.get("pathCount") or doc.get("pathCount") or 0)
    level_tiles = meta.get("tiles") or doc.get("tiles")

    findings: List[dict] = []
    solutions = doc.get("solutions") or []
    for idx, sol in enumerate(solutions):
        placements = sol.get("placements") or []
        if not placements:
            continue
        result = analyze_placements(
            placements,
            rows=rows,
            cols=cols,
            live_edges=live_edges,
            path_mode=path_mode,
            path_count=path_count,
            level_tiles=level_tiles,
        )
        if result.ok:
            continue
        findings.append(
            {
                "levelId": level_id,
                "file": str(path.relative_to(ROOT)).replace("\\", "/"),
                "solutionIndex": idx + 1,
                "solutionTotal": len(solutions),
                "solutionId": sol.get("id") or f"solve-{idx + 1}",
                "issue": result.issue,
                "detail": result.detail,
                "nodes": result.nodes,
                "edges": result.edges,
                "endpoints": result.endpoints,
                "maxDegree": result.max_degree,
            }
        )
    return findings


def fix_file(path: Path, live_edges: dict) -> tuple[int, int]:
    with path.open(encoding="utf-8") as f:
        doc = json.load(f)

    level_id = doc.get("levelId") or path.stem
    board = doc.get("board") or {}
    rows = int(board.get("rows") or 0)
    cols = int(board.get("cols") or 0)
    meta = load_level_meta(level_id)
    path_mode = meta.get("pathMode") or doc.get("pathMode")
    path_count = int(meta.get("pathCount") or doc.get("pathCount") or 0)
    level_tiles = meta.get("tiles") or doc.get("tiles")

    # Two-snake (pathCount >= 2) validation is not reliable yet — never auto-remove.
    if path_count >= 2:
        return 0, len(doc.get("solutions") or [])

    kept = []
    removed = 0
    for idx, sol in enumerate(doc.get("solutions") or []):
        placements = sol.get("placements") or []
        if not placements:
            removed += 1
            continue
        result = analyze_placements(
            placements,
            rows=rows,
            cols=cols,
            live_edges=live_edges,
            path_mode=path_mode,
            path_count=path_count,
            level_tiles=level_tiles,
        )
        if result.ok:
            kept.append(sol)
        else:
            removed += 1

    if removed == 0:
        return 0, len(doc.get("solutions") or [])

    for i, sol in enumerate(kept):
        sol["id"] = f"solve-{i + 1}"
        sol["label"] = f"{level_id} solve {i + 1}"

    doc["solutions"] = kept
    doc["totalUniqueSolutions"] = len(kept)
    with path.open("w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)
        f.write("\n")

    bucket = level_bucket_path(level_id)
    if bucket and bucket.is_file():
        with bucket.open(encoding="utf-8") as f:
            bucket_doc = json.load(f)
        changed = False
        for lv in bucket_doc.get("levels", []):
            if lv.get("id") == level_id:
                lv["totalUniqueSolutions"] = len(kept)
                changed = True
                break
        if changed:
            with bucket.open("w", encoding="utf-8") as f:
                json.dump(bucket_doc, f, indent=2)
                f.write("\n")

    return removed, len(kept)


def print_report(findings: List[dict], *, by_size: bool) -> None:
    if not findings:
        print("No loop/branch issues found.")
        return

    print(f"Found {len(findings)} invalid solution(s):\n")
    if by_size:
        grouped: Dict[str, List[dict]] = defaultdict(list)
        for row in findings:
            grouped[board_size_from_level_id(row["levelId"]) or "?"].append(row)
        for size in sorted(grouped, key=size_sort_key):
            rows = grouped[size]
            print(f"## {size} ({len(rows)} issue(s))")
            for row in rows:
                print(
                    f"  {row['levelId']}  solution {row['solutionIndex']}/{row['solutionTotal']}"
                    f"  [{row['issue']}] {row['detail']}"
                )
            print()
    else:
        for row in findings:
            print(
                f"{row['levelId']}  solution {row['solutionIndex']}/{row['solutionTotal']}"
                f"  [{row['issue']}] {row['detail']}"
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit solve JSON files for path loops/branches.")
    parser.add_argument("--size", help="Board size filter, e.g. 3x4")
    parser.add_argument("--min-size", help="Smallest board size (by area), e.g. 3x3")
    parser.add_argument("--max-size", help="Largest board size (by area), e.g. 4x5")
    parser.add_argument("--level", help="Single level id, e.g. 3x4-0B-AAA")
    parser.add_argument("--fix", action="store_true", help="Remove invalid solutions and update counts")
    parser.add_argument("--json-out", type=Path, help="Write full findings JSON report")
    parser.add_argument(
        "--group-by-size",
        action="store_true",
        default=True,
        help="Group console report by board size (default: on)",
    )
    args = parser.parse_args()

    live_edges = load_live_edges(ROOT)
    files = iter_solve_files(
        size=args.size,
        level_id=args.level,
        min_size=args.min_size,
        max_size=args.max_size,
    )
    if not files:
        print("No solve files matched.", file=sys.stderr)
        return 1

    all_findings: List[dict] = []
    total_removed = 0
    files_fixed = 0

    for path in files:
        findings = audit_file(path, live_edges)
        all_findings.extend(findings)
        if args.fix and findings:
            removed, kept = fix_file(path, live_edges)
            if removed:
                files_fixed += 1
                total_removed += removed
                print(f"Fixed {path.name}: removed {removed}, kept {kept}")

    if not args.fix:
        print_report(all_findings, by_size=args.group_by_size)

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "issueCount": len(all_findings),
            "findings": all_findings,
            "fixed": args.fix,
            "filesFixed": files_fixed,
            "solutionsRemoved": total_removed,
        }
        with args.json_out.open("w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
            f.write("\n")
        print(f"Wrote {args.json_out}")

    if args.fix:
        print(f"\nSummary: {len(all_findings)} invalid solution(s), {files_fixed} file(s) updated, {total_removed} removed.")
    elif all_findings:
        by_size_counts: Dict[str, int] = defaultdict(int)
        for row in all_findings:
            by_size_counts[board_size_from_level_id(row["levelId"]) or "?"] += 1
        print("\nBy board size:")
        for size in sorted(by_size_counts, key=size_sort_key):
            print(f"  {size}: {by_size_counts[size]}")

    return 0 if not all_findings or args.fix else 1


if __name__ == "__main__":
    raise SystemExit(main())
