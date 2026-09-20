# Release v0.99.263 — ISO day 263 cut

**Previous:** `v0.99.253`  
**New:** `v0.99.263`

## What landed since 0.99.253

- **Adventure path lag** — API response cached + gzipped (~2MB → ~120KB); client prefers JSON path
- **LevelSystem climb** — curated gates restored; contiguous Adv ranges; challenge-aware proposal (55×15 prep)
- **Daily schedule** — from 2026-09-21 forward, each week peaks Monday → Sunday lowest (history before that stays Sat-peak)
- **Soft restart** — production weekly restart moved to Wednesday 03:00
- **False bonus** — no bonus award when solution catalog fails to load
- Rank badge v2 tuner prep (BG + Nc + silver I–XV) — not live badges yet

### Deploy 0.99.263

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
  < scripts/sql/bump-version-0.99.263.sql
```
