export class Solutions {
  constructor(app){
    this.app = app;

    // Unlimited solution library (format 1): [{id,label,placements:[{tile,r,c,deg}]}]
    this.key = 'snake_solutions_library_v1';

    this.solutions = [];
    this.index = -1; // selected index
    this.ui = null;
  }

  bindUI(ui){
    this.ui = ui;

    // Initial load + render
    this.solutions = this.load();
    this.renderList();
    this.exportToText();

    ui.listEl?.addEventListener('change', () => {
      this.index = parseInt(ui.listEl.value, 10);
      this.refreshLabel();
      this.updateHud();
    });

    ui.labelEl?.addEventListener('change', () => {
      const sol = this.getSelected();
      if(!sol) return;
      sol.label = (ui.labelEl.value || '').trim() || sol.label;
      this.persist();
      this.renderList(false);
      this.updateHud();
    });

    // Capture a NEW solution entry from the current board
    ui.captureNewBtn?.addEventListener('click', () => {
      const placements = this.currentPlacements();
      if(!placements.length){
        alert('Board is empty.');
        return;
      }
      const label = (ui.labelEl?.value || '').trim() || `Solve ${this.solutions.length + 1}`;
      const id = new Date().toISOString() + '-' + Math.random().toString(16).slice(2);
      this.solutions.push({ id, label, placements });
      this.index = this.solutions.length - 1;
      this.persist();
      this.renderList();
      this.exportToText();
    });

    // Update selected solution with current board placements
    ui.updateBtn?.addEventListener('click', () => {
      const sol = this.getSelected();
      if(!sol){
        alert('Select a solution first.');
        return;
      }
      const placements = this.currentPlacements();
      if(!placements.length){
        alert('Board is empty.');
        return;
      }
      sol.placements = placements;
      sol.label = (ui.labelEl?.value || '').trim() || sol.label;
      this.persist();
      this.renderList(false);
      this.exportToText();
    });

    // Apply selected solution to the board
    ui.applyBtn?.addEventListener('click', async () => {
      const sol = this.getSelected();
      if(!sol){
        alert('Select a solution first.');
        return;
      }
      await this.apply(sol.placements || []);
      this.updateHud();
    });

    // Delete selected solution
    ui.deleteBtn?.addEventListener('click', () => {
      if(this.index < 0 || this.index >= this.solutions.length){
        alert('Select a solution first.');
        return;
      }
      const removed = this.solutions.splice(this.index, 1);
      if(!this.solutions.length){
        this.index = -1;
      }else{
        this.index = Math.min(this.index, this.solutions.length - 1);
      }
      this.persist();
      this.renderList();
      this.exportToText();
    });

    // Export all solutions to the JSON textarea
    ui.exportBtn?.addEventListener('click', () => this.exportToText());

    // Import library from JSON textarea (overwrites)
    ui.importBtn?.addEventListener('click', () => {
      try{
        const parsed = JSON.parse(ui.textEl.value || '[]');
        const lib = this.normalizeLibrary(parsed);
        this.solutions = lib;
        this.index = lib.length ? 0 : -1;
        this.persist();
        this.renderList();
        this.exportToText();
      }catch(e){
        alert('Invalid JSON.');
      }
    });

    // Apply a SINGLE solve from JSON textarea (list of placements)
    ui.applyJsonBtn?.addEventListener('click', async () => {
      try{
        const parsed = JSON.parse(ui.textEl.value || '[]');
        let docTry = parsed;
        if(Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && !Array.isArray(parsed[0]) && parsed[0].placements){
          docTry = parsed[0];
        }
        if(docTry && typeof docTry === 'object' && !Array.isArray(docTry) && typeof this.app?.applySolveDocObject === 'function'){
          const ok = await this.app.applySolveDocObject(docTry);
          if(ok) return;
        }
        // Accept either:
        // - placements array [{tile,r,c,deg},...]
        // - library array [{label,placements},...] (will apply selected from list if possible)
        if(Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'object' && !Array.isArray(parsed[0]) && 'placements' in parsed[0]){
          // library format: apply selected index if valid, else 0
          const i = (this.index >= 0) ? this.index : 0;
          const sol = parsed[i] || parsed[0];
          await this.apply(this.normalizePlacements(sol.placements || []));
        }else{
          await this.apply(this.normalizePlacements(parsed));
        }
      }catch(e){
        alert('Invalid JSON.');
      }
    });

    // Clear library
    ui.clearBtn?.addEventListener('click', () => {
      if(!confirm('Clear all saved solutions in this browser?')) return;
      this.solutions = [];
      this.index = -1;
      this.persist();
      this.renderList();
      this.exportToText();
    });
  }

  // ---------- Storage / normalization ----------

  load(){
    try{
      const raw = localStorage.getItem(this.key);
      if(!raw) return []; // user requested: start with no current solutions
      return this.normalizeLibrary(JSON.parse(raw));
    }catch(e){
      return [];
    }
  }

  persist(){
    try{
      localStorage.setItem(this.key, JSON.stringify(this.solutions, null, 2));
    }catch(e){}
  }

  normalizeLibrary(any){
    const arr = Array.isArray(any)
      ? any
      : any && typeof any === 'object' && Array.isArray(any.placements)
        ? [any]
        : [];
    return arr
      .filter(x => x && typeof x === 'object' && !Array.isArray(x))
      .map(x => ({
        id: (x.id || new Date().toISOString() + '-' + Math.random().toString(16).slice(2)).toString(),
        label: (x.label || '').toString().trim() || 'Untitled',
        placements: this.normalizePlacements(x.placements || [])
      }))
      .filter(x => x.placements.length); // keep only non-empty
  }

  normalizePlacements(list){
    if(!Array.isArray(list)) return [];
    return list
      .filter(p => p && typeof p === 'object')
      .map(p => ({
        tile: (this.app.tileId ? (this.app.tileId(p.tile) || p.tile) : p.tile),
        r: p.r|0,
        c: p.c|0,
        deg: p.deg|0
      }))
      .filter(p => typeof p.tile === 'string' && p.tile.length);
  }

  // ---------- UI helpers ----------

  renderList(updateLabel=true){
    const ui = this.ui;
    if(!ui?.listEl) return;

    // Rebuild options
    ui.listEl.innerHTML = '';
    this.solutions.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i+1}. ${s.label} (${(s.placements?.length||0)}/15)`;
      ui.listEl.appendChild(opt);
    });

    // Select current
    if(this.index >= 0 && this.index < this.solutions.length){
      ui.listEl.value = String(this.index);
    }else{
      ui.listEl.value = '';
    }

    if(updateLabel) this.refreshLabel();
    this.updateHud();
  }

  refreshLabel(){
    const ui = this.ui;
    if(!ui?.labelEl) return;
    const sol = this.getSelected();
    ui.labelEl.value = sol ? sol.label : '';
  }

  updateHud(){
    const ui = this.ui;
    if(!ui?.hudEl) return;
    if(this.index < 0 || this.index >= this.solutions.length){
      ui.hudEl.textContent = `No saved solutions • 0 total`;
      return;
    }
    const sol = this.solutions[this.index];
    const n = (sol.placements || []).length;
    ui.hudEl.textContent = `Selected: #${this.index+1} • ${sol.label} • tiles: ${n}/15 • total: ${this.solutions.length}`;
  }

  getSelected(){
    if(this.index < 0 || this.index >= this.solutions.length) return null;
    return this.solutions[this.index];
  }

  exportToText(){
    if(!this.ui?.textEl) return;
    this.ui.textEl.value = JSON.stringify(this.solutions, null, 2);
    this.updateHud();
  }

  // ---------- Board capture / apply ----------

  currentPlacements(){
    // Strip ephemeral ids; keep only portable fields
    return (this.app.state.tiles || []).map(t => ({
      tile: (this.app.tileId ? (this.app.tileId(t.tile) || t.tile) : t.tile),
      r: t.r,
      c: t.c,
      deg: t.deg
    }));
  }

  async apply(placements){
    const { state, setPaletteUsed, rebuildOccFromTiles, renderTiles, canPlaceNew } = this.app;

    // reset
    state.tiles = [];
    state.used.clear();
    for(const inst of (state.paletteInstances || [])) setPaletteUsed(inst.instanceId, false);

    const norm = this.normalizePlacements(placements);
    const pending = [...norm];
    const place = (p) => {
      const wantedId = this.app.tileId ? (this.app.tileId(p.tile) || p.tile) : p.tile;
      const inst = (state.paletteInstances || []).find(x => {
        if(state.used.has(x.instanceId)) return false;
        const xid = this.app.tileId ? (this.app.tileId(x.tile) || x.tile) : x.tile;
        return xid === wantedId;
      });
      if(!inst) return false;
      state.tiles.push({ id: Date.now()+Math.random(), tile:wantedId, r:p.r, c:p.c, deg:p.deg, instanceId: inst.instanceId });
      state.used.add(inst.instanceId);
      setPaletteUsed(inst.instanceId, true);
      return true;
    };

    // Pass 1: try rule-safe placement first.
    let madeProgress = true;
    while(pending.length && madeProgress){
      madeProgress = false;
      for(let i = pending.length - 1; i >= 0; i--){
        const p = pending[i];
        const wantedId = this.app.tileId ? (this.app.tileId(p.tile) || p.tile) : p.tile;
        if(!canPlaceNew(p.r, p.c, p.deg, wantedId)) continue;
        if(place(p)){
          pending.splice(i, 1);
          madeProgress = true;
        }
      }
    }

    // Pass 2 (replay fallback): force-place any leftovers so known solutions always render.
    for(const p of pending) place(p);

    rebuildOccFromTiles();
    await renderTiles();
  }
}

