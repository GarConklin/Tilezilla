# Release v0.99.312 — ISO day 312 cut

**Previous line:** `v0.99.295` → branch `release/v0.99.295` (kept as fallback)  
**Active:** `v0.99.312` → branch `release/v0.99.312`

Branch name matches `data/system_info.json` version (0.99.312).

## What landed since 0.99.264 (high level)

- **PHP auth image** — `php-auth` base image upgraded from PHP 8.1 (end of life) to 8.4.27 (from the 295 cut)
- **QZ tile** — new QZ tile as the mirror of QS, edges matched to the new art; unused OB alias removed from the live tile set
- **Swap draft puzzles** — 6,511 pair-swap drafts + `index.json` in `data/levels/specs/pair-swap-drafts/`; solution counts not yet run, not loaded by the game
- **Swap / QZ tooling** — batch, parallel, queue, status, witness-check, viewer and QZ homemade-enumerate scripts in `tools/scripts/`
- **Solver dependency fix** — restored `tools/scripts/lib/layout-equivalence-key.js` (`solves/solve-level.js` crashed with `MODULE_NOT_FOUND` without it)
- **Rank badges** — new gold rank badge art `img/ranks/gld-2.png` … `gld-9.png`
- **Tile cleanup** — obsolete `QS1-Tile.png` images removed (replaced by `QZ-Tile.png`)
- **Docs** — `Docs/TileZilla Levels names.xlsx` level names spreadsheet

### Deploy 0.99.312

```bash
git fetch origin
git checkout release/v0.99.312
git pull origin release/v0.99.312
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.312.sql
```

## Rollback

Point prod back to `release/v0.99.295` and redeploy if needed.
