# Dev layout tuners and tools (Phase 4) — not on production VPS.

Open via dev server (`python scripts/server.py` or Docker on port 3000/8080):

- **Index:** [/tools/tuners.html](http://127.0.0.1:8080/tools/tuners.html)
- **Dev entry:** [/tools/dev-player-select.html](http://127.0.0.1:8080/tools/dev-player-select.html)

Legacy URLs like `/tuners.html` still work (server falls back to `tools/web/`).

## Layout

```
tools/web/
  *.html           Layout tuners, dev player select, audit pages
  js/              Tuner-only scripts (import game modules from /js/…)
  css/             Tuner-only stylesheets
```

Shared game assets remain in repo-root `web/` (`/js/`, `/css/`, `/tilezilla-v2.html`).

Tuners POST layout JSON to `/api/dev/save-*` on the game server — same as before.
