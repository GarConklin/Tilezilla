# Release v0.99.206 — iPhone hint interaction polish

**Previous stable:** `v0.99.205` → branch `release/v0.99.205`  
**New development / deploy:** `v0.99.206` → branch `release/v0.99.206`

## What changed in 0.99.206 (vs 0.99.205)

- **iOS long-press fix** — the hold gesture no longer gets cancelled by Safari's scroll detection (`pointerleave` / `pointercancel` during a still hold). Pointer is captured; only a real lift or a clear drag cancels.
- **Start-of-game Use Hint bubble** — back to an **instant tap** (it disappears once tiles are placed, so no accidental-press risk).
- **Long-press timing** — player level, card stats, and the in-play hint token plaque fire after a **0.5 second** hold (was 1 second).

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.205` | 0.99.205 | Frozen — previous deploy line |
| `release/v0.99.206` | 0.99.206 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.206` when ready |

### Deploy 0.99.206

```bash
git fetch origin
git checkout release/v0.99.206
git pull origin release/v0.99.206
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.206.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.206.sql
```

No schema changes.

## Verify

1. Cartographer's Journal shows **v0.99.206**
2. `GET /api/system-info` shows `0.99.206`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.206`
4. On iPhone: empty board → tap the Use Hint bubble → confirm opens instantly
5. On iPhone: hold the hint token plaque half a second → confirm opens
6. Player level / card stats open on a half-second hold, not a tap

## Rollback

Point prod back to `release/v0.99.205` and redeploy. No data changes.
