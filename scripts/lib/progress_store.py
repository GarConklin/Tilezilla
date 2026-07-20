"""Server-side player progress — JSON files + MySQL summary tables."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
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


def _daily_challenge_level_id(challenge_date: str) -> Optional[str]:
    date_key = str(challenge_date or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_key):
        return None
    try:
        conn = _mysql_connect()
    except Exception:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT level_id FROM daily_challenges WHERE challenge_date = %s LIMIT 1",
                (date_key,),
            )
            row = cur.fetchone()
            if not row:
                return None
            level_id = str(row.get("level_id") or "").strip()
            return level_id or None
    except Exception:
        return None
    finally:
        conn.close()


def start_daily_attempt(
    user_id: int | str,
    challenge_date: str,
    level_id: str,
) -> dict[str, Any]:
    """Record first tile placement for today's daily (INSERT IGNORE — one start per user/day).

    started_at must not move when the board is reset: the client keeps the same
    stopwatch running for today's leaderboard attempt, and a rebinding start time
    would let a near-finished board reset into a fake short time.
    """
    date_key = str(challenge_date or "").strip()
    level_key = str(level_id or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_key):
        return {"ok": False, "error": "invalid-date"}
    if not level_key:
        return {"ok": False, "error": "levelId required"}
    if date_key != date.today().isoformat():
        return {"ok": False, "error": "not-today"}

    expected_level = _daily_challenge_level_id(date_key)
    if not expected_level:
        return {"ok": False, "error": "unknown-challenge-date"}
    if expected_level != level_key:
        return {"ok": False, "error": "level-mismatch"}

    now = datetime.now().replace(microsecond=0)
    try:
        conn = _mysql_connect()
    except Exception:
        return {"ok": False, "error": "db-unavailable"}

    created = False
    started_at = now
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT IGNORE INTO daily_attempts (
                    challenge_date, user_id, level_id, started_at
                ) VALUES (%s, %s, %s, %s)
                """,
                (date_key, int(user_id), level_key, now),
            )
            created = cur.rowcount > 0
            cur.execute(
                """
                SELECT started_at FROM daily_attempts
                WHERE challenge_date = %s AND user_id = %s
                LIMIT 1
                """,
                (date_key, int(user_id)),
            )
            row = cur.fetchone()
            if row and row.get("started_at"):
                started_at = row["started_at"]
        conn.commit()
    except Exception:
        conn.rollback()
        return {"ok": False, "error": "insert-failed"}
    finally:
        conn.close()

    if isinstance(started_at, datetime):
        started_iso = started_at.replace(microsecond=0).isoformat(sep=" ")
    else:
        started_iso = str(started_at)

    return {
        "ok": True,
        "created": created,
        "challengeDate": date_key,
        "levelId": level_key,
        "startedAt": started_iso,
    }


def daily_attempt_elapsed_seconds(
    user_id: int | str,
    challenge_date: str,
) -> Optional[int]:
    """Seconds since server-recorded daily attempt start, or None if no row."""
    date_key = str(challenge_date or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_key):
        return None
    try:
        conn = _mysql_connect()
    except Exception:
        return None

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT started_at FROM daily_attempts
                WHERE challenge_date = %s AND user_id = %s
                LIMIT 1
                """,
                (date_key, int(user_id)),
            )
            row = cur.fetchone()
            if not row or not row.get("started_at"):
                return None
            started_at = row["started_at"]
            if not isinstance(started_at, datetime):
                return None
            elapsed = int((datetime.now() - started_at).total_seconds())
            return max(0, elapsed)
    except Exception:
        return None
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
    hints_used_count: int = 0,
) -> None:
    """Best-effort MySQL summary; JSON file remains authoritative for full history."""
    rebuild_mysql_from_progress(repo_root, user_id, progress_data)

    if not leaderboard_saved or not challenge_date or bonus or index is None:
        return

    hint_count = max(0, int(hints_used_count or 0))

    try:
        conn = _mysql_connect()
    except Exception:
        return

    now = datetime.now().replace(microsecond=0)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT IGNORE INTO daily_results (
                    challenge_date, user_id, completion_time_seconds,
                    solution_id, completed_at, hints_used_count
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    challenge_date,
                    user_id,
                    max(0, int(completion_time_seconds)),
                    int(index) + 1,
                    now,
                    hint_count,
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        conn.close()


def _resolve_leaderboard_time(
    user_id: int | str,
    meta: dict[str, Any],
) -> tuple[Optional[str], bool, int, Optional[int]]:
    """Return (challenge_date, leaderboard_saved, completion_time, server_elapsed)."""
    client_completion_time_seconds = max(
        0, int(meta.get("completionTimeSeconds") or meta.get("elapsedSec") or 0)
    )
    challenge_date = str(meta.get("challengeDate") or "").strip() or None
    leaderboard_saved = bool(meta.get("leaderboardSubmitted"))
    completion_time_seconds = client_completion_time_seconds
    server_completion_time_seconds: Optional[int] = None
    if challenge_date and leaderboard_saved:
        # Leaderboard time is the puzzle stopwatch (client). Server attempt start is
        # rebound to each new timing window until daily_results exists, and is kept
        # for auditing — but must NOT replace the stopwatch with wall-clock that
        # spans continued multi-solve play after the first eligible finish.
        server_completion_time_seconds = daily_attempt_elapsed_seconds(
            user_id, challenge_date
        )
        if completion_time_seconds <= 0:
            if server_completion_time_seconds is not None:
                completion_time_seconds = server_completion_time_seconds
            else:
                leaderboard_saved = False
        elif (
            server_completion_time_seconds is not None
            and completion_time_seconds > server_completion_time_seconds + 5
        ):
            # Stopwatch cannot exceed attempt wall-clock (+skew); clamp obvious edits.
            completion_time_seconds = server_completion_time_seconds
    return (
        challenge_date,
        leaderboard_saved,
        completion_time_seconds,
        server_completion_time_seconds,
    )


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

    (
        challenge_date,
        leaderboard_saved,
        completion_time_seconds,
        server_completion_time_seconds,
    ) = _resolve_leaderboard_time(user_id, meta)
    hints_used_count = meta.get("hintsUsedCount")
    if hints_used_count is None:
        hints_used_count = 1 if meta.get("hintsUsed") else 0
    hints_used_count = max(0, int(hints_used_count or 0))

    for existing in found_list:
        key_existing = equivalence_key(existing.get("placements") or [], rows, cols)
        if key_existing == key_new:
            # Still allow a pending daily leaderboard insert (first-solve sync retry).
            if leaderboard_saved and challenge_date:
                idx = existing.get("index")
                sync_mysql_after_solve(
                    repo_root,
                    int(user_id),
                    data,
                    level_id=level_id,
                    index=int(idx) if idx is not None else None,
                    bonus=bool(existing.get("bonus")),
                    completion_time_seconds=completion_time_seconds,
                    challenge_date=challenge_date,
                    leaderboard_saved=leaderboard_saved,
                    hints_used_count=hints_used_count,
                )
            result: dict[str, Any] = {
                "ok": True,
                "duplicate": True,
                "index": existing.get("index"),
                "bonus": bool(existing.get("bonus")),
                "foundAt": existing.get("foundAt"),
                "completionTimeSeconds": completion_time_seconds,
                "leaderboardSubmitted": bool(
                    leaderboard_saved and challenge_date
                ),
            }
            if server_completion_time_seconds is not None:
                result["serverCompletionTimeSeconds"] = server_completion_time_seconds
            return result

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
        "hintsUsed": hints_used_count > 0,
        "hintsUsedCount": hints_used_count,
        "exampleRouteViewed": bool(meta.get("exampleRouteViewed")),
        "leaderboardSubmitted": leaderboard_saved,
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
        challenge_date=challenge_date,
        leaderboard_saved=leaderboard_saved,
        hints_used_count=hints_used_count,
    )

    result = {
        "ok": True,
        "duplicate": False,
        "index": index,
        "bonus": bonus,
        "foundAt": found_at,
        "completionTimeSeconds": completion_time_seconds,
        "leaderboardSubmitted": leaderboard_saved,
    }
    if server_completion_time_seconds is not None:
        result["serverCompletionTimeSeconds"] = server_completion_time_seconds
    client_completion_time_seconds = max(
        0, int(meta.get("completionTimeSeconds") or meta.get("elapsedSec") or 0)
    )
    if client_completion_time_seconds != completion_time_seconds:
        result["clientCompletionTimeSeconds"] = client_completion_time_seconds
    return result


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


def _found_entry_key(level_id: str, entry: dict[str, Any]) -> str:
    placements = entry.get("placements") or []
    playable = playable_placements(placements if isinstance(placements, list) else [])
    rows, cols = parse_board_size(level_id)
    if rows and cols and playable:
        return equivalence_key(playable, rows, cols)
    index = entry.get("index")
    bonus = bool(entry.get("bonus"))
    return f"idx:{index}|bonus:{bonus}|n:{len(playable)}"


def merge_progress_blobs(
    base: dict[str, Any] | None,
    incoming: dict[str, Any] | None,
) -> dict[str, Any]:
    """Union progress blobs — keep every unique found solution from either side."""
    out: dict[str, Any] = {}
    if isinstance(base, dict):
        out = json.loads(json.dumps(base))  # deep copy via JSON

    if not isinstance(incoming, dict):
        return out

    for level_id, entry in incoming.items():
        if not isinstance(level_id, str):
            continue
        if level_id.startswith("_"):
            if level_id not in out:
                out[level_id] = entry
            elif isinstance(out[level_id], dict) and isinstance(entry, dict):
                merged_meta = {**out[level_id], **entry}
                # Prefer richer encountered tile lists when present.
                for key in ("encounteredTiles", "seenTiles"):
                    a = out[level_id].get(key) if isinstance(out[level_id], dict) else None
                    b = entry.get(key)
                    if isinstance(a, list) or isinstance(b, list):
                        merged_meta[key] = sorted(
                            set([*(a or []), *(b or [])]),
                            key=str,
                        )
                out[level_id] = merged_meta
            continue
        if not isinstance(entry, dict):
            continue

        base_entry = out.get(level_id)
        if not isinstance(base_entry, dict):
            out[level_id] = json.loads(json.dumps(entry))
            continue

        merged_entry = {**base_entry, **{k: v for k, v in entry.items() if k != "found"}}
        found_out: list[dict] = list(base_entry.get("found") or [])
        seen = {_found_entry_key(level_id, f) for f in found_out if isinstance(f, dict)}
        for f in entry.get("found") or []:
            if not isinstance(f, dict):
                continue
            key = _found_entry_key(level_id, f)
            if key in seen:
                continue
            found_out.append(f)
            seen.add(key)
        merged_entry["found"] = found_out
        out[level_id] = merged_entry

    return out


def merge_progress(
    repo_root: Path,
    user_id: int | str,
    incoming: dict[str, Any],
) -> dict[str, Any]:
    """Merge client progress into server JSON (additive union of found solutions)."""
    if not isinstance(incoming, dict):
        return {"ok": False, "error": "data must be an object"}
    existing = load_progress(repo_root, user_id)
    merged = merge_progress_blobs(existing, incoming)
    save_progress(repo_root, user_id, merged)
    rebuild_mysql_from_progress(repo_root, int(user_id), merged)
    return {
        "ok": True,
        "merged": True,
        "data": merged,
        "levels": len([k for k in merged if not str(k).startswith("_")]),
        "solves": sum(
            len((v or {}).get("found") or [])
            for k, v in merged.items()
            if not str(k).startswith("_") and isinstance(v, dict)
        ),
    }


def all_time_best_daily(repo_root: Path) -> dict[str, Any]:  # noqa: ARG001
    """Fastest daily-challenge solve ever recorded, across all users.

    Joins daily_results → daily_challenges (for level_id) → users (for name).
    Returns {ok, best: {puzzleId, date, timeSeconds, user} | None}.
    """
    try:
        conn = _mysql_connect()
    except Exception:
        return {"ok": False, "best": None, "error": "db-unavailable"}

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    dr.completion_time_seconds AS time_seconds,
                    dr.challenge_date          AS challenge_date,
                    dc.level_id                AS level_id,
                    u.username                 AS username
                FROM daily_results dr
                JOIN daily_challenges dc ON dc.challenge_date = dr.challenge_date
                LEFT JOIN users u ON u.user_id = dr.user_id
                WHERE dr.completion_time_seconds > 0
                ORDER BY dr.completion_time_seconds ASC, dr.completed_at ASC
                LIMIT 1
                """
            )
            row = cur.fetchone()
    except Exception:
        return {"ok": False, "best": None, "error": "query-failed"}
    finally:
        conn.close()

    if not row:
        return {"ok": True, "best": None}

    date_val = row.get("challenge_date")
    date_iso = date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val or "")
    return {
        "ok": True,
        "best": {
            "puzzleId": str(row.get("level_id") or ""),
            "date": date_iso,
            "timeSeconds": int(row.get("time_seconds") or 0),
            "user": str(row.get("username") or ""),
        },
    }


def _iso_date(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value or "").strip()


def daily_leaderboard_for_date(
    repo_root: Path,  # noqa: ARG001
    challenge_date: str,
) -> dict[str, Any]:
    """All players' fastest daily times for one challenge date (MySQL daily_results)."""
    date_key = str(challenge_date or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_key):
        return {"ok": False, "error": "invalid-date", "rows": []}

    try:
        conn = _mysql_connect()
    except Exception:
        return {"ok": False, "error": "db-unavailable", "rows": []}

    rows: list[dict[str, Any]] = []
    level_id = ""
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT level_id FROM daily_challenges WHERE challenge_date = %s LIMIT 1",
                (date_key,),
            )
            challenge = cur.fetchone()
            level_id = str(challenge.get("level_id") or "") if challenge else ""

            cur.execute(
                """
                SELECT
                    dr.user_id                 AS user_id,
                    u.username                 AS username,
                    u.player_name              AS player_name,
                    dr.completion_time_seconds AS time_seconds,
                    dr.solution_id             AS solution_id,
                    dr.hints_used_count        AS hints_used_count,
                    dr.completed_at            AS completed_at
                FROM daily_results dr
                LEFT JOIN users u ON u.user_id = dr.user_id
                WHERE dr.challenge_date = %s
                  AND dr.completion_time_seconds > 0
                ORDER BY dr.completion_time_seconds ASC, dr.completed_at ASC
                """,
                (date_key,),
            )
            for row in cur.fetchall() or []:
                username = str(row.get("username") or "").strip()
                player_name = str(row.get("player_name") or "").strip()
                display_name = username or player_name
                user_id = row.get("user_id")
                rows.append(
                    {
                        "userId": user_id,
                        "username": display_name,
                        "completionTimeSeconds": int(row.get("time_seconds") or 0),
                        "solutionId": int(row.get("solution_id") or 0) or None,
                        "hintsUsedCount": max(0, int(row.get("hints_used_count") or 0)),
                        "levelId": level_id,
                        "challengeDate": date_key,
                        "completedAt": _iso_date(row.get("completed_at")),
                    }
                )
    except Exception:
        return {"ok": False, "error": "query-failed", "rows": []}
    finally:
        conn.close()

    return {
        "ok": True,
        "date": date_key,
        "levelId": level_id,
        "rows": rows,
    }


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
