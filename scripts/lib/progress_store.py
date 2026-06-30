"""Server-side player progress — JSON files + MySQL summary tables."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from lib.solve_match import (
    equivalence_key,
    load_solves_file,
    match_catalog,
    parse_board_size,
    playable_placements,
)


def progress_dir(repo_root: Path) -> Path:
    return repo_root / "data" / "progress" / "users"


def progress_path(repo_root: Path, user_id: int | str) -> Path:
    safe = str(int(user_id))
    return progress_dir(repo_root) / f"{safe}.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_progress(repo_root: Path, user_id: int | str) -> dict[str, Any]:
    path = progress_path(repo_root, user_id)
    if not path.is_file():
        return {}
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    data = doc.get("data") if isinstance(doc, dict) else None
    return data if isinstance(data, dict) else {}


def save_progress(repo_root: Path, user_id: int | str, data: dict[str, Any]) -> None:
    path = progress_path(repo_root, user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        "schema": "tilezilla-progress-v1",
        "userId": int(user_id),
        "updatedAt": _now_iso(),
        "data": data,
    }
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")


def _count_catalog_solutions(found: list[dict]) -> int:
    return sum(1 for f in found if not f.get("bonus") and f.get("index") is not None)


def _best_time_seconds(found: list[dict]) -> Optional[int]:
    times = [
        int(f.get("completionTimeSeconds") or 0)
        for f in found
        if int(f.get("completionTimeSeconds") or 0) > 0
    ]
    return min(times) if times else None


def _mysql_connect():
    import os

    import pymysql  # type: ignore

    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "tilegame"),
        password=os.environ.get("MYSQL_PASSWORD", "tilegame_dev"),
        database=os.environ.get("MYSQL_DATABASE", "tilegame"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def _solutions_found_count(found: list[dict]) -> int:
    return len(found or [])


def _puzzle_satisfied(found: list[dict], is_challenge: bool, total_known: int) -> bool:
    if not found:
        return False
    if not is_challenge:
        return len(found) >= 1
    non_bonus = sum(1 for f in found if not f.get("bonus"))
    required = max(int(total_known or 0), 1)
    return non_bonus >= required


def _adventure_cleared_count(cur, progress_data: dict[str, Any]) -> int:
    cur.execute(
        """
        SELECT ap.level_id, ap.is_challenge,
               COALESCE(l.total_unique_solutions, 1) AS total_known
        FROM adventure_puzzle ap
        LEFT JOIN levels l ON l.level_id = ap.level_id
        ORDER BY ap.rank_id, ap.sub_level, ap.puzzle_order
        """
    )
    rows = cur.fetchall() or []
    cleared = 0
    for row in rows:
        level_id = row.get("level_id")
        if not level_id:
            continue
        found = (progress_data.get(level_id) or {}).get("found") or []
        if _puzzle_satisfied(
            found,
            bool(row.get("is_challenge")),
            int(row.get("total_known") or 1),
        ):
            cleared += 1
    return cleared


def _current_adventure_position(cur, total_solved: int) -> tuple[int, int]:
    """Map cumulative adventure clears to the step the player is currently on."""
    cur.execute(
        """
        SELECT rank_id, sub_level
        FROM adventure_progression
        WHERE cumulative_levels_required > %s
        ORDER BY cumulative_levels_required ASC
        LIMIT 1
        """,
        (total_solved,),
    )
    prog = cur.fetchone()
    if prog:
        return int(prog.get("rank_id") or 1), int(prog.get("sub_level") or 1)
    cur.execute(
        """
        SELECT rank_id, sub_level
        FROM adventure_progression
        ORDER BY cumulative_levels_required DESC
        LIMIT 1
        """
    )
    prog = cur.fetchone() or {}
    return int(prog.get("rank_id") or 1), int(prog.get("sub_level") or 1)


def rebuild_mysql_from_progress(
    repo_root: Path,  # noqa: ARG001
    user_id: int,
    progress_data: dict[str, Any],
) -> None:
    """Sync MySQL summary tables from authoritative JSON progress blob."""
    try:
        conn = _mysql_connect()
    except Exception:
        return

    now = datetime.now().replace(microsecond=0)
    try:
        with conn.cursor() as cur:
            for level_id, entry in progress_data.items():
                if str(level_id).startswith("_") or not isinstance(entry, dict):
                    continue
                found = entry.get("found") or []
                if not found:
                    continue
                best = _best_time_seconds(found)
                solve_count = _solutions_found_count(found)
                for f in found:
                    if f.get("bonus") or f.get("index") is None:
                        continue
                    solution_id = int(f["index"]) + 1
                    discovered = f.get("foundAt") or now
                    cur.execute(
                        """
                        INSERT IGNORE INTO user_solution_discoveries
                            (user_id, level_id, solution_id, discovered_at)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (user_id, level_id, solution_id, discovered),
                    )
                cur.execute(
                    """
                    INSERT INTO user_level_progress (
                        user_id, level_id, completed, completion_count,
                        best_time_seconds, solutions_found_count,
                        first_completed_at, last_completed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        completed = VALUES(completed),
                        completion_count = VALUES(completion_count),
                        best_time_seconds = VALUES(best_time_seconds),
                        solutions_found_count = VALUES(solutions_found_count),
                        first_completed_at = COALESCE(first_completed_at, VALUES(first_completed_at)),
                        last_completed_at = VALUES(last_completed_at)
                    """,
                    (
                        user_id,
                        level_id,
                        solve_count > 0,
                        solve_count,
                        best,
                        solve_count,
                        now,
                        now,
                    ),
                )

            total_solved = _adventure_cleared_count(cur, progress_data)
            rank_id, sub_level = _current_adventure_position(cur, total_solved)
            cur.execute(
                """
                INSERT INTO player_progress (
                    player_id, total_levels_solved, current_rank_id, current_sub_level
                ) VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    total_levels_solved = VALUES(total_levels_solved),
                    current_rank_id = VALUES(current_rank_id),
                    current_sub_level = VALUES(current_sub_level),
                    last_updated = CURRENT_TIMESTAMP
                """,
                (user_id, total_solved, rank_id, sub_level),
            )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        conn.close()


def sync_mysql_after_solve(
    repo_root: Path,
    user_id: int,
    progress_data: dict[str, Any],
    *,
    level_id: str,
    index: Optional[int],
    bonus: bool,
    completion_time_seconds: int,
    challenge_date: Optional[str] = None,
    leaderboard_saved: bool = False,
) -> None:
    """Best-effort MySQL summary; JSON file remains authoritative for full history."""
    rebuild_mysql_from_progress(repo_root, user_id, progress_data)

    if not leaderboard_saved or not challenge_date or bonus or index is None:
        return

    try:
        conn = _mysql_connect()
    except Exception:
        return

    now = datetime.now().replace(microsecond=0)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO daily_results (
                    challenge_date, user_id, completion_time_seconds,
                    solution_id, completed_at
                ) VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    completion_time_seconds = LEAST(
                        completion_time_seconds, VALUES(completion_time_seconds)
                    ),
                    solution_id = IF(
                        VALUES(completion_time_seconds) < completion_time_seconds,
                        VALUES(solution_id),
                        solution_id
                    ),
                    completed_at = IF(
                        VALUES(completion_time_seconds) < completion_time_seconds,
                        VALUES(completed_at),
                        completed_at
                    )
                """,
                (
                    challenge_date,
                    user_id,
                    max(0, int(completion_time_seconds)),
                    int(index) + 1,
                    now,
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        conn.close()


def record_solve(
    repo_root: Path,
    user_id: int | str,
    level_id: str,
    placements: list[dict],
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    meta = meta or {}
    if not level_id:
        return {"ok": False, "error": "levelId required"}
    if not isinstance(placements, list) or not placements:
        return {"ok": False, "error": "placements required"}

    rows, cols = parse_board_size(level_id)
    playable = playable_placements(placements)
    key_new = equivalence_key(playable, rows, cols)

    data = load_progress(repo_root, user_id)
    level_entry = data.setdefault(level_id, {"found": []})
    found_list: list[dict] = level_entry.setdefault("found", [])

    for existing in found_list:
        key_existing = equivalence_key(existing.get("placements") or [], rows, cols)
        if key_existing == key_new:
            return {
                "ok": True,
                "duplicate": True,
                "index": existing.get("index"),
                "bonus": bool(existing.get("bonus")),
                "foundAt": existing.get("foundAt"),
            }

    known = load_solves_file(repo_root, level_id)
    client_check = meta.get("check") if isinstance(meta.get("check"), dict) else {}
    if known:
        index, bonus = match_catalog(playable, known, rows, cols)
    elif isinstance(client_check, dict):
        if client_check.get("bonus") is True:
            index, bonus = None, True
        elif client_check.get("index") is not None:
            try:
                index = int(client_check["index"])
                bonus = False
            except (TypeError, ValueError):
                index, bonus = None, True
        else:
            index, bonus = None, True
    else:
        index, bonus = None, True

    completion_time_seconds = max(
        0, int(meta.get("completionTimeSeconds") or meta.get("elapsedSec") or 0)
    )
    found_at = _now_iso()
    entry = {
        "index": index,
        "placements": [
            {
                "tile": p.get("tile"),
                "r": int(p.get("r") or 0),
                "c": int(p.get("c") or 0),
                "deg": int(p.get("deg") or 0),
            }
            for p in placements
        ],
        "bonus": bool(bonus),
        "elapsedMs": completion_time_seconds * 1000,
        "completionTimeSeconds": completion_time_seconds,
        "hintsUsed": bool(meta.get("hintsUsed")),
        "exampleRouteViewed": bool(meta.get("exampleRouteViewed")),
        "leaderboardSubmitted": bool(meta.get("leaderboardSubmitted")),
        "foundAt": found_at,
    }
    found_list.append(entry)
    save_progress(repo_root, user_id, data)

    sync_mysql_after_solve(
        repo_root,
        int(user_id),
        data,
        level_id=level_id,
        index=index,
        bonus=bonus,
        completion_time_seconds=completion_time_seconds,
        challenge_date=str(meta.get("challengeDate") or "").strip() or None,
        leaderboard_saved=bool(meta.get("leaderboardSubmitted")),
    )

    return {
        "ok": True,
        "duplicate": False,
        "index": index,
        "bonus": bonus,
        "foundAt": found_at,
    }


def migrate_progress(
    repo_root: Path,
    user_id: int | str,
    incoming: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(incoming, dict):
        return {"ok": False, "error": "data must be an object"}
    existing = load_progress(repo_root, user_id)
    if existing:
        return {"ok": False, "error": "progress already exists", "skipped": True}
    save_progress(repo_root, user_id, incoming)
    rebuild_mysql_from_progress(repo_root, int(user_id), incoming)
    return {"ok": True, "migrated": True}


def progress_response(repo_root: Path, user_id: int | str) -> dict[str, Any]:
    path = progress_path(repo_root, user_id)
    data = load_progress(repo_root, user_id)
    updated_at = None
    if path.is_file():
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
            updated_at = doc.get("updatedAt")
        except (OSError, json.JSONDecodeError):
            pass
    if data:
        rebuild_mysql_from_progress(repo_root, int(user_id), data)
    return {"ok": True, "data": data, "updatedAt": updated_at}
