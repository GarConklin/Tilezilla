#!/usr/bin/env python3
"""Minimal dev server for the tile puzzle web app.

Serves:
- /data/* and /solves/* from repo root
- everything else from /web (so / maps to /web/index.html)
"""

from __future__ import annotations

import gzip
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
SCRIPTS = ROOT / "scripts"
# Default 8081 avoids Docker Desktop binding host port 8080 (docker-compose web service).
PORT = int(os.environ.get("PORT", "8081"))
# Proxy /auth/* to PHP auth (nginx remote-test gateway does the same rewrite).
AUTH_UPSTREAM = os.environ.get("AUTH_UPSTREAM", "http://php-auth").rstrip("/")
_AUTH_HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
    }
)
_AUTH_FORWARD_REQUEST_HEADERS = frozenset({"content-type", "cookie", "accept"})
SUBLEVEL_LAYOUT_PATH = ROOT / "data" / "sublevel_icon_layout.json"
DISCOVERY_LAYOUT_PATH = ROOT / "data" / "discovery_record_layout.json"
MENU_LAYOUT_PATH = ROOT / "data" / "menu_layout.json"
BOTTOM_NAV_LAYOUT_PATH = ROOT / "data" / "bottom_nav_layout.json"
PREVIEW_LAYOUT_PATH = ROOT / "data" / "preview_layout.json"
PREVIEW_V2_LAYOUT_PATH = ROOT / "data" / "preview_v2_layout.json"
HINT_V2_LAYOUT_PATH = ROOT / "data" / "hint_v2_layout.json"
USER_DATA_V2_LAYOUT_PATH = ROOT / "data" / "user_data_v2_layout.json"
GAME_DATA_V2_LAYOUT_PATH = ROOT / "data" / "game_data_v2_layout.json"
INFO_DATA_V2_LAYOUT_PATH = ROOT / "data" / "info_data_v2_layout.json"
TIMER_DATA_V2_LAYOUT_PATH = ROOT / "data" / "timer_data_v2_layout.json"
STUCK_REVEAL_LAYOUT_PATH = ROOT / "data" / "stuck_reveal_layout.json"
PUZZLE_INFO_LAYOUT_PATH = ROOT / "data" / "puzzle_info_layout.json"
HINT_RULES_LAYOUT_PATH = ROOT / "data" / "hint_rules_layout.json"
JOURNAL_LAYOUT_PATH = ROOT / "data" / "journal_layout.json"
TILEBAG_LAYOUT_PATH = ROOT / "data" / "tilebag_layout.json"
TILEBAG_V2_LAYOUT_PATH = ROOT / "data" / "tilebag_v2_layout.json"
RANDOM_POPUP_LAYOUT_PATH = ROOT / "data" / "random_popup_layout.json"
GUEST_LOGIN_REQUIRED_LAYOUT_PATH = ROOT / "data" / "guest_login_required_layout.json"
REVISIT_LAYOUT_PATH = ROOT / "data" / "revisit_layout.json"
LOAD_SCREEN_LAYOUT_PATH = ROOT / "data" / "load_screen_layout.json"
AUTH_SCREEN_LAYOUT_PATH = ROOT / "data" / "auth_screen_layout.json"
AUTH_ERROR_LAYOUT_PATH = ROOT / "data" / "auth_error_layout.json"
CHALLENGE_BEGIN_LAYOUT_PATH = ROOT / "data" / "challenge_begin_layout.json"
MAIN_SCREEN_V2_LAYOUT_PATH = ROOT / "data" / "main_screen_v2_layout.json"
LAYOUT_KEYS = ("h", "nudgeX", "nudgeY", "wScale")
DISCOVERY_TEXT_KEYS = ("x", "y", "nudgeX", "nudgeY", "fontScale")
DISCOVERY_BTN_KEYS = ("x", "y", "nudgeX", "nudgeY", "w", "h", "wScale", "hScale")
DISCOVERY_COPY_KEYS = ("duplicateNote", "duplicateTitle")
DISCOVERY_ITEM_KEYS = (
    "solutionTotal",
    "note",
    "puzzleId",
    "solutionFound",
    "time",
    "tokens",
    "btnContinue",
    "btnAdvance",
    "btnViewFound",
    "btnBook",
)


import sys

sys.path.insert(0, str(SCRIPTS))
from lib.adventure_path_build import (  # noqa: E402
    load_adventure_path_from_json,
    load_adventure_path_from_mysql,
)
from lib.system_info import (  # noqa: E402
    load_system_info_from_json,
    load_system_info_from_mysql,
)


def adventure_path_api_response() -> tuple[int, dict]:
    path = load_adventure_path_from_mysql(ROOT)
    if path and path.get("flat"):
        return 200, {"ok": True, "source": "mysql", "path": path}

    path = load_adventure_path_from_json(ROOT)
    if path and path.get("flat"):
        return 200, {"ok": True, "source": "json", "path": path}

    return 200, {
        "ok": False,
        "error": "Adventure path not available",
        "hint": "Add data/adventure_path.json or configure MySQL / run import-adventure-map.py",
    }


def system_info_api_response() -> tuple[int, dict]:
    info = load_system_info_from_mysql(ROOT)
    if info:
        return 200, {"ok": True, "source": "mysql", "info": info}

    info = load_system_info_from_json(ROOT)
    if info:
        return 200, {"ok": True, "source": "json", "info": info}

    return 200, {
        "ok": False,
        "error": "System info not available",
        "hint": "Add data/system_info.json or seed the system_info MySQL table",
    }


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        req = unquote(parsed.path)

        # Production entry — guest welcome (legacy sandbox at /sandbox.html)
        if req in ("", "/"):
            target = WEB / "index.html"
        # Repo-root data consumed by app fetch() calls
        elif req.startswith("/data/") or req.startswith("/solves/"):
            target = ROOT / req.lstrip("/")
        # Shared artwork + tile PNGs live in /img at repo root
        elif req.startswith("/img/"):
            rel = req[len("/img/") :]
            target = ROOT / "img" / rel
            if not target.exists():
                target = ROOT / "img" / "Stuff" / rel
            if not target.exists():
                target = WEB / "img" / rel
        # Frontend assets as if /web were web root
        else:
            target = WEB / req.lstrip("/")

        # Fall back to web index for unknown app paths only (never for assets).
        if (
            not target.exists()
            and not req.startswith("/data/")
            and not req.startswith("/solves/")
            and not req.startswith("/img/")
        ):
            target = WEB / "index.html"

        return str(target)

    def end_headers(self) -> None:
        # Avoid stale JSON/assets while editing.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _proxy_auth_request(self, method: str) -> bool:
        parsed = urlparse(self.path)
        req_path = unquote(parsed.path)
        if not req_path.startswith("/auth/"):
            return False
        if not AUTH_UPSTREAM:
            self.send_error(503, "Auth proxy disabled (AUTH_UPSTREAM not set)")
            return True

        upstream_path = req_path[len("/auth") :] or "/"
        if parsed.query:
            upstream_path += "?" + parsed.query
        url = AUTH_UPSTREAM + upstream_path

        length = int(self.headers.get("Content-Length", "0") or "0")
        body = (
            self.rfile.read(length)
            if length > 0 and method in ("POST", "PUT", "PATCH")
            else None
        )

        headers = {
            key: val
            for key, val in self.headers.items()
            if key.lower() in _AUTH_FORWARD_REQUEST_HEADERS
        }

        req = Request(url, data=body, headers=headers, method=method)
        try:
            with urlopen(req, timeout=30) as resp:
                self.send_response(resp.status)
                for key in resp.headers:
                    if key.lower() in _AUTH_HOP_BY_HOP:
                        continue
                    self.send_header(key, resp.headers[key])
                self.end_headers()
                self.wfile.write(resp.read())
        except HTTPError as exc:
            self.send_response(exc.code)
            for key in exc.headers:
                if key.lower() in _AUTH_HOP_BY_HOP:
                    continue
                self.send_header(key, exc.headers[key])
            self.end_headers()
            err_body = exc.read()
            if err_body:
                self.wfile.write(err_body)
        except URLError as exc:
            self.send_error(
                502,
                f"Auth service unavailable ({exc.reason}). "
                "Start php-auth (remote-test stack or docker-compose.remote-test.yml).",
            )
        return True

    def _send_gzip_file(self, file_path: Path) -> bool:
        if not file_path.is_file():
            return False
        accept = self.headers.get("Accept-Encoding", "")
        if "gzip" not in accept.lower():
            return False
        try:
            raw = file_path.read_bytes()
        except OSError:
            return False
        if len(raw) < 2048:
            return False
        body = gzip.compress(raw, compresslevel=6)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Vary", "Accept-Encoding")
        self.end_headers()
        self.wfile.write(body)
        return True

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        req_path = unquote(parsed.path)
        if req_path.startswith("/auth/"):
            if self._proxy_auth_request("GET"):
                return
        if req_path.startswith(("/data/", "/solves/")) and req_path.endswith(".json"):
            if self._send_gzip_file(Path(self.translate_path(req_path))):
                return
        if parsed.path == "/api/adventure/path":
            status, payload = adventure_path_api_response()
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/system-info":
            status, payload = system_info_api_response()
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-sublevel-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/sublevel_icon_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-discovery-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/discovery_record_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-menu-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/menu_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-bottom-nav-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/bottom_nav_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-preview-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/preview_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-preview-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/preview_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-hint-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/hint_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-user-data-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/user_data_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-game-data-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/game_data_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-info-data-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/info_data_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-timer-data-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/timer_data_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-stuck-reveal-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/stuck_reveal_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-puzzle-info-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/puzzle_info_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-hint-rules-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/hint_rules_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-journal-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/journal_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-tilebag-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/tilebag_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-tilebag-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/tilebag_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-random-popup-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/random_popup_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-guest-login-required-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/guest_login_required_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-revisit-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/revisit_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-load-screen-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/load_screen_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-auth-screen-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/auth_screen_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-auth-error-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/auth_error_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-challenge-begin-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/challenge_begin_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/dev/save-main-screen-v2-layout":
            body = json.dumps(
                {"ok": True, "writable": True, "path": "data/main_screen_v2_layout.json"}
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/auth/"):
            if self._proxy_auth_request("POST"):
                return
        if parsed.path == "/api/guest/event":
            self._log_guest_event(parsed)
            return
        if parsed.path == "/api/dev/save-sublevel-layout":
            self._save_json_layout(parsed, SUBLEVEL_LAYOUT_PATH, validate_sublevel_layout)
            return
        if parsed.path == "/api/dev/save-discovery-layout":
            self._save_json_layout(parsed, DISCOVERY_LAYOUT_PATH, validate_discovery_layout)
            return
        if parsed.path == "/api/dev/save-menu-layout":
            self._save_json_layout(parsed, MENU_LAYOUT_PATH, validate_menu_layout)
            return
        if parsed.path == "/api/dev/save-bottom-nav-layout":
            self._save_json_layout(parsed, BOTTOM_NAV_LAYOUT_PATH, validate_bottom_nav_layout)
            return
        if parsed.path == "/api/dev/save-preview-layout":
            self._save_json_layout(parsed, PREVIEW_LAYOUT_PATH, validate_preview_layout)
            return
        if parsed.path == "/api/dev/save-preview-v2-layout":
            self._save_json_layout(parsed, PREVIEW_V2_LAYOUT_PATH, validate_preview_v2_layout)
            return
        if parsed.path == "/api/dev/save-hint-v2-layout":
            self._save_json_layout(parsed, HINT_V2_LAYOUT_PATH, validate_hint_v2_layout)
            return
        if parsed.path == "/api/dev/save-user-data-v2-layout":
            self._save_json_layout(parsed, USER_DATA_V2_LAYOUT_PATH, validate_preview_v2_data_sublayout)
            return
        if parsed.path == "/api/dev/save-game-data-v2-layout":
            self._save_json_layout(parsed, GAME_DATA_V2_LAYOUT_PATH, validate_preview_v2_data_sublayout)
            return
        if parsed.path == "/api/dev/save-info-data-v2-layout":
            self._save_json_layout(parsed, INFO_DATA_V2_LAYOUT_PATH, validate_preview_v2_data_sublayout)
            return
        if parsed.path == "/api/dev/save-timer-data-v2-layout":
            self._save_json_layout(parsed, TIMER_DATA_V2_LAYOUT_PATH, validate_preview_v2_data_sublayout)
            return
        if parsed.path == "/api/dev/save-stuck-reveal-layout":
            self._save_json_layout(parsed, STUCK_REVEAL_LAYOUT_PATH, validate_stuck_reveal_layout)
            return
        if parsed.path == "/api/dev/save-puzzle-info-layout":
            self._save_json_layout(parsed, PUZZLE_INFO_LAYOUT_PATH, validate_puzzle_info_layout)
            return
        if parsed.path == "/api/dev/save-hint-rules-layout":
            self._save_json_layout(parsed, HINT_RULES_LAYOUT_PATH, validate_hint_rules_layout)
            return
        if parsed.path == "/api/dev/save-journal-layout":
            self._save_json_layout(parsed, JOURNAL_LAYOUT_PATH, validate_journal_layout)
            return
        if parsed.path == "/api/dev/save-tilebag-layout":
            self._save_json_layout(parsed, TILEBAG_LAYOUT_PATH, validate_tilebag_layout)
            return
        if parsed.path == "/api/dev/save-tilebag-v2-layout":
            self._save_json_layout(parsed, TILEBAG_V2_LAYOUT_PATH, validate_tilebag_v2_layout)
            return
        if parsed.path == "/api/dev/save-random-popup-layout":
            self._save_json_layout(parsed, RANDOM_POPUP_LAYOUT_PATH, validate_random_popup_layout)
            return
        if parsed.path == "/api/dev/save-guest-login-required-layout":
            self._save_json_layout(
                parsed, GUEST_LOGIN_REQUIRED_LAYOUT_PATH, validate_guest_login_required_layout
            )
            return
        if parsed.path == "/api/dev/save-revisit-layout":
            self._save_json_layout(parsed, REVISIT_LAYOUT_PATH, validate_revisit_layout)
            return
        if parsed.path == "/api/dev/save-load-screen-layout":
            self._save_json_layout(parsed, LOAD_SCREEN_LAYOUT_PATH, validate_load_screen_layout)
            return
        if parsed.path == "/api/dev/save-auth-screen-layout":
            self._save_json_layout(parsed, AUTH_SCREEN_LAYOUT_PATH, validate_auth_screen_layout)
            return
        if parsed.path == "/api/dev/save-auth-error-layout":
            self._save_json_layout(parsed, AUTH_ERROR_LAYOUT_PATH, validate_auth_error_layout)
            return
        if parsed.path == "/api/dev/save-challenge-begin-layout":
            self._save_json_layout(parsed, CHALLENGE_BEGIN_LAYOUT_PATH, validate_challenge_begin_layout)
            return
        if parsed.path == "/api/dev/save-main-screen-v2-layout":
            self._save_json_layout(parsed, MAIN_SCREEN_V2_LAYOUT_PATH, validate_main_screen_v2_layout)
            return
        self.send_error(404, "Not found")

    def _save_json_layout(self, parsed, path: Path, validator) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            self.send_error(400, "Empty body")
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(400, "Invalid JSON")
            return

        err = validator(payload)
        if err:
            self.send_error(400, err)
            return

        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        except OSError as exc:
            self.send_error(500, f"Write failed: {exc}")
            return

        rel = path.relative_to(ROOT).as_posix()
        body = json.dumps({"ok": True, "path": rel}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        print(f"Wrote {path.relative_to(ROOT)}")

    def _log_guest_event(self, parsed) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            self.send_error(400, "Empty body")
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(400, "Invalid JSON")
            return

        log_path = ROOT / "data" / "guest_events.jsonl"
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except OSError as exc:
            self.send_error(500, f"Write failed: {exc}")
            return

        body = json.dumps({"ok": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def validate_sublevel_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    if "defaults" not in payload or not isinstance(payload["defaults"], dict):
        return "Missing defaults object"
    for key in LAYOUT_KEYS:
        if key not in payload["defaults"]:
            return f"defaults.{key} is required"

    levels = payload.get("levels")
    if levels is not None and not isinstance(levels, dict):
        return "levels must be an object"
    if isinstance(levels, dict):
        for cat, cat_levels in levels.items():
            if cat not in ("gld", "slvr"):
                return f"Unknown level category: {cat}"
            if not isinstance(cat_levels, dict):
                return f"levels.{cat} must be an object"
            for lvl_key, overrides in cat_levels.items():
                if not str(lvl_key).isdigit() or not (1 <= int(lvl_key) <= 10):
                    return f"Invalid sublevel key: {lvl_key}"
                if not isinstance(overrides, dict):
                    return f"levels.{cat}.{lvl_key} must be an object"
                for key in overrides:
                    if key not in LAYOUT_KEYS:
                        return f"Unknown layout key: {key}"
    return None


def validate_bottom_nav_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    for key in ("plaque", "hits", "items"):
        val = payload.get(key)
        if val is not None and not isinstance(val, dict):
            return f"{key} must be an object"
    return None


def validate_preview_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    if isinstance(items, dict):
        for key, box in items.items():
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
            for dim in ("x", "y", "w", "h"):
                if dim in box and not isinstance(box[dim], (int, float)):
                    return f"items.{key}.{dim} must be a number"
    return None


def validate_preview_v2_layout(payload: object) -> str | None:
    err = validate_preview_layout(payload)
    if err:
        return err
    frame = payload.get("frame")
    if frame is not None:
        if not isinstance(frame, dict):
            return "frame must be an object"
        for dim in ("w", "h"):
            if dim in frame and not isinstance(frame[dim], (int, float)):
                return f"frame.{dim} must be a number"
    art = payload.get("art")
    if art is not None and not isinstance(art, dict):
        return "art must be an object"
    if isinstance(art, dict) and "rendererStageWidthScale" in art:
        if not isinstance(art["rendererStageWidthScale"], (int, float)):
            return "art.rendererStageWidthScale must be a number"
    tile_in_slot = payload.get("tileInSlot")
    if tile_in_slot is not None:
        if not isinstance(tile_in_slot, dict):
            return "tileInSlot must be an object"
        for key in (
            "rot0ScaleW", "rot0ScaleH", "rot90ScaleW", "rot90ScaleH",
            "offsetX", "offsetY", "boardScale", "fitInsetX", "fitInsetY", "clampToSlot",
        ):
            if key in tile_in_slot and not isinstance(tile_in_slot[key], (int, float)):
                return f"tileInSlot.{key} must be a number"
    return None


def validate_hint_v2_layout(payload: object) -> str | None:
    err = validate_preview_layout(payload)
    if err:
        return err
    frame = payload.get("frame")
    if frame is not None:
        if not isinstance(frame, dict):
            return "frame must be an object"
        for dim in ("w", "h"):
            if dim in frame and not isinstance(frame[dim], (int, float)):
                return f"frame.{dim} must be a number"
    art = payload.get("art")
    if art is not None and not isinstance(art, dict):
        return "art must be an object"
    token_font = payload.get("tokenCountFont")
    if token_font is not None and not isinstance(token_font, str):
        return "tokenCountFont must be a string"
    return None


def validate_preview_v2_data_sublayout(payload: object) -> str | None:
    err = validate_preview_layout(payload)
    if err:
        return err
    frame = payload.get("frame")
    if frame is not None:
        if not isinstance(frame, dict):
            return "frame must be an object"
        for dim in ("w", "h"):
            if dim in frame and not isinstance(frame[dim], (int, float)):
                return f"frame.{dim} must be a number"
    return None


def validate_stuck_reveal_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    dialog = payload.get("dialog")
    if dialog is not None and not isinstance(dialog, dict):
        return "dialog must be an object"
    if isinstance(dialog, dict):
        for key in ("previewWidthRatio", "artW", "artH"):
            if key in dialog and not isinstance(dialog[key], (int, float)):
                return f"dialog.{key} must be a number"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    if isinstance(items, dict):
        for key, box in items.items():
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
            for dim in ("x", "y", "w", "h", "widthScale", "heightScale", "boardScale"):
                if dim in box and not isinstance(box[dim], (int, float)):
                    return f"items.{key}.{dim} must be a number"
            if "centerX" in box and not isinstance(box["centerX"], bool):
                return f"items.{key}.centerX must be a boolean"
    return None


RANDOM_POPUP_ITEM_KEYS = ("remain", "venture", "close")


def validate_random_popup_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    dialog = payload.get("dialog")
    if dialog is not None and not isinstance(dialog, dict):
        return "dialog must be an object"
    if isinstance(dialog, dict):
        for key in ("artW", "artH", "displayPad", "maxDesignWidth", "widthScale"):
            if key in dialog and not isinstance(dialog[key], (int, float)):
                return f"dialog.{key} must be a number"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    if isinstance(items, dict):
        for key, box in items.items():
            if key not in RANDOM_POPUP_ITEM_KEYS:
                return f"Unknown item key: {key}"
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
            for dim in ("x", "y", "w", "h"):
                if dim in box and not isinstance(box[dim], (int, float)):
                    return f"items.{key}.{dim} must be a number"
            if "hidden" in box and not isinstance(box["hidden"], bool):
                return f"items.{key}.hidden must be a boolean"
    return None


GUEST_LOGIN_REQUIRED_ITEM_KEYS = ("message", "create", "login", "cancel", "close")


def validate_guest_login_required_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    dialog = payload.get("dialog")
    if dialog is not None and not isinstance(dialog, dict):
        return "dialog must be an object"
    if isinstance(dialog, dict):
        for key in ("artW", "artH", "displayPad", "maxDesignWidth", "widthScale"):
            if key in dialog and not isinstance(dialog[key], (int, float)):
                return f"dialog.{key} must be a number"
        if "baseSrc" in dialog and not isinstance(dialog["baseSrc"], str):
            return "dialog.baseSrc must be a string"
    buttons = payload.get("buttons")
    if buttons is not None and not isinstance(buttons, dict):
        return "buttons must be an object"
    if isinstance(buttons, dict):
        for key in ("create", "login", "cancel"):
            if key in buttons and not isinstance(buttons[key], str):
                return f"buttons.{key} must be a string"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    if isinstance(items, dict):
        for key, box in items.items():
            if key not in GUEST_LOGIN_REQUIRED_ITEM_KEYS:
                return f"Unknown item key: {key}"
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
            for dim in ("x", "y", "w", "h", "fontScale"):
                if dim in box and not isinstance(box[dim], (int, float)):
                    return f"items.{key}.{dim} must be a number"
            if "hidden" in box and not isinstance(box["hidden"], bool):
                return f"items.{key}.hidden must be a boolean"
    return None


REVISIT_ITEM_KEYS = ("puzzleId", "solutions", "solved", "cancel", "revisit")


def validate_revisit_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    dialog = payload.get("dialog")
    if dialog is not None and not isinstance(dialog, dict):
        return "dialog must be an object"
    if isinstance(dialog, dict):
        for key in ("artW", "artH", "displayPad", "widthScale"):
            if key in dialog and not isinstance(dialog[key], (int, float)):
                return f"dialog.{key} must be a number"
        if "fieldFontSize" in dialog and not isinstance(dialog["fieldFontSize"], str):
            return "dialog.fieldFontSize must be a string"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    if isinstance(items, dict):
        for key, box in items.items():
            if key not in REVISIT_ITEM_KEYS:
                return f"Unknown item key: {key}"
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
            for dim in ("x", "y", "w", "h"):
                if dim in box and not isinstance(box[dim], (int, float)):
                    return f"items.{key}.{dim} must be a number"
            if "fontSize" in box and not isinstance(box["fontSize"], str):
                return f"items.{key}.fontSize must be a string"
    return None


LOAD_SCREEN_ITEM_KEYS = ("preview", "guest", "login")

MAIN_SCREEN_V2_ITEM_KEYS = (
    "topBar",
    "menu",
    "title",
    "board",
    "infoBar",
    "preview",
    "tilebag",
    "bottomMenuTab",
    "bottomMenuCloseTab",
    "bottomMenuPanel",
)


def validate_main_screen_v2_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    if "background" in payload and not isinstance(payload["background"], str):
        return "background must be a string"
    for key in ("backgroundWaterA", "backgroundWaterB"):
        if key in payload and not isinstance(payload[key], str):
            return f"{key} must be a string"
    art = payload.get("art")
    if art is not None:
        if not isinstance(art, dict):
            return "art must be an object"
        if "src" in art and not isinstance(art["src"], str):
            return "art.src must be a string"
        for key in ("objectFit", "objectPosition"):
            if key in art and not isinstance(art[key], str):
                return f"art.{key} must be a string"
    items = payload.get("items")
    if items is None:
        return "items is required"
    if not isinstance(items, dict):
        return "items must be an object"
    for key, box in items.items():
        if key not in MAIN_SCREEN_V2_ITEM_KEYS:
            return f"Unknown item key: {key}"
        if not isinstance(box, dict):
            return f"items.{key} must be an object"
        for dim in ("x", "y", "w", "h"):
            if dim in box and not isinstance(box[dim], (int, float)):
                return f"items.{key}.{dim} must be a number"
        if key == "bottomMenuCloseTab":
            if "opacity" in box and not isinstance(box["opacity"], (int, float)):
                return "items.bottomMenuCloseTab.opacity must be a number"
            if "bg" in box and not isinstance(box["bg"], str):
                return "items.bottomMenuCloseTab.bg must be a string"
        px = box.get("px")
        if px is not None:
            if not isinstance(px, dict):
                return f"items.{key}.px must be an object"
            for dim in ("x", "y", "w", "h"):
                if dim in px and not isinstance(px[dim], (int, float)):
                    return f"items.{key}.px.{dim} must be a number"
    return None


def validate_load_screen_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    art = payload.get("art")
    if art is not None and not isinstance(art, dict):
        return "art must be an object"
    if isinstance(art, dict) and "rendererStageWidthScale" in art:
        if not isinstance(art["rendererStageWidthScale"], (int, float)):
            return "art.rendererStageWidthScale must be a number"
    if isinstance(art, dict):
        if "src" in art and not isinstance(art["src"], str):
            return "art.src must be a string"
        if "objectFit" in art and not isinstance(art["objectFit"], str):
            return "art.objectFit must be a string"
        if "objectPosition" in art and not isinstance(art["objectPosition"], str):
            return "art.objectPosition must be a string"
        if "frame" in art and not isinstance(art["frame"], str):
            return "art.frame must be a string"
        for dim in ("x", "y", "w", "h"):
            if dim in art and not isinstance(art[dim], (int, float)):
                return f"art.{dim} must be a number"
    items = payload.get("items")
    if items is None:
        return "items is required"
    if not isinstance(items, dict):
        return "items must be an object"
    for key, box in items.items():
        if key not in LOAD_SCREEN_ITEM_KEYS:
            return f"Unknown item key: {key}"
        if not isinstance(box, dict):
            return f"items.{key} must be an object"
        for dim in ("x", "y", "w", "h"):
            if dim in box and not isinstance(box[dim], (int, float)):
                return f"items.{key}.{dim} must be a number"
        if "hidden" in box and not isinstance(box["hidden"], bool):
            return f"items.{key}.hidden must be a boolean"
    return None


AUTH_SCREEN_KEYS = ("login", "create", "profile")
AUTH_SCREEN_ITEM_KEYS = {
    "login": ("user", "pass", "passReveal", "submit", "secondary", "navDaily", "navLogout", "explorersRegistered", "totalAdventurePuzzles", "totalKnownRoutes", "largestSolution", "todaysChallenge", "recentPuzzleSolved", "recentDailyCompleted", "mostSolvedPuzzle", "latestDiscovery", "totalPlayTime"),
    "create": ("name", "email", "pass", "passReveal", "pass2", "pass2Reveal", "submit", "secondary", "navDaily", "navLogout", "totalAdventurePuzzles", "ranksToEarn", "challengeGates", "totalKnownRoutes"),
    "profile": (
        "profileName",
        "guestNote",
        "rankBadge",
        "sublevelIcon",
        "adventureProgress",
        "routesDiscovered",
        "hintTokens",
        "memberSince",
        "passportId",
        "explorersRegistered",
        "totalAdventurePuzzles",
        "totalKnownRoutes",
        "largestSolution",
        "todaysChallenge",
        "recentPuzzleSolved",
        "recentDailyCompleted",
        "mostSolvedPuzzle",
        "latestDiscovery",
        "totalPlayTime",
        "navDaily",
        "navAdventure",
        "navRandom",
        "navLogout",
        "back",
        "closeX",
    ),
}


def validate_auth_screen_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    for screen_key in payload:
        if screen_key not in AUTH_SCREEN_KEYS:
            return f"Unknown screen key: {screen_key}"
    for screen_key in AUTH_SCREEN_KEYS:
        screen = payload.get(screen_key)
        if screen is None:
            continue
        if not isinstance(screen, dict):
            return f"{screen_key} must be an object"
        dialog = screen.get("dialog")
        if dialog is not None and not isinstance(dialog, dict):
            return f"{screen_key}.dialog must be an object"
        if isinstance(dialog, dict):
            for key in ("artW", "artH", "maxWidth"):
                if key in dialog and not isinstance(dialog[key], (int, float)):
                    return f"{screen_key}.dialog.{key} must be a number"
        items = screen.get("items")
        if items is not None and not isinstance(items, dict):
            return f"{screen_key}.items must be an object"
        if isinstance(items, dict):
            for key, box in items.items():
                if key not in AUTH_SCREEN_ITEM_KEYS[screen_key]:
                    return f"Unknown item key: {screen_key}.{key}"
                if not isinstance(box, dict):
                    return f"{screen_key}.items.{key} must be an object"
                for dim in ("x", "y", "w", "h", "fontScale"):
                    if dim in box and not isinstance(box[dim], (int, float)):
                        return f"{screen_key}.items.{key}.{dim} must be a number"
                if "hidden" in box and not isinstance(box["hidden"], bool):
                    return f"{screen_key}.items.{key}.hidden must be a boolean"
    return None


AUTH_ERROR_ITEM_KEYS = ("message", "ok", "close")


def validate_auth_error_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    dialog = payload.get("dialog")
    if dialog is not None and not isinstance(dialog, dict):
        return "dialog must be an object"
    if isinstance(dialog, dict):
        for key in ("artW", "artH", "maxWidth", "widthScale"):
            if key in dialog and not isinstance(dialog[key], (int, float)):
                return f"dialog.{key} must be a number"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    if isinstance(items, dict):
        for key, box in items.items():
            if key not in AUTH_ERROR_ITEM_KEYS:
                return f"Unknown item key: {key}"
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
            for dim in ("x", "y", "w", "h", "fontScale"):
                if dim in box and not isinstance(box[dim], (int, float)):
                    return f"items.{key}.{dim} must be a number"
    return None


CHALLENGE_BEGIN_ITEM_KEYS = ("begin", "continue")


def validate_challenge_begin_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    dialog = payload.get("dialog")
    if dialog is not None and not isinstance(dialog, dict):
        return "dialog must be an object"
    if isinstance(dialog, dict):
        for key in ("artW", "artH", "displayPad", "maxDesignWidth", "widthScale"):
            if key in dialog and not isinstance(dialog[key], (int, float)):
                return f"dialog.{key} must be a number"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    if isinstance(items, dict):
        for key, box in items.items():
            if key not in CHALLENGE_BEGIN_ITEM_KEYS:
                return f"Unknown item key: {key}"
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
            for dim in ("x", "y", "w", "h"):
                if dim in box and not isinstance(box[dim], (int, float)):
                    return f"items.{key}.{dim} must be a number"
    return None


PINFO_ITEM_KEYS = (
    "rank",
    "id",
    "size",
    "type",
    "bar",
    "found",
    "hints",
    "best",
    "solved",
    "closeJournal",
    "closeX",
)


def validate_puzzle_info_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    for key in ("dialog", "typography", "defaults", "items"):
        val = payload.get(key)
        if val is not None and not isinstance(val, dict):
            return f"{key} must be an object"
    items = payload.get("items")
    if isinstance(items, dict):
        for key, box in items.items():
            if key not in PINFO_ITEM_KEYS and key != "close":
                return f"Unknown item key: {key}"
            if not isinstance(box, dict):
                return f"items.{key} must be an object"
    return None


def validate_hint_rules_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    for key in ("window", "exit", "scroller"):
        val = payload.get(key)
        if val is not None and not isinstance(val, dict):
            return f"{key} must be an object"
    return None


JOURNAL_ITEM_KEYS = tuple(
    k for k in (
        "paneTop", "paneBottomLeft", "paneBottomRight",
        "listTitleBar", "titleFoundSolutions", "titleRecordedPuzzles",
        "listScroller", "listContent", "listRow",
        "listRowMain", "listRowDetail", "listRowSub",
        "fieldPuzzleId", "fieldPuzzleType", "fieldBoardSize",
        "fieldTotalKnown", "fieldSolutionsFound", "fieldFirstSolved", "fieldLastPlayed",
        "progressBar", "solutionPreview", "btnBeginSearch",
        "selectorBoardSize", "selectorPuzzleType", "selectorStatus",
        "tabPuzzle", "tabStats", "tabFilter", "tabRecords",
        "btnFilter", "btnStats", "btnPrev", "btnNext", "btnExit", "btnLibraryBack",
    )
)


JOURNAL_OVERLAY_KEYS = (
    "shellBlank", "recordTop", "libraryTop", "statsScreen", "recordsScreen", "bottomBar",
)

JOURNAL_TAB_KEYS = ("puzzle", "stats", "filter", "records")


def validate_journal_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    for key in ("dialog", "typography", "items", "overlays", "tabs"):
        val = payload.get(key)
        if val is not None and not isinstance(val, dict):
            return f"{key} must be an object"
    items = payload.get("items")
    if isinstance(items, dict):
        for key in items:
            if key not in JOURNAL_ITEM_KEYS:
                return f"Unknown item key: {key}"
    overlays = payload.get("overlays")
    if isinstance(overlays, dict):
        for key in overlays:
            if key not in JOURNAL_OVERLAY_KEYS:
                return f"Unknown overlay key: {key}"
    tabs = payload.get("tabs")
    if isinstance(tabs, dict):
        for key in tabs:
            if key not in JOURNAL_TAB_KEYS:
                return f"Unknown tab key: {key}"
    return None


def validate_tilebag_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    for key in ("container", "collapsed", "expanded", "handle", "tiles", "glow", "expandedLayout"):
        val = payload.get(key)
        if val is not None and not isinstance(val, dict):
            return f"{key} must be an object"
    return None


def validate_tilebag_v2_layout(payload: object) -> str | None:
    err = validate_tilebag_layout(payload)
    if err:
        return err
    art = payload.get("art")
    if art is not None:
        if not isinstance(art, dict):
            return "art must be an object"
        for key in ("collapsed", "expanded", "handlebar"):
            if key in art and not isinstance(art[key], str):
                return f"art.{key} must be a string"
        for key in ("w", "collapsedH", "expandedH"):
            if key in art and not isinstance(art[key], (int, float)):
                return f"art.{key} must be a number"
    return None


def validate_menu_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    for key in ("plaque", "hits", "close", "standard", "dev"):
        val = payload.get(key)
        if val is not None and not isinstance(val, dict):
            return f"{key} must be an object"
    return None


def validate_discovery_layout(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "Root must be a JSON object"
    plaque = payload.get("plaque")
    if plaque is not None and not isinstance(plaque, dict):
        return "plaque must be an object"
    defaults = payload.get("defaults")
    if defaults is not None and not isinstance(defaults, dict):
        return "defaults must be an object"
    items = payload.get("items")
    if items is not None and not isinstance(items, dict):
        return "items must be an object"
    texts = payload.get("texts")
    if texts is not None and not isinstance(texts, dict):
        return "texts must be an object"
    variants = payload.get("variants")
    if variants is not None and not isinstance(variants, dict):
        return "variants must be an object"
    if isinstance(texts, dict):
        for key, val in texts.items():
            if key not in DISCOVERY_COPY_KEYS:
                return f"Unknown texts key: {key}"
            if not isinstance(val, str):
                return f"texts.{key} must be a string"
    if isinstance(items, dict):
        for key, val in items.items():
            if key not in DISCOVERY_ITEM_KEYS:
                return f"Unknown item key: {key}"
            if not isinstance(val, dict):
                return f"items.{key} must be an object"
            is_btn = key.startswith("btn")
            allowed = DISCOVERY_BTN_KEYS if is_btn else DISCOVERY_TEXT_KEYS
            for prop in val:
                if prop not in allowed:
                    return f"Unknown property items.{key}.{prop}"
    return None


class DevHTTPServer(ThreadingHTTPServer):
    # One listener per port — avoids stale servers sharing 8080 on Windows.
    allow_reuse_address = False


def main() -> None:
    try:
        server = DevHTTPServer(("0.0.0.0", PORT), Handler)
    except OSError as exc:
        print(f"Port {PORT} is already in use ({exc}).")
        print("Stop other dev servers, then run: python scripts/server.py")
        raise SystemExit(1) from exc

    print(f"Serving on http://127.0.0.1:{PORT}")
    print(f"Game: http://127.0.0.1:{PORT}/tilezilla-v2.html")
    if PORT == 8080:
        print("(Port 8080 may conflict with Docker — use PORT=8081 python scripts/server.py if you see ERR_EMPTY_RESPONSE)")
    print("Adventure path API: GET /api/adventure/path")
    print("System info API: GET /api/system-info")
    print("Sublevel tuner save API: POST /api/dev/save-sublevel-layout")
    print("Discovery tuner save API: POST /api/dev/save-discovery-layout")
    print("Menu tuner save API: POST /api/dev/save-menu-layout")
    print("Bottom nav tuner save API: POST /api/dev/save-bottom-nav-layout")
    print("Preview tuner save API: POST /api/dev/save-preview-layout")
    print("Preview v2 tuner save API: POST /api/dev/save-preview-v2-layout")
    print("Hint v2 tuner save API: POST /api/dev/save-hint-v2-layout")
    print("User data v2 tuner save API: POST /api/dev/save-user-data-v2-layout")
    print("Game data v2 tuner save API: POST /api/dev/save-game-data-v2-layout")
    print("Info data v2 tuner save API: POST /api/dev/save-info-data-v2-layout")
    print("Timer data v2 tuner save API: POST /api/dev/save-timer-data-v2-layout")
    print("Stuck reveal tuner save API: POST /api/dev/save-stuck-reveal-layout")
    print("Puzzle info tuner save API: POST /api/dev/save-puzzle-info-layout")
    print("Hint Rules tuner save API: POST /api/dev/save-hint-rules-layout")
    print("Journal tuner save API: POST /api/dev/save-journal-layout")
    print("Tile bag tuner save API: POST /api/dev/save-tilebag-layout")
    print("Tile bag v2 tuner save API: POST /api/dev/save-tilebag-v2-layout")
    print("Random popup tuner save API: POST /api/dev/save-random-popup-layout")
    print("Guest login required tuner save API: POST /api/dev/save-guest-login-required-layout")
    print("Revisit popup tuner save API: POST /api/dev/save-revisit-layout")
    print("Load screen tuner save API: POST /api/dev/save-load-screen-layout")
    print("Auth screen tuner save API: POST /api/dev/save-auth-screen-layout")
    print("Auth error tuner save API: POST /api/dev/save-auth-error-layout")
    print("Challenge begin tuner save API: POST /api/dev/save-challenge-begin-layout")
    server.serve_forever()


if __name__ == "__main__":
    main()
