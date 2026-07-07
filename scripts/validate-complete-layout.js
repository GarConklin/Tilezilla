/**
 * Complete-board path validation (matches web/js/app_v16.js rules).
 * Graph connectivity + resolvePlacementPathChoices for CR/CT/CQ.
 */
'use strict';

const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

function rotName(deg) {
  const r = ((deg % 360) + 360) % 360;
  return r === 0 ? 'r0' : r === 90 ? 'r90' : r === 180 ? 'r180' : 'r270';
}

function targetCells(r, c, deg) {
  const rot = ((deg % 360) + 360) % 360;
  if (rot === 0) return [[r, c], [r, c + 1]];
  if (rot === 90) return [[r, c], [r + 1, c]];
  if (rot === 180) return [[r, c], [r, c - 1]];
  return [[r, c], [r - 1, c]];
}

function pathUsesBothHalves(pathObj) {
  const ends = pathObj?.ends;
  if (!ends || ends.length !== 2) return false;
  return (
    (ends[0][0] === 'A' && ends[1][0] === 'B') ||
    (ends[0][0] === 'B' && ends[1][0] === 'A')
  );
}

function isFullCrossroads(tileName, deg, tilesJson) {
  const rn = rotName(deg);
  const specs = tilesJson[tileName]?.[rn]?.paths;
  if (!Array.isArray(specs) || specs.length < 2) return false;
  return specs.every(pathUsesBothHalves);
}

function resolvePlacementPathChoices(cellInfo, placed, rows, cols, tilesJson) {
  const ambig = [];
  const fixed = new Map();

  function pathsFor(tn, deg) {
    const p = tilesJson[tn]?.[rotName(deg)]?.paths;
    return Array.isArray(p) && p.length ? p : null;
  }

  function edgesFor(tn, deg, wh) {
    return tilesJson[tn]?.[rotName(deg)]?.[wh] || [];
  }

  for (const t of placed) {
    const specs = pathsFor(t.tile, t.deg);
    if (!specs) continue;
    if (specs.length === 1 || isFullCrossroads(t.tile, t.deg, tilesJson)) {
      fixed.set(t.id, 0);
    } else {
      ambig.push(t.id);
    }
  }

  function resolvedEdgesForPick(pathPick) {
    const key = (r, c) => `${r},${c}`;
    const nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const info = cellInfo[r * cols + c];
        if (!info) continue;
        const base = edgesFor(info.tile, info.deg, info.which);
        if (base.length) nodes.push({ r, c, info, edges: base });
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
      const specs = t ? pathsFor(t.tile, t.deg) : null;
      const ctLike = t && (t.tile === 'CT' || t.tile === 'CQ');
      let link = true;
      if (ctLike) {
        link = edgesFor(t.tile, t.deg, 'A').length > 0 && edgesFor(t.tile, t.deg, 'B').length > 0;
      } else if (specs && specs.length) {
        const pi = pathPick.has(pid) ? pathPick.get(pid) : 0;
        link = pathUsesBothHalves(specs[pi]);
      }
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
    return deg1 === 2;
  }

  function dfs(i, pathPick) {
    if (i >= ambig.length) {
      return resolvedEdgesForPick(pathPick) ? Object.fromEntries(pathPick) : null;
    }
    const pid = ambig[i];
    const t = placed.find((x) => x.id === pid);
    const specs = pathsFor(t.tile, t.deg);
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

/**
 * @param {object} opts
 * @param {number} opts.rows
 * @param {number} opts.cols
 * @param {Array<{tile,r,c,deg}>} opts.placements
 * @param {object} opts.tilesJson
 * @returns {{ ok: boolean, reason?: string, pathPick?: object }}
 */
function validateCompleteLayout(opts) {
  const { rows, cols, placements, tilesJson } = opts;
  const placed = placements.map((p, i) => ({ id: `t${i}`, ...p }));
  const cellInfo = Array(rows * cols).fill(null);

  for (const t of placed) {
    const rot = ((t.deg % 360) + 360) % 360;
    const cells = targetCells(t.r, t.c, rot);
    for (let i = 0; i < cells.length; i++) {
      const [rr, cc] = cells[i];
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) {
        return { ok: false, reason: `off-board ${t.tile} at (${rr},${cc})` };
      }
      const ii = rr * cols + cc;
      if (cellInfo[ii]) return { ok: false, reason: `overlap at (${rr},${cc})` };
      cellInfo[ii] = { tile: t.tile, deg: rot, which: i === 0 ? 'A' : 'B', placedId: t.id };
    }
  }

  const filled = cellInfo.filter(Boolean).length;
  const total = rows * cols;
  if (filled !== total) {
    return { ok: false, reason: `incomplete board ${filled}/${total}` };
  }

  function edgesFor(tn, deg, wh) {
    return tilesJson[tn]?.[rotName(deg)]?.[wh] || [];
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const info = cellInfo[r * cols + c];
      if (!info) continue;
      for (const e of edgesFor(info.tile, info.deg, info.which)) {
        const rr = r + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
        const cc = c + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) {
          return { ok: false, reason: `edge ${e} off-board at (${r},${c})` };
        }
        const nb = cellInfo[rr * cols + cc];
        if (!nb) return { ok: false, reason: `open edge ${e} at (${r},${c})` };
        if (!edgesFor(nb.tile, nb.deg, nb.which).includes(OPP[e])) {
          return { ok: false, reason: `edge mismatch (${r},${c}) ${e}` };
        }
      }
    }
  }

  const pathPick = resolvePlacementPathChoices(cellInfo, placed, rows, cols, tilesJson);
  if (!pathPick) {
    const ambig = placed
      .filter((t) => {
        const specs = tilesJson[t.tile]?.[rotName(t.deg)]?.paths;
        return specs && specs.length > 1 && !isFullCrossroads(t.tile, t.deg, tilesJson);
      })
      .map((t) => t.tile);
    return {
      ok: false,
      reason: ambig.length
        ? `ambiguous path wiring (${[...new Set(ambig)].join(', ')})`
        : 'path disconnected or wrong endpoints',
    };
  }

  return {
    ok: true,
    pathPick: pathPick instanceof Map ? Object.fromEntries(pathPick) : pathPick,
  };
}

module.exports = {
  validateCompleteLayout,
  targetCells,
  rotName,
};
