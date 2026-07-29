# Release v0.99.208 — mobile login, boot speed, and UI polish

**Previous stable:** `v0.99.207` → branch `release/v0.99.207`  
**This line:** `v0.99.208` → branch `release/v0.99.208` (**frozen**)  
**Current deploy:** `v0.99.210` → branch `release/v0.99.210`

## What changed in 0.99.208 (vs 0.99.207)

- **Post-login boot** — shell unhides immediately instead of sitting on "Loading Game Interface…" for 30–60s on mobile; layouts and engine finish in the background with fetch timeouts.
- **Android login** — welcome-screen Login uses a native link and touch/z-index fixes so sign-in opens reliably.
- **Cartographer's Journal** — tuner-saved version and email positions ship to live.
- **Start-screen carousel** — bottom panel auto-advances (2s per slide, 3s on slide 3).
- **Hint Rules** — close button stays pinned to the art on live (not below a tall panel).

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.207` | 0.99.207 | Frozen — previous deploy line |
| `release/v0.99.208` | 0.99.208 | Frozen — previous deploy line |
| `release/v0.99.210` | 0.99.210 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.210` when ready |

### Deploy 0.99.208

```bash
git fetch origin
git checkout release/v0.99.208
git pull origin release/v0.99.208
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.208.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.208.sql
```

No schema changes.

## Verify

1. Cartographer's Journal shows **0.99.208** (no `v` prefix) and the contact email under it
2. `GET /api/system-info` shows `0.99.208`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.208`
4. Log in on Android → sign-in page opens; game shell appears within a few seconds (not 30–60s on the loader)
5. Hint Rules close button sits on the art; start-screen carousel advances on its own

## Rollback

Point prod back to `release/v0.99.207` and redeploy. No data changes.
