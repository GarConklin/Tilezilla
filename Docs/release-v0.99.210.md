# Release v0.99.210 — daily timer, Records Adventure LB, nav hold, board resume

**Previous stable:** `v0.99.208` → branch `release/v0.99.208`  
**New development / deploy:** `v0.99.210` → branch `release/v0.99.210`

## What changed in 0.99.210 (vs 0.99.208)

- **Daily timer persistence** — unfinished Daily Challenge elapsed time is saved and resumed (no reset on leave/reload); autosave every 5 minutes, immediate save on hide/unload.
- **Adventure leaderboard** — Records tab between Daily and Personal Best; rows show rank · user · paths · level-sublevel · time.
- **Records tuner** — per-tab / per-panel list, scroller, and row-spacing controls; layout save API returns JSON errors; level + sublevel collated as `Name - III`.
- **Start mode** — boot preference only; does not lock bottom-nav Adventure when Daily is selected.
- **Bottom menu** — hold ~½s to open (short taps no longer open by accident).
- **Board resume** — mid-puzzle Daily/Adventure placements are stashed when leaving (e.g. Random) and restored on return.

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.99.208` | 0.99.208 | Frozen — previous deploy line |
| `release/v0.99.210` | 0.99.210 | Frozen — superseded by 0.99.214 |
| `main` | — | Merge `release/v0.99.210` when ready |

### Deploy 0.99.210

```bash
git fetch origin
git checkout release/v0.99.210
git pull origin release/v0.99.210
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.210.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.210.sql
```

No schema changes.

## Verify

1. Cartographer's Journal shows **0.99.210** (no `v` prefix)
2. `GET /api/system-info` shows `0.99.210`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.210`
4. Start Daily, place tiles, leave ~minutes, return — timer continues (not `0:00`)
5. Hold bottom menu tab to open; Adventure reachable with Start mode = Daily
6. Place tiles on Daily → Random → return to Daily — board placements restored
7. Records → Adventure tab shows paths / level-sublevel / time

## Rollback

Point prod back to `release/v0.99.208` and redeploy. No data changes.
