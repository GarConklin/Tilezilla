# Tile Game MySQL (Docker)

Database name: **tilegame**

## Start

From repo root:

```powershell
copy .env.example .env
docker compose up -d mysql
```

First boot runs `docker/mysql/init/*.sql` (empty tables). Hint economy: [Docs/hint-economy.md](../Docs/hint-economy.md).

Persistent data: Docker volume `tilegame_mysql_data`.

**Solver / enumeration:** The solve scripts do **not** use MySQL. A single `solve-level.js` run works fine with MySQL up (~430 MiB). Failures with **exit 137** are Docker **out-of-memory kills**, usually from **multiple solve containers at once** (orphans + a batch script, or a stray 6×6 job). Before enumerating: `.\scripts\stop-solve-docker-runs.ps1` and run **one** batch only. Optional extra RAM: `docker compose stop mysql` during long runs, `docker compose up -d mysql` after.

## Connection (from host)

| Setting | Default |
|---------|---------|
| Host | `127.0.0.1` |
| Port | `3306` |
| Database | `tilegame` |
| User | `tilegame` |
| Password | see `.env` → `MYSQL_PASSWORD` |

```powershell
docker compose exec mysql mysql -utilegame -p tilegame
```

## Connection (from `web` container)

- Host: `mysql`
- Port: `3306`
- Same database/user/password as in `.env`

## Populate `levels` and daily schedule

If import fails with **Host is not allowed to connect**, the MySQL volume may be missing the `tilegame` database/user. Fix:

```powershell
.\scripts\bootstrap-mysql-tilegame.ps1
```

Import scripts auto-run bootstrap when needed.

Sync CSVs first (normalizes daily dates, validates adventure map):

```powershell
docker compose run --rm web python scripts/sync-daily-adventure-data.py
```

From repo root (MySQL must be running; `solves/` populated or `solves.zip` extracted):

```powershell
.\scripts\import-catalog-to-mysql.ps1
```

This upserts:

- **`levels`** — all rows from `data/levels/levels.json` (`total_unique_solutions` from `solves/*.json`)
- **`daily_challenges`** — from `data/daily_challenges_import.csv` (ISO dates; strips `.json` from level ids)

Source for daily edits: `data/daily_challenges_import-org.csv` (re-run sync script after changes).

Optional Workbench SQL: `python scripts/generate-daily-challenges-workbench-sql.py` → `data/daily_challenges_workbench.sql`

Canonical **solve layouts** stay in `solves/*.json` — MySQL V1 does not store placements.

Options: `-DryRun`, `-LevelsOnly`, `-DailyOnly`.

Options: `-DryRun`, `-LevelsOnly`, `-DailyOnly`, `-SyncDailyEligible`.

## Adventure progression

From repo root (MySQL must be running):

```powershell
# New DB: 03-adventure-schema.sql runs automatically on first mysql boot
# Existing volume:
Get-Content docker\mysql\init\03-adventure-schema.sql -Raw | docker compose exec -T mysql mysql -utilegame -ptilegame_dev tilegame

.\scripts\import-adventure-map.ps1
```

Authoritative CSV: `data/adventure_solution_distribution.csv` — puzzle map, step boundaries (`CH-lvl=T`), and progression counts. Step puzzle counts: `data/LevelSystem.csv`.

`import-adventure-map.ps1` loads `adventure_rank`, `adventure_progression`, `adventure_puzzle`, and `adventure_postgame_puzzle` (levels after the last ranked step).

Existing MySQL volume without postgame table:

```powershell
Get-Content docker\mysql\init\04-adventure-postgame.sql -Raw | docker compose exec -T mysql mysql -utilegame -ptilegame_dev tilegame
```

Existing MySQL volume without rank badge paths:

```powershell
Get-Content docker\mysql\init\06-adventure-rank-badges.sql -Raw | docker compose exec -T mysql mysql -utilegame -ptilegame_dev tilegame
```

Canonical rank list (names + `badge_image` URLs): `data/adventure_ranks.json`. Badge PNGs: `img/ranks/`.

## Upgrade existing MySQL volume

If the DB was created before `reference_id` on `hint_transactions`, either reset (below) or apply the migration manually:

```powershell
docker compose exec -T mysql mysql -uroot -p tilegame < docker/mysql/init/02-hint-transactions-reference-id.sql
```

(Use root password from `.env`.)

## Dev users (Gar + Arn)

After catalog and adventure imports:

```powershell
.\scripts\seed-dev-users.ps1
```

| User | Username | Password | Adventure |
|------|----------|----------|-----------|
| Gar | `gar` | `gar` | L1-1, all stats 0 |
| Arn | `Arn` | `arn` | L4-1 (1,141 puzzles through L3-10) |

Seeds `tilegame.users`, `tile_profiles`, and `player_progress`. If `words_db` is running, also seeds WordsOnline login accounts (same fixed ids `900001` / `900002`).

Use `-TilegameOnly` to skip WordsOnline. Use `-DryRun` to print steps without writing.

## Reset database (destructive)

```powershell
docker compose down
docker volume rm garz-puzzle_tilegame_mysql_data
docker compose up -d mysql
```
