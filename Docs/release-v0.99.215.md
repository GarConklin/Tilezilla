# Release v0.99.215 — ISO day 215 cut

**Previous:** `v0.99.214` → branch `release/v0.99.214`  
**New:** `v0.99.215` → branch `release/v0.99.215`

## What landed since 0.99.214

- **Start mode** — honor Daily start on open; don’t skip passport after slow auth
- **Adventure Records** — force Blankwbtm art; Top 10 has no scroller (11+ only)
- **Check solve UX** — trumpet / token SFX / discovery popup no longer wait on slow sync
- **Solve path performance** — no full journal rebuild per solve; one MySQL connection; short session-check cache
- **3x4-1A-AAF** — ES counted as 2-snake end; three unique catalog solutions

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.214` | 0.99.214 | Frozen — previous deploy line |
| `release/v0.99.215` | 0.99.215 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.215` when ready |

### Deploy 0.99.215

```bash
git fetch origin
git checkout release/v0.99.215
git pull origin release/v0.99.215
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.215.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.215.sql
```
