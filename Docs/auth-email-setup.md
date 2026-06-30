# Tilezilla — Auth & Email Setup

Tilezilla runs on its **own VPS** (`tile.skifflakegames.com`). Accounts live in **`tilegame.users`** on the Tilezilla MySQL container. Outbound mail goes **directly over SMTP** to the Skifflake mail server — no Docker shared networks, no sendmail, no Words Online container hostnames.

## Architecture

```
Browser  →  tile.skifflakegames.com (nginx → Docker gateway)
              ↓
         PHP auth (auth/api/*.php)
              ↓
         tilegame MySQL (users, profiles, progress)
              ↓
         EmailNotifier.php  →  SMTP socket  →  mail.skifflakegames.com:587
```

| Layer | Location | Purpose |
|-------|----------|---------|
| Tilezilla VPS | Separate server (e.g. `76.13.26.113`) | Game, auth, MySQL |
| Mail server | `mail.skifflakegames.com` | Postfix relay (port **587** open; port **25** not used from Tilezilla) |
| Accounts | `tilegame.users` | Register, login, email verification |
| Auth code | `auth/` in this repo | PHP API + login/register pages |

Tilezilla and Words Online are **separate deployments**. They communicate only via public SMTP to `mail.skifflakegames.com`, not via Docker networks.

## SMTP settings (`.env.production` or auth container env)

| Variable | Production value | Notes |
|----------|------------------|-------|
| `SMTP_ENABLED` | `true` | Set `false` to disable outbound mail |
| `SMTP_HOST` | `mail.skifflakegames.com` | Public hostname of mail server |
| `SMTP_PORT` | `587` | Submission relay port |
| `SMTP_TLS` | `none` | `none`, `starttls`, or `ssl` (use `none` to match current IP-trusted relay) |
| `SMTP_USER` | (empty) | Set when relay requires AUTH |
| `SMTP_PASS` | (empty) | Set when relay requires AUTH |
| `APP_FROM_EMAIL` | `words@skifflakegames.com` | From header — must be allowed by relay |
| `APP_NAME` | `Tilezilla` | Shown in email subjects |
| `APP_BASE_URL` | `https://tile.skifflakegames.com` | Verification/reset links |

Relay policy today: **no TLS, no AUTH** — the mail server trusts the Tilezilla VPS IP. Enable `SMTP_TLS` or credentials later if relay policy changes.

## Accounts (free play)

New signups stay active after email verification — **no trial expiry** (`active_until` is NULL). Login/session checks only block accounts when `active_until` is set and in the past (for a future paid tier).

## Production test

After `docker compose -f docker-compose.production.yml --env-file .env.production up -d --build php-auth`:

```bash
docker exec -it tilezilla_auth php -r "
require_once '/var/www/html/src/EmailNotifier.php';
\$ok = EmailNotifier::send('your@email.com', 'Tilezilla test', '<p>SMTP works.</p>');
echo \$ok ? 'sent' : 'failed';
"
```

On failure:

```bash
docker logs tilezilla_auth --tail 50
```

From the Tilezilla host, confirm port 587 is reachable (port 25 is not required):

```bash
nc -zv mail.skifflakegames.com 587
```

## Local dev

Auth uses the same SMTP settings. For local registration testing without sending real mail, set `SMTP_ENABLED=false` in your env file.

```powershell
docker compose up -d
# or standalone auth:
docker compose -f docker-compose.auth.yml up -d --build
```

## Config (`auth/config/config.php`)

Environment variables override file defaults. See `auth/config/config.example.php`.

| Key | Notes |
|-----|-------|
| `db.*` | Tilezilla MySQL (`mysql` in Docker) |
| `app.base_url` | Public HTTPS URL for email links |
| `app.from_email` | Sender address |
| `smtp.*` | Mirrors `SMTP_*` env vars |

## API endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/register.php` | POST | Create account, send verification email |
| `/api/verify-email.php` | GET | Activate account (`?token=...`) |
| `/api/login.php` | POST | Session login |
| `/api/logout.php` | POST | End session |
| `/api/check-session.php` | GET | Current user JSON |
| `/api/forgot-password.php` | POST | Send reset email |
| `/api/reset-password.php` | POST | Set new password |

## Web pages

| Page | Path |
|------|------|
| Login | `/auth/login.html` |
| Register | `/auth/register.html` |
| Verify email | `/auth/verify-email.html?token=...` |

## Nginx (production)

Host nginx terminates TLS and proxies to Docker gateway on `127.0.0.1:3000`. The gateway routes `/auth/` to PHP auth. See `Docs/deploy-ubuntu.md` and `docker/nginx/host-reverse-proxy.example.conf`.

## Troubleshooting

| Problem | Check |
|---------|-------|
| Email not sent | `docker logs tilezilla_auth`; verify `SMTP_ENABLED=true` |
| Connection refused | `nc -zv mail.skifflakegames.com 587` from Tilezilla VPS |
| Relay denied | Tilezilla VPS IP allowlisted on mail server? `APP_FROM_EMAIL` permitted? |
| Login says verify email | User must click registration link first |
| DB connection failed | MySQL healthy? `.env.production` passwords match volume? |

See also: `Docs/deploy-ubuntu.md`
