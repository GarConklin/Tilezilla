# Release v0.99.207 — journal, progress sync, and shell startup polish

**Superseded by:** `v0.99.208` → branch `release/v0.99.208` (see `Docs/release-v0.99.208.md`)  
**Previous stable:** `v0.99.206` → branch `release/v0.99.206`  
**Was active:** `v0.99.207` → branch `release/v0.99.207`

## What changed in 0.99.207 (vs 0.99.206)

- **Cross-device progress** — found-counts refresh when the tab is focused, shown again, comes online, or after a short interval, so PC and phone stay aligned without a hard refresh.
- **Cartographer's Journal** — centered version badge, contact email under the version, art aspect and placement fixes, and a tuner that can select/nudge version and email.
- **Startup races** — menu and journal layouts apply before first interaction; passport profile fills sooner with correct Wanderer badge scaling; stray passport ID hidden from the auth layout.
- **Remote 5x6-0C tooling** — generator path that requires CR, CQ, or CT in the bag (for overnight remote runs).

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.206` | 0.99.206 | Frozen — previous deploy line |
| `release/v0.99.208` | 0.99.208 | **Active** development and deploy |
| `main` | — | Merge `release/v0.99.208` when ready |

### Deploy 0.99.207

```bash
git fetch origin
git checkout release/v0.99.207
git pull origin release/v0.99.207
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.207.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.207.sql
```

No schema changes.

## Verify

1. Cartographer's Journal shows **0.99.207** (no `v` prefix) and the contact email under it
2. `GET /api/system-info` shows `0.99.207`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.207`
4. Find a tile on one device, focus the other → found-count matches without hard refresh
5. Open journal / hamburger / profile soon after load → no long empty or jumping layout

## Rollback

Point prod back to `release/v0.99.206` and redeploy. No data changes.
