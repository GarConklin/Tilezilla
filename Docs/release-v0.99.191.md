# Release v0.99.191 — branch switch for testers

**Previous stable:** `v0.99.190` → branch `release/v0.99.190`  
**New development / deploy:** `v0.99.193` → branch `release/v0.99.193` (see `Docs/release-v0.99.193.md`)

## What changed in 0.99.191 (vs 0.99.190)

- **Puzzle Info solutions count** — matches journal/leaderboard progress (fixes “0 of 12” when a solve was recorded)
- **Duplicate-solve popup** — correct “X of N” when re-submitting a known solution on mobile
- **Daily leaderboard on mobile** — merges server + local rows; local calendar dates for today’s challenge
- **Timer hour display** — wider `timer_data` layout for `h:mm:ss`; hours preview in timer tuner

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.190` | 0.99.190 | Frozen — previous deploy line |
| `release/v0.99.191` | 0.99.191 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.191` when ready |

### Deploy 0.99.191

```bash
git fetch origin
git checkout release/v0.99.191
git pull origin release/v0.99.191
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.191.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

After pulling `release/v0.99.191` and rebuilding containers:

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.191.sql
```

## Verify

1. Cartographer's Journal shows **v0.99.191**
2. `GET /api/system-info` shows `0.99.191`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.191`

## Rollback

Point prod back to `release/v0.99.190` and redeploy. Gameplay data is compatible.
