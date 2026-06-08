export class Solver {
  constructor(app, speedInput){
    this.app = app;
    this.speedInput = speedInput;
    this.running = false;
    this.timer = null;
    this.turbo = false;
    this.turboChk = null;

    this.initialized = false;
    this.stack = [];        // DFS stack: [{tile, r, c, deg, optIdx}]
    this.board = null;      // 2D grid: board[r][c] = {tile, deg, which, tileId} | null
    this.remaining = null;  // {tileName: count}
    this.placedTiles = [];  // [{id, tile, r, c, deg}]
    this.fixedCount = 0;
    this.logEl = null;
    this.outEl = null;
    this.statsEl = null;

    this.stats = { iters: 0, backtracks: 0, depth: 0, maxDepth: 0, solutions: 0, startTime: 0 };
  }

  bindUI({solveBtn, pauseBtn, stepBtn, outEl, logEl, clearLogBtn, copyLogBtn, turboChk, statsEl}){
    this.outEl = outEl;
    this.logEl = logEl;
    this.statsEl = statsEl;
    this.turboChk = turboChk;

    solveBtn?.addEventListener('click', () => this.start());
    pauseBtn?.addEventListener('click', () => this.pause());
    stepBtn?.addEventListener('click', () => this.step());

    turboChk?.addEventListener('change', () => {
      this.turbo = turboChk.checked;
    });

    clearLogBtn?.addEventListener('click', () => this.clearLog());
    copyLogBtn?.addEventListener('click', () => this.copyLog());
  }

  reset(){
    this.pause();
    this.initialized = false;
    this.stack = [];
    this.board = null;
    this.remaining = null;
    this.placedTiles = [];
    this.fixedCount = 0;
    this.stats = { iters: 0, backtracks: 0, depth: 0, maxDepth: 0, solutions: 0, startTime: 0 };
    this.clearLog();
    this.renderStats();
  }

  clearLog(){ if(this.logEl) this.logEl.textContent = ''; }

  async copyLog(){
    if(!this.logEl) return;
    try{
      await navigator.clipboard.writeText(this.logEl.textContent || '');
      this.log('Log copied.');
    }catch(e){ alert('Copy failed.'); }
  }

  log(msg){
    if(!this.logEl) return;
    const ts = new Date().toLocaleTimeString();
    this.logEl.textContent += `[${ts}] ${msg}\n`;
    const lines = this.logEl.textContent.split('\n');
    if(lines.length > 320) this.logEl.textContent = lines.slice(lines.length-320).join('\n');
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  setOut(msg){ if(this.outEl) this.outEl.textContent = msg; }

  renderStats(){
    if(!this.statsEl) return;
    const s = this.stats;
    const elapsed = s.startTime ? ((Date.now() - s.startTime)/1000).toFixed(1) : '0.0';
    const rate = s.startTime && elapsed > 0 ? Math.round(s.iters / elapsed) : 0;
    this.statsEl.textContent =
      `Iters: ${s.iters.toLocaleString()}  |  Backtracks: ${s.backtracks.toLocaleString()}  |  ` +
      `Depth: ${s.depth}/${s.maxDepth}  |  Solutions: ${s.solutions}  |  ` +
      `${elapsed}s  (${rate.toLocaleString()} steps/s)`;
  }

  // --- Core solver logic (ported from solves/solve-level.js) ---

  _edgesFor(tn, deg, wh){
    return this.app.edgesFor(tn, deg, wh);
  }

  _targetCells(r, c, deg){
    const rot = ((deg%360)+360)%360;
    if(rot === 0)   return [[r,c],[r,c+1]];
    if(rot === 90)  return [[r,c],[r+1,c]];
    if(rot === 180) return [[r,c],[r,c-1]];
    return [[r,c],[r-1,c]];
  }

  _cellsForTile(tn, r, c, deg){
    const fn = this.app.cellsForTile;
    if(fn) return fn(tn, r, c, deg);
    return this._targetCells(r, c, deg);
  }

  _inBounds(r, c){
    const C = this.app.CONFIG;
    return r >= 0 && r < C.rows && c >= 0 && c < C.cols;
  }

  _pathsFor(tn, deg){
    const tileData = this.app.state.liveEdges;
    if(!tileData) return null;
    const rn = `r${((deg%360)+360)%360}`;
    const t = tileData[tn] || tileData[this.app.tileId?.(tn)] ;
    if(!t || !t[rn]) return null;
    const p = t[rn].paths;
    return Array.isArray(p) && p.length ? p : null;
  }

  _pathExitOtherEnd(paths, which, entryEdge){
    for(const path of paths){
      const ends = path.ends;
      if(!ends || ends.length !== 2) continue;
      if(ends[0][0] === which && ends[0][1] === entryEdge) return ends[1];
      if(ends[1][0] === which && ends[1][1] === entryEdge) return ends[0];
    }
    return null;
  }

  _getSnakeTip(){
    const OPP = {N:'S', S:'N', E:'W', W:'E'};
    const C = this.app.CONFIG;
    const tileIdFn = this.app.tileId || (x => x);

    // Try SH first, fall back to ET — solver can start from either endpoint
    let endpoint = this.placedTiles.find(t => tileIdFn(t.tile) === 'SH');
    if(!endpoint) endpoint = this.placedTiles.find(t => tileIdFn(t.tile) === 'ET');
    if(!endpoint) return null;

    const epCells = this._cellsForTile(endpoint.tile, endpoint.r, endpoint.c, endpoint.deg);
    let startR = null, startC = null, startEdge = null;
    for(let i = 0; i < epCells.length; i++){
      const [rr,cc] = epCells[i];
      const wh = i === 0 ? 'A' : 'B';
      const edges = this._edgesFor(endpoint.tile, endpoint.deg, wh);
      for(const e of edges){ startR = rr; startC = cc; startEdge = e; }
    }
    if(startR === null) return null;

    const vis = new Set(epCells.map(c => `${c[0]},${c[1]}`));
    const pathVis = new Set();
    let curR = startR, curC = startC, exitDir = startEdge;

    for(let iter = 0; iter < 200; iter++){
      const nR = curR + (exitDir==='N'?-1:exitDir==='S'?1:0);
      const nC = curC + (exitDir==='W'?-1:exitDir==='E'?1:0);
      if(!this._inBounds(nR, nC)) return null;
      const nc = this.board[nR][nC];
      if(!nc) return { needR: nR, needC: nC, neededEdge: OPP[exitDir] };

      const ne = this._edgesFor(nc.tile, nc.deg, nc.which);
      if(!ne.includes(OPP[exitDir])) return null;
      const ck = `${nR},${nC}`;

      const tp = this.placedTiles.find(t =>
        this._cellsForTile(t.tile, t.r, t.c, t.deg).some(cell => cell[0]===nR && cell[1]===nC)
      );
      if(!tp) return null;
      const tc = this._cellsForTile(tp.tile, tp.r, tp.c, tp.deg);
      const eci = tc.findIndex(cell => cell[0]===nR && cell[1]===nC);
      const entryEdge = OPP[exitDir];
      const whIn = eci === 0 ? 'A' : 'B';

      const pathList = this._pathsFor(tp.tile, tp.deg);
      if(pathList){
        // Path tiles (CR/CT/CQ) allow the snake to cross — track by direction
        const pvk = `${ck}:${entryEdge}`;
        if(pathVis.has(pvk)) return null;
        pathVis.add(pvk);

        const other = this._pathExitOtherEnd(pathList, whIn, entryEdge);
        if(!other || other.length < 2) return null;
        const oidx = other[0] === 'A' ? 0 : 1;
        curR = tc[oidx][0];
        curC = tc[oidx][1];
        exitDir = other[1];
        continue;
      }

      // Non-path tiles: simple cell-level visit check
      if(vis.has(ck)) return null;
      vis.add(ck);

      const oi = [eci];
      for(let ci = 0; ci < tc.length; ci++) if(ci !== eci) oi.push(ci);
      let fe = false;
      for(const cii of oi){
        const [cR, cC] = tc[cii];
        const wh = cii === 0 ? 'A' : 'B';
        const ce = this._edgesFor(tp.tile, tp.deg, wh);
        for(const e of ce){
          if(cR === nR && cC === nC && e === OPP[exitDir]) continue;
          const eR = cR + (e==='N'?-1:e==='S'?1:0);
          const eC = cC + (e==='W'?-1:e==='E'?1:0);
          if(!this._inBounds(eR, eC)) continue;
          // Don't skip exits to path-tile cells (they allow re-entry)
          const targetCell = this.board[eR][eC];
          if(targetCell && this._pathsFor(targetCell.tile, targetCell.deg)){
            // path tile — let the entry check handle revisit
          } else if(vis.has(`${eR},${eC}`)){
            continue;
          }
          curR = cR; curC = cC; exitDir = e; fe = true; break;
        }
        if(fe) break;
      }
      if(!fe) return null;
    }
    return null;
  }

  _canPlaceSimple(tn, r, c, deg){
    const OPP = {N:'S', S:'N', E:'W', W:'E'};
    if(!this.remaining[tn] || this.remaining[tn] <= 0) return false;
    const cells = this._cellsForTile(tn, r, c, deg);
    for(let ci = 0; ci < cells.length; ci++){
      const [rr,cc] = cells[ci];
      if(!this._inBounds(rr,cc)) return false;
      if(this.board[rr][cc] !== null) return false;
      const wh = ci === 0 ? 'A' : 'B';
      const edges = this._edgesFor(tn, deg, wh);
      for(const e of edges){
        const nr = rr + (e==='N'?-1:e==='S'?1:0);
        const nc = cc + (e==='W'?-1:e==='E'?1:0);
        if(!this._inBounds(nr, nc)) return false;
      }
    }
    let hasLive = this.placedTiles.length === 0;
    const footprint = new Set(cells.map(x => `${x[0]},${x[1]}`));
    for(let i = 0; i < cells.length; i++){
      const [rr,cc] = cells[i];
      const wh = i === 0 ? 'A' : 'B';
      const our = this._edgesFor(tn, deg, wh);
      const dirs = [['N',-1,0],['S',1,0],['E',0,1],['W',0,-1]];
      for(const [d, dr, dc] of dirs){
        const nr = rr+dr, nc = cc+dc;
        if(!this._inBounds(nr,nc)) continue;
        const nb = this.board[nr][nc];
        if(!nb) continue;
        const ne = this._edgesFor(nb.tile, nb.deg, nb.which);
        const we = our.includes(d);
        const nh = ne.includes(OPP[d]);
        if(we !== nh) return false;
        if(we && nh) hasLive = true;
      }
    }
    if(!hasLive) return false;

    // Isolated single-cell check
    for(const [rr,cc] of cells){
      const dirs2 = [[-1,0],[1,0],[0,-1],[0,1]];
      for(const [dr,dc] of dirs2){
        const nr = rr+dr, nc = cc+dc;
        if(!this._inBounds(nr,nc)) continue;
        if(footprint.has(`${nr},${nc}`)) continue;
        if(this.board[nr][nc] !== null) continue;
        let hasEN = false;
        for(const [dr2,dc2] of dirs2){
          const nnr = nr+dr2, nnc = nc+dc2;
          if(!this._inBounds(nnr,nnc)) continue;
          if(footprint.has(`${nnr},${nnc}`)) continue;
          if(this.board[nnr][nnc] === null){ hasEN = true; break; }
        }
        if(!hasEN) return false;
      }
    }
    return true;
  }

  _place(tn, r, c, deg){
    const cells = this._cellsForTile(tn, r, c, deg);
    const tid = `t${this.placedTiles.length}`;
    this.placedTiles.push({ id: tid, tile: tn, r, c, deg });
    this.remaining[tn]--;
    for(let i = 0; i < cells.length; i++){
      this.board[cells[i][0]][cells[i][1]] = { tile: tn, deg, which: i===0?'A':'B', tileId: tid };
    }
  }

  _unplace(){
    const last = this.placedTiles.pop();
    this.remaining[last.tile]++;
    const cells = this._cellsForTile(last.tile, last.r, last.c, last.deg);
    for(const [cr,cc] of cells) this.board[cr][cc] = null;
    return last;
  }

  _wouldCreateHole(tn, r, c, deg){
    if(!this._canPlaceSimple(tn, r, c, deg)) return true;
    this._place(tn, r, c, deg);
    const C = this.app.CONFIG;
    const empties = [];
    for(let rr = 0; rr < C.rows; rr++)
      for(let cc = 0; cc < C.cols; cc++)
        if(this.board[rr][cc] === null) empties.push([rr,cc]);

    const key = (r,c) => `${r},${c}`;
    const emptySet = new Set(empties.map(e => key(e[0],e[1])));

    // Isolated single empty
    for(const [rr,cc] of empties){
      let has = false;
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        if(emptySet.has(key(rr+dr,cc+dc))){ has = true; break; }
      }
      if(!has){ this._unplace(); return true; }
    }

    // Even-region check: each connected empty region must have even cell count
    // (odd regions can't be filled with dominoes)
    const vis = new Set();
    for(const [sR,sC] of empties){
      if(vis.has(key(sR,sC))) continue;
      const reg = [];
      const q = [[sR,sC]];
      vis.add(key(sR,sC));
      while(q.length){
        const cur = q.shift();
        reg.push(cur);
        for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
          const nk = key(cur[0]+dr, cur[1]+dc);
          if(emptySet.has(nk) && !vis.has(nk)){
            vis.add(nk);
            q.push([cur[0]+dr, cur[1]+dc]);
          }
        }
      }
      if(reg.length % 2 !== 0){ this._unplace(); return true; }
    }

    // Tip reachability: the snake tip's next needed cell must be in the empty set
    const tip = this._getSnakeTip();
    if(tip && empties.length > 0){
      if(!emptySet.has(key(tip.needR, tip.needC))){
        this._unplace();
        return true;
      }

      // Connectivity check (ported from headless solver):
      // If the OTHER endpoint is already placed, verify the tip can reach
      // its entry cell through empty cells (+ DB tile traversal).
      const tileIdFn = this.app.tileId || (x => x);
      const startTile = tileIdFn(this.placedTiles[0]?.tile);
      const otherName = startTile === 'SH' ? 'ET' : 'SH';
      const otherP = this.placedTiles.find(t => tileIdFn(t.tile) === otherName);
      if(otherP){
        const otherCells = this._cellsForTile(otherP.tile, otherP.r, otherP.c, otherP.deg);
        let otherEntry = null;
        for(let i = 0; i < otherCells.length; i++){
          const [rr,cc] = otherCells[i];
          const wh = i === 0 ? 'A' : 'B';
          const oEdges = this._edgesFor(otherP.tile, otherP.deg, wh);
          for(const oe of oEdges){
            const nr2 = rr + (oe==='N'?-1:oe==='S'?1:0);
            const nc2 = cc + (oe==='W'?-1:oe==='E'?1:0);
            if(this._inBounds(nr2, nc2)){
              otherEntry = { r: nr2, c: nc2 };
              break;
            }
          }
          if(otherEntry) break;
        }
        if(otherEntry){
          const entryOcc = this.board[otherEntry.r][otherEntry.c];
          if(!entryOcc){
            const bVis = new Set([key(tip.needR, tip.needC)]);
            const bQ = [[tip.needR, tip.needC]];
            let reached = false;
            while(bQ.length > 0){
              const cur = bQ.shift();
              if(cur[0] === otherEntry.r && cur[1] === otherEntry.c){
                reached = true; break;
              }
              for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
                const nr2 = cur[0]+dr, nc2 = cur[1]+dc;
                if(!this._inBounds(nr2, nc2)) continue;
                const nk2 = key(nr2, nc2);
                if(bVis.has(nk2)) continue;
                if(this.board[nr2][nc2] === null){
                  bVis.add(nk2);
                  bQ.push([nr2, nc2]);
                } else if(this.board[nr2][nc2].tile === 'DB'){
                  bVis.add(nk2);
                  const dbP = this.placedTiles.find(t => t.id === this.board[nr2][nc2].tileId);
                  if(dbP){
                    const dbC = this._cellsForTile(dbP.tile, dbP.r, dbP.c, dbP.deg);
                    for(const [dR2,dC2] of dbC){
                      const dk = key(dR2, dC2);
                      if(dk === nk2 || bVis.has(dk)) continue;
                      bVis.add(dk);
                      for(const [dr2,dc2] of [[-1,0],[1,0],[0,-1],[0,1]]){
                        const er = dR2+dr2, ec = dC2+dc2;
                        if(!this._inBounds(er, ec)) continue;
                        const ek = key(er, ec);
                        if(bVis.has(ek)) continue;
                        if(er === otherEntry.r && ec === otherEntry.c){
                          reached = true; break;
                        }
                        if(this.board[er][ec] === null){
                          bVis.add(ek);
                          bQ.push([er, ec]);
                        }
                      }
                      if(reached) break;
                    }
                  }
                }
                if(reached) break;
              }
              if(reached) break;
            }
            if(!reached){
              this._unplace();
              return true;
            }
          }
        }
      }
    }

    this._unplace();
    return false;
  }

  _getOptions(tipR, tipC, neededEdge){
    const opts = [];
    const tileNames = Object.keys(this.remaining).filter(n => !n.startsWith('_') && this.remaining[n] > 0);
    let tilesLeft = 0;
    for(const k of Object.keys(this.remaining)) if(!k.startsWith('_')) tilesLeft += this.remaining[k];
    // Hold back only the OTHER endpoint — the one not used as the starting tile
    const tileIdFn = this.app.tileId || (x => x);
    const startTile = this.placedTiles.length > 0 ? tileIdFn(this.placedTiles[0].tile) : null;
    const otherEP = startTile === 'SH' ? 'ET' : startTile === 'ET' ? 'SH' : null;
    let filtered = tileNames;
    if(otherEP){
      const epLeft = this.remaining[otherEP] || 0;
      if(tilesLeft - epLeft > 0) filtered = filtered.filter(n => n !== otherEP);
    }

    for(const tn of filtered){
      for(let di = 0; di < 4; di++){
        const deg = di * 90;
        const cells = this._cellsForTile(tn, 0, 0, deg);
        const cellCount = cells.length;

        const aE = this._edgesFor(tn, deg, 'A');
        if(aE.includes(neededEdge) && this._canPlaceSimple(tn, tipR, tipC, deg)){
          if(!this._wouldCreateHole(tn, tipR, tipC, deg))
            opts.push({tile: tn, r: tipR, c: tipC, deg});
        }

        if(cellCount > 1){
          const bE = this._edgesFor(tn, deg, 'B');
          if(bE.includes(neededEdge)){
            const rot = ((deg%360)+360)%360;
            const aR = tipR + (rot===90?-1:rot===270?1:0);
            const aC = tipC + (rot===0?-1:rot===180?1:0);
            if(this._inBounds(aR, aC) && this._canPlaceSimple(tn, aR, aC, deg)){
              if(!this._wouldCreateHole(tn, aR, aC, deg))
                opts.push({tile: tn, r: aR, c: aC, deg});
            }
          }
        }
      }
    }
    const seen = new Set();
    return opts.filter(o => {
      const k = `${o.tile}|${o.r}|${o.c}|${o.deg}`;
      if(seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // --- Initialization & sync to app state ---

  _syncToApp(){
    const { state, setPaletteUsed, rebuildOccFromTiles } = this.app;
    // Rebuild state.tiles from placedTiles (fixed + solver-placed)
    while(state.tiles.length > this.fixedCount) state.tiles.pop();
    // Clear used set for solver-placed tiles
    const fixedInstances = new Set();
    for(let i = 0; i < this.fixedCount; i++){
      if(state.tiles[i]?.instanceId) fixedInstances.add(state.tiles[i].instanceId);
    }
    for(const inst of (state.paletteInstances || [])){
      if(!fixedInstances.has(inst.instanceId)){
        state.used.delete(inst.instanceId);
        setPaletteUsed(inst.instanceId, false);
      }
    }
    // Push solver-placed tiles
    for(let i = this.fixedCount; i < this.placedTiles.length; i++){
      const p = this.placedTiles[i];
      const inst = this._findInstance(p.tile);
      const instanceId = inst ? inst.instanceId : p.tile;
      state.tiles.push({
        id: p.id,
        tile: p.tile,
        instanceId,
        r: p.r,
        c: p.c,
        deg: p.deg
      });
      state.used.add(instanceId);
      setPaletteUsed(instanceId, true);
    }
    rebuildOccFromTiles();
  }

  _findInstance(tileName){
    const { state } = this.app;
    const insts = state.paletteInstances || [];
    for(const inst of insts){
      if(inst.tile === tileName && !state.used.has(inst.instanceId)) return inst;
    }
    return null;
  }

  initFromCurrentBoard(){
    const { CONFIG, state } = this.app;
    const tileIdFn = this.app.tileId || (x => x);

    // Build internal board from current app state
    this.board = [];
    for(let r = 0; r < CONFIG.rows; r++){
      this.board.push([]);
      for(let c = 0; c < CONFIG.cols; c++) this.board[r].push(null);
    }

    // Mark blockers
    if(state.blockerCells){
      for(const bk of state.blockerCells){
        const [br, bc] = bk.split(',').map(Number);
        this.board[br][bc] = { tile: 'B1', deg: 0, which: 'A', tileId: '__blk' };
      }
    }

    // Build remaining tile counts from level
    this.remaining = {};
    const levelTiles = state.levelTileCounts || {};
    for(const [tn, cnt] of Object.entries(levelTiles)){
      this.remaining[tn] = cnt;
    }

    // Place current tiles on internal board
    this.placedTiles = [];
    for(const t of state.tiles){
      const tn = tileIdFn(t.tile);
      const cells = this._cellsForTile(tn, t.r, t.c, t.deg);
      const tid = `t${this.placedTiles.length}`;
      this.placedTiles.push({ id: tid, tile: tn, r: t.r, c: t.c, deg: t.deg });
      if(this.remaining[tn] !== undefined) this.remaining[tn]--;
      for(let i = 0; i < cells.length; i++){
        const [cr,cc] = cells[i];
        if(this._inBounds(cr,cc)){
          this.board[cr][cc] = { tile: tn, deg: t.deg, which: i===0?'A':'B', tileId: tid };
        }
      }
    }

    this.fixedCount = this.placedTiles.length;
    this.stack = [];
    this.initialized = true;
    this.stats = { iters: 0, backtracks: 0, depth: this.fixedCount, maxDepth: this.fixedCount, solutions: 0, startTime: Date.now() };

    this.log(`Initialized from current board (fixed tiles: ${this.fixedCount})`);

    const hasSH = this.placedTiles.some(t => tileIdFn(t.tile) === 'SH');
    const hasET = this.placedTiles.some(t => tileIdFn(t.tile) === 'ET');
    if(!hasSH && !hasET){
      this.log('Warning: Place SH or ET first — solver follows the snake from an endpoint tile.');
    } else {
      this.log(`Tracing snake from ${hasSH ? 'SH' : 'ET'}.`);
    }

    this.setOut(`Starting from ${this.fixedCount} fixed tile(s)...`);
    this.renderStats();
  }

  start(){
    if(!this.initialized) this.initFromCurrentBoard();
    this.running = true;

    const tick = async () => {
      if(!this.running) return;

      if(this.turbo){
        const batchSize = 500;
        let lastMsg = '';
        let done = false;
        for(let i = 0; i < batchSize; i++){
          const res = this.stepOnceSync();
          lastMsg = res.msg;
          if(res.done){ done = true; break; }
        }
        this.setOut(lastMsg);
        this.renderStats();
        this._syncToApp();
        await this.app.renderTiles();
        if(done){ this.running = false; this.log(lastMsg); return; }
        const delay = parseInt(this.speedInput.value, 10);
        this.timer = setTimeout(tick, Math.max(delay, 1));
      } else {
        const res = await this.stepOnce();
        this.setOut(res.msg);
        this.renderStats();
        if(res.done){ this.running = false; this.log(res.msg); return; }
        const delay = parseInt(this.speedInput.value, 10);
        this.timer = setTimeout(tick, delay);
      }
    };
    tick();
  }

  pause(){
    this.running = false;
    if(this.timer) clearTimeout(this.timer);
    this.setOut('Paused.');
    this.log('Paused.');
    this.renderStats();
  }

  step(){
    if(!this.initialized) this.initFromCurrentBoard();
    this.stepOnce().then(res => {
      this.setOut(res.msg);
      this.log(res.msg);
      this.renderStats();
    }).catch(e => {
      console.error(e);
      alert('Step failed: ' + e.message);
    });
  }

  stepOnceSync(){
    this.stats.iters++;

    // Check if all tiles placed
    let tilesLeft = 0;
    for(const k of Object.keys(this.remaining)){
      if(!k.startsWith('_')) tilesLeft += this.remaining[k];
    }

    if(tilesLeft === 0){
      this.stats.solutions++;
      return { done: true, msg: `SOLVED! (${this.stats.iters.toLocaleString()} iterations, ${this.stats.solutions} solution(s))` };
    }

    // If we have a pending options list from a previous backtrack, use it
    if(this.stack.length > 0){
      const top = this.stack[this.stack.length - 1];
      if(top._pending){
        // Try next option at this stack level
        top.optIdx++;
        if(top.optIdx < top._opts.length){
          const o = top._opts[top.optIdx];
          this._place(o.tile, o.r, o.c, o.deg);
          top._pending = false;
          top.tile = o.tile; top.r = o.r; top.c = o.c; top.deg = o.deg;
          this.stats.depth = this.placedTiles.length;
          if(this.placedTiles.length > this.stats.maxDepth) this.stats.maxDepth = this.placedTiles.length;
          return { done: false, msg: `Placed ${o.tile} @ (${o.r},${o.c}) ${o.deg}°  [depth ${this.stats.depth}]` };
        }
        // Exhausted all options at this level — pop and backtrack further
        this.stack.pop();
        if(this.placedTiles.length <= this.fixedCount){
          return { done: true, msg: `No solution found (${this.stats.iters.toLocaleString()} iterations exhausted).` };
        }
        const removed = this._unplace();
        this.stats.backtracks++;
        this.stats.depth = this.placedTiles.length;
        if(this.stack.length > 0) this.stack[this.stack.length - 1]._pending = true;
        return { done: false, msg: `Backtrack (removed ${removed.tile} from (${removed.r},${removed.c}))  [depth ${this.stats.depth}]` };
      }
    }

    // Follow snake tip to find where next tile goes
    const tip = this._getSnakeTip();
    if(!tip){
      // Can't follow tip — dead end, backtrack
      if(this.placedTiles.length <= this.fixedCount){
        return { done: true, msg: `No solution found (${this.stats.iters.toLocaleString()} iterations — snake tip dead end).` };
      }
      // Mark current top as needing to try next option
      if(this.stack.length > 0){
        this._unplace();
        this.stats.backtracks++;
        this.stats.depth = this.placedTiles.length;
        this.stack[this.stack.length - 1]._pending = true;
        return { done: false, msg: `Backtrack (tip dead end)  [depth ${this.stats.depth}]` };
      }
      return { done: true, msg: `No solution found (${this.stats.iters.toLocaleString()} iterations — no valid tip).` };
    }

    // Get candidate tiles for the tip cell
    const opts = this._getOptions(tip.needR, tip.needC, tip.neededEdge);

    if(opts.length === 0){
      // No valid tile fits — backtrack
      if(this.placedTiles.length <= this.fixedCount){
        return { done: true, msg: `No solution found (${this.stats.iters.toLocaleString()} iterations — no options at tip).` };
      }
      if(this.stack.length > 0){
        this._unplace();
        this.stats.backtracks++;
        this.stats.depth = this.placedTiles.length;
        this.stack[this.stack.length - 1]._pending = true;
        return { done: false, msg: `Backtrack (no options at (${tip.needR},${tip.needC}))  [depth ${this.stats.depth}]` };
      }
      return { done: true, msg: `No solution found (${this.stats.iters.toLocaleString()} iterations).` };
    }

    // Place first option, push frame with all options for later backtracking
    const o = opts[0];
    this._place(o.tile, o.r, o.c, o.deg);
    this.stack.push({ tile: o.tile, r: o.r, c: o.c, deg: o.deg, optIdx: 0, _opts: opts, _pending: false });
    this.stats.depth = this.placedTiles.length;
    if(this.placedTiles.length > this.stats.maxDepth) this.stats.maxDepth = this.placedTiles.length;

    return { done: false, msg: `Placed ${o.tile} @ (${o.r},${o.c}) ${o.deg}°  [depth ${this.stats.depth}]` };
  }

  async stepOnce(){
    const res = this.stepOnceSync();
    this._syncToApp();
    await this.app.renderTiles();
    return res;
  }
}
