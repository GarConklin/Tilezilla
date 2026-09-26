const fs = require("fs");
const path = require("path");
const tilesJson = JSON.parse(fs.readFileSync(path.join(__dirname,"..","data","tiles","tiles-live-edges.json"),"utf-8"));
const OPP = {N:"S",S:"N",E:"W",W:"E"};
function rotName(d){const r=((d%360)+360)%360;return r===0?"r0":r===90?"r90":r===180?"r180":"r270";}
function targetCells(r,c,d){const rot=((d%360)+360)%360;if(rot===0)return[[r,c],[r,c+1]];if(rot===90)return[[r,c],[r+1,c]];if(rot===180)return[[r,c],[r,c-1]];return[[r,c],[r-1,c]];}
function edgesFor(tn,d,wh){const rn=rotName(d);const t=tilesJson[tn];if(!t||!t[rn])return[];return t[rn][wh]||[];}

class PuzzleSolver {
  constructor(rows,cols,tileCounts){
    this.ROWS=rows;this.COLS=cols;this.board=[];this.remaining={};this.placedTiles=[];this.solutions=[];this.hashes=new Set();this.maxSolutions=100;
    for(let r=0;r<rows;r++){this.board.push([]);for(let c=0;c<cols;c++)this.board[r].push(null);}
    for(const[name,count]of Object.entries(tileCounts))this.remaining[name]=count;
  }
  inBounds(r,c){return r>=0&&r<this.ROWS&&c>=0&&c<this.COLS;}
  place(tn,r,c,d){const cells=targetCells(r,c,d);const tid="t"+this.placedTiles.length;this.placedTiles.push({id:tid,tile:tn,r,c,deg:d});this.remaining[tn]--;for(let i=0;i<cells.length;i++)this.board[cells[i][0]][cells[i][1]]={tile:tn,deg:d,which:i===0?"A":"B",tileId:tid};}
  unplace(){const last=this.placedTiles.pop();this.remaining[last.tile]++;const cells=targetCells(last.r,last.c,last.deg);for(let i=0;i<cells.length;i++)this.board[cells[i][0]][cells[i][1]]=null;}

  canPlace(tn,r,c,deg){
    if(!this.remaining[tn]||this.remaining[tn]<=0)return false;
    const cells=targetCells(r,c,deg);
    for(let i=0;i<cells.length;i++){const[rr,cc]=cells[i];if(!this.inBounds(rr,cc))return false;if(this.board[rr][cc]!==null)return false;
      const wh=i===0?"A":"B";const edges=edgesFor(tn,deg,wh);for(const e of edges){const nr=rr+(e==="N"?-1:e==="S"?1:0),nc=cc+(e==="W"?-1:e==="E"?1:0);if(!this.inBounds(nr,nc))return false;}}
    let hasLive=this.placedTiles.length===0;const fp=new Set(cells.map(c=>c[0]+","+c[1]));
    for(let i=0;i<cells.length;i++){const[rr,cc]=cells[i];const wh=i===0?"A":"B";const our=edgesFor(tn,deg,wh);
      for(const[d,dr,dc]of[["N",-1,0],["S",1,0],["E",0,1],["W",0,-1]]){const nr=rr+dr,nc=cc+dc;if(!this.inBounds(nr,nc))continue;const nb=this.board[nr][nc];if(!nb)continue;
        const ne=edgesFor(nb.tile,nb.deg,nb.which);const we=our.includes(d);const nh=ne.includes(OPP[d]);if(we!==nh)return false;if(we&&nh)hasLive=true;}}
    if(!hasLive)return false;
    for(let i=0;i<cells.length;i++){const[rr,cc]=cells[i];for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=rr+dr,nc=cc+dc;if(!this.inBounds(nr,nc))continue;if(fp.has(nr+","+nc))continue;if(this.board[nr][nc]!==null)continue;
        let hasEN=false;for(const[dr2,dc2]of[[-1,0],[1,0],[0,-1],[0,1]]){const nnr=nr+dr2,nnc=nc+dc2;if(!this.inBounds(nnr,nnc))continue;if(fp.has(nnr+","+nnc))continue;if(this.board[nnr][nnc]===null){hasEN=true;break;}}if(!hasEN)return false;}}
    return true;
  }

  getCellReq(tR,tC,exTile,exR,exC,exDeg){
    const reqL=new Set(),reqN=new Set();const exCells=exTile!==null?targetCells(exR,exC,exDeg):null;
    for(const[d,dr,dc]of[["N",-1,0],["S",1,0],["E",0,1],["W",0,-1]]){const nr=tR+dr,nc=tC+dc;if(!this.inBounds(nr,nc))continue;let nb=this.board[nr][nc];
      if(!nb&&exCells){for(let ci=0;ci<exCells.length;ci++){if(exCells[ci][0]===nr&&exCells[ci][1]===nc){nb={tile:exTile,deg:exDeg,which:ci===0?"A":"B"};break;}}}
      if(!nb)continue;const nE=edgesFor(nb.tile,nb.deg,nb.which);if(nE.includes(OPP[d]))reqL.add(d);else reqN.add(d);}
    return{requiredLive:reqL,requiredNonLive:reqN};
  }

  canAdjacentCellsBeFilled(tn,r,c,deg){
    const cells=targetCells(r,c,deg);const fp=new Set(cells.map(cc=>cc[0]+","+cc[1]));const adj=new Set();
    for(const[rr,cc]of cells)for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=rr+dr,nc=cc+dc;if(!this.inBounds(nr,nc))continue;if(fp.has(nr+","+nc))continue;if(this.board[nr][nc]!==null)continue;adj.add(nr+","+nc);}
    for(const cellKey of adj){const[tR,tC]=cellKey.split(",").map(Number);const req=this.getCellReq(tR,tC,tn,r,c,deg);let canFill=false;
      const avail={};for(const n in this.remaining)avail[n]=this.remaining[n];if(avail[tn]!==undefined)avail[tn]=Math.max(0,avail[tn]-1);
      const tileNames=Object.keys(avail).filter(n=>avail[n]>0);
      for(let ti=0;ti<tileNames.length&&!canFill;ti++){const cT=tileNames[ti];for(let di=0;di<4&&!canFill;di++){const cD=di*90;const def=tilesJson[cT]?.[rotName(cD)];if(!def)continue;
        const eA=def["A"]||[];let aOk=true;for(const e of req.requiredLive)if(!eA.includes(e)){aOk=false;break;}if(aOk)for(const e of req.requiredNonLive)if(eA.includes(e)){aOk=false;break;}
        if(aOk){const cC2=targetCells(tR,tC,cD);const bC=cC2[1];if(this.inBounds(bC[0],bC[1])&&this.board[bC[0]][bC[1]]===null&&!fp.has(bC[0]+","+bC[1])){
          const eB=def["B"]||[];const bR=this.getCellReq(bC[0],bC[1],tn,r,c,deg);let bOk=true;for(const e of bR.requiredLive)if(!eB.includes(e)){bOk=false;break;}if(bOk)for(const e of bR.requiredNonLive)if(eB.includes(e)){bOk=false;break;}if(bOk)canFill=true;}}
        if(!canFill){const eB2=def["B"]||[];let bOk=true;for(const e of req.requiredLive)if(!eB2.includes(e)){bOk=false;break;}if(bOk)for(const e of req.requiredNonLive)if(eB2.includes(e)){bOk=false;break;}
          if(bOk){const rot2=((cD%360)+360)%360;const aR2=tR+(rot2===90?-1:rot2===270?1:0),aC2=tC+(rot2===0?-1:rot2===180?1:0);
            if(this.inBounds(aR2,aC2)&&this.board[aR2][aC2]===null&&!fp.has(aR2+","+aC2)){const eA2=def["A"]||[];const aR3=this.getCellReq(aR2,aC2,tn,r,c,deg);let aOk2=true;
              for(const e of aR3.requiredLive)if(!eA2.includes(e)){aOk2=false;break;}if(aOk2)for(const e of aR3.requiredNonLive)if(eA2.includes(e)){aOk2=false;break;}if(aOk2)canFill=true;}}}}}
      if(!canFill)return false;}
    return true;
  }

  wouldCreateHole(tn,r,c,deg){
    if(!this.canPlace(tn,r,c,deg))return true;this.place(tn,r,c,deg);
    const empties=[];for(let rr=0;rr<this.ROWS;rr++)for(let cc=0;cc<this.COLS;cc++)if(this.board[rr][cc]===null)empties.push([rr,cc]);
    const key=(r,c)=>r+","+c;const emptySet=new Set(empties.map(e=>key(e[0],e[1])));
    for(const[rr,cc]of empties){let has=false;for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){if(emptySet.has(key(rr+dr,cc+dc))){has=true;break;}}if(!has){this.unplace();return true;}}
    const vis=new Set();for(const[sR,sC]of empties){if(vis.has(key(sR,sC)))continue;const reg=[],q=[[sR,sC]];vis.add(key(sR,sC));
      while(q.length>0){const cur=q.shift();reg.push(cur);for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nk=key(cur[0]+dr,cur[1]+dc);if(emptySet.has(nk)&&!vis.has(nk)){vis.add(nk);q.push([cur[0]+dr,cur[1]+dc]);}}}
      if(reg.length%2!==0){this.unplace();return true;}}
    const tip=this.getSnakeTip();if(tip){const etP=this.placedTiles.find(t=>t.tile.includes("ET"));if(etP){
      const etCells=targetCells(etP.r,etP.c,etP.deg);let etEntry=null;
      for(let i=0;i<etCells.length;i++){const wh=i===0?"A":"B";const edges=edgesFor(etP.tile,etP.deg,wh);for(const e of edges){const nr=etCells[i][0]+(e==="N"?-1:e==="S"?1:0),nc=etCells[i][1]+(e==="W"?-1:e==="E"?1:0);if(this.inBounds(nr,nc)){etEntry={r:nr,c:nc};break;}}if(etEntry)break;}
      if(etEntry&&!this.board[etEntry.r][etEntry.c]){const bVis=new Set([key(tip.needR,tip.needC)]),bQ=[[tip.needR,tip.needC]];let reached=false;
        while(bQ.length>0&&!reached){const cur=bQ.shift();if(cur[0]===etEntry.r&&cur[1]===etEntry.c){reached=true;break;}
          for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=cur[0]+dr,nc=cur[1]+dc;if(!this.inBounds(nr,nc))continue;const nk=key(nr,nc);if(bVis.has(nk))continue;
            if(this.board[nr][nc]===null){bVis.add(nk);bQ.push([nr,nc]);}
            else if(this.board[nr][nc].tile==="DB-Snake-Tile.png"){bVis.add(nk);const dbP=this.placedTiles.find(t=>t.id===this.board[nr][nc].tileId);if(dbP){const dbC=targetCells(dbP.r,dbP.c,dbP.deg);
              for(const[dR,dC]of dbC){const ok=key(dR,dC);if(ok!==nk&&!bVis.has(ok)){bVis.add(ok);for(const[dr2,dc2]of[[-1,0],[1,0],[0,-1],[0,1]]){const er=dR+dr2,ec=dC+dc2;if(!this.inBounds(er,ec))continue;const ek=key(er,ec);if(bVis.has(ek))continue;
                    if(er===etEntry.r&&ec===etEntry.c){reached=true;break;}if(this.board[er][ec]===null){bVis.add(ek);bQ.push([er,ec]);}}if(reached)break;}}}}}}
        if(!reached){this.unplace();return true;}}}}
    this.unplace();return false;
  }

  getSnakeTip(){
    const sh=this.placedTiles.find(t=>t.tile.includes("SH"));if(!sh)return null;const shCells=targetCells(sh.r,sh.c,sh.deg);let sR=null,sC=null,sE=null;
    for(let i=0;i<shCells.length;i++){const wh=i===0?"A":"B";const edges=edgesFor(sh.tile,sh.deg,wh);for(const e of edges){sR=shCells[i][0];sC=shCells[i][1];sE=e;}}
    if(sR===null)return null;const vis=new Set(shCells.map(c=>c[0]+","+c[1]));let curR=sR,curC=sC,exitDir=sE;
    for(let iter=0;iter<200;iter++){const nR=curR+(exitDir==="N"?-1:exitDir==="S"?1:0),nC=curC+(exitDir==="W"?-1:exitDir==="E"?1:0);
      if(!this.inBounds(nR,nC))return null;if(!this.board[nR][nC])return{needR:nR,needC:nC,neededEdge:OPP[exitDir]};
      const nc=this.board[nR][nC];if(!edgesFor(nc.tile,nc.deg,nc.which).includes(OPP[exitDir]))return null;const ck=nR+","+nC;if(vis.has(ck))return null;vis.add(ck);
      const tp=this.placedTiles.find(t=>targetCells(t.r,t.c,t.deg).some(c=>c[0]===nR&&c[1]===nC));if(!tp)return null;
      const tc2=targetCells(tp.r,tp.c,tp.deg);const eci=tc2.findIndex(c=>c[0]===nR&&c[1]===nC);const order=[eci,...tc2.map((_,i)=>i).filter(i=>i!==eci)];let found=false;
      for(const cii of order){const cR=tc2[cii][0],cC=tc2[cii][1],wh=cii===0?"A":"B";const ce=edgesFor(tp.tile,tp.deg,wh);
        for(const e of ce){if(cR===nR&&cC===nC&&e===OPP[exitDir])continue;const eR=cR+(e==="N"?-1:e==="S"?1:0),eC=cC+(e==="W"?-1:e==="E"?1:0);if(!this.inBounds(eR,eC))continue;curR=cR;curC=cC;exitDir=e;found=true;break;}if(found)break;}
      if(!found)return null;}
    return null;
  }

  getOptions(tipR,tipC,neededEdge){
    const opts=[];let tileNames=Object.keys(this.remaining).filter(n=>this.remaining[n]>0);
    let tilesLeft=0;for(const k in this.remaining)tilesLeft+=this.remaining[k];
    if(tilesLeft-(this.remaining["ET-Snake-Tile.png"]||0)>0)tileNames=tileNames.filter(n=>!n.includes("ET"));
    for(const tn of tileNames){for(let di=0;di<4;di++){const deg=di*90;
      if(edgesFor(tn,deg,"A").includes(neededEdge)&&this.canPlace(tn,tipR,tipC,deg)){if(!this.wouldCreateHole(tn,tipR,tipC,deg))opts.push({tile:tn,r:tipR,c:tipC,deg});}
      if(edgesFor(tn,deg,"B").includes(neededEdge)){const rot=((deg%360)+360)%360;const aR=tipR+(rot===90?-1:rot===270?1:0),aC=tipC+(rot===0?-1:rot===180?1:0);
        if(this.inBounds(aR,aC)&&this.canPlace(tn,aR,aC,deg)){if(!this.wouldCreateHole(tn,aR,aC,deg))opts.push({tile:tn,r:aR,c:aC,deg});}}}}
    const seen=new Set();return opts.filter(o=>{const k=o.tile+"|"+o.r+"|"+o.c+"|"+o.deg;if(seen.has(k))return false;seen.add(k);return true;});
  }

  hash(){const p=[];for(let r=0;r<this.ROWS;r++)for(let c=0;c<this.COLS;c++){const cl=this.board[r][c];if(cl){const e=edgesFor(cl.tile,cl.deg,cl.which).slice().sort().join("");p.push(r+","+c+":"+e);}}return p.join("|");}

  solve(initial){
    for(const p of initial)this.place(p.tile,p.r,p.c,p.deg);
    const dfs=()=>{if(this.solutions.length>=this.maxSolutions)return;let tl=0;for(const k in this.remaining)tl+=this.remaining[k];
      if(tl===0){const h=this.hash();if(!this.hashes.has(h)){this.hashes.add(h);this.solutions.push(this.placedTiles.map(t=>({tile:t.tile,r:t.r,c:t.c,deg:t.deg})));}return;}
      const tip=this.getSnakeTip();if(!tip)return;const opts=this.getOptions(tip.needR,tip.needC,tip.neededEdge);
      for(const o of opts){this.place(o.tile,o.r,o.c,o.deg);dfs();this.unplace();if(this.solutions.length>=this.maxSolutions)return;}};
    dfs();return this.solutions;
  }
}

function isValidPlacement(rows,cols,tn,r,c,deg){const cells=targetCells(r,c,deg);for(let i=0;i<cells.length;i++){const[cr,cc]=cells[i];if(cr<0||cr>=rows||cc<0||cc>=cols)return false;
  const wh=i===0?"A":"B";const edges=edgesFor(tn,deg,wh);for(const e of edges){const nr=cr+(e==="N"?-1:e==="S"?1:0),nc=cc+(e==="W"?-1:e==="E"?1:0);if(nr<0||nr>=rows||nc<0||nc>=cols)return false;}}return true;}
function overlaps(r1,c1,d1,r2,c2,d2){const c1s=targetCells(r1,c1,d1),c2s=targetCells(r2,c2,d2);for(const a of c1s)for(const b of c2s)if(a[0]===b[0]&&a[1]===b[1])return true;return false;}

// 180-degree board mirror: if rotating the entire board 180° yields a known solution, skip it
function mirror180Hash(placements, rows, cols){
  const ps = new PuzzleSolver(rows, cols, {});
  // We only need to read the hash, so manually fill the board
  for(const p of placements){
    const mr = rows-1-p.r, mc = cols-1-p.c, md = (p.deg+180)%360;
    const cells = targetCells(mr, mc, md);
    for(let i=0;i<cells.length;i++){
      const wh = i===0?"A":"B";
      ps.board[cells[i][0]][cells[i][1]] = {tile:p.tile, deg:md, which:wh};
    }
  }
  return ps.hash();
}

function solvePuzzle(level){
  const{rows,cols,tiles}=level;const SH="SH-Snake-Tile.png",ET="ET-Snake-Tile.png";const allSolutions=[];const allHashes=new Set();
  const shPlacements=[];const shSeen=new Set();
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)for(let d=0;d<4;d++){const deg=d*90;if(!isValidPlacement(rows,cols,SH,r,c,deg))continue;
    const cells=targetCells(r,c,deg);const key=cells.map(cc=>cc[0]+","+cc[1]).sort().join("|")+":"+edgesFor(SH,deg,"B").join("");if(shSeen.has(key))continue;shSeen.add(key);shPlacements.push({r,c,deg});}
  for(const sh of shPlacements){for(let er=0;er<rows;er++)for(let ec=0;ec<cols;ec++)for(let ed=0;ed<4;ed++){
    const eDeg=ed*90;if(!isValidPlacement(rows,cols,ET,er,ec,eDeg))continue;if(overlaps(sh.r,sh.c,sh.deg,er,ec,eDeg))continue;
    const solver=new PuzzleSolver(rows,cols,{...tiles});const initial=[{tile:SH,r:sh.r,c:sh.c,deg:sh.deg},{tile:ET,r:er,c:ec,deg:eDeg}];
    const sols=solver.solve(initial);for(const sol of sols){const ts=new PuzzleSolver(rows,cols,{...tiles});for(const p of sol)ts.place(p.tile,p.r,p.c,p.deg);const h=ts.hash();
      if(!allHashes.has(h)){const mh=mirror180Hash(sol,rows,cols);if(!allHashes.has(mh)){allHashes.add(h);allHashes.add(mh);allSolutions.push({shPos:sh,etPos:{r:er,c:ec,deg:eDeg},placements:sol,label:"SH("+sh.r+","+sh.c+")d"+sh.deg+" ET("+er+","+ec+")d"+eDeg});}}}}}
  return allSolutions;
}

// Corner/edge search for large boards with progress logging and incremental file output.
function solvePuzzleEdges(level, outFile){
  const{rows,cols,tiles}=level;const SH="SH-Snake-Tile.png",ET="ET-Snake-Tile.png";const allSolutions=[];const allHashes=new Set();
  const positions=[];
  for(let r=0;r<rows;r+=rows-1)for(let c=0;c<cols;c+=cols-1)positions.push([r,c]);
  if(!level.cornersOnly){
    for(let c=1;c<cols-1;c++){positions.push([0,c]);positions.push([rows-1,c]);}
    for(let r=1;r<rows-1;r++){positions.push([r,0]);positions.push([r,cols-1]);}
  }
  // Build unique SH placements
  const shPlacements=[];const shSeen=new Set();
  for(const[sr,sc]of positions){for(let sd=0;sd<4;sd++){
    const sDeg=sd*90;if(!isValidPlacement(rows,cols,SH,sr,sc,sDeg))continue;
    const shCells=targetCells(sr,sc,sDeg);const shKey=shCells.map(cc=>cc[0]+","+cc[1]).sort().join("|")+":"+edgesFor(SH,sDeg,"B").join("");
    if(shSeen.has(shKey))continue;shSeen.add(shKey);shPlacements.push({r:sr,c:sc,deg:sDeg});
  }}
  console.log("  "+positions.length+" edge positions, "+shPlacements.length+" unique SH placements");
  const t0=Date.now();let combosChecked=0;
  // Helper: write current solutions to file incrementally
  function flushToFile(){
    if(!outFile)return;
    const output={board:{rows,cols,cells:rows*cols},tileSet:"tiles-live-edges.json",tiles,
      totalUniqueSolutions:allSolutions.length,generatedAt:new Date().toISOString(),status:"in_progress",
      solutions:allSolutions.map((s,i)=>({id:"solve-"+(i+1),label:level.name+" #"+(i+1)+" - "+(s.label||""),placements:s.placements}))};
    try{fs.writeFileSync(outFile,JSON.stringify(output,null,2));}catch(e){}
  }
  for(let si=0;si<shPlacements.length;si++){
    const sh=shPlacements[si];
    const elapsed=((Date.now()-t0)/1000).toFixed(0);
    console.log("  SH "+(si+1)+"/"+shPlacements.length+" @ ("+sh.r+","+sh.c+") "+sh.deg+"° | "+allSolutions.length+" solutions so far | "+elapsed+"s");
    for(const[er,ec]of positions){for(let ed=0;ed<4;ed++){
      const eDeg=ed*90;if(!isValidPlacement(rows,cols,ET,er,ec,eDeg))continue;if(overlaps(sh.r,sh.c,sh.deg,er,ec,eDeg))continue;
      combosChecked++;
      const solver=new PuzzleSolver(rows,cols,{...tiles});const initial=[{tile:SH,r:sh.r,c:sh.c,deg:sh.deg},{tile:ET,r:er,c:ec,deg:eDeg}];
      const sols=solver.solve(initial);for(const sol of sols){const ts=new PuzzleSolver(rows,cols,{...tiles});for(const p of sol)ts.place(p.tile,p.r,p.c,p.deg);const h=ts.hash();
        if(!allHashes.has(h)){const mh=mirror180Hash(sol,rows,cols);if(!allHashes.has(mh)){allHashes.add(h);allHashes.add(mh);
          allSolutions.push({shPos:{r:sh.r,c:sh.c,deg:sh.deg},etPos:{r:er,c:ec,deg:eDeg},placements:sol,label:"SH("+sh.r+","+sh.c+")d"+sh.deg+" ET("+er+","+ec+")d"+eDeg});
          console.log("    >> NEW solution #"+allSolutions.length+" SH("+sh.r+","+sh.c+")d"+sh.deg+" ET("+er+","+ec+")d"+eDeg);
          flushToFile();
        }}}
    }}
  }
  const totalElapsed=((Date.now()-t0)/1000).toFixed(1);
  console.log("  DONE: "+allSolutions.length+" unique solutions, "+combosChecked+" combos checked, "+totalElapsed+"s");
  return allSolutions;
}

const LEVELS=[
  {name:"Puzzle 1",rows:2,cols:4,tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":1,"HL-Snake-Tile.png":1}},
  {name:"Puzzle 2",rows:3,cols:4,tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":1,"RC-Snake-Tile.png":1,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1}},
  {name:"Puzzle 2B",rows:3,cols:4,outFile:"3x4-B.json",tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":1,"VL-Snake-Tile.png":1,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1}},
  {name:"Puzzle 3",rows:4,cols:4,tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":1,"RC-Snake-Tile.png":1,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1,"HL-Snake-Tile.png":1,"VL-Snake-Tile.png":1}},
  {name:"Puzzle 4",rows:4,cols:5,tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":4,"RC-Snake-Tile.png":1,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1,"HL-Snake-Tile.png":1}},
  {name:"Puzzle 5",rows:6,cols:5,tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":6,"RC-Snake-Tile.png":2,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1,"HL-Snake-Tile.png":1,"VL-Snake-Tile.png":1,"DB-Snake-Tile.png":1}},
  {name:"Puzzle 6",rows:6,cols:6,tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":4,"RC-Snake-Tile.png":4,"LL-Snake-Tile.png":2,"LR-Snake-Tile.png":2,"HL-Snake-Tile.png":1,"VL-Snake-Tile.png":1,"DB-Snake-Tile.png":2},edgesOnly:true,cornersOnly:true},
  {name:"Puzzle 3B",rows:4,cols:4,outFile:"4x4-B.json",tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"SZ-Snake-Tile.png":1,"SS-Snake-Tile.png":1,"DS-Snake-Tile.png":1,"UT-Snake-Tile.png":1,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1}},
  {name:"Puzzle 4B",rows:4,cols:5,outFile:"4x5-B.json",tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"SZ-Snake-Tile.png":1,"SS-Snake-Tile.png":1,"QC-Snake-Tile.png":1,"DS-Snake-Tile.png":1,"UT-Snake-Tile.png":2,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1}},
  {name:"Puzzle 5B",rows:6,cols:5,outFile:"6x5-B.json",edgesOnly:true,cornersOnly:true,tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"SZ-Snake-Tile.png":1,"SS-Snake-Tile.png":1,"LC-Snake-Tile.png":1,"DS-Snake-Tile.png":1,"QC-Snake-Tile.png":1,"UT-Snake-Tile.png":4,"RC-Snake-Tile.png":1,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1,"DB-Snake-Tile.png":1}},
  {name:"Puzzle 2B",rows:3,cols:4,outFile:"3x4-B.json",tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"UT-Snake-Tile.png":1,"VL-Snake-Tile.png":1,"LL-Snake-Tile.png":1,"LR-Snake-Tile.png":1}},
  {name:"Puzzle 4C",rows:4,cols:5,outFile:"4x5-C.json",tiles:{"SH-Snake-Tile.png":1,"ET-Snake-Tile.png":1,"RC-Snake-Tile.png":2,"UT-Snake-Tile.png":2,"LL-Snake-Tile.png":1,"VL-Snake-Tile.png":1,"LR-Snake-Tile.png":1,"HL-Snake-Tile.png":1}}
];

console.log("=== Puzzle Solution Generator ===\n");
for(const level of LEVELS){
  const totalTiles=Object.values(level.tiles).reduce((a,b)=>a+b,0);const totalCells=level.rows*level.cols;
  console.log(level.name+": "+level.rows+"x"+level.cols+" ("+totalCells+" cells, "+totalTiles+" tiles)");
  if(totalTiles*2!==totalCells){console.log("  WARNING: tile count mismatch. Skipping.\n");continue;}
  const t0=Date.now();const solutions=level.edgesOnly?solvePuzzleEdges(level):solvePuzzle(level);const elapsed=Date.now()-t0;
  console.log("  Found "+solutions.length+" unique solutions in "+elapsed+"ms");
  const output={board:{rows:level.rows,cols:level.cols,cells:totalCells},tileSet:"tiles-live-edges.json",tiles:level.tiles,totalUniqueSolutions:solutions.length,generatedAt:new Date().toISOString(),
    solutions:solutions.map((s,i)=>({id:"solve-"+(i+1),label:level.name+" #"+(i+1)+" - "+s.label,placements:s.placements}))};
  const filename=level.outFile||level.rows+"x"+level.cols+".json";
  fs.writeFileSync(path.join(__dirname,filename),JSON.stringify(output,null,2));
  console.log("  Wrote "+filename+"\n");
}
console.log("Done!");