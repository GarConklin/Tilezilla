# Tilezilla — Auth & Email Setup

Tilezilla uses the **same Skifflake mail server and user accounts** as Words Online. No second email server is required.

## Architecture

```
Browser  →  Tilezilla PHP (auth/api/*.php)
              ↓
         WordsOnline MySQL (users table — shared accounts)
              ↓
         PHP mail()  →  sendmail  →  mailserver:587  →  words_mailserver
```

| Layer | Location | Purpose |
|-------|----------|---------|
| Mail relay | `words_mailserver` on Docker network `words_network` | Postfix, hostname `mailserver` |
| Auth DB | `WordsOnline.users` | Register, login, email verification |
| Game DB | `tilegame` | Progress, hints, daily challenges (`tile_profiles`, etc.) |
| Auth code | `auth/` in this repo | PHP API + login/register pages |
| Static game | `web/` + Python `scripts/server.py` | Gameplay (port 8081 by default) |
| Auth web | `docker-compose.auth.yml` → port 8081 | PHP/Apache auth service |

## Quick start (production server)

Words Online and the mail server must already be running:

```bash
# On server — mail + words stack
cd /path/to/WordsOnline
docker compose up -d
docker compose -f docker-compose.mail.yml up -d
```

Then start Tilezilla auth:

```bash
cd /path/to/Tilezilla
cp auth/config/config.example.php auth/config/config.php
# Edit config.php: DB host, base_url, admin email

docker compose -f docker-compose.auth.yml up -d --build
```

Test email from the auth container:

```bash
docker exec -it tilezilla_auth php -r "
require_once '/var/www/html/src/EmailNotifier.php';
\$ok = EmailNotifier::send('your@email.com', 'Tilezilla test', '<p>Mail relay works.</p>');
echo \$ok ? 'sent' : 'failed';
"
```

## Quick start (local dev)

1. Start Words Online stack (creates `words_network` + `words_mailserver`):

   ```powershell
   cd D:\Words-Online\WordsOnline
   docker compose up -d
   docker compose -f docker-compose.mail.yml up -d
   ```

2. Copy and edit config:

   ```powershell
   cd C:\Users\~Gar\Tile-Puzzle\Tilezilla
   copy auth\config\config.example.php auth\config\config.php
   ```

   Set `db.host` to `words_db` (container name on `words_network`).

3. Start auth service:

   ```powershell
   docker compose -f docker-compose.auth.yml up -d --build
   ```

4. Open `http://localhost:8081/register.html` to test registration.

## Config (`auth/config/config.php`)

| Key | Example | Notes |
|-----|---------|-------|
| `db.host` | `words_db` | Words MySQL container on `words_network` |
| `db.database` | `WordsOnline` | Shared user accounts |
| `game_db.host` | `garz-puzzle-mysql` | Tilezilla MySQL (optional, for profiles) |
| `game_db.database` | `tilegame` | Game progress DB |
| `app.base_url` | `https://tile.skifflakegames.com` | Verification/reset links in emails |
| `app.from_email` | `words@skifflakegames.com` | Same sender domain as Words |
| `app.name` | `Tilezilla` | Shown in email subjects |

## API endpoints

All served from the auth container (`/api/`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/register.php` | POST | Create account, send verification email |
| `/api/verify-email.php` | GET | Activate account (`?token=...`) |
| `/api/login.php` | POST | Session login |
| `/api/logout.php` | POST | End session |
| `/api/check-session.php` | GET | Current user JSON |
| `/api/forgot-password.php` | POST | Send reset email |
| `/api/reset-password.php` | POST | Set new password |

### Register (JSON body)

```json
{ "username": "player1", "email": "you@example.com", "password": "secret12" }
```

### Login (JSON body)

```json
{ "username": "player1", "password": "secret12" }
```

Username field accepts **username or email**.

## Web pages

| Page | Path |
|------|------|
| Login | `/login.html` |
| Register | `/register.html` |
| Verify email | `/verify-email.html?token=...` |
| Game | `/web/index.html` (static, Python server or nginx proxy) |

## Wiring the game client (`web/js/app_v16.js`)

Replace the local `userSelect` dropdown with session auth:

```javascript
// At startup
const auth = await fetch('/api/check-session.php').then(r => r.json());
if (!auth.authenticated) {
  window.location.href = '/login.html?return=' + encodeURIComponent(location.pathname);
}
state.userId = String(auth.user.id);  // WordsOnline users.id
```

Include `auth/public/js/auth-utils.js` on game pages if you proxy API through the same host.

## Shared accounts

- One Skifflake account works for **Words** and **Tilezilla**.
- `users.id` from WordsOnline is the `user_id` / `words_user_id` in tilegame tables.
- See `docker/mysql/init/05-tile-profiles.sql` for tilegame-specific profile fields.

## Alternative: call Words APIs directly (no local PHP)

If you prefer zero mail config in Tilezilla, point forms at Words Online:

- `POST https://words.skifflakegames.com/api/register.php`
- `GET https://words.skifflakegames.com/api/verify-email.php?token=...`
- `POST https://words.skifflakegames.com/api/login.php`

Downside: PHP sessions are per-domain unless cookies use `.skifflakegames.com`.

**Recommended:** use the local `auth/` package on `words_network` so verification links and sessions stay on the Tilezilla domain.

## Nginx reverse proxy (production)

Example host `tile.skifflakegames.com`:

- `/api/*`, `/login.html`, `/register.html`, `/verify-email.html` → `tilezilla_auth:80`
- `/web/*`, `/data/*`, `/solves/*` → Python static server or nginx static root

## Troubleshooting

| Problem | Check |
|---------|-------|
| Email not sent | `docker logs words_mailserver --tail 20` |
| Connection refused to mail | Auth container on `words_network`? `docker network inspect words_network` |
| DB connection failed | `db.host` must be reachable from auth container (`words_db` on server) |
| Login says verify email | User must click link from registration email first |

See also: `D:\Words-Online\WordsOnline\TEST_EMAIL_SETUP.md`
