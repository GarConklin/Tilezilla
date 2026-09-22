# Release v0.99.264 — ISO day 264 cut

**Previous line:** `v0.99.238` → branch `release/v0.99.238` (kept as fallback)  
**Active:** `v0.99.264` → branch `release/v0.99.264`

Branch name again matches `data/system_info.json` version (0.99.264). Work after 0.99.238 had been landing on the old branch name while the app version kept advancing.

## What landed since 0.99.238 (high level)

- Layered rank badges v2 + passport news
- Rank fanfare only at tier starts **11 / 21 / 31 / 41 / 51**
- DB passport messages + admin composer (`/admin-messages.html`)
- Daily sols calendar / schedule work from the 263 cut

### Deploy 0.99.264

```bash
git fetch origin
git checkout release/v0.99.264
git pull origin release/v0.99.264
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

### Database (passport messages — once on existing servers)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < tools/scripts/migrate-passport-messages.sql
```

## Rollback

Point prod back to `release/v0.99.238` and redeploy if needed.
