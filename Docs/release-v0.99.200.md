# Release v0.99.200 — branch switch for testers

**Previous stable:** `v0.99.193` → branch `release/v0.99.193`  
**New development / deploy:** `v0.99.200` → branch `release/v0.99.200`

## What changed in 0.99.200 (vs 0.99.193)

- **Daily timer** — first eligible solve freezes the stopwatch; continued multi-solve play no longer replaces daily time with session wall-clock
- **Board reset (daily)** — resetting / clearing the board does **not** zero today’s leaderboard attempt timer (anti-cheat)
- **Progress sync** — login hydrates with a **merge** of local + server solves (no longer wipes richer phone progress)
- **Solve sync** — every solution awaits `/api/progress/solve` (no silent fire-and-forget drops)
- **Daily attempts** — `daily_attempts.started_at` locks on first placement (`INSERT IGNORE`)
- **Progress storage** — found solutions live in MySQL (`user_found_solutions`); JSON files are import-only backups

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.193` | 0.99.193 | Frozen — previous deploy line |
| `release/v0.99.200` | 0.99.200 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.200` when ready |

### Deploy 0.99.200

```bash
git fetch origin
git checkout release/v0.99.200
git pull origin release/v0.99.200
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.200.sql` | **Upgrade existing** production DB |
| `scripts/sql/daily-attempts.sql` | Create `daily_attempts` if missing |
| `scripts/sql/user-found-solutions.sql` | Found-solutions + progress meta tables |

## Database upgrade (existing server)

After pulling `release/v0.99.200` and rebuilding containers:

```bash
# Version badge
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.200.sql

# Daily attempt start table (safe to re-run)
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/daily-attempts.sql

# Found solutions in MySQL (safe to re-run)
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/user-found-solutions.sql

# One-time: import progress JSON volume into SQL (idempotent)
docker compose -f docker-compose.production.yml --env-file .env.production exec -T web \
  python scripts/migrate-progress-json-to-sql.py
```

## Verify

1. Cartographer's Journal shows **v0.99.200**
2. `GET /api/system-info` shows `0.99.200`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.200`
4. `SELECT COUNT(*) FROM user_found_solutions WHERE user_id = 900004;` matches prior JSON solve count

## Rollback

Point prod back to `release/v0.99.193` and redeploy. Gameplay data is compatible.
JSON backups remain as `data/progress/users/{id}.migrated.json` after migration.
