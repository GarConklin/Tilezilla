# Release v0.99.315 — ISO day 315 cut

**Previous line:** `v0.99.312` → branch `release/v0.99.312` (kept as fallback)  
**Active:** `v0.99.315` → branch `release/v0.99.315`

Branch name matches `data/system_info.json` version (0.99.315).

## What landed since 0.99.312 (high level)

- **Missing solve files** — 559 live catalog levels (172 `5x6-0B` DNR–DUG, 382 `5x6-0C`, 5 `6x6-0B` ADT–ADX) had no entry in `solves.zip`; added as `solves/<id>.json` (zip now 9,131 solve files)
- **Solution counts** — 67 `5x6-0B` levels (DOS–DUF) showed 1 solution in `data/levels/5x6-0B.json`; synced from their solve files (`scripts/sql/update-missing-solve-counts-2026-11-11.sql` for MySQL)
- **Solution viewer** — step through a puzzle's solutions and loop boards in a popup with the game's tile art
- **Nightly solves** — resumable nightly fast-solver run with live view, export and solver check
- **Daily leaderboard** — MOVES column label, move counts shown instead of a dash

### Deploy 0.99.315

`solves.zip` changed, so it must be re-extracted on the server.

```bash
cd /opt/tilezilla
git fetch origin
git checkout release/v0.99.315
git pull origin release/v0.99.315
unzip -o -q solves.zip -d /opt/tilezilla
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.315.sql
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/update-missing-solve-counts-2026-11-11.sql
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/add-missing-catalog-levels-2026-11-11.sql
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/check-missing-catalog-levels-2026-11-11.sql
```

`add-missing-catalog-levels-2026-11-11.sql` adds the 185 catalog levels that were in the bucket files but not in
`data/levels/levels.json` (172 `5x6-0B` DNR–DUG, `3x4-0C` AAD/AAF, `3x5-1A` AAA/AAB, `3x5-1C` AAA–AAC,
`6x6-0B` AAC + ADT–ADX), so they had no `levels` row. The check should print 185 levels, 4153 solutions.

## Rollback

Point prod back to `release/v0.99.312` and redeploy if needed.
