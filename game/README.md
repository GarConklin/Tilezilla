# Game production bundle (Phase 1)

This folder holds **production-only** Docker definitions used when deploying to the VPS.

The live game bundle is built by:

```powershell
.\scripts\build-game-bundle.ps1
```

Output: `deploy-export\<timestamp>\game\` — copy **that folder** to `/opt/tilezilla` on the server.

## What the bundle includes

- `web/` (player UI — no tuner pages)
- `auth/`, `audio/`, `img/`, `solves/`
- `data/` catalog, layouts, daily CSV (no `solver-runs/`, batch txt, generator specs)
- `scripts/server.py` + runtime Python libs only
- `docker/` nginx, PHP, MySQL init

## What stays on your dev PC (not in bundle)

- Solver / enumerate / ingest scripts (`tools/scripts/` — wrappers in `scripts/` still work)
- `tools/data/solver-runs/`, batch queue `.txt` files
- Layout tuner HTML (`web/*-tuner.html`)
- Dev compose files (`docker-compose.yml`, remote-test)

## VPS deploy

```bash
cd /opt/tilezilla
cp .env.production.example .env.production   # first time only
nano .env.production
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

Progress JSON uses Docker volume `tilezilla_game_progress`. Guest events append to `data/guest_events.jsonl`.

## Updating content after ingest (dev workflow)

1. Run ingest/solver locally in the full repo
2. `.\scripts\build-game-bundle.ps1 -Force`
3. Rsync/scp the new `game/` folder to VPS
4. Rebuild: `docker compose ... up -d --build`

Optional DB export: `.\scripts\export-for-deploy.ps1` (SQL only — separate from game bundle).
