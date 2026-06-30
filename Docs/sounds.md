# Tilezilla — Sound effects

How game sounds are stored, served, and played in the web client.

**Related:** gameplay settings in `web/js/tilezilla-settings.js`; Docker/nginx serve `/audio/*` from the repo `audio/` folder.

---

## Audio files

All clips live in **`audio/`** at the repo root (MP3). The game loads them by URL, e.g. `/audio/tile-place.mp3`.

| File | SFX key | Used? |
|------|---------|-------|
| `ui-click.mp3` | `uiClick` | Yes |
| `tile-place.mp3` | `tilePlace` | Yes |
| `tile-pickup.mp3` | `tilePickup` | Yes |
| `tile-bump.mp3` | `tileInvalid` | Yes |
| `solve-ok.mp3` | `solveOk` | Yes |
| `spinCWTile.mp3` | `spinCWTile` | Yes |
| `spinCCWTile.mp3` | `spinCCWTile` | Yes |
| `closebuttonclick.mp3` | `backButton` | Yes |
| `Swipe.mp3` | `swipeStartScreen` | Yes |
| `ChimeChirp.mp3` | `generalSelection` | Yes |
| `Success-fanfare.mp3` | `levelSuccess` | Yes |
| `itemclick.mp3` | — | **Not wired** (reserved) |
| `tile-bump2.mp3` | — | **Not wired** (alternate bump) |

Canonical mapping is `SFX_CLIPS` in `web/js/tilezilla-sfx.js`.

---

## How files are served

| Environment | Path |
|-------------|------|
| Local Python (`scripts/server.py`) | `GET /audio/<file>.mp3` → `audio/<file>.mp3` |
| Docker production / remote-test nginx | `location /audio/` → `/app/audio/` |

No build step — add or replace MP3s in `audio/` and redeploy (or refresh the browser).

---

## Client module: `web/js/tilezilla-sfx.js`

Central sound layer added for production-ready SFX:

- **`SFX_CLIPS`** — maps logical names to `/audio/...` URLs  
- **`playSfx(name)`** — plays a clip if sound effects are enabled  
- **`setSfxEnabled(on)`** — respects Settings → Sound effects ON/OFF  
- **`initTilezillaSfx()`** — document-level click handlers for UI/back/selection sounds  
- **`unlockAudio()`** — satisfies browser autoplay policy (first tap/key must unlock audio)

Clips are cached in memory (`new Audio(src)`). Overlapping plays use `cloneNode()` when the same clip is already playing.

### Autoplay note

Browsers block audio until a **user gesture**. `unlockAudio()` runs on `pointerdown` / `touchstart` / `keydown`. Tile placement/pickup sounds are triggered **before** `await renderTiles()` in `app_v16.js` so they stay inside the gesture chain when possible.

---

## Where sounds are initialized

| Page / entry | File | What runs |
|--------------|------|-----------|
| Load / startup screen | `web/js/tilezilla-load.js` | `setSfxEnabled(...)`, `initTilezillaSfx()` |
| Main game shell | `web/js/tilezilla-bootstrap.js` | Same on boot; updates when settings change |

Settings are stored in `localStorage` via `loadGameplaySettings()` / `saveGameplaySettings()` (`tilezilla-settings.js`). Default: **Sound effects ON**.

UI: **Settings → Sound effects** toggle in `web/tilezilla-v2.html`.

---

## Where each sound is triggered

### Automatic UI (via `initTilezillaSfx` click delegation)

| Sound key | When |
|-----------|------|
| `backButton` | Back/exit/close hits: settings back, journal exit, hint exit, modal backdrops, `[data-sfx="back"]` |
| `generalSelection` | Tab/segment picks: `.tz-segment`, bottom nav, menu tabs, `[data-sfx="select"]` |
| `uiClick` | Generic buttons, menu plaque hits, `.tz-settings-hit` |

### Load screen carousel

| Sound key | File | When |
|-----------|------|------|
| `swipeStartScreen` | `load-screen-carousel.js` | Prev/next on startup carousel slides |

### Game board (`app_v16.js`)

| Sound key | When |
|-----------|------|
| `tilePickup` | Tap a placed tile to pick it up off the board |
| `tilePlace` | Place a tile from the bag (board click or hint placement) |
| `tileInvalid` | Invalid place, blocked move, blocked rotation, or invalid check-solve |
| `spinCWTile` / `spinCCWTile` | Rotate placed tile or bag preview (+90° / −90°) |
| `generalSelection` | Select a tile in the bag palette |
| `solveOk` | Check solve — duplicate solution already found |
| `levelSuccess` | Check solve — new catalog solution found |

---

## Adding a new sound

1. Drop `your-sound.mp3` in `audio/`.
2. Add a key to `SFX_CLIPS` in `web/js/tilezilla-sfx.js`.
3. Call `playSfx('yourKey')` from the relevant handler, **before** any `await` if it must run on the same user tap.
4. Optionally add a selector rule in `initTilezillaSfx` for automatic UI clicks.
5. Bump cache-bust query on `tilezilla-v2.html` script tags if browsers cache old JS aggressively.

---

## Deploy checklist

- [ ] `audio/*.mp3` committed and present on the server (included in git since the SFX commit).
- [ ] `curl -sI https://tile.skifflakegames.com/audio/tile-place.mp3` returns **200**.
- [ ] Settings → Sound effects **ON**.
- [ ] First interaction on the page (tap) unlocks audio; then placement sounds should play.

---

## History (why this exists)

Earlier builds relied on browser autoplay without a dedicated module; sounds often failed after async board renders. The current setup adds:

- `tilezilla-sfx.js` (preload, enable gate, autoplay unlock)
- Wiring in `app_v16.js`, `tilezilla-bootstrap.js`, `tilezilla-load.js`, `load-screen-carousel.js`
- MP3 assets under `audio/` served at `/audio/`

No server-side or MySQL involvement — sounds are 100% client-side.
