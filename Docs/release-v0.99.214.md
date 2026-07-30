# Release v0.99.214 — ISO day 214 cut

**Previous:** `v0.99.210` → branch `release/v0.99.210`  
**New:** `v0.99.214` → branch `release/v0.99.214`

## What landed since 0.99.210

- **Bottom nav** — Daily Challenge / Adventure hit targets matched to plaque art order
- **iOS pending solves** — queue before POST; keepalive flush on pagehide / hide / freeze
- **ClariceBec Jul 28** — backfill SQL for 6:58 daily time
- **Adventure Records** — dedicated background art, Top 10 + 11+ scroller (no 1/2-hint panes), total hints + avg time/puzzle
- **Boot stability** — ui-scale / frame recursion fix; layouts no longer block puzzle boot; cache-bust `?v=20260730b`

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.210` | 0.99.210 | Frozen — previous deploy line |
| `release/v0.99.214` | 0.99.214 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.214` when ready |

### Deploy 0.99.214

```bash
git fetch origin
git checkout release/v0.99.214
git pull origin release/v0.99.214
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.214.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.214.sql
```
