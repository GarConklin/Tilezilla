#!/usr/bin/env python3
"""Minimal dev server for the tile puzzle web app.

Serves:
- /data/* and /solves/* from repo root
- everything else from /web (so / maps to /web/index.html)
"""

from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PORT = int(os.environ.get("PORT", "8080"))


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


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving on http://localhost:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
