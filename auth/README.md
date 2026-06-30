# Tilezilla auth (PHP)

Registration and login use **tilegame.users** in MySQL. Outbound email uses the Words Online **mail relay** on `words_network` (SMTP only — no WordsOnline account DB).

## Local stack (3000 / 3001)

```powershell
docker compose up -d
.\scripts\migrate-auth-to-tilegame.ps1   # once, if upgrading from WordsOnline accounts
```

Game: http://localhost:3000/ — Auth direct: http://localhost:3001/

## Standalone auth + mail relay (3001)

```powershell
# Words mail on words_network (in WordsOnline repo)
docker compose -f docker-compose.mail.yml up -d

docker compose -f docker-compose.auth.yml up -d --build
```

| File | Role |
|------|------|
| `src/Db.php` | Single tilegame connection |
| `src/AuthManager.php` | Register/login against `tilegame.users` |
| `src/GuestManager.php` | Guest codes in tilegame |
| `api/*.php` | JSON auth API |

User ids (`user_id`) are returned as `id` in JSON for browser localStorage compatibility.
