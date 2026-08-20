# Release v0.99.231 — ISO day 231 cut

**Previous:** `v0.99.215` → branch `release/v0.99.215`  
**New:** `v0.99.231` → branch `release/v0.99.231`

## What landed since 0.99.215

- **GET /api/progress** — no full MySQL rebuild on every poll (fixes web CPU spike / 12s client timeouts)

### Deploy 0.99.231

```bash
git fetch origin
git checkout release/v0.99.231
git pull origin release/v0.99.231
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.231.sql
```
