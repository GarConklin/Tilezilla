# Tilezilla

This is a refactored version that separates:
- `web/index.html` (layout only)
- `web/css/styles.css`
- `web/js/app.js` (UI + placement)
- `web/js/solver.js` (solver + visible log)
- `web/js/solutions.js` (save/load solutions)

## Run (Docker)
```bash
docker compose up --build
```
Open http://127.0.0.1:8081/tilezilla-v2.html (local Python dev) or http://127.0.0.1:3000/ (Docker)

## Remote / LAN testing (Windows 11)

For testing on a phone or tablet on the same Wi‑Fi:

```powershell
.\scripts\start-remote-test.ps1 -OpenFirewall -SeedUsers
```

## Production deploy (Ubuntu / tile.skifflakegames.com)

See **[Docs/deploy-ubuntu.md](Docs/deploy-ubuntu.md)** — export DB from Windows, restore on server, HTTPS + mail relay.

```powershell
.\scripts\export-for-deploy.ps1 -IncludeSolves
```

This starts a self-contained stack (`docker-compose.remote-test.yml`):

- **nginx gateway** on port **3000** — one URL for the game and `/auth/*`
- **PHP auth** direct on port **3001** (optional; same stack)
- **Python** game server (live-mounted repo)
- **PHP** auth (local MySQL stub — no Words Online mail stack required)
- **MySQL** for adventure path API and optional dev logins

The script prints a **LAN URL** (e.g. `http://192.168.1.42:3000`). Open that on your test device.

| Command | Purpose |
|---------|---------|
| `.\scripts\start-remote-test.ps1` | Start stack |
| `.\scripts\start-remote-test.ps1 -Port 9080 -OpenFirewall` | Custom port + firewall rule |
| `.\scripts\stop-remote-test.ps1` | Stop containers (keeps DB volume) |
| `.\scripts\stop-remote-test.ps1 -RemoveVolumes` | Stop and **wipe all accounts** (shared volume) |

**MySQL persistence:** Both `docker compose up` and the remote-test stack use the same Docker volume **`tilezilla_shared_mysql_data`**. Switching stacks does not delete accounts. Data is only lost if you run `docker volume rm tilezilla_shared_mysql_data` or `stop-remote-test.ps1 -RemoveVolumes`. After upgrading from older setups, run `.\scripts\ensure-shared-mysql-volume.ps1` once to copy legacy account data into the shared volume.

**Guest play** works without login. With `-SeedUsers`, dev accounts `gar` / `gar` and `Arn` / `arn` are seeded (requires game catalog import for full registered play).

Copy `.env.remote-test.example` to `.env.remote-test` to pin a fixed LAN IP / port; the start script regenerates this file each run.

## Files you must provide
Put your real files in `web/img/`:
- tile images: `web/img/*.png`
- `web/img/tiles.json` (array of filenames)
- `data/tiles/tiles-live-edges.json` (your live-edge map)
