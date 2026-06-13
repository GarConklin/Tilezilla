#!/usr/bin/env python3
"""Minimal dev server for the tile puzzle web app.

Serves:
- /data/* and /solves/* from repo root
- everything else from /web (so / maps to /web/index.html)
"""

from __future__ import annotations

import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PORT = int(os.environ.get("PORT", "8080"))
SUBLEVEL_LAYOUT_PATH = ROOT / "data" / "sublevel_icon_layout.json"
DISCOVERY_LAYOUT_PATH = ROOT / "data" / "discovery_record_layout.json"
MENU_LAYOUT_PATH = ROOT / "data" / "menu_layout.json"
BOTTOM_NAV_LAYOUT_PATH = ROOT / "data" / "bottom_nav_layout.json"
PREVIEW_LAYOUT_PATH = ROOT / "data" / "preview_layout.json"
STUCK_REVEAL_LAYOUT_PATH = ROOT / "data" / "stuck_reveal_layout.json"
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


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        req = unquote(parsed.path)

        # Dev player picker → production shell (dev tool still at /index.html)
        if req in ("", "/"):
            target = WEB / "dev-player-select.html"
        # Repo-root data consumed by app fetch() calls
        elif req.startswith("/data/") or req.startswith("/solves/"):
            target = ROOT / req.lstrip("/")
        # Shared artwork + tile PNGs live in /img at repo root
        elif req.startswith("/img/"):
            rel = req[len("/img/") :]
            target = ROOT / "img" / rel
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

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
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
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
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
        if parsed.path == "/api/dev/save-stuck-reveal-layout":
            self._save_json_layout(parsed, STUCK_REVEAL_LAYOUT_PATH, validate_stuck_reveal_layout)
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


def validate_stuck_reveal_layout(payload: object) -> str | None:
    return validate_preview_layout(payload)


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

    print(f"Serving on http://localhost:{PORT}")
    print("Sublevel tuner save API: POST /api/dev/save-sublevel-layout")
    print("Discovery tuner save API: POST /api/dev/save-discovery-layout")
    print("Menu tuner save API: POST /api/dev/save-menu-layout")
    print("Bottom nav tuner save API: POST /api/dev/save-bottom-nav-layout")
    print("Preview tuner save API: POST /api/dev/save-preview-layout")
    print("Stuck reveal tuner save API: POST /api/dev/save-stuck-reveal-layout")
    server.serve_forever()


if __name__ == "__main__":
    main()
