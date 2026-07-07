# Release v0.99.187 — branch switch for testers

**Previous stable (testers stay here):** `v0.98.179` → branch `release/v0.98.179`  
**New development / deploy:** `v0.99.187` → branch `release/v0.99.187`

## What changed in 0.99.187 (vs 0.98.179)

- Journal **Records** tab — leaderboard + personal best (0 / 1 / 2+ hints)
- MySQL **daily leaderboard** API (`/api/daily-leaderboard`, all-time best)
- **Guest leaderboard preview** after daily solve (placement banner, not saved)
- **Daily post-solve flow** — fanfare → view today's leaderboard → daily hub
- **Lazy level catalog boot** — load current/next puzzle only; `stats-index.json` for passport
- **Auth expiry fix** — free accounts no longer blocked by legacy `active_until`
- **July 4 puzzle ingest** (5×6 + 6×6) + enumerate queues
- `daily_results.hints_used_count` migration for leaderboard hint buckets

## Git branches

| Branch | Version | Use |
|--------|---------|-----|
| `release/v0.98.179` | 0.98.179 | **Frozen** — point testers and stable prod at this until they migrate |
| `release/v0.99.187` | 0.99.187 | Active development and next deploy |
| `main` | — | Merge `release/v0.99.187` when ready to make 0.99.187 the default line |

### Testers on 0.98.179

```bash
git fetch origin
git checkout release/v0.98.179
# deploy / docker compose from this branch — do not pull main
```

### Deploy 0.99.187

```bash
git fetch origin
git checkout release/v0.99.187
git pull origin release/v0.99.187
```

## Version metadata

| Location | Purpose |
|----------|---------|
| `data/system_info.json` | Dev fallback + menu / Cartographer's Journal badge |
| `docker/mysql/init/09-system-info.sql` | Fresh MySQL volume seed |
| `scripts/sql/bump-version-0.99.187.sql` | **Upgrade existing** production DB |

## Database upgrade (existing server)

After pulling `release/v0.99.187` and rebuilding containers:

```bash
mysql -u tilegame -p tilegame < scripts/sql/bump-version-0.99.187.sql
```

Also run any new feature SQL if not already applied:

```bash
mysql -u tilegame -p tilegame < scripts/sql/daily-results-hints.sql
```

After puzzle ingest on server, regenerate compact catalog stats:

```bash
python scripts/build-level-stats-index.js
```

## Verify

1. Cartographer's Journal (main menu) shows **v0.99.187**
2. `GET /api/system-info` (or hamburger menu) shows `0.99.187`
3. `SELECT version FROM tilegame.system_info WHERE id = 1;` → `0.99.187`

## Rollback

Point testers or prod back to `release/v0.98.179` and redeploy. DB version string can stay at 0.99.187 or be reverted manually; gameplay data is compatible.
