# Deploy Tilezilla to Ubuntu (tile.skifflakegames.com)

Step-by-step for moving your **Windows dev stack** (code + MySQL + users) to a live VPS.

**Production URL:** `https://tile.skifflakegames.com`

---

## Overview

| Piece | How it runs on the server |
|-------|---------------------------|
| Game + APIs | Python `scripts/server.py` in Docker (`tilezilla_prod_web`) |
| Auth (register/login) | PHP in Docker (`tilezilla_auth`) |
| MySQL | Docker volume `tilezilla_shared_mysql_data` |
| HTTPS | **Host nginx** (already on the VPS) → Docker gateway on `127.0.0.1:3000` |
| Email | PHP `mail()` → sendmail → **Words mail relay** on Docker `words_network` |

**Host ports (do not use 8080 on the VPS):**

| Service | Host port | Notes |
|---------|-----------|--------|
| Tilezilla Web (gateway) | **3000** | Game + `/auth/*` — host nginx reverse-proxies here |
| Tilezilla Auth (direct) | **3001** | Optional; bound to localhost for debugging |
| MySQL | internal only | Not exposed publicly in production compose |

---

## Part 1 — Export from Windows (after your last tweaks)

1. Commit and push to GitHub:

   ```powershell
   git add -A
   git commit -m "Ready for tile.skifflakegames.com deploy"
   git push origin main
   ```

2. Ensure Docker MySQL is running:

   ```powershell
   docker compose up -d mysql
   ```

3. Run the export script:

   ```powershell
   .\scripts\export-for-deploy.ps1 -IncludeSolves
   ```

   Output: `deploy-export\YYYYMMDD-HHMMSS\` containing:
   - `tilegame.sql` — full database
   - `manifest.json` — git commit + file list
   - `.env.production.example`
   - `solves.zip` (if `-IncludeSolves` and file exists)

   Optional: `-IncludeEnv` copies your local `.env` (secrets — handle carefully).

4. Copy the export folder to the server:

   ```powershell
   scp -r deploy-export\20260629-120000 user@YOUR_SERVER_IP:/opt/tilezilla/deploy-import/
   ```

---

## Part 2 — Ubuntu server setup (one-time)

### Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl git unzip
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in
```

### Clone the repo

```bash
sudo mkdir -p /opt/tilezilla
sudo chown $USER:$USER /opt/tilezilla
cd /opt/tilezilla
git clone https://github.com/GarConklin/Tilezilla.git .
```

### DNS

Point **`tile.skifflakegames.com`** A record to the server’s public IP.

---

## Part 3 — Restore database and start stack

```bash
cd /opt/tilezilla
chmod +x scripts/restore-on-ubuntu.sh

# Edit production env (passwords!) before or after first copy:
cp .env.production.example .env.production
nano .env.production

./scripts/restore-on-ubuntu.sh deploy-import/20260629-120000
```

Smoke test (on the server):

```bash
curl -sI http://127.0.0.1:3000/tilezilla-v2.html
curl -s http://127.0.0.1:3000/api/system-info | head
```

---

## Part 4 — HTTPS with host nginx

Tilezilla runs **inside Docker** on `127.0.0.1:3000`. Your **existing nginx** on the VPS terminates TLS and proxies to that port. Do not expose port 3000 on the public firewall — only nginx needs to reach it locally.

### Architecture

```
Internet → nginx :443 (host) → 127.0.0.1:3000 (Docker gateway) → web + php-auth
```

The Docker gateway (`docker/nginx/production.conf`) already routes `/` to the game and `/auth/` to PHP. Host nginx only needs one `proxy_pass` to port **3000**.

### Site config

Copy the example from the repo:

```bash
cd /opt/tilezilla
sudo cp docker/nginx/host-reverse-proxy.example.conf \
  /etc/nginx/sites-available/tile.skifflakegames.com
sudo ln -sf /etc/nginx/sites-available/tile.skifflakegames.com \
  /etc/nginx/sites-enabled/
```

Or paste the same file manually — see `docker/nginx/host-reverse-proxy.example.conf`.

Test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Let’s Encrypt (certbot)

If certbot is not installed:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain a certificate and let certbot patch the nginx config:

```bash
sudo certbot --nginx -d tile.skifflakegames.com
```

Renewal is usually automatic via `certbot.timer`. Test with:

```bash
sudo certbot renew --dry-run
```

### Verify HTTPS

```bash
curl -sI https://tile.skifflakegames.com/tilezilla-v2.html
curl -s https://tile.skifflakegames.com/api/system-info | head
```

**Important:** `APP_BASE_URL` in `.env.production` must be `https://tile.skifflakegames.com` so verification emails and auth redirects use HTTPS links.

**Do not** bind Tilezilla’s Docker gateway to `0.0.0.0:3000` on a shared server — keep `GATEWAY_BIND=127.0.0.1:3000` in `.env.production` so only host nginx can reach it.

---

## Part 5 — Mail server (registration / password reset)

Tilezilla auth sends mail via **PHP `mail()` → sendmail → SMTP relay** configured in `docker/php/Dockerfile`:

- Relay host: `mailserver` (Docker hostname)
- Port: `587`
- Network: **`words_network`** (external Docker network)

The production compose file attaches `tilezilla_auth` to `words_network`. That network and the mail container must exist **before** email works.

### Option A — Same server already runs Words Online mail (typical Skifflake setup)

On the server (Words Online repo):

```bash
cd /path/to/WordsOnline
docker compose up -d
docker compose -f docker-compose.mail.yml up -d
```

Verify:

```bash
docker network inspect words_network --format '{{range .Containers}}{{.Name}} {{end}}'
# Should include something like words_mailserver
```

Then restart Tilezilla auth:

```bash
cd /opt/tilezilla
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build php-auth
```

Test email from the auth container:

```bash
docker exec -it tilezilla_auth php -r "
require_once '/var/www/html/src/EmailNotifier.php';
\$ok = EmailNotifier::send('your@email.com', 'Tilezilla test', '<p>Mail relay works.</p>');
echo \$ok ? 'sent' : 'failed';
"
```

If it fails:

```bash
docker logs tilezilla_auth --tail 30
docker logs words_mailserver --tail 30   # name may vary
```

### Option B — Mail on another machine

You need a reachable SMTP relay and must update `docker/php/Dockerfile` `SMART_HOST` (or use a different PHP mail transport). Discuss with whoever runs `words@skifflakegames.com` DNS (SPF/DKIM).

### Option C — Test without mail first

Guest play and existing logins work without mail. New registrations will create accounts but **verification email won’t send** until Option A/B is wired.

### Email settings checklist

| Setting | Where | Value |
|---------|--------|--------|
| `APP_BASE_URL` | `.env.production` | `https://tile.skifflakegames.com` |
| `APP_FROM_EMAIL` | `.env.production` | `words@skifflakegames.com` (must match relay policy) |
| Auth container on `words_network` | `docker-compose.production.yml` | automatic |
| DNS SPF | DNS panel | must authorize sending server |

Verification link format:  
`https://tile.skifflakegames.com/auth/verify-email.html?token=...`

---

## Part 6 — Post-deploy checks

```bash
# System stats (registered users, known routes)
docker compose -f docker-compose.production.yml exec web \
  python scripts/refresh-system-stats.py

# Adventure path API
curl -s https://tile.skifflakegames.com/api/adventure/path | head

# Auth session (guest)
curl -s https://tile.skifflakegames.com/auth/api/check-session.php
```

In the browser:

1. `https://tile.skifflakegames.com/` — load screen  
2. `https://tile.skifflakegames.com/tilezilla-v2.html` — game  
3. Register a test account (after mail works)  
4. Log in as `gar` / dev user if seeded in SQL dump  

---

## Updating later (code only)

```bash
cd /opt/tilezilla
git pull
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

Database is preserved in `tilezilla_shared_mysql_data`.

## Updating later (new DB from Windows)

Re-run `export-for-deploy.ps1` on Windows, copy new `tilegame.sql`, on server:

```bash
docker compose -f docker-compose.production.yml exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" tilegame < deploy-import/NEW/tilegame.sql
```

---

## Files reference

| File | Purpose |
|------|---------|
| `docker-compose.production.yml` | Production stack |
| `.env.production.example` | Env template |
| `docker/nginx/host-reverse-proxy.example.conf` | Host nginx site (HTTPS → :3000) |
| `docker/nginx/production.conf` | Internal Docker gateway |
| `scripts/export-for-deploy.ps1` | Windows export |
| `scripts/restore-on-ubuntu.sh` | Ubuntu restore |
| `Docs/auth-email-setup.md` | Auth + mail architecture |

---

## Quick troubleshooting

| Problem | Fix |
|---------|-----|
| `words_network` not found | Start Words mail stack or create network: `docker network create words_network` (mail still won’t work until relay exists) |
| 502 on HTTPS | `curl http://127.0.0.1:3000/` — if fail, `docker compose logs gateway web`; if OK, check host nginx error log |
| Login works locally not on HTTPS | `APP_BASE_URL` must be `https://…`; cookies need same site |
| Email not received | Test with `docker exec` snippet above; check spam; check `words_mailserver` logs |
| Empty adventure / stats | Run `refresh-system-stats.py`; confirm SQL import succeeded |

For ChatGPT / mail deep-dive, share: output of `docker network inspect words_network`, auth test send result, and whether Words Online mail compose is on the **same VPS** or a separate host.
