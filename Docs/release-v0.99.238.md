# Release v0.99.238 — ISO day 238 cut

**Previous:** `v0.99.231` → branch `release/v0.99.231`  
**New:** `v0.99.238` → branch `release/v0.99.238`

## What landed since 0.99.231

- **GET /api/progress** — fully read-only on poll; no catalog JSON scans per request
- **Records leaderboard** — faster adventure SQL aggregation; one daily API fetch; defer stats index to Personal Best
- **Production stability** — fixes web CPU spike / client timeout storms (499 on progress and leaderboard)

### Deploy 0.99.238

```bash
git fetch origin
git checkout release/v0.99.238
git pull origin release/v0.99.238
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.238.sql
```
