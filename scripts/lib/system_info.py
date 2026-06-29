"""Load application system metadata for the hamburger menu."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional


def normalize_system_info(raw: Optional[dict]) -> Optional[dict]:
    if not raw or not isinstance(raw, dict):
        return None
    version = str(raw.get("version") or "").strip()
    if not version:
        return None
    logout_redirect = str(
        raw.get("logoutRedirectUrl") or raw.get("logout_redirect_url") or ""
    ).strip()
    extra = raw.get("extra")
    if not logout_redirect and isinstance(extra, dict):
        logout_redirect = str(
            extra.get("logoutRedirectUrl") or extra.get("logout_redirect_url") or ""
        ).strip()
    if not logout_redirect:
        logout_redirect = "https://www.skifflakegames.com/"
    return {
        "schema": "system-info-v1",
        "version": version,
        "lastUpdated": str(raw.get("lastUpdated") or raw.get("last_updated") or "").strip(),
        "creator": str(raw.get("creator") or "").strip(),
        "creationDate": str(raw.get("creationDate") or raw.get("creation_date") or "").strip(),
        "productName": str(raw.get("productName") or raw.get("product_name") or "Tilezilla").strip(),
        "environment": str(raw.get("environment") or "").strip(),
        "logoutRedirectUrl": logout_redirect,
    }


def load_system_info_from_json(repo_root: Path) -> Optional[dict]:
    path_file = repo_root / "data" / "system_info.json"
    if not path_file.is_file():
        return None
    try:
        doc = json.loads(path_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    info = normalize_system_info(doc)
    if not info:
        return None
    stats_raw = doc.get("stats")
    if isinstance(stats_raw, dict):
        try:
            from lib.system_stats import normalize_stats

            stats = normalize_stats(stats_raw)
            if stats:
                info["stats"] = stats
        except Exception:
            pass
    return info


def load_system_info_from_mysql(repo_root: Path) -> Optional[dict]:  # noqa: ARG001
    try:
        import pymysql  # type: ignore
    except ImportError:
        return None

    import os

    try:
        conn = pymysql.connect(
            host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
            port=int(os.environ.get("MYSQL_PORT", "3306")),
            user=os.environ.get("MYSQL_USER", "tilegame"),
            password=os.environ.get("MYSQL_PASSWORD", "tilegame_dev"),
            database=os.environ.get("MYSQL_DATABASE", "tilegame"),
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
    except Exception:
        return None

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    version,
                    last_updated,
                    creator,
                    creation_date,
                    product_name,
                    environment,
                    extra_json,
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
        info = normalize_system_info(
            {
                "version": row.get("version"),
                "lastUpdated": _format_mysql_date(row.get("last_updated")),
                "creator": row.get("creator"),
                "creationDate": row.get("creation_date"),
                "productName": row.get("product_name"),
                "environment": row.get("environment"),
            }
        )
        if info and row.get("extra_json"):
            extra = _parse_extra_json(row["extra_json"])
            if extra:
                info["extra"] = extra
                if extra.get("logoutRedirectUrl") and not info.get("logoutRedirectUrl"):
                    info["logoutRedirectUrl"] = str(extra["logoutRedirectUrl"]).strip()
        if info:
            try:
                from lib.system_stats import normalize_stats

                stats = normalize_stats(row)
                if stats:
                    info["stats"] = _merge_stats_with_json_fallback(repo_root, stats)
            except Exception:
                pass
        return info
    except Exception:
        return None
    finally:
        conn.close()


def _merge_stats_with_json_fallback(repo_root: Path, mysql_stats: dict) -> dict:
    """Fill zero MySQL cache fields from data/system_info.json (dev / pre-refresh)."""
    if not mysql_stats:
        return mysql_stats
    json_info = load_system_info_from_json(repo_root)
    file_stats = (json_info or {}).get("stats")
    if not isinstance(file_stats, dict):
        return mysql_stats
    merged = dict(mysql_stats)
    for key in (
        "registeredUsers",
        "totalPlaySeconds",
        "totalAdventurePuzzles",
        "totalKnownRoutes",
        "largestSolution",
        "ranksToEarn",
        "challengeGates",
    ):
        if int(merged.get(key) or 0) > 0:
            continue
        fallback = int(file_stats.get(key) or 0)
        if fallback > 0:
            merged[key] = fallback
    return merged


def _format_mysql_date(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _parse_extra_json(value: Any) -> Optional[dict]:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8")
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None
