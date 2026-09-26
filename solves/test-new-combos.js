// test-new-combos.js - Tests candidate tile combos for -B level variants
// Run inside Docker: docker exec garz-puzzle-web-1 node /app/solves/test-new-combos.js
const fs = require("fs");
const path = require("path");
const tilesJson = JSON.parse(fs.readFileSync(path.join(__dirname,"..","data","tiles","tiles-live-edges.json"),"utf-8"));
const OPP = {N:"S",S:"N",E:"W",W:"E"};
function rotName(d){const r=((d%360)+360)%360;return r===0?"r0":r===90?"r90":r===180?"r180":"r270";}
function targetCells(r,c,d){const rot=((d%360)+360)%360;if(rot===0)return[[r,c],[r,c+1]];if(rot===90)return[[r,c],[r+1,c]];if(rot===180)return[[r,c],[r,c-1]];return[[r,c],[r-1,c]];}
function edgesFor(tn,d,wh){const rn=rotName(d);const t=tilesJson[tn];if(!t||!t[rn])return[];return t[rn][wh]||[];}

class PuzzleSolver {
  constructor(rows,cols,tc){
    this.ROWS=rows;this.COLS=cols;this.board=[];this.remaining={};this.placedTiles=[];this.solutions=[];this.hashes=new Set();this.maxSolutions=20;
    for(let r=0;r<rows;r++){this.board.push([]);for(let c=0;c<cols;c++)this.board[r].push(null);}
    for(const[n,ct]of Object.entries(tc))this.remaining[n]=ct;
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
  wouldCreateHole(tn,r,c,deg){
    if(!this.canPlace(tn,r,c,deg))return true;this.place(tn,r,c,deg);
    const empties=[];for(let rr=0;rr<this.ROWS;rr++)for(let cc=0;cc<this.COLS;cc++)if(this.board[rr][cc]===null)empties.push([rr,cc]);
    const key=(r,c)=>r+","+c;const es=new Set(empties.map(e=>key(e[0],e[1])));
    for(const[rr,cc]of empties){let has=false;for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){if(es.has(key(rr+dr,cc+dc))){has=true;break;}}if(!has){this.unplace();return true;}}
    const vis=new Set();for(const[sR,sC]of empties){if(vis.has(key(sR,sC)))continue;const reg=[],q=[[sR,sC]];vis.add(key(sR,sC));
      while(q.length>0){const cur=q.shift();reg.push(cur);for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nk=key(cur[0]+dr,cur[1]+dc);if(es.has(nk)&&!vis.has(nk)){vis.add(nk);q.push([cur[0]+dr,cur[1]+dc]);}}}
      if(reg.length%2!==0){this.unplace();return true;}}
    this.unplace();return false;
  }
  getSnakeTip(){
    const sh=this.placedTiles.find(t=>t.tile.includes("SH"));if(!sh)return null;
    const shC=targetCells(sh.r,sh.c,sh.deg);let sR=null,sC=null,sE=null;
    for(let i=0;i<shC.length;i++){const wh=i===0?"A":"B";const ed=edgesFor(sh.tile,sh.deg,wh);for(const e of ed){sR=shC[i][0];sC=shC[i][1];sE=e;}}
    if(sR===null)return null;const vis=new Set(shC.map(c=>c[0]+","+c[1]));let curR=sR,curC=sC,exitDir=sE;
    for(let iter=0;iter<200;iter++){
      const nR=curR+(exitDir==="N"?-1:exitDir==="S"?1:0),nC=curC+(exitDir==="W"?-1:exitDir==="E"?1:0);
      if(!this.inBounds(nR,nC))return null;
      if(!this.board[nR][nC])return{needR:nR,needC:nC,neededEdge:OPP[exitDir]};
      const nc=this.board[nR][nC];if(!edgesFor(nc.tile,nc.deg,nc.which).includes(OPP[exitDir]))return null;
      const ck=nR+","+nC;if(vis.has(ck))return null;vis.add(ck);
      const tp=this.placedTiles.find(t=>targetCells(t.r,t.c,t.deg).some(c=>c[0]===nR&&c[1]===nC));if(!tp)return null;
      const tc2=targetCells(tp.r,tp.c,tp.deg);const eci=tc2.findIndex(c=>c[0]===nR&&c[1]===nC);
      const order=[eci,...tc2.map((_,i)=>i).filter(i=>i!==eci)];let found=false;
      for(const cii of order){const cR=tc2[cii][0],cC=tc2[cii][1],wh=cii===0?"A":"B";const ce=edgesFor(tp.tile,tp.deg,wh);
        for(const e of ce){if(cR===nR&&cC===nC&&e===OPP[exitDir])continue;
          const eR=cR+(e==="N"?-1:e==="S"?1:0),eC=cC+(e==="W"?-1:e==="E"?1:0);
          if(!this.inBounds(eR,eC))continue;curR=cR;curC=cC;exitDir=e;found=true;break;}if(found)break;}
      if(!found)return null;}
    return null;
  }
  getOptions(tipR,tipC,neededEdge){
    const opts=[];let tn2=Object.keys(this.remaining).filter(n=>this.remaining[n]>0);
    let tl=0;for(const k in this.remaining)tl+=this.remaining[k];
    if(tl-(this.remaining["ET"]||0)>0)tn2=tn2.filter(n=>!n.includes("ET"));
    for(const tn of tn2){for(let di=0;di<4;di++){const deg=di*90;
      if(edgesFor(tn,deg,"A").includes(neededEdge)&&this.canPlace(tn,tipR,tipC,deg)){if(!this.wouldCreateHole(tn,tipR,tipC,deg))opts.push({tile:tn,r:tipR,c:tipC,deg});}
      if(edgesFor(tn,deg,"B").includes(neededEdge)){const rot=((deg%360)+360)%360;const aR=tipR+(rot===90?-1:rot===270?1:0),aC=tipC+(rot===0?-1:rot===180?1:0);
        if(this.inBounds(aR,aC)&&this.canPlace(tn,aR,aC,deg)){if(!this.wouldCreateHole(tn,aR,aC,deg))opts.push({tile:tn,r:aR,c:aC,deg});}}}}
    const seen=new Set();return opts.filter(o=>{const k=o.tile+"|"+o.r+"|"+o.c+"|"+o.deg;if(seen.has(k))return false;seen.add(k);return true;});
  }
  hash(){const p=[];for(let r=0;r<this.ROWS;r++)for(let c=0;c<this.COLS;c++){const cl=this.board[r][c];if(cl){const e=edgesFor(cl.tile,cl.deg,cl.which).slice().sort().join("");p.push(r+","+c+":"+e);}}return p.join("|");}
  solve(initial){
    for(const p of initial)this.place(p.tile,p.r,p.c,p.deg);
    const dfs=()=>{if(this.solutions.length>=this.maxSolutions)return;
      let tl=0;for(const k in this.remaining)tl+=this.remaining[k];
      if(tl===0){const h=this.hash();if(!this.hashes.has(h)){this.hashes.add(h);this.solutions.push(this.placedTiles.map(t=>({tile:t.tile,r:t.r,c:t.c,deg:t.deg})));}return;}
      const tip=this.getSnakeTip();if(!tip)return;
      const opts=this.getOptions(tip.needR,tip.needC,tip.neededEdge);
      for(const o of opts){this.place(o.tile,o.r,o.c,o.deg);dfs();this.unplace();if(this.solutions.length>=this.maxSolutions)return;}};
    dfs();return this.solutions;
  }
}

function isValid(rows,cols,tn,r,c,deg){
  const cells=targetCells(r,c,deg);
  for(let i=0;i<cells.length;i++){const[cr,cc]=cells[i];if(cr<0||cr>=rows||cc<0||cc>=cols)return false;
    const wh=i===0?"A":"B";const edges=edgesFor(tn,deg,wh);
    for(const e of edges){const nr=cr+(e==="N"?-1:e==="S"?1:0),nc=cc+(e==="W"?-1:e==="E"?1:0);
      if(nr<0||nr>=rows||nc<0||nc>=cols)return false;}}
  return true;
}
function overlaps(r1,c1,d1,r2,c2,d2){
  const c1s=targetCells(r1,c1,d1),c2s=targetCells(r2,c2,d2);
  for(const a of c1s)for(const b of c2s)if(a[0]===b[0]&&a[1]===b[1])return true;return false;
}

function solveFull(lv){
  const{rows,cols,tiles}=lv;const SH="SH",ET="ET";
  const all=[],ah=new Set(),shP=[],shS=new Set();
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)for(let d=0;d<4;d++){
    const deg=d*90;if(!isValid(rows,cols,SH,r,c,deg))continue;
    const cells=targetCells(r,c,deg);
    const k=cells.map(c=>c[0]+","+c[1]).sort().join("|")+":"+edgesFor(SH,deg,"B").join("");
    if(shS.has(k))continue;shS.add(k);shP.push({r,c,deg});}
  for(const sh of shP){
    for(let er=0;er<rows;er++)for(let ec=0;ec<cols;ec++)for(let ed=0;ed<4;ed++){
      const eDeg=ed*90;if(!isValid(rows,cols,ET,er,ec,eDeg))continue;
      if(overlaps(sh.r,sh.c,sh.deg,er,ec,eDeg))continue;
      const sv=new PuzzleSolver(rows,cols,{...tiles});
      const init=[{tile:SH,r:sh.r,c:sh.c,deg:sh.deg},{tile:ET,r:er,c:ec,deg:eDeg}];
      const sols=sv.solve(init);
      for(const sol of sols){const ts=new PuzzleSolver(rows,cols,{...tiles});for(const p of sol)ts.place(p.tile,p.r,p.c,p.deg);const h=ts.hash();
        if(!ah.has(h)){ah.add(h);all.push({shPos:sh,etPos:{r:er,c:ec,deg:eDeg},placements:sol,
          label:"SH("+sh.r+","+sh.c+")d"+sh.deg+" ET("+er+","+ec+")d"+eDeg});}}}}
  return all;
}

function solveEdges(lv){
  const{rows,cols,tiles}=lv;const SH="SH",ET="ET";
  const all=[],ah=new Set(),pos=[];
  for(let r=0;r<rows;r+=rows-1)for(let c=0;c<cols;c+=cols-1)pos.push([r,c]);
  if(!lv.cornersOnly){
    for(let c=1;c<cols-1;c++){pos.push([0,c]);pos.push([rows-1,c]);}
    for(let r=1;r<rows-1;r++){pos.push([r,0]);pos.push([r,cols-1]);}}
  const shS=new Set();
  for(const[sr,sc]of pos){for(let sd=0;sd<4;sd++){
    const sDeg=sd*90;if(!isValid(rows,cols,SH,sr,sc,sDeg))continue;
    const shC=targetCells(sr,sc,sDeg);
    const shK=shC.map(c=>c[0]+","+c[1]).sort().join("|")+":"+edgesFor(SH,sDeg,"B").join("");
    if(shS.has(shK))continue;shS.add(shK);
    for(const[er,ec]of pos){for(let ed=0;ed<4;ed++){
      const eDeg=ed*90;if(!isValid(rows,cols,ET,er,ec,eDeg))continue;
      if(overlaps(sr,sc,sDeg,er,ec,eDeg))continue;
      const sv=new PuzzleSolver(rows,cols,{...tiles});
      const init=[{tile:SH,r:sr,c:sc,deg:sDeg},{tile:ET,r:er,c:ec,deg:eDeg}];
      const sols=sv.solve(init);
      for(const sol of sols){const ts=new PuzzleSolver(rows,cols,{...tiles});for(const p of sol)ts.place(p.tile,p.r,p.c,p.deg);const h=ts.hash();
        if(!ah.has(h)){ah.add(h);all.push({shPos:{r:sr,c:sc,deg:sDeg},etPos:{r:er,c:ec,deg:eDeg},placements:sol,
          label:"SH("+sr+","+sc+")d"+sDeg+" ET("+er+","+ec+")d"+eDeg});}}}}}
  }
  return all;
}

const CANDS=[
  {id:"2x4-B",rows:2,cols:4,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1}},
  {id:"3x4-Ba",rows:3,cols:4,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1,"RC":1,"LC":1}},
  {id:"3x4-Bb",rows:3,cols:4,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1,"LL":1,"LR":1}},
  {id:"4x4-Ba",rows:4,cols:4,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1,"LC":1,"UT":1,"LL":1,"LR":1}},
  {id:"4x4-Bb",rows:4,cols:4,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1,"DS":1,"UT":1,"LL":1,"LR":1}},
  {id:"4x5-Ba",rows:4,cols:5,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1,"LC":1,"DS":1,"UT":3,"RC":1}},
  {id:"4x5-Bb",rows:4,cols:5,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1,"QC":1,"DS":1,"UT":2,"LL":1,"LR":1}},
  {id:"6x5-B",rows:6,cols:5,edgesOnly:true,cornersOnly:true,tiles:{"SH":1,"ET":1,"SZ":1,"SS":1,"LC":1,"DS":1,"QC":1,"UT":4,"RC":1,"LL":1,"LR":1,"DB":1}}
];

console.log("=== Testing New Tile Combos ===\n");
const results=[];
for(const cand of CANDS){
  const tt=Object.values(cand.tiles).reduce((a,b)=>a+b,0);
  const tc=cand.rows*cand.cols;
  const nt=Object.keys(cand.tiles).filter(t=>["SZ","SS","LC","DS","QC"].some(p=>t.startsWith(p))).map(t=>t.replace(/-Snake-Tile\.png/,''));
  console.log(cand.id+": "+cand.rows+"x"+cand.cols+" ("+tc+" cells, "+tt+" tiles)");
  console.log("  New tiles: "+nt.join(", "));
  if(tt*2!==tc){console.log("  SKIP\n");continue;}
  const t0=Date.now();
  const sols=cand.edgesOnly?solveEdges(cand):solveFull(cand);
  const el=Date.now()-t0;
  console.log("  Found "+sols.length+" solutions in "+el+"ms");
  if(sols.length>0){results.push({...cand,cnt:sols.length,sols});console.log("  >> VIABLE\n");}
  else console.log("  >> NO SOLUTIONS\n");
}

console.log("\n=== SUMMARY ===");
console.log("Viable: "+results.length+"/"+CANDS.length);
for(const r of results)console.log("  "+r.id+": "+r.cnt+" solutions");

const done=new Set();
for(const r of results){
  const fn=r.rows+"x"+r.cols+"-B.json";
  if(done.has(fn)){console.log("\n  skip "+r.id+" (already wrote "+fn+")");continue;}
  done.add(fn);
  const out={board:{rows:r.rows,cols:r.cols,cells:r.rows*r.cols},tileSet:"tiles-live-edges.json",tiles:r.tiles,totalUniqueSolutions:r.cnt,generatedAt:new Date().toISOString(),
    solutions:r.sols.map((s,j)=>({id:"solve-"+(j+1),label:r.rows+"x"+r.cols+"-B #"+(j+1)+" - "+s.label,placements:s.placements}))};
  fs.writeFileSync(path.join(__dirname,fn),JSON.stringify(out,null,2));
  console.log("\nWrote "+fn+" ("+r.cnt+" solutions from "+r.id+")");
}
console.log("\nDone!");