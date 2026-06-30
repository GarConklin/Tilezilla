# Release v0.98.179 — branch switch for testers

**Previous stable (testers stay here):** `v0.97.178` → branch `release/v0.97.178`  
**New development / deploy:** `v0.98.179` → branch `release/v0.98.179`

## What changed in 0.98.179 (vs 0.97.178)

- Server-backed hint tokens (`auth/api/hints.php`, `HintManager`)
- In-game random hint confirm popup + smart placement
- Admin user management (`is_admin`, `web/admin-users.html`)
- Hint access gating, viewport lock, profile hint display
- Auth / guest / buy-hints popup wiring updates

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.97.178` | 0.97.178 | **Frozen** — point testers and stable prod at this until they migrate |
| `release/v0.98.179` | 0.98.179 | Active development and next deploy |
| `main` | — | Merge `release/v0.98.179` when ready to make 0.98.179 the default line |

### Testers on 0.97.178

```bash
git fetch origin
git checkout release/v0.97.178
# deploy / docker compose from this branch — do not pull main
```

### Deploy 0.98.179

```bash
git fetch origin
git checkout release/v0.98.179
git pull origin release/v0.98.179
```

### Publish branches (one-time, from repo maintainer)

```powershell
git branch release/v0.97.178 main   # if not already created at d4944de
git checkout -b release/v0.98.179
# commit all 0.98.179 work, then:
git push -u origin release/v0.97.178
git push -u origin release/v0.98.179
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.98.179.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

After pulling `release/v0.98.179` and rebuilding containers:

```bash
mysql -u tilegame -p tilegame < scripts/sql/bump-version-0.98.179.sql
```

Also run any new feature SQL if not already applied:

```bash
# Admin access (set your username)
mysql -u tilegame -p tilegame < scripts/sql/grant-admin.sql
```

Hint tables/columns should already exist from V1 schema (`hint_transactions`, `users.hint_tokens`). No schema version bump required for the app version alone.

## Verify

1. Cartographer's Journal (main menu) shows **v0.98.179**
2. `GET /api/system-info` (or hamburger menu) shows `0.98.179`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.98.179`

## Rollback

Point testers or prod back to `release/v0.97.178` and redeploy. DB version string can stay at 0.98.179 or be reverted manually; gameplay data is compatible.
