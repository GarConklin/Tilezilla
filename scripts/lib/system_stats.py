"""Compute and store cached global stats in tilegame.system_info."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional


def _mysql_connect(database: str):
    import pymysql  # type: ignore

    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "tilegame"),
        password=os.environ.get("MYSQL_PASSWORD", "tilegame_dev"),
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def count_registered_users(conn_words) -> int:
    with conn_words.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM users
            WHERE email_verified = 1
              AND status NOT IN ('suspended', 'expired')
            """
        )
        row = cur.fetchone() or {}
    return int(row.get("n") or 0)


def count_adventure_catalog(conn_tile) -> dict[str, int]:
    with conn_tile.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS n FROM adventure_puzzle
            """
        )
        ranked = int((cur.fetchone() or {}).get("n") or 0)
        cur.execute(
            """
            SELECT COUNT(*) AS n FROM adventure_postgame_puzzle
            """
        )
        postgame = int((cur.fetchone() or {}).get("n") or 0)
        cur.execute(
            """
            SELECT
                COALESCE(SUM(l.total_unique_solutions), 0) AS routes
            FROM (
                SELECT level_id FROM adventure_puzzle
                UNION
                SELECT level_id FROM adventure_postgame_puzzle
            ) ap
            INNER JOIN levels l ON l.level_id = ap.level_id
            """
        )
        agg = cur.fetchone() or {}
        cur.execute(
            """
            SELECT COALESCE(MAX(total_unique_solutions), 0) AS m FROM levels
            """
        )
        catalog_max = int((cur.fetchone() or {}).get("m") or 0)
        cur.execute(
            """
            SELECT COUNT(*) AS n FROM adventure_rank WHERE is_active = 1
            """
        )
        ranks = int((cur.fetchone() or {}).get("n") or 0)
        cur.execute(
            """
            SELECT COUNT(*) AS n FROM adventure_puzzle WHERE is_challenge = 1
            """
        )
        gates = int((cur.fetchone() or {}).get("n") or 0)
        cur.execute(
            """
            SELECT COUNT(*) AS n FROM adventure_postgame_puzzle WHERE is_challenge = 1
            """
        )
        gates += int((cur.fetchone() or {}).get("n") or 0)
    return {
        "total_adventure_puzzles": ranked + postgame,
        "total_known_routes": int(agg.get("routes") or 0),
        "largest_solution": catalog_max,
        "ranks_to_earn": ranks,
        "challenge_gates": gates,
    }


def sum_play_seconds(conn_tile) -> int:
    total = 0
    with conn_tile.cursor() as cur:
        for table in ("tile_profiles", "guest_users"):
            try:
                cur.execute(f"SELECT COALESCE(SUM(play_seconds), 0) AS s FROM {table}")
                row = cur.fetchone() or {}
                total += int(row.get("s") or 0)
            except Exception:
                pass
    return total


def compute_system_stats() -> dict[str, Any]:
    words_db = os.environ.get("WORDS_DB_NAME", "WordsOnline")
    stats = {
        "registered_users": 0,
        "total_play_seconds": 0,
        "total_adventure_puzzles": 0,
        "total_known_routes": 0,
        "largest_solution": 0,
        "ranks_to_earn": 0,
        "challenge_gates": 0,
    }

    conn_tile = _mysql_connect(os.environ.get("MYSQL_DATABASE", "tilegame"))
    try:
        catalog = count_adventure_catalog(conn_tile)
        stats.update(catalog)
        stats["total_play_seconds"] = sum_play_seconds(conn_tile)
    finally:
        conn_tile.close()

    try:
        conn_words = _mysql_connect(words_db)
    except Exception:
        return stats

    try:
        stats["registered_users"] = count_registered_users(conn_words)
    finally:
        conn_words.close()

    return stats


def refresh_system_stats(force: bool = False, max_age_seconds: int = 3600) -> Optional[dict[str, Any]]:
    """Recompute stats and UPDATE system_info row id=1. Returns stats dict."""
    conn = _mysql_connect(os.environ.get("MYSQL_DATABASE", "tilegame"))
    try:
        with conn.cursor() as cur:
            existing = load_stats_from_row(cur)
            if not force and existing and not stats_are_stale(existing, max_age_seconds):
                return existing

        stats = compute_system_stats()
        now = datetime.now().replace(microsecond=0)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE system_info
                SET stats_updated_at = %s,
                    registered_users = %s,
                    total_play_seconds = %s,
                    total_adventure_puzzles = %s,
                    total_known_routes = %s,
                    largest_solution = %s,
                    ranks_to_earn = %s,
                    challenge_gates = %s
                WHERE id = 1
                """,
                (
                    now,
                    stats["registered_users"],
                    stats["total_play_seconds"],
                    stats["total_adventure_puzzles"],
                    stats["total_known_routes"],
                    stats["largest_solution"],
                    stats["ranks_to_earn"],
                    stats["challenge_gates"],
                ),
            )
        conn.commit()
        stats["stats_updated_at"] = now.isoformat(sep=" ", timespec="seconds")
        return normalize_stats(stats)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def load_stats_from_row(cur) -> Optional[dict[str, Any]]:
    cur.execute(
        """
        SELECT
            stats_updated_at,
            registered_users,
            total_play_seconds,
            total_adventure_puzzles,
            total_known_routes,
            largest_solution,
            ranks_to_earn,
            challenge_gates
        FROM system_info
        WHERE id = 1
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        return None
    return normalize_stats(row)


def load_system_stats_from_mysql() -> Optional[dict[str, Any]]:
    try:
        conn = _mysql_connect(os.environ.get("MYSQL_DATABASE", "tilegame"))
    except Exception:
        return None
    try:
        with conn.cursor() as cur:
            return load_stats_from_row(cur)
    except Exception:
        return None
    finally:
        conn.close()


def normalize_stats(raw: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not raw:
        return None
    updated = raw.get("stats_updated_at") or raw.get("statsUpdatedAt")
    if hasattr(updated, "isoformat"):
        updated = updated.isoformat(sep=" ", timespec="seconds")
    return {
        "statsUpdatedAt": str(updated or "").strip(),
        "registeredUsers": int(raw.get("registered_users") or raw.get("registeredUsers") or 0),
        "totalPlaySeconds": int(raw.get("total_play_seconds") or raw.get("totalPlaySeconds") or 0),
        "totalAdventurePuzzles": int(
            raw.get("total_adventure_puzzles") or raw.get("totalAdventurePuzzles") or 0
        ),
        "totalKnownRoutes": int(raw.get("total_known_routes") or raw.get("totalKnownRoutes") or 0),
        "largestSolution": int(raw.get("largest_solution") or raw.get("largestSolution") or 0),
        "ranksToEarn": int(raw.get("ranks_to_earn") or raw.get("ranksToEarn") or 0),
        "challengeGates": int(raw.get("challenge_gates") or raw.get("challengeGates") or 0),
    }


def stats_are_stale(stats: Optional[dict[str, Any]], max_age_seconds: int = 3600) -> bool:
    if not stats or not stats.get("statsUpdatedAt"):
        return True
    try:
        raw = str(stats["statsUpdatedAt"]).replace("T", " ")
        updated = datetime.fromisoformat(raw)
        age = datetime.now() - updated
        return age.total_seconds() >= max_age_seconds
    except ValueError:
        return True
