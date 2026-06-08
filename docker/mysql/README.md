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

From repo root (MySQL must be running; `solves/` populated or `solves.zip` extracted):

```powershell
.\scripts\import-catalog-to-mysql.ps1
```

This upserts:

- **`levels`** — all rows from `data/levels/levels.json` (`total_unique_solutions` from `solves/*.json`)
- **`daily_challenges`** — from `data/daily_challenges_import.csv` (strips `.json` from level ids)

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

Authoritative CSV: `data/adventure_solution_distribution.csv` — puzzle map, step boundaries (`CH-lvl=T`), and progression counts.

`import-adventure-map.ps1` loads `adventure_rank`, `adventure_progression`, `adventure_puzzle`, and `adventure_postgame_puzzle` (levels after L8-10).

Existing MySQL volume without postgame table:

```powershell
Get-Content docker\mysql\init\04-adventure-postgame.sql -Raw | docker compose exec -T mysql mysql -utilegame -ptilegame_dev tilegame
```

## Upgrade existing MySQL volume

If the DB was created before `reference_id` on `hint_transactions`, either reset (below) or apply the migration manually:

```powershell
docker compose exec -T mysql mysql -uroot -p tilegame < docker/mysql/init/02-hint-transactions-reference-id.sql
```

(Use root password from `.env`.)

## Reset database (destructive)

```powershell
docker compose down
docker volume rm garz-puzzle_tilegame_mysql_data
docker compose up -d mysql
```
