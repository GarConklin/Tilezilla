/**
 * Strict single-snake check for a finished board (browser + Node).
 *
 * PASS only when:
 *   - every live edge meets a matching edge on an occupied, in-bounds neighbour;
 *   - there is exactly one SH and one ET;
 *   - one simple SH -> ET route visits every live (path) cell exactly once
 *     (so there are no detached or side loops).
 *
 * Cell graph = matched edges between neighbouring cells + the link between the two
 * halves of a domino, using the same half-link rule as the game's validateBoard().
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TZStrict = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const DR = { N: -1, S: 1, E: 0, W: 0 };
  const DC = { N: 0, S: 0, E: 1, W: -1 };
  const NEUTRAL = new Set(['E1', 'E2', 'B1', 'B2']);

  function tileId(ref) {
    if (!ref || typeof ref !== 'string') return '';
    const head = ref.split('#')[0].split('-')[0];
    return /^[A-Z0-9]{2,3}$/.test(head) ? head : '';
  }

  function norm(deg) {
    return ((Number(deg) % 360) + 360) % 360;
  }

  function cellCount(liveEdges, id) {
    const shape = liveEdges?.[id]?.shape;
    return Array.isArray(shape) && shape.length ? shape.length : 2;
  }

  /** Same footprint rule as cellsForTile() in web/js/app_v16.js. */
  function cellsForTile(liveEdges, tile, r, c, deg) {
    const id = tileId(tile) || tile;
    if (cellCount(liveEdges, id) === 1) return [[r, c]];
    const rot = norm(deg);
    if (rot === 0) return [[r, c], [r, c + 1]];
    if (rot === 90) return [[r, c], [r + 1, c]];
    if (rot === 180) return [[r, c], [r, c - 1]];
    return [[r, c], [r - 1, c]];
  }

  function edgesFor(liveEdges, tile, deg, which) {
    const id = tileId(tile) || tile;
    return liveEdges?.[id]?.['r' + norm(deg)]?.[which] || [];
  }

  function halvesLinked(liveEdges, tile, deg) {
    const id = tileId(tile) || tile;
    if (id !== 'CT' && id !== 'CQ') return true;
    const specs = liveEdges?.[id]?.['r' + norm(deg)]?.paths;
    if (!Array.isArray(specs) || !specs.length) return true;
    const ends = specs[0]?.ends;
    return Array.isArray(ends) && ends.length === 2 && ends[0][0] !== ends[1][0];
  }

  /**
   * @param {{rows:number, cols:number, liveEdges:object, placements:Array, blockers?:Set<string>}} o
   * @returns {{ok:boolean, msg:string, order:Array<[number,number]>|null, offRoute:Array<[number,number]>,
   *            liveCount:number, routeCount:number, badCells:Array<[number,number]>}}
   */
  function strictCheck(o) {
    const { rows, cols, liveEdges } = o;
    const blockers = o.blockers || new Set();
    const placements = o.placements || [];
    const key = (r, c) => r + ',' + c;
    const inB = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;
    const info = new Map();
    const res = { ok: false, msg: '', order: null, offRoute: [], liveCount: 0, routeCount: 0, badCells: [] };

    placements.forEach((p, i) => {
      const cells = cellsForTile(liveEdges, p.tile, p.r, p.c, p.deg);
      cells.forEach(([r, c], j) => {
        const k = key(r, c);
        if (!inB(r, c) || info.has(k) || blockers.has(k)) res.badCells.push([r, c]);
        info.set(k, { pid: i, tile: tileId(p.tile) || p.tile, deg: norm(p.deg), which: j === 0 ? 'A' : 'B', r, c });
      });
    });
    if (res.badCells.length) {
      res.msg = 'Off-board or overlapping tiles';
      return res;
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (!blockers.has(key(r, c)) && !info.has(key(r, c))) res.badCells.push([r, c]);
    if (res.badCells.length) {
      res.msg = `Board not full (${res.badCells.length} empty cell(s))`;
      return res;
    }

    const adj = new Map();
    const live = [];
    for (const [k, n] of info) {
      const edges = edgesFor(liveEdges, n.tile, n.deg, n.which);
      if (!edges.length || NEUTRAL.has(n.tile)) continue;
      live.push(k);
      const nb = [];
      for (const e of edges) {
        const rr = n.r + DR[e], cc = n.c + DC[e];
        const other = info.get(key(rr, cc));
        if (!inB(rr, cc) || !other || !edgesFor(liveEdges, other.tile, other.deg, other.which).includes(OPP[e])) {
          res.badCells.push([n.r, n.c]);
          continue;
        }
        nb.push(key(rr, cc));
      }
      adj.set(k, nb);
    }
    if (res.badCells.length) {
      const [r, c] = res.badCells[0];
      res.msg = `Unmatched live edge at (${r},${c})`;
      return res;
    }
    const byTile = new Map();
    for (const k of live) {
      const n = info.get(k);
      if (!byTile.has(n.pid)) byTile.set(n.pid, []);
      byTile.get(n.pid).push(k);
    }
    for (const [pid, ks] of byTile) {
      if (ks.length !== 2) continue;
      const p = placements[pid];
      if (!halvesLinked(liveEdges, p.tile, p.deg)) continue;
      const [a, b] = ks;
      if (!adj.get(a).includes(b)) adj.get(a).push(b);
      if (!adj.get(b).includes(a)) adj.get(b).push(a);
    }

    res.liveCount = live.length;
    const sh = live.filter((k) => info.get(k).tile === 'SH');
    const et = live.filter((k) => info.get(k).tile === 'ET');
    if (sh.length !== 1 || et.length !== 1) {
      res.msg = `Strict check needs exactly one SH and one ET (found SH=${sh.length}, ET=${et.length})`;
      return res;
    }
    const start = sh[0], goal = et[0];

    const seen = new Set([start]);
    const cur = [start];
    let best = null;
    let fullFirst = null;
    let routes = 0;
    const MAX_ROUTES = 50;
    (function dfs(u) {
      if (routes >= MAX_ROUTES) return;
      if (u === goal) {
        if (!best || cur.length > best.length) best = cur.slice();
        if (cur.length === live.length) {
          routes++;
          if (!fullFirst) fullFirst = cur.slice();
        }
        return;
      }
      for (const v of adj.get(u)) {
        if (seen.has(v)) continue;
        seen.add(v);
        cur.push(v);
        dfs(v);
        cur.pop();
        seen.delete(v);
      }
    })(start);

    const toRC = (k) => k.split(',').map(Number);
    res.routeCount = routes;
    if (fullFirst) {
      res.ok = true;
      res.order = fullFirst.map(toRC);
      res.msg = `One SH->ET route through all ${live.length} path cells` + (routes > 1 ? ` (${routes}${routes >= MAX_ROUTES ? '+' : ''} orders)` : '');
      return res;
    }
    if (!best) {
      res.offRoute = live.map(toRC);
      res.msg = 'SH and ET are not connected';
      return res;
    }
    const on = new Set(best);
    res.order = best.map(toRC);
    res.offRoute = live.filter((k) => !on.has(k)).map(toRC);
    res.msg = `Best SH->ET route covers ${best.length} of ${live.length} path cells; ${res.offRoute.length} cell(s) form a loop off the route`;
    return res;
  }

  return { strictCheck, cellsForTile, edgesFor, tileId };
});
