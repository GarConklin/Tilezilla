#!/usr/bin/env python3
"""Build Workbench-ready SQL + cleaned CSV for daily_challenges import."""

from __future__ import annotations

import csv
import json
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    csv_path = root / "data" / "daily_challenges_import.csv"
    levels_doc = json.loads(
        (root / "data" / "levels" / "levels.json").read_text(encoding="utf-8")
    )
    by_id = {L["id"]: L for L in levels_doc.get("levels", [])}

    rows = list(csv.DictReader(csv_path.open(encoding="utf-8-sig")))
    clean_csv = root / "data" / "daily_challenges_import_clean.csv"
    sql_path = root / "data" / "daily_challenges_workbench.sql"

    missing: set[str] = set()
    level_inserts: list[str] = []
    seen_levels: set[str] = set()

    for r in rows:
        lid = r["level_id"].strip().replace(".json", "")
        if lid not in by_id:
            missing.add(lid)
        elif lid not in seen_levels:
            seen_levels.add(lid)
            lv = by_id[lid]
            parts = lid.split("-")
            tier = parts[1] if len(parts) >= 2 else ""
            cols = int(lv["board"]["cols"])
            rows_n = int(lv["board"]["rows"])
            tus = int(lv.get("totalUniqueSolutions") or r["total_solutions"] or 0)
            level_inserts.append(
                f"('{lid}', {cols}, {rows_n}, '{tier}', {tus}, TRUE, NULL)"
            )

    with clean_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["challenge_date", "level_id", "total_solutions", "notes"])
        for r in rows:
            w.writerow(
                [
                    r["challenge_date"],
                    r["level_id"].strip().replace(".json", ""),
                    r["total_solutions"],
                    r.get("notes", ""),
                ]
            )

    daily_vals: list[str] = []
    for r in rows:
        lid = r["level_id"].strip().replace(".json", "")
        notes = (r.get("notes") or "").strip()
        notes_sql = "NULL" if not notes else f"'{notes.replace(chr(39), chr(39)+chr(39))}'"
        daily_vals.append(
            f"('{r['challenge_date']}', '{lid}', {int(r['total_solutions'])}, {notes_sql})"
        )

    lines = [
        "-- Run in MySQL Workbench against database: tilegame",
        "-- Seeds levels referenced by daily schedule, then loads daily_challenges.",
        "",
        "USE tilegame;",
        "",
    ]
    if missing:
        lines.append(
            f"-- WARNING: {len(missing)} level ids not in catalog (rows will fail FK):"
        )
        for mid in sorted(missing)[:50]:
            lines.append(f"--   {mid}")
        lines.append("")

    lines.extend(
        [
            "START TRANSACTION;",
            "",
            f"-- Levels needed: {len(level_inserts)} unique ids from CSV",
            "INSERT INTO levels (level_id, board_width, board_height, tier, total_unique_solutions, daily_eligible, target_time_seconds)",
            "VALUES",
            ",\n".join(level_inserts),
            "ON DUPLICATE KEY UPDATE",
            "  board_width = VALUES(board_width),",
            "  board_height = VALUES(board_height),",
            "  tier = VALUES(tier),",
            "  total_unique_solutions = VALUES(total_unique_solutions),",
            "  daily_eligible = VALUES(daily_eligible);",
            "",
            f"-- Daily rows: {len(daily_vals)}",
            "INSERT INTO daily_challenges (challenge_date, level_id, total_solutions, notes)",
            "VALUES",
            ",\n".join(daily_vals),
            "ON DUPLICATE KEY UPDATE",
            "  level_id = VALUES(level_id),",
            "  total_solutions = VALUES(total_solutions),",
            "  notes = VALUES(notes);",
            "",
            "COMMIT;",
            "",
            "SELECT COUNT(*) AS daily_rows FROM daily_challenges;",
            "",
        ]
    )

    sql_path.write_text("\n".join(lines), encoding="utf-8")
    print(clean_csv)
    print(sql_path)
    print(f"daily rows: {len(daily_vals)}")
    print(f"level seeds: {len(level_inserts)}")
    print(f"missing catalog ids: {len(missing)}")


if __name__ == "__main__":
    main()
