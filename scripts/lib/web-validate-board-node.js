'use strict';

/**
 * Node port of web/js/app_v16.js validateBoard() and its direct helpers.
 * Synced 2026-05-16 — keep aligned with validateBoard + edges/cells helpers.
 */

const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

function tileId(tileRef) {
  if (!tileRef || typeof tileRef !== 'string') return '';
  const head = tileRef.split('#')[0].split('-')[0];
  return /^[A-Z0-9]{2,3}$/.test(head) ? head : '';
}

function makeCtx(rows, cols, liveEdges, levelTileCounts, currentLevel, blockerCellsSet) {
  const ctx = {
    rows,
    cols,
    liveEdges,
    levelTileCounts: normalizeLevelTiles(levelTileCounts || {}),
    currentLevel: currentLevel || {},
    blockerCells: blockerCellsSet || new Set(),
    tiles: [],
  };

  function resolveTileKey(tileRef) {
    const id = tileId(tileRef);
    if (id && liveEdges?.[id]) return id;
    const raw = typeof tileRef === 'string' ? tileRef.split('#')[0] : tileRef;
    if (raw && liveEdges?.[raw]) return raw;
    return id || raw || tileRef;
  }

  function normalizeLevelTiles(tilesObj) {
    const out = {};
    if (!tilesObj || typeof tilesObj !== 'object') return out;
    for (const [name, count] of Object.entries(tilesObj)) {
      const id = resolveTileKey(name);
      out[id] = (out[id] || 0) + (Number(count) || 0);
    }
    return out;
  }

  function cellKey(r, c) {
    return `${r},${c}`;
  }
  function idx(r, c) {
    return r * cols + c;
  }
  function inBounds(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  function rotName(deg) {
    const r = ((deg % 360) + 360) % 360;
    return r === 0 ? 'r0' : r === 90 ? 'r90' : r === 180 ? 'r180' : 'r270';
  }

  function edgesFor(tileName, deg, which) {
    const rn = rotName(deg);
    const tk = resolveTileKey(tileName);
    return liveEdges?.[tk]?.[rn]?.[which] || [];
  }

  function pathSpecsForPlacement(tileName, deg) {
    const rn = rotName(deg);
    const tk = resolveTileKey(tileName);
    return liveEdges?.[tk]?.[rn]?.paths;
  }

  function pathUsesBothHalves(pathObj) {
    const ends = pathObj?.ends;
    if (!Array.isArray(ends) || ends.length !== 2) return false;
    const p0 = ends[0];
    const p1 = ends[1];
    if (!Array.isArray(p0) || !Array.isArray(p1) || !p0.length || !p1.length) return false;
    return (p0[0] === 'A' && p1[0] === 'B') || (p0[0] === 'B' && p1[0] === 'A');
  }

  function tileInternallyLinksHalves(tileRef, specs, pathPick, placedId, expectedPathCount, placed) {
    const id = tileId(tileRef);
    const ctLike = id === 'CT' || id === 'CQ';

    if (expectedPathCount > 1) {
      if (!ctLike) return true;
      const t = placed.find((x) => x.id === placedId);
      if (!t) return true;
      const rot = ((t.deg % 360) + 360) % 360;
      const cells = cellsForTile(t.tile, t.r, t.c, rot);
      if (cells.length < 2) return true;
      const e0 = edgesFor(t.tile, rot, 'A').length;
      const e1 = edgesFor(t.tile, rot, 'B').length;
      return e0 > 0 && e1 > 0;
    }

    if (Array.isArray(specs) && specs.length) {
      const pi = pathPick.has(placedId) ? pathPick.get(placedId) : 0;
      const crosses = pathUsesBothHalves(specs[pi]);
      if (ctLike) return crosses;
    }
    return true;
  }

  function isFullCrossroads(tileName, deg) {
    const specs = pathSpecsForPlacement(tileName, deg);
    if (!Array.isArray(specs) || specs.length < 2) return false;
    for (const pathObj of specs) {
      if (!pathUsesBothHalves(pathObj)) return false;
    }
    return true;
  }

  function targetCells(r, c, deg) {
    const rot = ((deg % 360) + 360) % 360;
    if (rot === 0) return [
      [r, c],
      [r, c + 1],
    ];
    if (rot === 90) return [
      [r, c],
      [r + 1, c],
    ];
    if (rot === 180) return [
      [r, c],
      [r, c - 1],
    ];
    return [
      [r, c],
      [r - 1, c],
    ];
  }

  function tileCellCount(tileRef) {
    const k = resolveTileKey(tileRef);
    const shape = liveEdges?.[k]?.shape;
    return Array.isArray(shape) && shape.length ? shape.length : 2;
  }

  function cellsForTile(tileRef, r, c, deg) {
    if (tileCellCount(tileRef) === 1) return [[r, c]];
    return targetCells(r, c, deg);
  }

  function computeExpectedPathCount(placed) {
    const cfgMode = ctx.currentLevel?.pathMode;
    const cfgCount = Number(ctx.currentLevel?.pathCount || 0);
    const shPlaced = placed.filter((t) => tileId(t.tile) === 'SH').length;
    const etPlaced = placed.filter((t) => tileId(t.tile) === 'ET').length;
    const shLevel = Number(ctx.levelTileCounts?.SH || 0);
    const etLevel = Number(ctx.levelTileCounts?.ET || 0);
    const levelPaths = shLevel > 0 && etLevel > 0 ? Math.min(shLevel, etLevel) : 0;
    const fallbackPaths = shPlaced === 2 && etPlaced === 2 ? 2 : 1;
    return levelPaths > 0
      ? levelPaths
      : (cfgMode === 'multi' || cfgMode === 'multi-flex') && cfgCount > 0
        ? cfgCount
        : cfgMode === 'single'
          ? 1
          : fallbackPaths;
  }

  function resolvePlacementPathChoices(cellInfo, placed) {
    const expectedPaths = computeExpectedPathCount(placed);

    if (expectedPaths > 1) {
      return new Map();
    }

    const ambig = [];
    const fixed = new Map();
    for (const t of placed) {
      const specs = pathSpecsForPlacement(t.tile, t.deg);
      if (!Array.isArray(specs) || !specs.length) continue;
      if (specs.length === 1 || isFullCrossroads(t.tile, t.deg)) {
        fixed.set(t.id, 0);
        continue;
      }
      ambig.push(t.id);
    }

    function resolvedEdgesForPick(pathPick) {
      const key = (r, c) => r + ',' + c;
      const nodes = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const info = cellInfo[idx(r, c)];
          if (!info) continue;
          const base = edgesFor(info.tile, info.deg, info.which);
          if (!base.length) continue;
          nodes.push({ r, c, info, edges: base });
        }
      }
      if (!nodes.length) return true;
      const nodeMap = new Map(nodes.map((n) => [key(n.r, n.c), n]));
      const adj = new Map();
      for (const n of nodes) adj.set(key(n.r, n.c), []);
      for (const n of nodes) {
        const k = key(n.r, n.c);
        for (const e of n.edges) {
          const rr = n.r + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const cc = n.c + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          const nk = key(rr, cc);
          if (nodeMap.has(nk)) {
            const nbrs = adj.get(k);
            if (!nbrs.includes(nk)) nbrs.push(nk);
          }
        }
      }
      const byTile = new Map();
      for (const n of nodes) {
        if (!byTile.has(n.info.placedId)) byTile.set(n.info.placedId, []);
        byTile.get(n.info.placedId).push(key(n.r, n.c));
      }
      for (const [pid, cells] of byTile) {
        if (cells.length < 2) continue;
        const t = placed.find((x) => x.id === pid);
        const specs = t ? pathSpecsForPlacement(t.tile, t.deg) : null;
        const link = t ? tileInternallyLinksHalves(t.tile, specs, pathPick, pid, 1, placed) : true;
        if (!link) continue;
        const [a, b] = cells;
        if (!adj.get(a).includes(b)) adj.get(a).push(b);
        if (!adj.get(b).includes(a)) adj.get(b).push(a);
      }
      const start = adj.keys().next().value;
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift();
        for (const nb of adj.get(cur) || []) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }
      if (seen.size !== nodes.length) return false;
      let deg1 = 0;
      for (const [, nbrs] of adj) if (nbrs.length === 1) deg1++;
      return deg1 === expectedPaths * 2;
    }

    function dfs(i, pathPick) {
      if (i >= ambig.length) {
        return resolvedEdgesForPick(pathPick) ? pathPick : null;
      }
      const pid = ambig[i];
      const t = placed.find((x) => x.id === pid);
      const specs = pathSpecsForPlacement(t.tile, t.deg);
      for (let pi = 0; pi < specs.length; pi++) {
        pathPick.set(pid, pi);
        const res = dfs(i + 1, pathPick);
        if (res) return res;
      }
      pathPick.delete(pid);
      return null;
    }

    const initial = new Map(fixed);
    if (!ambig.length) {
      return resolvedEdgesForPick(initial) ? initial : null;
    }
    return dfs(0, initial);
  }

  function buildResolvedEdgeGetter(pathPick, cellInfo, placed, expectedPathCount) {
    const cache = new Map();
    return function resolvedEdgesAt(info) {
      const key = `${info.placedId}|${info.which}`;
      if (cache.has(key)) return cache.get(key);
      const base = edgesFor(info.tile, info.deg, info.which);
      cache.set(key, base);
      return base;
    };
  }

  function getInventoryMismatch(placedTiles) {
    const levelTileCounts = ctx.levelTileCounts;
    if (!levelTileCounts || typeof levelTileCounts !== 'object') return null;
    const placedCounts = {};
    for (const t of placedTiles || []) {
      const id = tileId(t?.tile);
      if (!id) continue;
      placedCounts[id] = (placedCounts[id] || 0) + 1;
    }
    for (const [id, needRaw] of Object.entries(levelTileCounts)) {
      const need = Number(needRaw || 0);
      const got = Number(placedCounts[id] || 0);
      if (got !== need) return { id, got, need };
    }
    for (const [id, gotRaw] of Object.entries(placedCounts)) {
      const got = Number(gotRaw || 0);
      const need = Number(levelTileCounts[id] || 0);
      if (got !== need) return { id, got, need };
    }
    return null;
  }

  function validatePlacements(placedRaw) {
    const placed = placedRaw.map((p, i) => ({
      id: p.id != null ? p.id : i + 1,
      tile: p.tile,
      r: p.r,
      c: p.c,
      deg: p.deg,
    }));
    ctx.tiles = placed;

    const inv = getInventoryMismatch(placed);
    if (inv) {
      return { ok: false, msg: `Inventory mismatch: ${inv.id} placed ${inv.got}, need ${inv.need}`, inventory: inv };
    }

    let traceSummary = '';

    for (const t of placed) {
      for (const [rr, cc] of cellsForTile(t.tile, t.r, t.c, t.deg)) {
        if (!inBounds(rr, cc)) return { ok: false, msg: `Tile ${t.tile} off-board at (${rr},${cc})` };
      }
    }
    const seenCells = new Set();
    for (const t of placed) {
      for (const [rr, cc] of cellsForTile(t.tile, t.r, t.c, t.deg)) {
        const k = rr + ',' + cc;
        if (seenCells.has(k)) return { ok: false, msg: `Overlap at (${rr},${cc})` };
        seenCells.add(k);
      }
    }

    const cellInfo = Array(rows * cols).fill(null);
    for (const t of placed) {
      const rot = ((t.deg % 360) + 360) % 360;
      const cells = cellsForTile(t.tile, t.r, t.c, rot);
      if (!Array.isArray(cells) || !cells.length) {
        return { ok: false, msg: `Tile ${t.tile} has invalid footprint` };
      }
      for (const [rr, cc] of cells) {
        if (!inBounds(rr, cc)) return { ok: false, msg: `Tile ${t.tile} goes off-board at (${rr},${cc})` };
      }
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!Array.isArray(cell) || cell.length < 2) {
          return { ok: false, msg: `Tile ${t.tile} has invalid cell at index ${i}` };
        }
        const [rr, cc] = cell;
        const ii = idx(rr, cc);
        if (cellInfo[ii]) return { ok: false, msg: `Overlap at (${rr},${cc})` };
        const which = i === 0 ? 'A' : 'B';
        cellInfo[ii] = { tile: t.tile, deg: rot, which, placedId: t.id };
      }
    }

    const totalPlayable = rows * cols - ctx.blockerCells.size;
    const filledCells = cellInfo.filter(Boolean).length;
    const boardComplete = filledCells >= totalPlayable;

    const expectedPaths = computeExpectedPathCount(placed);

    let pathPick = null;
    let resolvedEdgesAt;
    if (boardComplete) {
      pathPick = resolvePlacementPathChoices(cellInfo, placed);
      if (expectedPaths <= 1 && !pathPick) {
        return { ok: false, msg: 'Cannot resolve path routing on path-aware tiles (ambiguous fork wiring vs neighbors).' };
      }
      resolvedEdgesAt = buildResolvedEdgeGetter(pathPick, cellInfo, placed, expectedPaths);
    } else {
      resolvedEdgesAt = function (info) {
        return edgesFor(info.tile, info.deg, info.which);
      };
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (ctx.blockerCells.has(cellKey(r, c))) continue;
        const info = cellInfo[idx(r, c)];
        if (!info) continue;
        const edges = resolvedEdgesAt(info);
        for (const e of edges) {
          const rr = r + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const cc = c + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (!inBounds(rr, cc)) return { ok: false, msg: `Edge ${e} at (${r},${c}) goes off-board` };
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const info = cellInfo[idx(r, c)];
        if (!info) continue;
        const edges = resolvedEdgesAt(info);
        for (const e of edges) {
          const rr = r + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const cc = c + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (!inBounds(rr, cc)) continue;
          if (ctx.blockerCells.has(cellKey(rr, cc)))
            return { ok: false, msg: `Mismatch: (${r},${c}) has ${e} into blocker at (${rr},${cc})` };
          const nb = cellInfo[idx(rr, cc)];
          if (!nb) {
            if (boardComplete) return { ok: false, msg: `Mismatch: (${r},${c}) has ${e} but neighbor empty` };
            continue;
          }
          const nbEdges = resolvedEdgesAt(nb);
          if (!nbEdges.includes(OPP[e])) return { ok: false, msg: `Mismatch: (${r},${c}) has ${e} but neighbor lacks ${OPP[e]}` };
        }
      }
    }

    if (!boardComplete) {
      if (placed.length > 1) {
        for (const t of placed) {
          const cells = cellsForTile(t.tile, t.r, t.c, ((t.deg % 360) + 360) % 360);
          let connected = false;
          for (let ci = 0; ci < cells.length && !connected; ci++) {
            const [cr, cc] = cells[ci];
            const which = ci === 0 ? 'A' : 'B';
            const es = edgesFor(t.tile, ((t.deg % 360) + 360) % 360, which);
            for (const e of es) {
              const nr = cr + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
              const nc = cc + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
              if (!inBounds(nr, nc)) continue;
              const nbInfo = cellInfo[idx(nr, nc)];
              if (nbInfo && nbInfo.placedId !== t.id) {
                connected = true;
                break;
              }
            }
          }
          if (!connected) return { ok: false, msg: `Floating tile ${t.tile} at (${t.r},${t.c})` };
        }
      }
      return { ok: true, msg: 'Partial board OK', partial: true };
    }

    const expectedEndpoints = expectedPaths * 2;
    const isMultiFlex = ctx.currentLevel?.pathMode === 'multi-flex';
    const isNeutralPathTile = (tileName) => {
      const id = tileId(tileName);
      return id === 'E1' || id === 'E2' || id === 'B1' || id === 'B2';
    };

    const liveNodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const info = cellInfo[idx(r, c)];
        if (!info) continue;
        if (isNeutralPathTile(info.tile)) continue;
        const edges = resolvedEdgesAt(info);
        if (edges.length > 0) {
          liveNodes.push({ r, c, tile: info.tile, deg: info.deg, which: info.which, placedId: info.placedId, edges });
        }
      }
    }

    const skipMergedConnectivity = expectedPaths > 1;

    if (liveNodes.length && !skipMergedConnectivity) {
      const key = (r, c) => r + ',' + c;
      const nodeMap = new Map(liveNodes.map((n) => [key(n.r, n.c), n]));
      const adj = new Map();
      const degMap = new Map();

      for (const n of liveNodes) {
        const k = key(n.r, n.c);
        const nbrs = [];
        for (const e of n.edges) {
          const rr = n.r + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const cc = n.c + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          const nk = key(rr, cc);
          if (nodeMap.has(nk)) nbrs.push(nk);
        }
        adj.set(k, nbrs);
        degMap.set(k, nbrs.length);
      }

      const byTile = new Map();
      for (const n of liveNodes) {
        if (!byTile.has(n.placedId)) byTile.set(n.placedId, []);
        byTile.get(n.placedId).push(key(n.r, n.c));
      }
      for (const cells of byTile.values()) {
        if (cells.length < 2) continue;
        const a = cells[0],
          b = cells[1];
        const infoA = nodeMap.get(a);
        const pid = infoA?.placedId;
        const t = placed.find((x) => x.id === pid);
        const specs = t ? pathSpecsForPlacement(t.tile, t.deg) : null;
        const linkCells = t ? tileInternallyLinksHalves(t.tile, specs, pathPick, pid, expectedPaths, placed) : true;
        if (!linkCells) continue;
        const aNbrs = adj.get(a) || [];
        const bNbrs = adj.get(b) || [];
        if (!aNbrs.includes(b)) aNbrs.push(b);
        if (!bNbrs.includes(a)) bNbrs.push(a);
        adj.set(a, aNbrs);
        adj.set(b, bNbrs);
      }
      for (const [k, nbrs] of adj.entries()) {
        degMap.set(k, nbrs.length);
      }

      const components = [];
      const seen2 = new Set();
      for (const k0 of adj.keys()) {
        if (seen2.has(k0)) continue;
        const comp = [];
        const q = [k0];
        seen2.add(k0);
        while (q.length) {
          const cur = q.shift();
          comp.push(cur);
          for (const nb of adj.get(cur) || []) {
            if (!seen2.has(nb)) {
              seen2.add(nb);
              q.push(nb);
            }
          }
        }
        components.push(comp);
      }
      if ((!isMultiFlex && components.length !== expectedPaths) || (isMultiFlex && components.length < expectedPaths)) {
        return {
          ok: false,
          msg: `Path disconnected (${components.length} components, expected ${isMultiFlex ? '>=' : ''}${expectedPaths})`,
        };
      }

      const endpoints = [];
      for (const [k, d] of degMap.entries()) {
        if (d === 1) endpoints.push(k);
      }
      if ((!isMultiFlex && endpoints.length !== expectedEndpoints) || (isMultiFlex && endpoints.length < expectedEndpoints)) {
        return {
          ok: false,
          msg: `Path must have ${isMultiFlex ? 'at least' : 'exactly'} ${expectedEndpoints} endpoints (has ${endpoints.length})`,
        };
      }

      const endTiles = endpoints.map((k) => nodeMap.get(k).tile);
      const shEnds = endTiles.filter((t) => tileId(t) === 'SH').length;
      const etEnds = endTiles.filter((t) => tileId(t) === 'ET').length;
      if (
        (!isMultiFlex && (shEnds !== expectedPaths || etEnds !== expectedPaths)) ||
        (isMultiFlex && (shEnds < expectedPaths || etEnds < expectedPaths))
      ) {
        return {
          ok: false,
          msg: `Endpoints must be ${isMultiFlex ? 'at least' : ''} ${expectedPaths}x SH and ${expectedPaths}x ET (got SH=${shEnds}, ET=${etEnds})`,
        };
      }

      const traceParts = [];
      const compIndexByKey = new Map();
      components.forEach((comp, i) => {
        for (const k of comp) compIndexByKey.set(k, i);
      });
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const compEndpoints = comp.filter((k) => (degMap.get(k) || 0) === 1);
        if (compEndpoints.length !== 2) {
          traceParts.push(`C${i + 1}: endpoints=${compEndpoints.length}`);
          continue;
        }
        const start = compEndpoints[0];
        const goal = compEndpoints[1];
        const q = [start];
        const seen = new Set([start]);
        const prev = new Map();
        while (q.length) {
          const cur = q.shift();
          if (cur === goal) break;
          for (const nb of adj.get(cur) || []) {
            if (seen.has(nb)) continue;
            if (compIndexByKey.get(nb) !== i) continue;
            seen.add(nb);
            prev.set(nb, cur);
            q.push(nb);
          }
        }
        const path = [goal];
        let cur = goal;
        while (cur !== start && prev.has(cur)) {
          cur = prev.get(cur);
          path.push(cur);
        }
        path.reverse();
        const sNode = nodeMap.get(start);
        const eNode = nodeMap.get(goal);
        const sId = tileId(sNode?.tile) || '?';
        const eId = tileId(eNode?.tile) || '?';
        traceParts.push(`C${i + 1}: ${sId}(${sNode?.r},${sNode?.c})->${eId}(${eNode?.r},${eNode?.c}), hops=${Math.max(0, path.length - 1)}`);
      }
      if (traceParts.length) traceSummary = traceParts.join(' | ');
    }

    const nodes = [];
    const nodeId = new Map();
    function key2(r, c) {
      return r + ',' + c;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const info = cellInfo[idx(r, c)];
        if (!info) continue;
        if (isNeutralPathTile(info.tile)) continue;
        const edges = resolvedEdgesAt(info);
        if (edges.length === 0) continue;
        const k = key2(r, c);
        if (!nodeId.has(k)) {
          nodeId.set(k, nodes.length);
          nodes.push({ r, c });
        }
      }
    }

    const adj2 = Array(nodes.length)
      .fill(0)
      .map(() => []);
    const addEdge = (r1, c1, r2, c2) => {
      const a = nodeId.get(key2(r1, c1));
      const b = nodeId.get(key2(r2, c2));
      if (a == null || b == null) return;
      adj2[a].push(b);
      adj2[b].push(a);
    };

    const tileLiveCells = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const info = cellInfo[idx(r, c)];
        if (!info) continue;
        const edges = resolvedEdgesAt(info);
        if (edges.length === 0) continue;
        if (!tileLiveCells.has(info.placedId)) tileLiveCells.set(info.placedId, []);
        tileLiveCells.get(info.placedId).push([r, c]);
      }
    }
    for (const cells of tileLiveCells.values()) {
      if (cells.length < 2) continue;
      const [a, b] = cells;
      const pid = cellInfo[idx(a[0], a[1])]?.placedId;
      const t = placed.find((x) => x.id === pid);
      const specs = t ? pathSpecsForPlacement(t.tile, t.deg) : null;
      const linkCells = t ? tileInternallyLinksHalves(t.tile, specs, pathPick, pid, expectedPaths, placed) : true;
      if (!linkCells) continue;
      addEdge(a[0], a[1], b[0], b[1]);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const info = cellInfo[idx(r, c)];
        if (!info) continue;
        const edges = resolvedEdgesAt(info);
        for (const e of edges) {
          const rr = r + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const cc = c + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (!inBounds(rr, cc)) continue;
          const nb = cellInfo[idx(rr, cc)];
          if (!nb) continue;
          if (isNeutralPathTile(info.tile) || isNeutralPathTile(nb.tile)) continue;

          const isSH = tileId(info.tile) === 'SH';
          const isET = tileId(info.tile) === 'ET';
          const nbIsSH = tileId(nb.tile) === 'SH';
          const nbIsET = tileId(nb.tile) === 'ET';
          if ((isSH && nbIsET) || (isET && nbIsSH)) {
            return { ok: false, msg: `Invalid: SH and ET connect directly at (${r},${c}) <-> (${rr},${cc})` };
          }

          if (e === 'E' || e === 'S') {
            addEdge(r, c, rr, cc);
          }
        }
      }
    }

    if (nodes.length > 0 && !skipMergedConnectivity) {
      const vis = Array(nodes.length).fill(false);
      let compCount = 0;
      for (let i = 0; i < nodes.length; i++) {
        if (vis[i]) continue;
        compCount++;
        const q = [i];
        vis[i] = true;
        while (q.length) {
          const u = q.pop();
          for (const v of adj2[u]) {
            if (!vis[v]) {
              vis[v] = true;
              q.push(v);
            }
          }
        }
      }
      if ((!isMultiFlex && compCount !== expectedPaths) || (isMultiFlex && compCount < expectedPaths)) {
        return {
          ok: false,
          msg: `Invalid: disconnected path fragments (${compCount} components, expected ${isMultiFlex ? '>=' : ''}${expectedPaths})`,
        };
      }
    }

    return { ok: true, msg: traceSummary ? `OK ${traceSummary}` : 'OK' };
  }

  return { validatePlacements, getInventoryMismatch };
}

function parseBlockersToSet(blockers, rows, cols) {
  const s = new Set();
  if (!Array.isArray(blockers)) return s;
  for (const b of blockers) {
    if (Array.isArray(b) && b.length >= 2) {
      const r = Number(b[0]),
        c = Number(b[1]);
      if (Number.isFinite(r) && Number.isFinite(c)) s.add(`${r},${c}`);
    } else if (b && typeof b === 'object' && Number.isFinite(b.r) && Number.isFinite(b.c)) {
      s.add(`${b.r},${b.c}`);
    }
  }
  return s;
}

module.exports = { makeCtx, parseBlockersToSet, tileId };
