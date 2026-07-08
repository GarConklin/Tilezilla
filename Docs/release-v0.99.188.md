# Release v0.99.188 — branch switch for testers

**Previous stable:** `v0.99.187` → branch `release/v0.99.187`  
**New development / deploy:** `v0.99.189` → branch `release/v0.99.189` (see `Docs/release-v0.99.189.md`)

## What changed in 0.99.188 (vs 0.99.187)

- **Records / leaderboard** — layout reapplies on tab open; journal side tabs hidden on Records; Back returns to Stats
- **Leaderboard header** — today's puzzle ID + date; time hidden on leaderboard (Personal Best only)
- **Leaderboard usernames** — display names instead of numeric user IDs
- **Hamburger menu** — Leaderboard link above Cartographer's Journal; single **Development** popup (dev tools + tuners)
- **Passport boot** — after login, show logged-in passport first; defer daily/adventure/random until user picks a path
- **Hamburger icon** — smaller menu button asset for faster open
- Login screen double-load flash fix (from late 0.99.187 line)
- **Production health check** — `scripts/health-check-production.sh` + optional systemd boot hook

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.187` | 0.99.187 | Frozen — previous deploy line |
| `release/v0.99.188` | 0.99.188 | Frozen — superseded by 0.99.189 |
| `release/v0.99.189` | 0.99.189 | Active development and next deploy |
| `main` | — | Merge `release/v0.99.189` when ready to make 0.99.189 the default line |

### Deploy 0.99.188

```bash
git fetch origin
git checkout release/v0.99.188
git pull origin release/v0.99.188
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.188.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

After pulling `release/v0.99.188` and rebuilding containers:

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.188.sql
```

## Verify

1. Cartographer's Journal shows **v0.99.188**
2. `GET /api/system-info` shows `0.99.188`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.188`

## Rollback

Point prod back to `release/v0.99.187` and redeploy. Gameplay data is compatible.
