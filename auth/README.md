# Tilezilla Auth Package

PHP registration/login wired to **Words Online mail server** and **WordsOnline.users** shared accounts.

**Full setup guide:** [`../Docs/auth-email-setup.md`](../Docs/auth-email-setup.md)

## Start

```powershell
# 1. Words stack + mail (once)
cd D:\Words-Online\WordsOnline
docker compose up -d
docker compose -f docker-compose.mail.yml up -d

# 2. Tilezilla auth
cd C:\Users\~Gar\Tile-Puzzle\Tilezilla
docker compose -f docker-compose.auth.yml up -d --build
```

Open: http://localhost:8081/register.html

## Files

| Path | Role |
|------|------|
| `src/EmailNotifier.php` | Sends via `mail()` → `words_mailserver` |
| `src/AuthManager.php` | Register/login against WordsOnline DB |
| `api/*.php` | REST endpoints |
| `public/*.html` | Login, register, verify pages |
| `config/config.php` | DB + app URL (from env or edit directly) |
