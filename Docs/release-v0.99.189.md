# Release v0.99.189 — branch switch for testers

**Previous stable:** `v0.99.188` → branch `release/v0.99.188`  
**New development / deploy:** `v0.99.191` → branch `release/v0.99.191` (see `Docs/release-v0.99.191.md`)

## What changed in 0.99.189 (vs 0.99.188)

- **Hamburger menu — Main Navigation** — opens the bottom nav drawer (iPhone-friendly alternative to the lower graphic)
- **Menu tuner** — new **Main Navigation** hit area on `Menu.png` / `Menu-devtools.png`
- **Menu art** — updated `Menu.png` and `Menu-devtools.png` with the new row
- **iPhone / mobile fixes** (from 0.99.188 line) — passport boot, check-solve, discovery popup, duplicate solve popup
- **Challenge progress popup** — larger gate screen and buttons on desktop

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.188` | 0.99.188 | Frozen — previous deploy line |
| `release/v0.99.189` | 0.99.189 | Frozen — superseded by 0.99.190 |
| `release/v0.99.190` | 0.99.190 | Frozen — superseded by 0.99.191 |
| `release/v0.99.191` | 0.99.191 | Active development and next deploy |
| `main` | — | Merge `release/v0.99.191` when ready to make 0.99.191 the default line |

### Deploy 0.99.189

```bash
git fetch origin
git checkout release/v0.99.189
git pull origin release/v0.99.189
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.189.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

After pulling `release/v0.99.189` and rebuilding containers:

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.189.sql
```

## Verify

1. Cartographer's Journal shows **v0.99.189**
2. `GET /api/system-info` shows `0.99.189`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.189`

## Rollback

Point prod back to `release/v0.99.188` and redeploy. Gameplay data is compatible.
