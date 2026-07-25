# Release v0.99.205 — iPhone shell fix

**Previous:** `v0.99.200`
**Current:** `v0.99.205` — same branch `release/v0.99.200`

## What changed in 0.99.205 (vs 0.99.200)

- **iPhone shell crash** — `requestIdleCallback` does not exist in iOS Safari, and optional chaining does not protect a bare undeclared identifier, so profile overlay init threw a `ReferenceError` that aborted the remaining shell wiring. Use Hints and adventure Continue never received listeners on iPhone (the click sound still played because SFX is wired earlier).
- **Shell hardening** — profile overlay init is wrapped so a single module failure can no longer take down hint, nav, and settings wiring.
- **Hamburger menu** — menu Settings now closes the menu properly instead of only hiding it, so `tz-modal-open` clears and the hamburger stays usable.
- **Bottom nav** — Adventure and Daily hit targets now match their plaque art (they were swapped against the `--adventure` / `--daily-challenge` classes), the nav re-syncs from the current screen when opened, and the menu button is inert until boot finishes.
- **Start mode setting** — new Gameplay setting picks whether Daily Challenge or Adventure loads at launch; changing it switches modes immediately.
- **Long press** — player level, card stats, and the hint plaque now require a 1 second hold instead of a tap. Rotate stays an instant click.

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.205.sql` | **Upgrade existing** production DB |

## Deploy

```bash
git fetch origin
git checkout release/v0.99.200
git pull origin release/v0.99.200
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

## Database upgrade (existing server)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < scripts/sql/bump-version-0.99.205.sql
```

No schema changes — the 0.99.200 table upgrades still apply.

## Verify

1. Cartographer's Journal shows **v0.99.205**
2. `GET /api/system-info` shows `0.99.205`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.205`
4. On iPhone: hold the hint plaque 1 second → Use Hint confirm opens
5. On iPhone: adventure Continue loads the next puzzle
6. Open the hamburger during boot → no dead modal state

## Rollback

Point prod back to `653e04d` (0.99.200) and redeploy. No data changes.
