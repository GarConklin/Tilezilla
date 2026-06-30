# Tilezilla auth (PHP)

Registration and login use **tilegame.users** in MySQL on the Tilezilla server. Outbound email uses **direct SMTP** to `mail.skifflakegames.com:587` (separate VPS from Words Online).

## Local stack (3000 / 3001)

```powershell
docker compose up -d
```

Game: http://localhost:3000/ — Auth: http://localhost:3001/register.html

## Standalone auth (3001)

```powershell
docker compose -f docker-compose.auth.yml up -d --build
```

Set `SMTP_ENABLED=false` in env to skip real mail during local dev.

| File | Role |
|------|------|
| `src/EmailNotifier.php` | Direct SMTP client |
| `src/AuthManager.php` | Register/login against `tilegame.users` |
| `src/GuestManager.php` | Guest codes in tilegame |
| `api/*.php` | JSON auth API |

User ids (`user_id`) are returned as `id` in JSON for browser localStorage compatibility.
