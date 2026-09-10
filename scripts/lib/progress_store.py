"""Server-side player progress — MySQL found-solutions + JSON import fallback."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from lib.solve_match import (
    board_size_from_solves,
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


def progress_migrated_path(repo_root: Path, user_id: int | str) -> Path:
    safe = str(int(user_id))
    return progress_dir(repo_root) / f"{safe}.migrated.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _equiv_hash(equiv_key: str) -> str:
    return hashlib.sha256(str(equiv_key).encode("utf-8")).hexdigest()


def _normalize_placements(placements: list[dict] | None) -> list[dict]:
    out = []
    for p in placements or []:
        if not isinstance(p, dict):
            continue
        tile = p.get("tile")
        if isinstance(tile, dict):
            tile = tile.get("id") or tile.get("tile") or ""
        out.append(
            {
                "tile": str(tile or ""),
                "r": int(p.get("r") or 0),
                "c": int(p.get("c") or 0),
                "deg": int(p.get("deg") or 0),
            }
        )
    return out


def _parse_found_at(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    raw = str(value or "").strip()
    if not raw:
        return datetime.utcnow().replace(microsecond=0)
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        return datetime.utcnow().replace(microsecond=0)


def _found_at_iso(value: Any) -> str:
    if isinstance(value, datetime):
        return value.replace(microsecond=0).isoformat() + "+00:00"
    raw = str(value or "").strip()
    return raw or _now_iso()


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


def _load_json_file_data(repo_root: Path, user_id: int | str) -> dict[str, Any]:
    path = progress_path(repo_root, user_id)
    if not path.is_file():
        migrated = progress_migrated_path(repo_root, user_id)
        if migrated.is_file():
            path = migrated
        else:
            return {}
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    data = doc.get("data") if isinstance(doc, dict) else None
    return data if isinstance(data, dict) else {}


def _sql_progress_counts(user_id: int) -> tuple[int, bool]:
    """Return (found_row_count, has_meta)."""
    try:
        conn = _mysql_connect()
    except Exception:
        return 0, False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM user_found_solutions WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone() or {}
            n = int(row.get("n") or 0)
            cur.execute(
                "SELECT 1 AS ok FROM user_progress_meta WHERE user_id = %s LIMIT 1",
                (user_id,),
            )
            has_meta = bool(cur.fetchone())
            return n, has_meta
    except Exception:
        return 0, False
    finally:
        conn.close()


def _row_to_found_entry(row: dict[str, Any]) -> dict[str, Any]:
    placements = row.get("placements_json")
    if isinstance(placements, str):
        try:
            placements = json.loads(placements)
        except json.JSONDecodeError:
            placements = []
    if not isinstance(placements, list):
        placements = []
    index = row.get("solution_index")
    if index is not None:
        try:
            index = int(index)
        except (TypeError, ValueError):
            index = None
    sec = max(0, int(row.get("completion_time_seconds") or 0))
    hints = max(0, int(row.get("hints_used_count") or 0))
    # Null-index rows with placements are pending rematch — never expose as bonus
    # or the client under-counts "N of total".
    is_bonus = bool(row.get("is_bonus")) and index is None and not placements
    return {
        "index": index,
        "placements": _normalize_placements(placements),
        "bonus": is_bonus,
        "elapsedMs": sec * 1000,
        "completionTimeSeconds": sec,
        "hintsUsed": hints > 0,
        "hintsUsedCount": hints,
        "exampleRouteViewed": bool(row.get("example_route_viewed")),
        "leaderboardSubmitted": bool(row.get("leaderboard_submitted")),
        "foundAt": _found_at_iso(row.get("found_at")),
    }


def _assemble_progress_from_sql(user_id: int) -> dict[str, Any]:
    try:
        conn = _mysql_connect()
    except Exception:
        return {}
    data: dict[str, Any] = {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level_id, solution_index, is_bonus, placements_json,
                       completion_time_seconds, hints_used_count,
                       example_route_viewed, leaderboard_submitted, found_at
                FROM user_found_solutions
                WHERE user_id = %s
                ORDER BY found_at ASC, found_id ASC
                """,
                (user_id,),
            )
            for row in cur.fetchall() or []:
                level_id = str(row.get("level_id") or "").strip()
                if not level_id:
                    continue
                entry = data.setdefault(level_id, {"found": []})
                entry.setdefault("found", []).append(_row_to_found_entry(row))

            cur.execute(
                "SELECT meta_json FROM user_progress_meta WHERE user_id = %s LIMIT 1",
                (user_id,),
            )
            meta_row = cur.fetchone()
            if meta_row and meta_row.get("meta_json") is not None:
                meta = meta_row["meta_json"]
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except json.JSONDecodeError:
                        meta = {}
                if isinstance(meta, dict):
                    for key, value in meta.items():
                        if key == "levels" and isinstance(value, dict):
                            for level_id, level_meta in value.items():
                                if not isinstance(level_meta, dict):
                                    continue
                                entry = data.setdefault(str(level_id), {"found": []})
                                for mk, mv in level_meta.items():
                                    if mk == "found":
                                        continue
                                    entry[mk] = mv
                        elif str(key).startswith("_"):
                            data[str(key)] = value
    except Exception:
        return {}
    finally:
        conn.close()
    return data


def _extract_meta_blob(progress_data: dict[str, Any]) -> dict[str, Any]:
    meta: dict[str, Any] = {"levels": {}}
    for key, value in (progress_data or {}).items():
        if str(key).startswith("_"):
            meta[str(key)] = value
            continue
        if not isinstance(value, dict):
            continue
        level_meta = {k: v for k, v in value.items() if k != "found"}
        if level_meta:
            meta["levels"][str(key)] = level_meta
    if not meta["levels"]:
        meta.pop("levels", None)
    return meta


def _upsert_found_entry_sql(
    cur,
    user_id: int,
    level_id: str,
    entry: dict[str, Any],
) -> bool:
    """Insert found row if new. Returns True when a row was inserted."""
    placements = _normalize_placements(entry.get("placements") or [])
    rows, cols = parse_board_size(level_id)
    equiv = equivalence_key(placements, rows, cols) if placements else _found_entry_key(level_id, entry)
    equiv_h = _equiv_hash(equiv)
    index = entry.get("index")
    try:
        index_i = int(index) if index is not None else None
    except (TypeError, ValueError):
        index_i = None
    # Do not force bonus just because index is missing — those are pending rematch.
    is_bonus = bool(entry.get("bonus"))
    sec = max(0, int(entry.get("completionTimeSeconds") or 0))
    hints = entry.get("hintsUsedCount")
    if hints is None:
        hints = 1 if entry.get("hintsUsed") else 0
    hints = max(0, int(hints or 0))
    found_at = _parse_found_at(entry.get("foundAt"))
    cur.execute(
        """
        INSERT IGNORE INTO user_found_solutions (
            user_id, level_id, solution_index, is_bonus, equiv_hash,
            placements_json, completion_time_seconds, hints_used_count,
            example_route_viewed, leaderboard_submitted, found_at
        ) VALUES (%s, %s, %s, %s, %s, CAST(%s AS JSON), %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            level_id,
            index_i,
            1 if is_bonus else 0,
            equiv_h,
            json.dumps(placements, separators=(",", ":")),
            sec,
            hints,
            1 if entry.get("exampleRouteViewed") else 0,
            1 if entry.get("leaderboardSubmitted") else 0,
            found_at,
        ),
    )
    return cur.rowcount > 0


def _update_found_index_sql(
    cur,
    user_id: int,
    level_id: str,
    entry: dict[str, Any],
) -> None:
    placements = _normalize_placements(entry.get("placements") or [])
    rows, cols = parse_board_size(level_id)
    if not placements:
        return
    equiv_h = _equiv_hash(equivalence_key(placements, rows, cols))
    index = entry.get("index")
    try:
        index_i = int(index) if index is not None else None
    except (TypeError, ValueError):
        index_i = None
    cur.execute(
        """
        UPDATE user_found_solutions
        SET solution_index = %s, is_bonus = %s
        WHERE user_id = %s AND level_id = %s AND equiv_hash = %s
        """,
        (
            index_i,
            1 if (entry.get("bonus") or index_i is None) else 0,
            user_id,
            level_id,
            equiv_h,
        ),
    )


def _write_progress_meta_sql(cur, user_id: int, progress_data: dict[str, Any]) -> None:
    meta = _extract_meta_blob(progress_data)
    cur.execute(
        """
        INSERT INTO user_progress_meta (user_id, meta_json)
        VALUES (%s, CAST(%s AS JSON))
        ON DUPLICATE KEY UPDATE meta_json = VALUES(meta_json)
        """,
        (user_id, json.dumps(meta, separators=(",", ":"))),
    )


def import_progress_blob_to_sql(
    repo_root: Path,  # noqa: ARG001
    user_id: int | str,
    progress_data: dict[str, Any],
) -> dict[str, Any]:
    """Upsert a progress blob into MySQL. Idempotent on equivalence hash."""
    if not isinstance(progress_data, dict):
        return {"ok": False, "error": "data must be an object", "inserted": 0}
    uid = int(user_id)
    inserted = 0
    try:
        conn = _mysql_connect()
    except Exception:
        return {"ok": False, "error": "db-unavailable", "inserted": 0}
    try:
        with conn.cursor() as cur:
            for level_id, entry in progress_data.items():
                if str(level_id).startswith("_") or not isinstance(entry, dict):
                    continue
                for f in entry.get("found") or []:
                    if not isinstance(f, dict):
                        continue
                    if _upsert_found_entry_sql(cur, uid, str(level_id), f):
                        inserted += 1
            _write_progress_meta_sql(cur, uid, progress_data)
        conn.commit()
    except Exception as err:
        conn.rollback()
        return {"ok": False, "error": str(err), "inserted": 0}
    finally:
        conn.close()
    return {"ok": True, "inserted": inserted}


def _rename_json_to_migrated(repo_root: Path, user_id: int | str) -> None:
    src = progress_path(repo_root, user_id)
    if not src.is_file():
        return
    dest = progress_migrated_path(repo_root, user_id)
    try:
        if dest.is_file():
            dest.unlink()
        src.rename(dest)
    except OSError:
        pass


def load_progress(repo_root: Path, user_id: int | str) -> dict[str, Any]:
    """Load progress assembled from MySQL; import JSON once if SQL empty."""
    uid = int(user_id)
    n, has_meta = _sql_progress_counts(uid)
    if n > 0 or has_meta:
        return _assemble_progress_from_sql(uid)

    file_data = _load_json_file_data(repo_root, user_id)
    if not file_data:
        return {}

    imported = import_progress_blob_to_sql(repo_root, uid, file_data)
    if imported.get("ok"):
        repaired = repair_found_catalog_indices(repo_root, file_data)
        # Persist any index repairs discovered during import.
        try:
            conn = _mysql_connect()
            with conn.cursor() as cur:
                for level_id, entry in repaired.items():
                    if str(level_id).startswith("_") or not isinstance(entry, dict):
                        continue
                    for f in entry.get("found") or []:
                        if isinstance(f, dict) and f.get("index") is not None:
                            _update_found_index_sql(cur, uid, str(level_id), f)
            conn.commit()
            conn.close()
        except Exception:
            pass
        if progress_path(repo_root, uid).is_file():
            _rename_json_to_migrated(repo_root, uid)
        data = _assemble_progress_from_sql(uid)
        if data:
            rebuild_mysql_from_progress(repo_root, uid, data)
        return data

    # DB tables missing / unavailable — fall back to file for this request.
    return file_data


def save_progress(repo_root: Path, user_id: int | str, data: dict[str, Any]) -> None:
    """Persist progress blob to MySQL (authoritative). Does not write JSON."""
    if not isinstance(data, dict):
        return
    uid = int(user_id)
    import_progress_blob_to_sql(repo_root, uid, data)
    # Apply index fields that may have been repaired in-memory.
    try:
        conn = _mysql_connect()
        with conn.cursor() as cur:
            for level_id, entry in data.items():
                if str(level_id).startswith("_") or not isinstance(entry, dict):
                    continue
                for f in entry.get("found") or []:
                    if isinstance(f, dict):
                        _update_found_index_sql(cur, uid, str(level_id), f)
            _write_progress_meta_sql(cur, uid, data)
        conn.commit()
        conn.close()
    except Exception:
        pass


def _count_catalog_solutions(found: list[dict]) -> int:
    return sum(1 for f in found if not f.get("bonus") and f.get("index") is not None)


def _best_time_seconds(found: list[dict]) -> Optional[int]:
    times = [
        int(f.get("completionTimeSeconds") or 0)
        for f in found
        if int(f.get("completionTimeSeconds") or 0) > 0
    ]
    return min(times) if times else None


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


def _adventure_cleared_count_from_sql(cur, user_id: int) -> int:
    """Count cleared adventure puzzles from SQL finds only (no full progress blob)."""
    cur.execute(
        """
        SELECT
            ap.level_id,
            ap.is_challenge,
            COALESCE(l.total_unique_solutions, 1) AS total_known,
            COUNT(ufs.found_id) AS find_count,
            SUM(
                CASE
                    WHEN ufs.is_bonus = 0 AND ufs.solution_index IS NOT NULL THEN 1
                    ELSE 0
                END
            ) AS catalog_count
        FROM adventure_puzzle ap
        LEFT JOIN levels l ON l.level_id = ap.level_id
        LEFT JOIN user_found_solutions ufs
            ON ufs.user_id = %s AND ufs.level_id = ap.level_id
        GROUP BY ap.level_id, ap.is_challenge, COALESCE(l.total_unique_solutions, 1)
        """,
        (user_id,),
    )
    cleared = 0
    for row in cur.fetchall() or []:
        is_challenge = bool(row.get("is_challenge"))
        total_known = int(row.get("total_known") or 1)
        find_count = int(row.get("find_count") or 0)
        catalog_count = int(row.get("catalog_count") or 0)
        if not find_count:
            continue
        if not is_challenge:
            cleared += 1
        elif catalog_count >= max(total_known, 1):
            cleared += 1
    return cleared


def _load_level_found_from_sql(cur, user_id: int, level_id: str) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT level_id, solution_index, is_bonus, placements_json,
               completion_time_seconds, hints_used_count,
               example_route_viewed, leaderboard_submitted, found_at
        FROM user_found_solutions
        WHERE user_id = %s AND level_id = %s
        ORDER BY found_at ASC, found_id ASC
        """,
        (user_id, level_id),
    )
    return [_row_to_found_entry(row) for row in (cur.fetchall() or [])]


def _upsert_level_summary_sql(
    cur,
    user_id: int,
    level_id: str,
    found: list[dict[str, Any]],
) -> None:
    """Update discovery + level progress for one level only."""
    now = datetime.now().replace(microsecond=0)
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


def _player_adventure_rank(cur, user_id: int) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT pp.current_rank_id AS rank_id,
               pp.current_sub_level AS sub_level,
               ar.rank_name AS rank_name
        FROM player_progress pp
        LEFT JOIN adventure_rank ar ON ar.rank_id = pp.current_rank_id
        WHERE pp.player_id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    rank_id = int(row.get("rank_id") or 0)
    sub_level = max(1, int(row.get("sub_level") or 1))
    if rank_id <= 0:
        return None
    rank_name = str(row.get("rank_name") or "").strip() or None
    return {"rankId": rank_id, "subLevel": sub_level, "rankName": rank_name}


def _refresh_player_progress_sql(cur, user_id: int) -> None:
    total_solved = _adventure_cleared_count_from_sql(cur, user_id)
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
    """Sync MySQL summary tables from a full progress blob (migrate/import only)."""
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


def sync_mysql_after_solve(
    repo_root: Path,  # noqa: ARG001
    user_id: int,
    progress_data: Optional[dict[str, Any]] = None,  # noqa: ARG001 — kept for call-site compat
    *,
    level_id: str,
    index: Optional[int],
    bonus: bool,
    completion_time_seconds: int,
    challenge_date: Optional[str] = None,
    leaderboard_saved: bool = False,
    hints_used_count: int = 0,
    conn=None,
) -> None:
    """Update summary tables for this level only — never rebuild the whole journal."""
    owns_conn = conn is None
    if owns_conn:
        try:
            conn = _mysql_connect()
        except Exception:
            return

    hint_count = max(0, int(hints_used_count or 0))
    try:
        with conn.cursor() as cur:
            found = _load_level_found_from_sql(cur, user_id, level_id)
            _upsert_level_summary_sql(cur, user_id, level_id, found)
            _refresh_player_progress_sql(cur, user_id)

            if leaderboard_saved and challenge_date and not bonus:
                solution_id = (int(index) + 1) if index is not None else 1
                now = datetime.now().replace(microsecond=0)
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
                        solution_id,
                        now,
                        hint_count,
                    ),
                )
        if owns_conn:
            conn.commit()
    except Exception:
        if owns_conn:
            conn.rollback()
    finally:
        if owns_conn:
            conn.close()


def _ensure_sql_progress_seeded(repo_root: Path, user_id: int) -> None:
    """Import JSON→SQL once if this user has no SQL rows yet. Cheap when already seeded."""
    n, has_meta = _sql_progress_counts(user_id)
    if n > 0 or has_meta:
        return
    load_progress(repo_root, user_id)


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

    uid = int(user_id)
    rows, cols = board_size_from_solves(repo_root, level_id)
    playable = playable_placements(placements)
    key_new = equivalence_key(playable, rows, cols)
    equiv_h = _equiv_hash(key_new)

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

    # One-time JSON import if needed — do not assemble the full journal on every solve.
    _ensure_sql_progress_seeded(repo_root, uid)

    known = load_solves_file(repo_root, level_id)
    client_check = meta.get("check") if isinstance(meta.get("check"), dict) else {}
    index: Optional[int] = None
    bonus = True
    client_index: Optional[int] = None
    if isinstance(client_check, dict) and client_check.get("bonus") is not True:
        raw_idx = client_check.get("index")
        if raw_idx is not None and raw_idx != "":
            try:
                client_index = int(raw_idx)
            except (TypeError, ValueError):
                client_index = None
    if known:
        index, bonus = match_catalog(playable, known, rows, cols)
    if index is None and client_index is not None:
        index, bonus = client_index, False
    elif index is None and isinstance(client_check, dict) and client_check.get("bonus") is True:
        index, bonus = None, True
    if index is None and not known and not client_check:
        index, bonus = None, True

    found_at = _now_iso()
    entry = {
        "index": index,
        "placements": _normalize_placements(placements),
        "bonus": bool(bonus),
        "elapsedMs": completion_time_seconds * 1000,
        "completionTimeSeconds": completion_time_seconds,
        "hintsUsed": hints_used_count > 0,
        "hintsUsedCount": hints_used_count,
        "exampleRouteViewed": bool(meta.get("exampleRouteViewed")),
        "leaderboardSubmitted": leaderboard_saved,
        "foundAt": found_at,
    }

    try:
        conn = _mysql_connect()
    except Exception as err:
        return {"ok": False, "error": f"sql-connect-failed: {err}"}

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT found_id, solution_index, is_bonus, found_at
                FROM user_found_solutions
                WHERE user_id = %s AND level_id = %s AND equiv_hash = %s
                LIMIT 1
                """,
                (uid, level_id, equiv_h),
            )
            existing_row = cur.fetchone()

        if existing_row:
            idx = existing_row.get("solution_index")
            if leaderboard_saved and challenge_date:
                sync_mysql_after_solve(
                    repo_root,
                    uid,
                    None,
                    level_id=level_id,
                    index=int(idx) if idx is not None else None,
                    bonus=bool(existing_row.get("is_bonus")),
                    completion_time_seconds=completion_time_seconds,
                    challenge_date=challenge_date,
                    leaderboard_saved=leaderboard_saved,
                    hints_used_count=hints_used_count,
                    conn=conn,
                )
            conn.commit()
            result: dict[str, Any] = {
                "ok": True,
                "duplicate": True,
                "index": idx,
                "bonus": bool(existing_row.get("is_bonus")),
                "foundAt": _found_at_iso(existing_row.get("found_at")),
                "completionTimeSeconds": completion_time_seconds,
                "leaderboardSubmitted": bool(leaderboard_saved and challenge_date),
            }
            if server_completion_time_seconds is not None:
                result["serverCompletionTimeSeconds"] = server_completion_time_seconds
            with conn.cursor() as cur:
                adventure_rank = _player_adventure_rank(cur, uid)
            if adventure_rank:
                result["adventureRank"] = adventure_rank
            return result

        with conn.cursor() as cur:
            _upsert_found_entry_sql(cur, uid, level_id, entry)
        sync_mysql_after_solve(
            repo_root,
            uid,
            None,
            level_id=level_id,
            index=index,
            bonus=bonus,
            completion_time_seconds=completion_time_seconds,
            challenge_date=challenge_date,
            leaderboard_saved=leaderboard_saved,
            hints_used_count=hints_used_count,
            conn=conn,
        )
        conn.commit()
    except Exception as err:
        try:
            conn.rollback()
        except Exception:
            pass
        return {"ok": False, "error": f"sql-write-failed: {err}"}
    finally:
        try:
            conn.close()
        except Exception:
            pass

    result = {
        "ok": True,
        "duplicate": False,
        "index": index,
        "bonus": bonus,
        "foundAt": found_at,
        "completionTimeSeconds": completion_time_seconds,
        "leaderboardSubmitted": bool(leaderboard_saved),
    }
    if server_completion_time_seconds is not None:
        result["serverCompletionTimeSeconds"] = server_completion_time_seconds
    client_completion_time_seconds = max(
        0, int(meta.get("completionTimeSeconds") or meta.get("elapsedSec") or 0)
    )
    if client_completion_time_seconds != completion_time_seconds:
        result["clientCompletionTimeSeconds"] = client_completion_time_seconds
    try:
        conn = _mysql_connect()
        with conn.cursor() as cur:
            adventure_rank = _player_adventure_rank(cur, uid)
        conn.close()
        if adventure_rank:
            result["adventureRank"] = adventure_rank
    except Exception:
        pass
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
    imported = import_progress_blob_to_sql(repo_root, user_id, incoming)
    if not imported.get("ok"):
        return {"ok": False, "error": imported.get("error") or "import-failed"}
    data = load_progress(repo_root, user_id)
    rebuild_mysql_from_progress(repo_root, int(user_id), data)
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
    """Merge client progress into MySQL (additive union of found solutions)."""
    if not isinstance(incoming, dict):
        return {"ok": False, "error": "data must be an object"}
    existing = load_progress(repo_root, user_id)
    merged = merge_progress_blobs(existing, incoming)
    repaired = repair_found_catalog_indices(repo_root, merged)
    save_progress(repo_root, user_id, repaired)
    data = load_progress(repo_root, user_id)
    rebuild_mysql_from_progress(repo_root, int(user_id), data)
    return {
        "ok": True,
        "merged": True,
        "data": data,
        "levels": len([k for k in data if not str(k).startswith("_")]),
        "solves": sum(
            len((v or {}).get("found") or [])
            for k, v in data.items()
            if not str(k).startswith("_") and isinstance(v, dict)
        ),
    }


def repair_found_catalog_indices(
    repo_root: Path,
    progress_data: dict[str, Any],
) -> dict[str, Any]:
    """Fill missing found[].index from catalog solves when placements match."""
    if not isinstance(progress_data, dict):
        return progress_data
    for level_id, entry in progress_data.items():
        if str(level_id).startswith("_") or not isinstance(entry, dict):
            continue
        found = entry.get("found")
        if not isinstance(found, list) or not found:
            continue
        rows, cols = board_size_from_solves(repo_root, level_id)
        if not rows or not cols:
            continue
        known = load_solves_file(repo_root, level_id)
        if not known:
            continue
        for f in found:
            if not isinstance(f, dict):
                continue
            if f.get("index") is not None and not f.get("bonus"):
                try:
                    int(f["index"])
                    continue
                except (TypeError, ValueError):
                    pass
            placements = f.get("placements") or []
            if not isinstance(placements, list) or not placements:
                continue
            playable = playable_placements(placements)
            index, bonus = match_catalog(playable, known, rows, cols)
            if index is None:
                continue
            f["index"] = index
            f["bonus"] = bool(bonus)
    return progress_data


def repair_user_progress_indices(
    repo_root: Path,
    user_id: int | str,
) -> dict[str, Any]:
    data = load_progress(repo_root, user_id)
    if not data:
        return {"ok": False, "error": "no-progress"}
    before = sum(
        1
        for k, v in data.items()
        if not str(k).startswith("_") and isinstance(v, dict)
        for f in (v.get("found") or [])
        if isinstance(f, dict) and f.get("index") is None
    )
    repaired = repair_found_catalog_indices(repo_root, data)
    after = sum(
        1
        for k, v in repaired.items()
        if not str(k).startswith("_") and isinstance(v, dict)
        for f in (v.get("found") or [])
        if isinstance(f, dict) and f.get("index") is None
    )
    save_progress(repo_root, user_id, repaired)
    data = load_progress(repo_root, user_id)
    rebuild_mysql_from_progress(repo_root, int(user_id), data)
    return {
        "ok": True,
        "repairedNullIndex": max(0, before - after),
        "remainingNullIndex": after,
        "data": data,
    }


def migrate_user_json_file(
    repo_root: Path,
    user_id: int | str,
    *,
    rename_file: bool = True,
) -> dict[str, Any]:
    """Import one user JSON (or .migrated.json) into SQL."""
    uid = int(user_id)
    file_data = _load_json_file_data(repo_root, uid)
    if not file_data:
        n, has_meta = _sql_progress_counts(uid)
        if n or has_meta:
            return {"ok": True, "skipped": True, "reason": "already-in-sql", "userId": uid}
        return {"ok": False, "error": "no-json", "userId": uid}
    repaired = repair_found_catalog_indices(repo_root, file_data)
    imported = import_progress_blob_to_sql(repo_root, uid, repaired)
    if not imported.get("ok"):
        return {"ok": False, "error": imported.get("error"), "userId": uid}
    # Persist repaired indexes.
    save_progress(repo_root, uid, repaired)
    data = load_progress(repo_root, uid)
    rebuild_mysql_from_progress(repo_root, uid, data)
    if rename_file and progress_path(repo_root, uid).is_file():
        _rename_json_to_migrated(repo_root, uid)
    return {
        "ok": True,
        "userId": uid,
        "inserted": imported.get("inserted", 0),
        "levels": len([k for k in data if not str(k).startswith("_")]),
        "solves": sum(
            len((v or {}).get("found") or [])
            for k, v in data.items()
            if not str(k).startswith("_") and isinstance(v, dict)
        ),
    }


def progress_response(repo_root: Path, user_id: int | str) -> dict[str, Any]:
    """Build GET /api/progress payload. Read-only — never repair or rewrite on poll."""
    data = load_progress(repo_root, user_id)
    updated_at = _now_iso()
    adventure_rank = None
    try:
        conn = _mysql_connect()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT updated_at FROM user_progress_meta WHERE user_id = %s LIMIT 1",
                (int(user_id),),
            )
            row = cur.fetchone()
            if row and row.get("updated_at"):
                updated_at = _found_at_iso(row["updated_at"])
            adventure_rank = _player_adventure_rank(cur, int(user_id))
        conn.close()
    except Exception:
        pass
    payload: dict[str, Any] = {"ok": True, "data": data, "updatedAt": updated_at}
    if adventure_rank:
        payload["adventureRank"] = adventure_rank
    return payload


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


def submit_daily_leaderboard_result(
    user_id: int | str,
    *,
    challenge_date: str,
    level_id: str,
    completion_time_seconds: int,
    hints_used_count: int = 0,
    solution_id: Optional[int] = None,
    solution_index: Optional[int] = None,
) -> dict[str, Any]:
    """Upsert one player's daily_results row (cross-device leaderboard source of truth).

    Used when the phone recorded a local daily time but MySQL never received it
    (failed solve sync, or solve sync ok without leaderboard_saved).
    """
    date_key = str(challenge_date or "").strip()
    level = str(level_id or "").strip().replace(".json", "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_key):
        return {"ok": False, "error": "invalid-date"}
    if not level:
        return {"ok": False, "error": "levelId required"}
    sec = max(0, int(completion_time_seconds or 0))
    if sec <= 0:
        return {"ok": False, "error": "completionTimeSeconds required"}
    hint_count = max(0, int(hints_used_count or 0))
    sid: Optional[int] = None
    if solution_id is not None and str(solution_id) != "":
        try:
            sid = max(1, int(solution_id))
        except (TypeError, ValueError):
            sid = None
    if sid is None and solution_index is not None and str(solution_index) != "":
        try:
            sid = max(1, int(solution_index) + 1)
        except (TypeError, ValueError):
            sid = None
    if sid is None:
        sid = 1

    uid = int(user_id)
    try:
        conn = _mysql_connect()
    except Exception as err:
        return {"ok": False, "error": f"sql-connect-failed: {err}"}

    now = datetime.now().replace(microsecond=0)
    try:
        with conn.cursor() as cur:
            # Prefer the scheduled daily puzzle id when known.
            cur.execute(
                "SELECT level_id FROM daily_challenges WHERE challenge_date = %s LIMIT 1",
                (date_key,),
            )
            challenge = cur.fetchone()
            scheduled = str((challenge or {}).get("level_id") or "").strip().replace(".json", "")
            if scheduled and scheduled != level:
                return {
                    "ok": False,
                    "error": "level-mismatch",
                    "expectedLevelId": scheduled,
                    "levelId": level,
                }

            cur.execute(
                """
                INSERT INTO daily_results (
                    challenge_date, user_id, completion_time_seconds,
                    solution_id, completed_at, hints_used_count
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    completion_time_seconds = IF(
                        completion_time_seconds <= 0
                        OR VALUES(completion_time_seconds) < completion_time_seconds,
                        VALUES(completion_time_seconds),
                        completion_time_seconds
                    ),
                    hints_used_count = IF(
                        completion_time_seconds <= 0
                        OR VALUES(completion_time_seconds) < completion_time_seconds,
                        VALUES(hints_used_count),
                        hints_used_count
                    ),
                    solution_id = IF(
                        completion_time_seconds <= 0
                        OR VALUES(completion_time_seconds) < completion_time_seconds,
                        VALUES(solution_id),
                        solution_id
                    )
                """,
                (date_key, uid, sec, sid, now, hint_count),
            )
            cur.execute(
                """
                SELECT completion_time_seconds AS time_seconds,
                       hints_used_count AS hints_used_count,
                       solution_id AS solution_id
                FROM daily_results
                WHERE challenge_date = %s AND user_id = %s
                LIMIT 1
                """,
                (date_key, uid),
            )
            row = cur.fetchone() or {}
        conn.commit()
    except Exception as err:
        try:
            conn.rollback()
        except Exception:
            pass
        return {"ok": False, "error": f"sql-write-failed: {err}"}
    finally:
        try:
            conn.close()
        except Exception:
            pass

    return {
        "ok": True,
        "challengeDate": date_key,
        "levelId": scheduled or level,
        "completionTimeSeconds": int(row.get("time_seconds") or sec),
        "hintsUsedCount": max(0, int(row.get("hints_used_count") or hint_count)),
        "solutionId": int(row.get("solution_id") or sid),
        "leaderboardSubmitted": True,
    }


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


def adventure_leaderboard(
    repo_root: Path,  # noqa: ARG001
) -> dict[str, Any]:
    """Cross-user adventure rankings: paths, rank/sublevel, avg time/puzzle, total hints."""
    try:
        conn = _mysql_connect()
    except Exception:
        return {"ok": False, "error": "db-unavailable", "rows": []}

    rows: list[dict[str, Any]] = []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH adventure_finds AS (
                    SELECT
                        ufs.user_id,
                        ufs.level_id,
                        ufs.completion_time_seconds,
                        ufs.hints_used_count,
                        ufs.found_at
                    FROM user_found_solutions ufs
                    INNER JOIN adventure_puzzle ap ON ap.level_id = ufs.level_id
                    WHERE ufs.is_bonus = 0
                      AND ufs.completion_time_seconds > 0
                ),
                per_level_best AS (
                    SELECT user_id, level_id, MIN(completion_time_seconds) AS best_time
                    FROM adventure_finds
                    GROUP BY user_id, level_id
                ),
                user_hints AS (
                    SELECT user_id, SUM(hints_used_count) AS total_hints
                    FROM adventure_finds
                    GROUP BY user_id
                ),
                user_avg AS (
                    SELECT user_id, ROUND(AVG(best_time)) AS avg_time_sec
                    FROM per_level_best
                    GROUP BY user_id
                ),
                last_find AS (
                    SELECT user_id, level_id, completion_time_seconds, hints_used_count,
                           ROW_NUMBER() OVER (
                               PARTITION BY user_id ORDER BY found_at DESC
                           ) AS rn
                    FROM adventure_finds
                )
                SELECT
                    pp.player_id               AS user_id,
                    u.username                 AS username,
                    u.player_name              AS player_name,
                    pp.total_levels_solved     AS paths_completed,
                    pp.current_rank_id         AS current_rank_id,
                    pp.current_sub_level       AS current_sub_level,
                    ar.rank_name               AS rank_name,
                    lf.level_id                AS last_level_id,
                    lf.completion_time_seconds AS last_time_sec,
                    COALESCE(uh.total_hints, 0) AS total_hints,
                    ua.avg_time_sec            AS avg_time_sec
                FROM player_progress pp
                LEFT JOIN users u ON u.user_id = pp.player_id
                LEFT JOIN adventure_rank ar ON ar.rank_id = pp.current_rank_id
                LEFT JOIN last_find lf ON lf.user_id = pp.player_id AND lf.rn = 1
                LEFT JOIN user_hints uh ON uh.user_id = pp.player_id
                LEFT JOIN user_avg ua ON ua.user_id = pp.player_id
                WHERE pp.total_levels_solved > 0
                ORDER BY pp.total_levels_solved DESC,
                         COALESCE(ua.avg_time_sec, lf.completion_time_seconds, 999999) ASC,
                         COALESCE(u.username, u.player_name, '') ASC
                """
            )
            for player in cur.fetchall() or []:
                uid = player.get("user_id")
                username = str(player.get("username") or "").strip()
                player_name = str(player.get("player_name") or "").strip()
                display_name = username or player_name
                paths = max(0, int(player.get("paths_completed") or 0))
                last_level = str(player.get("last_level_id") or "")
                last_time = max(0, int(player.get("last_time_sec") or 0))
                avg_time = player.get("avg_time_sec")
                avg_time = int(avg_time) if avg_time is not None else last_time
                hints = max(0, int(player.get("total_hints") or 0))
                rank_id = int(player.get("current_rank_id") or 0)
                sub_level = max(1, int(player.get("current_sub_level") or 1))
                rank_name = str(player.get("rank_name") or "").strip() or f"Rank {rank_id or '—'}"
                rows.append(
                    {
                        "userId": uid,
                        "username": display_name,
                        "pathsCompleted": paths,
                        "lastTimeSec": last_time,
                        "avgTimeSec": avg_time,
                        "completionTimeSeconds": avg_time,
                        "hintsUsedCount": hints,
                        "totalHintsUsed": hints,
                        "rankId": rank_id,
                        "rankName": rank_name,
                        "subLevel": sub_level,
                        "levelId": last_level,
                    }
                )

            # Fallback when finds table is empty but summaries exist.
            if not rows:
                cur.execute(
                    """
                    SELECT
                        pp.player_id               AS user_id,
                        u.username                 AS username,
                        u.player_name              AS player_name,
                        pp.total_levels_solved     AS paths_completed,
                        pp.current_rank_id         AS current_rank_id,
                        pp.current_sub_level       AS current_sub_level,
                        ar.rank_name               AS rank_name,
                        ulp.level_id               AS last_level_id,
                        ulp.best_time_seconds      AS last_time_sec
                    FROM player_progress pp
                    LEFT JOIN users u ON u.user_id = pp.player_id
                    LEFT JOIN adventure_rank ar ON ar.rank_id = pp.current_rank_id
                    LEFT JOIN user_level_progress ulp ON ulp.user_id = pp.player_id
                        AND ulp.completed = 1
                        AND ulp.best_time_seconds > 0
                    WHERE pp.total_levels_solved > 0
                    ORDER BY pp.total_levels_solved DESC,
                             ulp.best_time_seconds ASC,
                             COALESCE(u.username, u.player_name, '') ASC
                    """
                )
                seen: set[Any] = set()
                for player in cur.fetchall() or []:
                    uid = player.get("user_id")
                    if uid in seen:
                        continue
                    seen.add(uid)
                    username = str(player.get("username") or "").strip()
                    player_name = str(player.get("player_name") or "").strip()
                    display_name = username or player_name
                    paths = max(0, int(player.get("paths_completed") or 0))
                    last_level = str(player.get("last_level_id") or "")
                    last_time = max(0, int(player.get("last_time_sec") or 0))
                    rank_id = int(player.get("current_rank_id") or 0)
                    sub_level = max(1, int(player.get("current_sub_level") or 1))
                    rank_name = str(player.get("rank_name") or "").strip() or f"Rank {rank_id or '—'}"
                    rows.append(
                        {
                            "userId": uid,
                            "username": display_name,
                            "pathsCompleted": paths,
                            "lastTimeSec": last_time,
                            "avgTimeSec": last_time,
                            "completionTimeSeconds": last_time,
                            "hintsUsedCount": 0,
                            "totalHintsUsed": 0,
                            "rankId": rank_id,
                            "rankName": rank_name,
                            "subLevel": sub_level,
                            "levelId": last_level,
                        }
                    )
    except Exception:
        return {"ok": False, "error": "query-failed", "rows": []}
    finally:
        conn.close()

    return {"ok": True, "rows": rows}
