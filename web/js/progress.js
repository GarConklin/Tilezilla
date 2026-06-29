/**
 * Progress tracking for puzzle solutions.
 * Tracks which solutions the player has found per level,
 * supports "bonus" discoveries, and persists to localStorage.
 */
export class Progress {
  constructor(app) {
    this.app = app;
    this.storageKey = 'snake_progress_v1';
    this.data = this.load();
  }

  // -- Storage --

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) { /* quota exceeded etc. */ }
  }

  // -- Per-level accessors --

  getFoundForLevel(levelId) {
    return this.data[levelId]?.found || [];
  }

  hasViewedExampleRoute(levelId) {
    const entry = this.data[levelId];
    return !!(entry?.exampleRoute?.used_example_route || entry?.viewedExampleRoute);
  }

  getExampleRouteRecord(levelId) {
    return this.data[levelId]?.exampleRoute || null;
  }

  hasLeaderboardForfeit(levelId) {
    const rec = this.getExampleRouteRecord(levelId);
    return !!(rec?.leaderboard_forfeited || rec?.used_example_route);
  }

  hasHintCompletionRewardForfeit(levelId) {
    const rec = this.getExampleRouteRecord(levelId);
    return !!(rec?.hint_completion_reward_forfeited || rec?.used_example_route);
  }

  markViewedExampleRoute(levelId, meta = {}) {
    if (!levelId) return;
    if (!this.data[levelId]) this.data[levelId] = { found: [] };
    const placements = Array.isArray(meta.placements)
      ? meta.placements.map((p) => ({ tile: p.tile, r: p.r, c: p.c, deg: p.deg }))
      : [];
    this.data[levelId].exampleRoute = {
      used_example_route: true,
      token_cost: meta.tokenCost ?? 1,
      player_id: meta.playerId ?? '',
      leaderboard_forfeited: meta.leaderboardForfeited !== false,
      hint_completion_reward_forfeited: meta.hintCompletionRewardForfeited !== false,
      placements,
      viewedAt: new Date().toISOString(),
    };
    this.data[levelId].viewedExampleRoute = true;
    this.save();
  }

  /** Returns {found, total, bonuses} counts */
  getStats(levelId, totalKnown) {
    const found = this.getFoundForLevel(levelId);
    const bonuses = found.filter(f => f.bonus).length;
    const knownFound = found.filter(f => !f.bonus).length;
    return { found: knownFound, total: totalKnown, bonuses };
  }

  /** Earliest ISO timestamp among recorded solutions for this level. */
  getFirstSolvedAt(levelId) {
    const found = this.getFoundForLevel(levelId);
    let earliest = null;
    for (const entry of found) {
      if (!entry?.foundAt) continue;
      if (!earliest || entry.foundAt < earliest) earliest = entry.foundAt;
    }
    return earliest;
  }

  getLevelMeta(levelId) {
    return this.data[levelId]?.meta || null;
  }

  getLastPlayedAt(levelId) {
    return this.getLevelMeta(levelId)?.lastPlayedAt || null;
  }

  /**
   * Record that the player opened/played a level (journal + session tracking).
   * @param {string} levelId
   * @param {{ journalSource?: string, challengeDate?: string|null }} meta
   */
  touchLevelPlayed(levelId, meta = {}) {
    if (!levelId) return;
    if (!this.data[levelId]) this.data[levelId] = { found: [] };
    const prev = this.data[levelId].meta || {};
    this.data[levelId].meta = {
      ...prev,
      lastPlayedAt: new Date().toISOString(),
      playCount: (Number(prev.playCount) || 0) + 1,
      journalSource: meta.journalSource ?? prev.journalSource ?? null,
      challengeDate: meta.challengeDate !== undefined
        ? meta.challengeDate
        : (prev.challengeDate ?? null),
    };
    this.save();
  }

  /** Level has any journal entry (played or has found solutions). */
  hasJournalEntry(levelId) {
    const entry = this.data[levelId];
    if (!entry) return false;
    if (entry.meta?.lastPlayedAt) return true;
    return (entry.found?.length || 0) > 0;
  }

  // -- Canonical form --

  /**
   * Convert placements array to a canonical JSON string for comparison.
   * Sorts by (r, c, tile, deg) so placement order doesn't matter.
   */
  canonicalize(placements) {
    const sorted = placements
      .map(p => this.normalizePlacement(p))
      .sort((a, b) =>
        a.r - b.r || a.c - b.c || a.tile.localeCompare(b.tile) || a.deg - b.deg
      );
    return JSON.stringify(sorted);
  }

  normalizePlacement(p) {
    const tile = p?.tile;
    const r = p?.r | 0;
    const c = p?.c | 0;
    const deg = ((p?.deg | 0) % 360 + 360) % 360;
    const shape = this.app?.state?.liveEdges?.[tile]?.shape;
    const cellCount = Array.isArray(shape) ? shape.length : 2;

    // 1-cell tiles are orientation-invariant for matching.
    if (cellCount <= 1) return { tile, r, c, deg: 0 };

    // Canonicalize 2-cell anchor/orientation so equivalent encodings compare equal.
    const cells = this.app?.targetCells ? this.app.targetCells(r, c, deg) : [[r, c], [r, c + 1]];
    if (!Array.isArray(cells) || cells.length < 2) return { tile, r, c, deg };
    const [a, b] = cells;
    const [r1, c1] = a;
    const [r2, c2] = b;

    if (r1 === r2) {
      // Horizontal: anchor is left cell, deg 0.
      return { tile, r: r1, c: Math.min(c1, c2), deg: 0 };
    }
    // Vertical: anchor is top cell, deg 90.
    return { tile, r: Math.min(r1, r2), c: c1 === c2 ? c1 : Math.min(c1, c2), deg: 90 };
  }

  /** Fixed board blockers appear in solve files but are not player-placed tiles. */
  playablePlacements(placements) {
    return (placements || []).filter((p) => {
      const id = typeof p?.tile === 'string' ? p.tile : (p?.tile?.id || p?.tile || '');
      return id !== 'B1' && id !== 'B2' && id !== 'SB';
    });
  }

  /**
   * Return the 180-degree board rotation of a set of placements.
   * Each tile at (r,c,deg) maps to (rows-1-r, cols-1-c, (deg+180)%360).
   */
  mirror180(placements, rows, cols) {
    return placements.map(p => ({
      tile: p.tile,
      r: rows - 1 - p.r,
      c: cols - 1 - p.c,
      deg: (p.deg + 180) % 360
    }));
  }

  /** Full-board 90° clockwise (square n×n); matches solves/solve-level.js. */
  rotate90CW(placements, n) {
    return placements.map(p => ({
      tile: p.tile,
      r: p.c,
      c: n - 1 - p.r,
      deg: ((p.deg + 90) % 360 + 360) % 360
    }));
  }

  /**
   * One stable key per geometric layout: on square boards, lexicographically smallest
   * canonical string among 0°/90°/180°/270° rotations (C4). On rectangles, half-turn (180°) only.
   */
  equivalenceKey(placements, rows, cols) {
    if (!rows || !cols) return this.canonicalize(placements);
    if (rows === cols) {
      let cur = placements;
      let best = this.canonicalize(cur);
      for (let k = 0; k < 3; k++) {
        cur = this.rotate90CW(cur, rows);
        const s = this.canonicalize(cur);
        if (s < best) best = s;
      }
      return best;
    }
    const a = this.canonicalize(placements);
    const b = this.canonicalize(this.mirror180(placements, rows, cols));
    return a < b ? a : b;
  }

  // -- Solution checking --

  /**
   * Check the current board against known solutions and already-found list.
   * Square boards: same layout at 0°/90°/180°/270° counts once. Rectangles: 180° half-turn only.
   * @param {string} levelId
   * @param {Array} placements - current board placements [{tile,r,c,deg}]
   * @param {Array} knownSolutions - from the level's solution file
   * @returns {{matched:boolean, index:number|null, bonus:boolean, duplicate:boolean, msg:string}}
   */
  checkSolution(levelId, placements, knownSolutions) {
    const playable = this.playablePlacements(placements);
    const currentCanon = this.canonicalize(playable);
    const board = this.app?.state?.currentLevel?.board;
    const rows = board?.rows;
    const cols = board?.cols;
    const keyCur = rows && cols ? this.equivalenceKey(playable, rows, cols) : currentCanon;
    const found = this.getFoundForLevel(levelId);

    for (const f of found) {
      const foundPlayable = this.playablePlacements(f.placements);
      const keyF = rows && cols ? this.equivalenceKey(foundPlayable, rows, cols) : this.canonicalize(foundPlayable);
      if (keyCur !== keyF) continue;
      const exact = this.canonicalize(foundPlayable) === currentCanon;
      let index = f.index;
      let bonus = f.bonus;
      if (bonus) {
        for (let i = 0; i < knownSolutions.length; i++) {
          const sol = this.playablePlacements(knownSolutions[i].placements);
          const keySol = rows && cols ? this.equivalenceKey(sol, rows, cols) : this.canonicalize(sol);
          if (keyCur === keySol) {
            index = i;
            bonus = false;
            break;
          }
        }
      }
      let msg = 'You already found this solution!';
      if (!exact && rows === cols) {
        msg = 'You already found this layout (0°, 90°, 180°, and 270° rotations count as one).';
      } else if (!exact && rows !== cols) {
        msg = 'You already found this layout (180° board rotation matches what you saved).';
      }
      return {
        matched: true,
        index,
        bonus,
        duplicate: true,
        foundAt: f.foundAt || null,
        msg,
      };
    }

    for (let i = 0; i < knownSolutions.length; i++) {
      const sol = this.playablePlacements(knownSolutions[i].placements);
      const keySol = rows && cols ? this.equivalenceKey(sol, rows, cols) : this.canonicalize(sol);
      if (keyCur !== keySol) continue;
      const exact = this.canonicalize(sol) === currentCanon;
      const n = i + 1;
      let msg = `Solution #${n} found!`;
      if (!exact && rows === cols) {
        msg = `Solution #${n} found! — same layout at 0°, 90°, 180°, or 270° rotation as the catalog.`;
      } else if (!exact && rows !== cols) {
        msg = `Solution #${n} found! — same layout after 180° board rotation as the catalog.`;
      }
      return { matched: true, index: i, bonus: false, duplicate: false, msg };
    }

    return { matched: true, index: null, bonus: true, duplicate: false, msg: 'Bonus solution discovered!' };
  }

  // -- Recording --

  recordFound(levelId, index, placements, bonus, elapsedMs = 0, meta = {}) {
    if (!this.data[levelId]) {
      this.data[levelId] = { found: [] };
    }
    const completionTimeSeconds = Math.max(
      0,
      Math.floor(Number(meta.completionTimeSeconds ?? elapsedMs / 1000) || 0),
    );
    this.data[levelId].found.push({
      index,
      placements: placements.map(p => ({ tile: p.tile, r: p.r, c: p.c, deg: p.deg })),
      bonus,
      elapsedMs: completionTimeSeconds * 1000,
      completionTimeSeconds,
      hintsUsed: !!meta.hintsUsed,
      exampleRouteViewed: !!meta.exampleRouteViewed,
      leaderboardSubmitted: !!meta.leaderboardSubmitted,
      foundAt: new Date().toISOString(),
    });
    this.save();
  }

  dailyResultsStorageKey() {
    return 'snake_daily_results_v1';
  }

  loadDailyResults() {
    try {
      const raw = localStorage.getItem(this.dailyResultsStorageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  saveDailyResults(data) {
    try {
      localStorage.setItem(this.dailyResultsStorageKey(), JSON.stringify(data));
    } catch { /* quota */ }
  }

  /**
   * Record a daily leaderboard entry (local stand-in for daily_results table).
   * Keeps the fastest eligible time per user per challenge date.
   */
  recordLeaderboardResult(entry) {
    const {
      challengeDate,
      userId,
      levelId,
      solutionIndex,
      solutionBonus = false,
      completionTimeSeconds,
      hintsUsed = false,
      exampleRouteViewed = false,
      completedAt,
    } = entry || {};

    if (!challengeDate || !userId || !levelId) {
      return { saved: false, reason: 'missing-fields' };
    }

    const sec = Math.max(0, Number(completionTimeSeconds) || 0);
    const store = this.loadDailyResults();
    const rowKey = `${challengeDate}:${userId}`;
    const existing = store[rowKey];

    if (existing && Number(existing.completionTimeSeconds) <= sec) {
      return { saved: false, reason: 'slower-or-equal', existing };
    }

    store[rowKey] = {
      challengeDate,
      userId,
      levelId,
      solutionId: Number.isFinite(solutionIndex) ? solutionIndex : null,
      solutionBonus: !!solutionBonus,
      completionTimeSeconds: sec,
      hintsUsed: !!hintsUsed,
      exampleRouteViewed: !!exampleRouteViewed,
      completedAt: completedAt || new Date().toISOString(),
    };
    this.saveDailyResults(store);
    return { saved: true, entry: store[rowKey] };
  }

  getLeaderboardResultsForDate(challengeDate) {
    const store = this.loadDailyResults();
    return Object.values(store)
      .filter((row) => row?.challengeDate === challengeDate)
      .sort((a, b) => (a.completionTimeSeconds || 0) - (b.completionTimeSeconds || 0));
  }

  // -- Reset --

  resetLevel(levelId) {
    if (this.data[levelId]) {
      delete this.data[levelId];
      this.save();
    }
  }

  resetAll() {
    this.data = {};
    this.save();
  }

  // -- Tile types encountered in puzzle bags (info bar intro tip) --

  encounteredStorageKey() {
    const userId = this.app?.state?.userId;
    return userId ? `tilezilla_encountered_v1_${userId}` : null;
  }

  _introState() {
    if (!this.data._intro) this.data._intro = { encounteredTiles: [], seenTwoSnake: false };
    if (!this.data._intro.encounteredTiles && this.data._intro.seenTiles) {
      this.data._intro.encounteredTiles = [...this.data._intro.seenTiles];
    }
    return this.data._intro;
  }

  getEncounteredTileTypes() {
    const intro = this._introState();
    const fromData = intro.encounteredTiles || intro.seenTiles || [];
    if (fromData.length) return new Set(fromData);
    const key = this.encounteredStorageKey();
    if (!key) return new Set();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  setEncounteredTileTypes(tileIds, { persist = true } = {}) {
    const merged = [...new Set((tileIds || []).filter(Boolean))].sort();
    const intro = this._introState();
    intro.encounteredTiles = merged;
    intro.seenTiles = merged;
    if (persist) this.persistEncounteredTiles(merged);
    return merged;
  }

  persistEncounteredTiles(tiles) {
    const merged = [...new Set((tiles || []).filter(Boolean))].sort();
    const key = this.encounteredStorageKey();
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(merged));
      } catch {
        /* quota */
      }
    }
    if (!this.guestSolveProgressDisabled) {
      this.save();
    }
  }

  /**
   * Record tile types from a loaded puzzle bag.
   * @returns {string[]} tile ids that were not previously encountered
   */
  recordTilesEncountered(tileIds) {
    if (!Array.isArray(tileIds) || !tileIds.length) return [];
    const set = this.getEncounteredTileTypes();
    const newly = [];
    for (const id of tileIds) {
      if (!id || typeof id !== 'string') continue;
      if (!set.has(id)) {
        newly.push(id);
        set.add(id);
      }
    }
    if (newly.length) {
      this.setEncounteredTileTypes([...set], { persist: true });
      import('./tilezilla-encountered-tiles.js')
        .then(({ queueEncounteredTilesServerSync }) => queueEncounteredTilesServerSync(newly))
        .catch(() => {});
    }
    return newly;
  }

  /** @deprecated use getEncounteredTileTypes */
  getSeenTileTypes() {
    return this.getEncounteredTileTypes();
  }

  /** @deprecated use recordTilesEncountered */
  markTilesIntroduced(tileIds) {
    this.recordTilesEncountered(tileIds);
  }

  hasSeenTwoSnakeIntro() {
    return !!this._introState().seenTwoSnake;
  }

  markTwoSnakeIntroSeen() {
    this._introState().seenTwoSnake = true;
    this.save();
  }

  /**
   * Snapshot for download / backup (plain JSON file per user).
   * Browser storage uses the same shape under localStorage key snake_progress_v1_<user>.
   */
  exportSnapshot(userId = '') {
    return {
      schema: 'snake-progress-export-v1',
      savedAt: new Date().toISOString(),
      userId: userId || undefined,
      data: this.data,
    };
  }

  /**
   * Restore from export file or raw progress object { levelId: { found: [...] } }.
   */
  importSnapshot(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const payload = obj.data !== undefined && obj.data !== null ? obj.data : obj;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    this.data = payload;
    this.save();
    return true;
  }
}