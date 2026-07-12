# Game production bundle (Phases 1 + 5)

This folder holds **production-only** Docker definitions. The VPS runs **only** the game runtime — no solver tooling, no full-repo bind mount, no Node.js in the web image.

## Build & deploy

```powershell
.\scripts\build-game-bundle.ps1
```

Output: `deploy-export\<timestamp>\game\` — copy **that entire folder** to `/opt/tilezilla` on the server.

```bash
cd /opt/tilezilla
cp .env.production.example .env.production   # first time; edit passwords
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

The bundle ships `Dockerfile`, `.dockerignore`, and `docker-compose.production.yml` at the deploy root. Do **not** set `PROD_WEB_DOCKERFILE` in `.env.production` for bundle deploys.

## Production stack (Phase 5)

| Service | Role |
|---------|------|
| `gateway` | nginx — `/img`, `/web`, `/audio` read-only mounts only |
| `web` | Python `scripts/server.py` — code baked into image (rebuild to update) |
| `php-auth` | Register / login |
| `mysql` | Persistent volume `tilezilla_shared_mysql_data` |

Progress JSON: Docker volume `tilezilla_game_progress`. Guest events: bind `data/guest_events.jsonl`.

**Not** mounted: `tools/`, solver scripts, tuner HTML, batch `.txt` files.

## Full git clone on VPS (optional)

If you deploy via `git pull` instead of the bundle, uncomment in `.env.production`:

```
PROD_WEB_DOCKERFILE=game/Dockerfile
```

Or test locally: `.\scripts\start-production-stack.ps1`

## Dev machine (not on VPS)

| Path | Contents |
|------|----------|
| `tools/scripts/` | Solver, ingest, enumerate |
| `tools/data/` | Batch files, solver-runs logs |
| `tools/web/` | Layout tuners (`/tools/tuners.html`) |
| `docker-compose.yml` | Dev stack (bind-mounts repo, includes Node in web image) |

## After ingest (dev workflow)

1. Run ingest/solver in the full repo
2. `.\scripts\build-game-bundle.ps1 -Force`
3. Rsync/scp `deploy-export/<stamp>/game/` to VPS
4. `docker compose ... up -d --build`

Optional DB-only export: `.\scripts\export-for-deploy.ps1`
