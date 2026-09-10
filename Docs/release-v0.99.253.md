# Release v0.99.253 — ISO day 253 cut

**Previous:** `v0.99.243`  
**New:** `v0.99.253`

## What landed

- **Daily leaderboard cross-device sync** — phone-local daily times that never reached MySQL no longer appear as a private ghost score
- **POST `/api/daily-leaderboard/submit`** — pushes pending/local daily results into `daily_results`
- **Fix false confirm** — local daily row is only marked synced when the server actually saved the leaderboard entry
- Opening Records flushes phone-local ghosts into MySQL before painting the board

### Deploy 0.99.253

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
  < scripts/sql/bump-version-0.99.253.sql
```

## Heal yesterday on phone (after deploy)

1. Open the game **on the phone** (the device that still shows Sept 9).
2. Open **Journal → Daily Leaderboard → PREV** to Sept 9.
3. That visit uploads the local-only score to MySQL.
4. Refresh on PC — GarOdal / 34:17 should appear.
