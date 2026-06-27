#!/usr/bin/env python3
"""Import Adventure puzzle map + progression into MySQL.

Authoritative source: data/adventure_solution_distribution.csv
  Adv_ID     → global adventure sequence
  CH-lvl=T   → challenge puzzle; ends a ranked step (L1-1 … L9-10 only)
  level_id   → FK target in levels

Ranked adventure stops at L9-10 (90 steps). Rows after the L9-10 challenge
→ adventure_postgame_puzzle. Extra CH-lvl=T markers in postgame are challenge
gates (every ~100 puzzles), not new ranks.

Populates:
  adventure_rank, adventure_progression, adventure_puzzle, adventure_postgame_puzzle

  python scripts/import-adventure-map.py
  python scripts/import-adventure-map.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import List, Tuple

try:
    import pymysql
except ImportError:
    pymysql = None  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.adventure_ranks import ADVENTURE_RANK_COUNT, load_adventure_ranks
from lib.level_system import derive_progression_from_level_system, load_level_system_steps

STEPS_PER_RANK = 10


def connect():
    if pymysql is None:
        raise SystemExit("pymysql is required: pip install pymysql")
    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "tilegame"),
        password=os.environ.get("MYSQL_PASSWORD", "tilegame_dev"),
        database=os.environ.get("MYSQL_DATABASE", "tilegame"),
        charset="utf8mb4",
        autocommit=False,
    )


def step_to_rank_sub(step_index: int) -> Tuple[int, int]:
    """Map 0-based step index to (rank_id, sub_level) e.g. L1-1 … L9-2."""
    rank_id = step_index // STEPS_PER_RANK + 1
    sub_level = step_index % STEPS_PER_RANK + 1
    if rank_id < 1:
        raise ValueError(f"Step index {step_index} invalid")
    return rank_id, sub_level


def load_map_entries(map_path: Path) -> List[dict]:
    entries: List[dict] = []
    with map_path.open(encoding="utf-8-sig", newline="") as f:
        for line_no, raw in enumerate(csv.DictReader(f)):
            adv_raw = (raw.get("Adv_ID") or "").strip()
            level_id = (raw.get("level_id") or "").strip()
            if not adv_raw or not level_id:
                continue
            entries.append(
                {
                    "adv_id": int(adv_raw),
                    "line": line_no,
                    "level_id": level_id,
                    "is_challenge": (raw.get("CH-lvl") or "").strip().upper() == "T",
                }
            )
    entries.sort(key=lambda e: (e["adv_id"], e["line"]))
    return entries


def build_adventure_rows(
    entries: List[dict],
    level_system_steps: List[dict] | None = None,
    max_ranked_steps: int = ADVENTURE_RANK_COUNT * STEPS_PER_RANK,
) -> Tuple[List[dict], List[dict], List[str]]:
    challenge_adv = sorted(e["adv_id"] for e in entries if e["is_challenge"])
    if not challenge_adv:
        raise SystemExit("No CH-lvl=T rows found in adventure CSV")

    warnings: List[str] = []
    puzzles: List[dict] = []
    postgame: List[dict] = []
    prev_adv = 0

    ranked_challenge_adv = challenge_adv[:max_ranked_steps]
    if len(challenge_adv) > max_ranked_steps:
        extra = challenge_adv[max_ranked_steps:]
        warnings.append(
            f"Ranked adventure caps at L{ADVENTURE_RANK_COUNT}-10 (Adv_ID {ranked_challenge_adv[-1]}); "
            f"{len(extra)} later CH-lvl=T marker(s) at Adv_ID {extra} are postgame challenge gates"
        )

    for step_idx, end_adv in enumerate(ranked_challenge_adv):
        rank_id, sub_level = step_to_rank_sub(step_idx)

        step_entries = [e for e in entries if prev_adv < e["adv_id"] <= end_adv]
        step_entries.sort(key=lambda e: (e["adv_id"], e["line"]))
        if not step_entries:
            raise SystemExit(
                f"Empty step L{rank_id}-{sub_level} (adv {prev_adv + 1}..{end_adv})"
            )

        challenges = [e for e in step_entries if e["is_challenge"]]
        if len(challenges) != 1:
            raise SystemExit(
                f"Step L{rank_id}-{sub_level} must have exactly one T row; got {len(challenges)}"
            )

        actual = len(step_entries)
        if level_system_steps and step_idx < len(level_system_steps):
            ls = level_system_steps[step_idx]
            expect = ls["levels_required"]
            if actual != expect:
                warnings.append(
                    f"L{rank_id}-{sub_level}: map has {actual} puzzles, "
                    f"LevelSystem pzzle_amt={expect}"
                )
            if ls["rank_id"] != rank_id or ls["sub_level"] != sub_level:
                warnings.append(
                    f"Step index {step_idx + 1}: map L{rank_id}-{sub_level} != "
                    f"LevelSystem L{ls['rank_id']}-{ls['sub_level']}"
                )

        for order, entry in enumerate(step_entries, start=1):
            puzzles.append(
                {
                    "rank_id": rank_id,
                    "sub_level": sub_level,
                    "puzzle_order": order,
                    "level_id": entry["level_id"],
                    "is_challenge": entry["is_challenge"],
                }
            )

        prev_adv = end_adv

    if level_system_steps and len(ranked_challenge_adv) < len(level_system_steps):
        last_mapped = ranked_challenge_adv[-1]
        pending = level_system_steps[len(ranked_challenge_adv) :]
        first_pending = pending[0]
        planned_total = sum(s["levels_required"] for s in level_system_steps)
        warnings.append(
            f"LevelSystem defines {len(level_system_steps)} steps ({planned_total} ranked puzzles) "
            f"but map CSV has {len(ranked_challenge_adv)} ranked CH-lvl=T markers (through Adv_ID {last_mapped}); "
            f"next planned step L{first_pending['rank_id']}-{first_pending['sub_level']} "
            f"(Adv_ID_Start {first_pending['adv_id_start']}) has no puzzles yet"
        )

    trailing = [e for e in entries if e["adv_id"] > prev_adv]
    trailing.sort(key=lambda e: (e["adv_id"], e["line"]))
    seen_adv: set[int] = set()
    for entry in trailing:
        if entry["adv_id"] in seen_adv:
            warnings.append(
                f"postgame: skipped duplicate Adv_ID {entry['adv_id']} "
                f"({entry['level_id']}, csv line {entry['line']})"
            )
            continue
        seen_adv.add(entry["adv_id"])
        postgame.append(
            {
                "puzzle_order": len(postgame) + 1,
                "adv_id": entry["adv_id"],
                "level_id": entry["level_id"],
                "is_challenge": entry["is_challenge"],
            }
        )

    return puzzles, postgame, warnings


def upsert_ranks(cur, repo_root: Path) -> None:
    sql = """
        INSERT INTO adventure_rank (
            rank_id, rank_code, rank_name, rank_description, badge_name, badge_image,
            badge_locked_image, badge_color, unlock_title, unlock_message,
            display_order, is_active
        ) VALUES (%s, %s, %s, %s, %s, %s, NULL, NULL, NULL, NULL, %s, TRUE)
        ON DUPLICATE KEY UPDATE
            rank_code = VALUES(rank_code),
            rank_name = VALUES(rank_name),
            rank_description = VALUES(rank_description),
            badge_name = VALUES(badge_name),
            badge_image = VALUES(badge_image),
            display_order = VALUES(display_order),
            is_active = VALUES(is_active)
    """
    for row in load_adventure_ranks(repo_root):
        cur.execute(
            sql,
            (
                row["rank_id"],
                row["rank_code"],
                row["rank_name"],
                row["rank_description"],
                row["rank_name"],
                row["badge_image"],
                row["display_order"],
            ),
        )


def upsert_progression(cur, rows: List[dict]) -> None:
    sql = """
        INSERT INTO adventure_progression (
            rank_id, sub_level, levels_required, cumulative_levels_required
        ) VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            levels_required = VALUES(levels_required),
            cumulative_levels_required = VALUES(cumulative_levels_required)
    """
    for row in rows:
        cur.execute(
            sql,
            (
                row["rank_id"],
                row["sub_level"],
                row["levels_required"],
                row["cumulative_levels_required"],
            ),
        )


def replace_puzzles(cur, rows: List[dict]) -> None:
    cur.execute("DELETE FROM adventure_puzzle")
    sql = """
        INSERT INTO adventure_puzzle (
            rank_id, sub_level, puzzle_order, level_id, is_challenge
        ) VALUES (%s, %s, %s, %s, %s)
    """
    for row in rows:
        cur.execute(
            sql,
            (
                row["rank_id"],
                row["sub_level"],
                row["puzzle_order"],
                row["level_id"],
                row["is_challenge"],
            ),
        )


def replace_postgame(cur, rows: List[dict]) -> None:
    cur.execute("DELETE FROM adventure_postgame_puzzle")
    sql = """
        INSERT INTO adventure_postgame_puzzle (
            puzzle_order, adv_id, level_id, is_challenge
        ) VALUES (%s, %s, %s, %s)
    """
    for row in rows:
        cur.execute(
            sql,
            (
                row["puzzle_order"],
                row["adv_id"],
                row["level_id"],
                row["is_challenge"],
            ),
        )


def main() -> None:
    ap = argparse.ArgumentParser(description="Import adventure map CSV into MySQL.")
    ap.add_argument(
        "--csv",
        default="data/adventure_solution_distribution.csv",
        help="Adventure puzzle map CSV path",
    )
    ap.add_argument(
        "--level-system",
        default="data/LevelSystem.csv",
        help="Step progression CSV (levels_required per Lx-y)",
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--export-json",
        action="store_true",
        help="After import, write data/adventure_path.json from MySQL",
    )
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    map_path = (root / args.csv).resolve()
    if not map_path.exists():
        raise SystemExit(f"CSV not found: {map_path}")

    ls_path = (root / args.level_system).resolve()
    if not ls_path.exists():
        raise SystemExit(f"LevelSystem CSV not found: {ls_path}")

    ranks = load_adventure_ranks(root)
    max_rank_id = max(r["rank_id"] for r in ranks)
    progression = derive_progression_from_level_system(ls_path, max_rank_id=max_rank_id)
    level_system_steps = load_level_system_steps(ls_path)

    entries = load_map_entries(map_path)
    puzzles, postgame, warnings = build_adventure_rows(entries, level_system_steps)

    print(f"Map CSV: {map_path}")
    print(f"LevelSystem: {ls_path}")
    print(f"CSV rows: {len(entries)}")
    print(f"LevelSystem progression steps: {len(progression)}")
    print(f"mapped progression puzzles: {len(puzzles)}")
    last_step = progression[-1] if progression else None
    last_label = (
        f"L{last_step['rank_id']}-{last_step['sub_level']}" if last_step else "?"
    )
    mapped_steps = len({(p['rank_id'], p['sub_level']) for p in puzzles})
    prog_idx = min(mapped_steps, len(progression)) - 1 if mapped_steps and progression else -1
    last_mapped = progression[prog_idx] if prog_idx >= 0 else None
    last_mapped_label = (
        f"L{last_mapped['rank_id']}-{last_mapped['sub_level']}" if last_mapped else "?"
    )
    print(f"mapped ranked steps in CSV: {mapped_steps} (through {last_mapped_label})")
    print(f"postgame puzzles (after ranked L{ADVENTURE_RANK_COUNT}-10): {len(postgame)}")
    print(f"total puzzle rows: {len(puzzles) + len(postgame)}")
    print(f"challenges in map: {sum(1 for p in puzzles if p['is_challenge'])}")
    if progression:
        print(
            f"LevelSystem cumulative at {last_label}: "
            f"{progression[-1]['cumulative_levels_required']} "
            f"(levels_required={progression[-1]['levels_required']})"
        )
    if postgame:
        print(
            f"postgame Adv_ID range: {postgame[0]['adv_id']}..{postgame[-1]['adv_id']}"
        )
    if warnings:
        print(f"warnings ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")

    if args.dry_run:
        return

    conn = connect()
    try:
        with conn.cursor() as cur:
            upsert_ranks(cur, root)
            upsert_progression(cur, progression)
            replace_puzzles(cur, puzzles)
            replace_postgame(cur, postgame)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM adventure_rank")
            ranks_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_progression")
            prog_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_puzzle")
            puzzle_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_postgame_puzzle")
            post_n = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM adventure_puzzle WHERE is_challenge = TRUE")
            ch_n = cur.fetchone()[0]
            print(f"db adventure_rank: {ranks_n}")
            print(f"db adventure_progression: {prog_n}")
            print(f"db adventure_puzzle: {puzzle_n} ({ch_n} challenges)")
            print(f"db adventure_postgame_puzzle: {post_n}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    if args.export_json:
        sys.path.insert(0, str(root / "scripts"))
        from lib.adventure_path_build import load_adventure_path_from_mysql  # noqa: E402

        out = root / "data" / "adventure_path.json"
        doc = load_adventure_path_from_mysql(root)
        if not doc:
            raise SystemExit("MySQL import OK but adventure_path.json export failed")
        with out.open("w", encoding="utf-8") as f:
            json.dump(doc, f, indent=2)
            f.write("\n")
        print(f"Wrote {out} from MySQL ({doc['stepCount']} steps)")


if __name__ == "__main__":
    main()
