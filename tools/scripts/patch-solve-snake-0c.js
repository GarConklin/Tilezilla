#!/usr/bin/env node
/**
 * Patch solves/solve-level.js getSnakeTip for 0C path tiles (CR/CT/CQ).
 * Run: docker compose run --rm web node tools/scripts/patch-solve-snake-0c.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'solves', 'solve-level.js');
let src = fs.readFileSync(target, 'utf8');

const OLD = `  function getSnakeTip(board, placedTiles, config) {
    const sh = placedTiles.find((t) => t.tile.indexOf('SH') >= 0);
    if (!sh) return null;
    const shCells = targetCells(sh.r, sh.c, sh.deg);
    let startR = null;
    let startC = null;
    let startEdge = null;
    for (let i = 0; i < shCells.length; i++) {
      const rr = shCells[i][0];
      const cc = shCells[i][1];
      const wh = i === 0 ? 'A' : 'B';
      const edges = edgesFor(sh.tile, sh.deg, wh);
      for (let j = 0; j < edges.length; j++) {
        startR = rr;
        startC = cc;
        startEdge = edges[j];
      }
    }
    if (startR === null) return null;
    const vis = new Set();
    for (let k = 0; k < shCells.length; k++) vis.add(\`\${shCells[k][0]},\${shCells[k][1]}\`);
    let curR = startR;
    let curC = startC;
    let exitDir = startEdge;
    for (let iter = 0; iter < 100; iter++) {
      const nR = curR + (exitDir === 'N' ? -1 : exitDir === 'S' ? 1 : 0);
      const nC = curC + (exitDir === 'W' ? -1 : exitDir === 'E' ? 1 : 0);
      if (nR < 0 || nR >= config.rows || nC < 0 || nC >= config.cols) return null;
      const nc = board[nR][nC];
      if (!nc) return { needR: nR, needC: nC, neededEdge: OPP[exitDir] };
      const ne = edgesFor(nc.tile, nc.deg, nc.which);
      if (ne.indexOf(OPP[exitDir]) < 0) return null;
      const ck = \`\${nR},\${nC}\`;
      if (vis.has(ck)) return null;
      vis.add(ck);
      const tp = placedTiles.find((t) =>
        targetCells(t.r, t.c, t.deg).some((cell) => cell[0] === nR && cell[1] === nC)
      );
      if (!tp) return null;
      const tc = targetCells(tp.r, tp.c, tp.deg);
      const eci = tc.findIndex((cell) => cell[0] === nR && cell[1] === nC);
      const entryEdge = OPP[exitDir];
      const whIn = eci === 0 ? 'A' : 'B';
      const pathList = pathsFor(tp.tile, tp.deg);
      if (pathList) {
        const other = pathExitOtherEnd(pathList, whIn, entryEdge);
        if (!other || other.length < 2) return null;
        const outW = other[0];
        const outE = other[1];
        const oidx = outW === 'A' ? 0 : 1;
        const oc = tc[oidx];
        curR = oc[0];
        curC = oc[1];
        exitDir = outE;
        continue;
      }
      const oi = [eci];
      for (let ci = 0; ci < tc.length; ci++) if (ci !== eci) oi.push(ci);
      let fe = false;
      for (let oii = 0; oii < oi.length; oii++) {
        const cii = oi[oii];
        const cR = tc[cii][0];
        const cC = tc[cii][1];
        const wh = cii === 0 ? 'A' : 'B';
        const ce = edgesFor(tp.tile, tp.deg, wh);
        for (let ei = 0; ei < ce.length; ei++) {
          const e = ce[ei];
          if (cR === nR && cC === nC && e === OPP[exitDir]) continue;
          const eR = cR + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const eC = cC + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (eR < 0 || eR >= config.rows || eC < 0 || eC >= config.cols) continue;
          curR = cR;
          curC = cC;
          exitDir = e;
          fe = true;
          break;
        }
        if (fe) break;
      }
      if (!fe) return null;
    }
    return null;
  }`;

const NEW = `  function getSnakeTip(board, placedTiles, config) {
    let endpoint = placedTiles.find((t) => t.tile.indexOf('SH') >= 0);
    if (!endpoint) endpoint = placedTiles.find((t) => t.tile.indexOf('ET') >= 0);
    if (!endpoint) return null;
    const epCells = targetCells(endpoint.r, endpoint.c, endpoint.deg);
    let startR = null;
    let startC = null;
    let startEdge = null;
    for (let i = 0; i < epCells.length; i++) {
      const rr = epCells[i][0];
      const cc = epCells[i][1];
      const wh = i === 0 ? 'A' : 'B';
      const edges = edgesFor(endpoint.tile, endpoint.deg, wh);
      for (let j = 0; j < edges.length; j++) {
        startR = rr;
        startC = cc;
        startEdge = edges[j];
      }
    }
    if (startR === null) return null;
    const vis = new Set();
    for (let k = 0; k < epCells.length; k++) vis.add(\`\${epCells[k][0]},\${epCells[k][1]}\`);
    const pathVis = new Set();
    let curR = startR;
    let curC = startC;
    let exitDir = startEdge;
    for (let iter = 0; iter < 200; iter++) {
      const nR = curR + (exitDir === 'N' ? -1 : exitDir === 'S' ? 1 : 0);
      const nC = curC + (exitDir === 'W' ? -1 : exitDir === 'E' ? 1 : 0);
      if (nR < 0 || nR >= config.rows || nC < 0 || nC >= config.cols) return null;
      const nc = board[nR][nC];
      if (!nc) return { needR: nR, needC: nC, neededEdge: OPP[exitDir] };
      const ne = edgesFor(nc.tile, nc.deg, nc.which);
      if (ne.indexOf(OPP[exitDir]) < 0) return null;
      const ck = \`\${nR},\${nC}\`;
      const tp = placedTiles.find((t) =>
        targetCells(t.r, t.c, t.deg).some((cell) => cell[0] === nR && cell[1] === nC)
      );
      if (!tp) return null;
      const tc = targetCells(tp.r, tp.c, tp.deg);
      const eci = tc.findIndex((cell) => cell[0] === nR && cell[1] === nC);
      const entryEdge = OPP[exitDir];
      const whIn = eci === 0 ? 'A' : 'B';
      const pathList = pathsFor(tp.tile, tp.deg);
      if (pathList) {
        const pvk = \`\${ck}:\${entryEdge}\`;
        if (pathVis.has(pvk)) return null;
        pathVis.add(pvk);
        const other = pathExitOtherEnd(pathList, whIn, entryEdge);
        if (!other || other.length < 2) return null;
        const oidx = other[0] === 'A' ? 0 : 1;
        curR = tc[oidx][0];
        curC = tc[oidx][1];
        exitDir = other[1];
        continue;
      }
      if (vis.has(ck)) return null;
      vis.add(ck);
      const oi = [eci];
      for (let ci = 0; ci < tc.length; ci++) if (ci !== eci) oi.push(ci);
      let fe = false;
      for (let oii = 0; oii < oi.length; oii++) {
        const cii = oi[oii];
        const cR = tc[cii][0];
        const cC = tc[cii][1];
        const wh = cii === 0 ? 'A' : 'B';
        const ce = edgesFor(tp.tile, tp.deg, wh);
        for (let ei = 0; ei < ce.length; ei++) {
          const e = ce[ei];
          if (cR === nR && cC === nC && e === OPP[exitDir]) continue;
          const eR = cR + (e === 'N' ? -1 : e === 'S' ? 1 : 0);
          const eC = cC + (e === 'W' ? -1 : e === 'E' ? 1 : 0);
          if (eR < 0 || eR >= config.rows || eC < 0 || eC >= config.cols) continue;
          const targetCell = board[eR][eC];
          if (targetCell && pathsFor(targetCell.tile, targetCell.deg)) {
            // path tile — re-entry handled via pathVis
          } else if (vis.has(\`\${eR},\${eC}\`)) {
            continue;
          }
          curR = cR;
          curC = cC;
          exitDir = e;
          fe = true;
          break;
        }
        if (fe) break;
      }
      if (!fe) return null;
    }
    return null;
  }`;

if (!src.includes('const pathVis = new Set();')) {
  if (!src.includes(OLD.slice(0, 80))) {
    console.error('getSnakeTip block not found — already patched or solve-level.js changed');
    process.exit(1);
  }
  src = src.replace(OLD, NEW);
  fs.writeFileSync(target, src);
  console.log('Patched getSnakeTip in solves/solve-level.js');
} else {
  console.log('Already patched (pathVis present)');
}
