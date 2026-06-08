# Future Needs

## Server-side Solve Intake

Build a server-side process so solve data is not trapped in client/local storage and can be reviewed before entering canonical level/solve files.

### Goals

- Accept solve submissions from client app.
- Persist submissions centrally for later curation.
- Detect duplicate solves and identify new-level candidates.
- Preserve user attribution for community and moderation workflows.
- Avoid auto-mutating canonical level files until reviewed/approved.

### Suggested Flow

1. Client submits solve candidate to API.
2. Server validates payload and computes signature hash.
3. Server stores submission with status `pending`.
4. Server tags submission as one of:
   - `matches_existing_level`
   - `new_level_candidate`
   - `duplicate_solution`
5. Review/admin process approves or rejects.
6. Approved entries are merged into:
   - `solves/*.json`
   - level manifests (`data/levels/*`)

### Submission Payload (minimum)

- `userId` (stable internal id)
- `displayName` (optional)
- `submittedAt` (server timestamp)
- `source` (`web`, `sandbox`, etc.)
- `board` (`rows`, `cols`)
- `tiles` (tile counts)
- `blockers` (typed format, e.g. `[r,c,"B1"]`)
- `placements` (tile placements for solution)
- `signatureHash` (server-generated canonical signature)
- `status` (`pending`, `approved`, `rejected`, `merged`)

### Optional Metadata

- `sessionId`
- `clientVersion`
- `notes`
- `ip` / `userAgent` (subject to privacy policy)

### Matching Rule

Treat a submission as the same level only when signature matches:

- board size (`rows`, `cols`)
- tile multiset
- typed blocker set

If signature differs, create a new level candidate.

### Why This Matters

- Prevents loss of user solves.
- Enables collaborative submissions.
- Keeps canonical data clean through review gates.
- Supports attribution and future trust/reputation systems.

## Level-Variant Swap TODO (E/B)

Create mirrored level variants by swapping endpoint and blocker tile families:

- `E1 -> B1`
- `E2 -> B2`
- `B1 -> E1`
- `B2 -> E2`

For each generated variant, normalize and fix blocker metadata in JSON:

- Ensure blocker tuples are typed (`[r,c,"B1"]` / `[r,c,"B2"]`).
- Keep `tiles` multiset consistent with the transformed level.
- Ensure placement-level tile refs and level-level blocker refs stay semantically aligned.
- Recompute signature (`board + tiles + typed blockers`) so variants are deduped correctly.

## 0C logistics: CR ↔ DB (single-snake)

**Note (authoring):** In **single-snake** / `pathMode: single`, **`CR` can replace `DB` in the level multiset** as a way to mint **0C-style** variants: same board size and bag shape, different art (`CR` uses explicit `paths` in `tiles-live-edges.json`; `DB` does not). A large share of **`solves/*.json`** already include at least one solution that places **`DB`**, so this is a **plausible bulk source** for CR-based 0C content.

Pipeline sketch: scan solves or levels that include **`DB`**, emit a sibling level with **`DB → CR`** in `tiles`, then **re-validate** solutions (app `validateBoard` or path-aware tooling)—keep or adjust placements as needed.

## Per-User Found Solutions Storage (JSON -> MySQL)

Track each player's discovered solutions server-side so known solutions stay hidden until discovered, then become viewable.

### Phase 1 (Now): JSON-backed API in Docker

- Store user progress as JSON files (for example: `data/progress/users/<userId>.json`).
- Add API endpoints:
  - `POST /api/solve/check` (validate + match known + record found)
  - `GET /api/progress/:levelId` (found count/status for level)
  - `GET /api/founds/:levelId` (only user-unlocked viewable solutions)
- Keep known solution catalog server-side authoritative.
- Return unlock state so UI only shows found/known solutions for that user.

### Phase 2 (Later): Migrate to MySQL

- Move JSON progress records to relational tables for concurrency and scale.
- Keep the same canonical hash/signature logic used in Phase 1.
- Preserve API contract so the client does not need major rewrites.

## Configurable UI Layout Setup

Allow players/admins to choose panel layout instead of hardcoding column order.

### Goals

- Add a setup/preferences UI for layout presets (for example: `palette|preview|grid`, `grid|preview|palette`).
- Support drag/reorder or preset buttons for key panels (`Palette`, `Active Tile`, `Grid`, `Board Tools`, `Solutions Library`).
- Persist selection per user (local first, server-backed later with user profile).
- Add a one-click "Reset to default layout" option.

### Suggested Approach

- Introduce a layout config object in app state (column order, panel placement).
- Render columns from config rather than fixed DOM assumptions.
- Keep compatibility with older saves by falling back to a safe default preset.

## Printable + Online Random Challenge Flow

Long-term product goal: players can buy/print physical board + tiles, then use the online app to receive random playable challenges for the physical set.

### Goals

- Support a "physical mode" where each challenge is designed for the real board and printed tiles.
- Randomly serve a level (board + tile palette + blockers) from curated pools.
- Generate printable card output for each challenge (board framing, tile list, optional hints).
- Allow challenge seed/share code so two players can run the same puzzle.

### Suggested Experience

1. Player selects physical set (board size + tile family).
2. App generates random curated challenge.
3. Player views/prints challenge card (5x6 physical framing, blanks masked with E1/E2 where needed).
4. Player solves physically.
5. Player enters/validates solve online for tracking and unlocks.

### Implementation Notes

- Add challenge picker API (seeded random + constraints like tier/difficulty).
- Add "card mode" output templates tuned for print (ink-friendly and color versions).
- Keep challenge metadata stable: `challengeId`, `seed`, `board`, `tiles`, `blockers`, `tier`.
- Persist per-user challenge history and completion stats.

## Board Orientation Naming Normalization (5x6 canonical)

**Status:** Catalog level IDs, bucket filenames, and `index.json` **`size`** now use **`5x6`** for this family (still **`rows: 6`, `cols: 5`** in JSON). The web app accepts legacy size keys **`6x5`** in filters where aliases remain.

### Goals (historical)

- Standardize naming across manifests, cards, and tooling (`5x6-*`).
- Keep runtime gameplay coordinates stable (no geometry rewrite).

### Notes

- Solve JSON filenames should match **`solvesFile`** (e.g. `5x6-0A-AAA.json`). Rename local **`6x5-*.json`** solves if present.
- Saved progress keyed by **level `id`** — rename/import localStorage progress if you relied on old **`6x5-*`** ids.

## Enumerator: two snakes (2×SH, 2×ET)

**Status:** Not implemented in `solves/solve-level.js` (single-snake only today).

### Goals

- Support levels whose multiset has **two SH** and **two ET** (and game `pathMode` / multi-path rules), aligned with `web/js/app_v16.js` validation.
- Extend **seeding** beyond one SH×ET pair: enumerate valid placements for both endpoint pairs (ordering, non-overlap, and tier rules).
- Extend **`getSnakeTip` / DFS**: trace **two** disjoint paths (or the game’s exact connectivity model), place remaining tiles consistently, and dedupe solutions (including mirror-classes if still desired).
- Allow **`--batch-4x4`** (or other batch modes) to include multi-path catalog rows instead of skipping `pathMode-not-single`.

### Notes

- Today the solver uses `placedTiles.find` for a single SH and `allSeeds` builds one SH + one ET; multi-path is explicitly out of scope until this work lands.

---

## Check solution & board UX (TODO)

Near-term tasks to track in code (see also **Enumerator: two snakes** above).

1. **Two-snake / two-path “check solution”**  
   - Harden **Check solution** and shared validation so **2×SH / 2×ET** (and `pathMode` / `pathCount` multi-path rules in `web/js/app_v16.js`) are fully covered end-to-end: `validateBoard()`, `getInventoryMismatch()`, and `progress.checkSolution()` / portable placement comparison must agree with the same graph rules the user sees.  
   - Where the offline solver (`solve-level.js` / batch) still assumes one path, either gate those levels or extend seeding + search (per enumerator section).

2. **Visual hint: live edge vs non-live neighbor**  
   - On **Validate** / **Check solution** failure (optional: also while hovering or after each place), detect **infraction cells**: a tile has a **live edge** toward a neighbor that is **empty, blocker, or has no opposite live edge**.  
   - **Pulse** (or otherwise highlight) **both** sides of the mismatch (source cell + neighbor, or the shared edge) so the player sees exactly where the snake “breaks.”  
   - Clear pulse when the board becomes valid or when the user clears / changes tiles.
