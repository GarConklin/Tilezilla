# Release v0.99.193 — branch switch for testers

**Previous stable:** `v0.99.191` → branch `release/v0.99.191`  
**New development / deploy:** `v0.99.200` → branch `release/v0.99.200` (see `Docs/release-v0.99.200.md`)  
**This branch:** `v0.99.193` → `release/v0.99.193` (frozen previous line)

## What changed in 0.99.193 (vs 0.99.191)

- **Journal load** — faster library index; “Gathering your adventure logs.. Please wait.” overlay
- **Solutions Found** — daily fallback from leaderboard / local daily results (Puzzle Info + Journal)
- **Daily leaderboard** — first eligible solve locks your time (later fast replays do not replace it)
- **Leaderboard display** — MySQL row wins over stale browser localStorage for the same player
- **Records screen** — bottom Filter / Exit work on leaderboard; PREV/NEXT step daily dates (first challenge → today)
- **Journal fix** — missing `$` DOM helper no longer crashes journal on open

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.191` | 0.99.191 | Frozen — previous deploy line |
| `release/v0.99.193` | 0.99.193 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.193` when ready |

### Deploy 0.99.193

```bash
git fetch origin
git checkout release/v0.99.193
git pull origin release/v0.99.193
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.193.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

After pulling `release/v0.99.193` and rebuilding containers:

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.193.sql
```

## Verify

1. Cartographer's Journal shows **v0.99.193**
2. `GET /api/system-info` shows `0.99.193`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.193`

## Rollback

Point prod back to `release/v0.99.191` and redeploy. Gameplay data is compatible.
