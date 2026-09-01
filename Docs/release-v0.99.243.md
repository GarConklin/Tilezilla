# Release v0.99.243 — ISO day 243 cut

**Previous:** `v0.99.238` → branch `release/v0.99.238`  
**New:** `v0.99.243`

## What landed

- **Rank badge sync** — passport / in-game sublevel icon now uses authoritative MySQL rank (same source as daily/adventure leaderboards) after each solve and progress hydrate
- **Rank refresh on solve** — badge updates immediately after recording a solution, not only on Adventure screen
- **Profile icon rescale fix** — stopped stale sublevel dataset from overwriting a fresh rank paint

### Deploy 0.99.243

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
  < scripts/sql/bump-version-0.99.243.sql
```
