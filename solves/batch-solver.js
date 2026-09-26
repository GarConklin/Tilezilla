#!/usr/bin/env node
/**
 * Batch solver: systematically tries every valid tile-set combination
 * for a given board size and finds which ones have solutions.
 *
 * One board size per run: pass `<rows> <cols>` for that grid only; repeat the command for another size.
 *
 * Neutral singles (E1, B1, E2, B2) — caps enforced on every --mode that fixes them (maximums per level, not required mixes):
 *   • Either the "E1-only" branch: up to 2× E1, no B1/B2; OR the "blocker" branch: at most 1× (B1 or B2) with exactly 1× E1 when a blocker is present (never B1+B2 together).
 *   • E2: at most 1× — may appear alone (--mode e2) or stacked with E1 / B+E1 (e1e2, b1e2, …). No requirement to use E2 on every run.
 *   • Odd-area boards (e.g. 3×3, 3×5, 5×5): combining E2 with E1 or with B1+E1 is often how you balance playable cell parity when authoring; even boards may use base/advanced with no neutrals. Nothing here forces odd boards to always pick an E2+E1/B1 recipe — pick the --mode that matches the puzzle you want.
 *   • Modes b1 / b1e2 / … use B1+E1(+E2); use b2* for B2+E1(+E2).
 *
 * Usage:
 *   node batch-solver.js <rows> <cols> [--advanced] [--mode …] [--summary-out <file>] [--out-prefix <prefix>]
 *   node batch-solver.js --neutral-rules   (print allowed neutral modes and exit)
 *
 * --mode values:
 *   base | advanced
 *   e1 | e1x2 | e1e2 | e1x2e2
 *   e1b1 | b1 | b1e2 | e1b2 | b2 | b2e2
 *   e2 | e2-advanced
 *   e1-advanced | e1x2-advanced | e1e2-advanced | e1x2e2-advanced
 *   e1b1-advanced | b1-advanced | b1e2-advanced | e1b2-advanced | b2-advanced | b2e2-advanced
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args.includes("--neutral-rules")) {
  console.log(`Neutral tile rules (E1, B1, E2, B2) for --mode — these are per-level MAXIMA, not mandatory mixes:
  • E1-only branch: up to 2× E1, no B1/B2.
  • Blocker branch: at most 1× B1 xor 1× B2; if a blocker is used, exactly 1× E1 with it (never B1+B2 together).
  • E2: at most 1×; alone (e2) or with E1 / B+E1 (e1e2, b1e2, …). You do not have to use neutrals on every batch run.
  • Odd-area sizes (e.g. 3×3, 3×5, 5×5): E2 with E1 or B1+E1 is the usual way to fix parity when you need it — optional per run.
  Modes (each size: run once per rows×cols):
    base | advanced
    e1 | e1x2 | e1e2 | e1x2e2 | e2
    e1b1 | b1 | b1e2 | e1b2 | b2 | b2e2
    …-advanced for each (including e2-advanced)`);
  process.exit(0);
}
if (args.length < 2) { console.log("Usage: node batch-solver.js <rows> <cols> [--advanced] [--mode …]  (see file header)"); process.exit(1); }

const ROWS = parseInt(args[0], 10);
const COLS = parseInt(args[1], 10);
const ADVANCED = args.includes("--advanced");
const modeIdx = args.indexOf("--mode");
const MODE = modeIdx >= 0 && args[modeIdx + 1] ? args[modeIdx + 1].toLowerCase() : null;
const summaryOutIdx = args.indexOf("--summary-out");
const SUMMARY_OUT = summaryOutIdx >= 0 && args[summaryOutIdx + 1] ? args[summaryOutIdx + 1] : null;
const outPrefixIdx = args.indexOf("--out-prefix");
const OUT_PREFIX = outPrefixIdx >= 0 && args[outPrefixIdx + 1] ? args[outPrefixIdx + 1] : "";

// Parse --blockers "r,c;r2,c2" 
const blockersArg = args.find(a => a.startsWith("--blockers"));
const blockersIdx = args.indexOf("--blockers");
const BLOCKERS = blockersIdx >= 0 && args[blockersIdx + 1]
  ? args[blockersIdx + 1].split(";").map(s => s.split(",").map(Number))
  : [];

const CELLS = ROWS * COLS;
const PLAYABLE_CELLS = CELLS - BLOCKERS.length;

const EDGES_PATH = path.resolve(__dirname, "../data/tiles/tiles-live-edges.json");
const tilesJson = JSON.parse(fs.readFileSync(EDGES_PATH, "utf-8"));

/** Caps on E1/B1/E2/B2 counts in FIXED_EXTRA (not parity-by-board-size — choose --mode per run). See header / --neutral-rules. */
function validateNeutralFixedBag(fixed) {
  if (!fixed || typeof fixed !== "object") return null;
  const e1 = Math.floor(Number(fixed.E1) || 0);
  const e2 = Math.floor(Number(fixed.E2) || 0);
  const b1 = Math.floor(Number(fixed.B1) || 0);
  const b2 = Math.floor(Number(fixed.B2) || 0);
  for (const [k, v] of Object.entries(fixed)) {
    if (!["E1", "E2", "B1", "B2"].includes(k)) continue;
    if (!Number.isFinite(v) || v < 0 || v > 3) return `invalid count for ${k}`;
  }
  if (e1 > 2) return "E1: at most 2";
  if (e2 > 1) return "E2: at most 1";
  if (b1 > 1) return "B1: at most 1";
  if (b2 > 1) return "B2: at most 1";
  if (b1 && b2) return "use B1 or B2, not both";
  const hasBlocker = !!(b1 || b2);
  if (hasBlocker) {
    if (e1 !== 1) return "B1/B2 branch requires exactly 1× E1";
  } else if (e1 > 2) {
    return "without B1/B2, at most 2× E1";
  }
  return null;
}

const BASIC_BODY = ["UT","RC","LC","DB","HL","VL","LL","LR"];
const ADVANCED_BODY = ["SZ","SS","DS","QC","DC"];
const SH = "SH";
const ET = "ET";

let BODY_TILES = ADVANCED ? [...BASIC_BODY, ...ADVANCED_BODY] : BASIC_BODY;
let FIXED_EXTRA = {}; // tiles fixed in every combo (e.g., E2:1)
let bodySlots = 0;
let modeLabel = ADVANCED ? "basic+advanced" : "basic only";

if (MODE) {
  if (MODE === "base") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = {};
    modeLabel = "base";
  } else if (MODE === "advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = {};
    modeLabel = "advanced";
  } else if (MODE === "e1") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { E1: 1 };
    modeLabel = "restricted e1";
  } else if (MODE === "e1x2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { E1: 2 };
    modeLabel = "restricted e1x2";
  } else if (MODE === "e1e2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { E1: 1, E2: 1 };
    modeLabel = "restricted e1+e2";
  } else if (MODE === "e1x2e2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { E1: 2, E2: 1 };
    modeLabel = "restricted e1x2+e2";
  } else if (MODE === "e1b1") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { E1: 1, B1: 1 };
    modeLabel = "restricted e1+b1";
  } else if (MODE === "b1") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { B1: 1, E1: 1 };
    modeLabel = "restricted b1+e1";
  } else if (MODE === "b1e2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { B1: 1, E1: 1, E2: 1 };
    modeLabel = "restricted b1+e1+e2";
  } else if (MODE === "e1b2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { E1: 1, B2: 1 };
    modeLabel = "restricted e1+b2";
  } else if (MODE === "b2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { B2: 1, E1: 1 };
    modeLabel = "restricted b2+e1";
  } else if (MODE === "b2e2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { B2: 1, E1: 1, E2: 1 };
    modeLabel = "restricted b2+e1+e2";
  } else if (MODE === "e2") {
    BODY_TILES = BASIC_BODY;
    FIXED_EXTRA = { E2: 1 };
    modeLabel = "restricted e2";
  } else if (MODE === "e1-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { E1: 1 };
    modeLabel = "restricted e1 + advanced";
  } else if (MODE === "e1x2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { E1: 2 };
    modeLabel = "restricted e1x2 + advanced";
  } else if (MODE === "e1e2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { E1: 1, E2: 1 };
    modeLabel = "restricted e1+e2 + advanced";
  } else if (MODE === "e1x2e2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { E1: 2, E2: 1 };
    modeLabel = "restricted e1x2+e2 + advanced";
  } else if (MODE === "e1b1-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { E1: 1, B1: 1 };
    modeLabel = "restricted e1+b1 + advanced";
  } else if (MODE === "b1-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { B1: 1, E1: 1 };
    modeLabel = "restricted b1+e1 + advanced";
  } else if (MODE === "b1e2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { B1: 1, E1: 1, E2: 1 };
    modeLabel = "restricted b1+e1+e2 + advanced";
  } else if (MODE === "e1b2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { E1: 1, B2: 1 };
    modeLabel = "restricted e1+b2 + advanced";
  } else if (MODE === "b2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { B2: 1, E1: 1 };
    modeLabel = "restricted b2+e1 + advanced";
  } else if (MODE === "b2e2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { B2: 1, E1: 1, E2: 1 };
    modeLabel = "restricted b2+e1+e2 + advanced";
  } else if (MODE === "e2-advanced") {
    BODY_TILES = [...BASIC_BODY, ...ADVANCED_BODY];
    FIXED_EXTRA = { E2: 1 };
    modeLabel = "restricted e2 + advanced";
  } else {
    console.error(`Unknown --mode '${MODE}'. Run: node batch-solver.js --neutral-rules`);
    process.exit(1);
  }
}

const neutralErr = validateNeutralFixedBag(FIXED_EXTRA);
if (neutralErr) {
  console.error("[batch-solver] " + neutralErr);
  process.exit(1);
}

const fixedExtraCells = Object.entries(FIXED_EXTRA).reduce((sum, [tile, count]) => {
  return sum + (tileCellCountByName(tile) * (Number(count) || 0));
}, 0);
const remainingBodyCells = PLAYABLE_CELLS - 4 - fixedExtraCells; // SH + ET always consume 4 cells
if (remainingBodyCells < 0) {
  console.error("Mode restrictions exceed playable cells.");
  process.exit(1);
}
if (remainingBodyCells % 2 !== 0) {
  console.error("Invalid cell budget for selected mode: remaining body cells must be even.");
  process.exit(1);
}
bodySlots = remainingBodyCells / 2;

const modeTag = modeLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "default";
const TOTAL_TILES = 2 + Object.values(FIXED_EXTRA).reduce((a, b) => a + (Number(b) || 0), 0) + bodySlots;

console.log("Batch solver: " + ROWS + "x" + COLS + " (" + CELLS + " cells" + (BLOCKERS.length ? ", " + BLOCKERS.length + " blocker(s), " + PLAYABLE_CELLS + " playable" : "") + ", " + TOTAL_TILES + " tiles, " + bodySlots + " combo body slots)");
console.log("Tile pool: " + BODY_TILES.length + " body types (" + modeLabel + ")" + (Object.keys(FIXED_EXTRA).length ? " | fixed extra: " + JSON.stringify(FIXED_EXTRA) : "") + (BLOCKERS.length ? " | Blockers: " + BLOCKERS.map(b=>b.join(",")).join(";") : ""));

const OPP = {N:"S",S:"N",E:"W",W:"E"};
const NEUTRAL_TILES = new Set(["E1","E2","B1","B2"]);
function rotName(d){const r=((d%360)+360)%360;return r===0?"r0":r===90?"r90":r===180?"r180":"r270";}
function targetCells(r,c,d){const rot=((d%360)+360)%360;if(rot===0)return[[r,c],[r,c+1]];if(rot===90)return[[r,c],[r+1,c]];if(rot===180)return[[r,c],[r,c-1]];return[[r,c],[r-1,c]];}
function edgesFor(tn,d,wh){const rn=rotName(d);const t=tilesJson[tn];if(!t||!t[rn])return[];return t[rn][wh]||[];}

class PuzzleSolver{
  constructor(rows,cols,tileCounts,blockers=[]){
    this.ROWS=rows;this.COLS=cols;this.board=[];this.remaining={};this.placedTiles=[];this.solutions=[];this.hashes=new Set();this.maxSolutions=200;
    for(let r=0;r<rows;r++){this.board.push([]);for(let c=0;c<cols;c++)this.board[r].push(null);}
    // Mark blocker cells
    for(const[br,bc]of blockers)this.board[br][bc]={blocked:true};
    for(const[name,count]of Object.entries(tileCounts))this.remaining[name]=count;
  }
  inBounds(r,c){return r>=0&&r<this.ROWS&&c>=0&&c<this.COLS;}
  place(tn,r,c,d){const cells=targetCells(r,c,d);const tid="t"+this.placedTiles.length;this.placedTiles.push({id:tid,tile:tn,r,c,deg:d});this.remaining[tn]--;for(let i=0;i<cells.length;i++)this.board[cells[i][0]][cells[i][1]]={tile:tn,deg:d,which:i===0?"A":"B",tileId:tid};}
  unplace(){const last=this.placedTiles.pop();this.remaining[last.tile]++;const cells=targetCells(last.r,last.c,last.deg);for(let i=0;i<cells.length;i++)this.board[cells[i][0]][cells[i][1]]=null;}
  canPlace(tn,r,c,deg){
    if(!this.remaining[tn]||this.remaining[tn]<=0)return false;
    const cells=targetCells(r,c,deg);
    for(let i=0;i<cells.length;i++){const[rr,cc]=cells[i];if(!this.inBounds(rr,cc))return false;if(this.board[rr][cc]!==null)return false;
      const wh=i===0?"A":"B";const edges=edgesFor(tn,deg,wh);for(const e of edges){const nr=rr+(e==="N"?-1:e==="S"?1:0),nc=cc+(e==="W"?-1:e==="E"?1:0);if(!this.inBounds(nr,nc))return false;if(this.board[nr]?.[nc]?.blocked)return false;}}
    let hasLive=this.placedTiles.length===0;const fp=new Set(cells.map(c=>c[0]+","+c[1]));
    for(let i=0;i<cells.length;i++){const[rr,cc]=cells[i];const wh=i===0?"A":"B";const our=edgesFor(tn,deg,wh);
      for(const[d,dr,dc]of[["N",-1,0],["S",1,0],["E",0,1],["W",0,-1]]){const nr=rr+dr,nc=cc+dc;if(!this.inBounds(nr,nc))continue;const nb=this.board[nr][nc];if(!nb||nb.blocked)continue;
        const ne=edgesFor(nb.tile,nb.deg,nb.which);const we=our.includes(d);const nh=ne.includes(OPP[d]);if(we!==nh)return false;if(we&&nh)hasLive=true;}}
    if(!hasLive)return false;
    for(let i=0;i<cells.length;i++){const[rr,cc]=cells[i];for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=rr+dr,nc=cc+dc;if(!this.inBounds(nr,nc))continue;if(fp.has(nr+","+nc))continue;const nbc=this.board[nr]?.[nc];if(nbc!==null)continue;
        let hasEN=false;for(const[dr2,dc2]of[[-1,0],[1,0],[0,-1],[0,1]]){const nnr=nr+dr2,nnc=nc+dc2;if(!this.inBounds(nnr,nnc))continue;if(fp.has(nnr+","+nnc))continue;if(this.board[nnr]?.[nnc]===null){hasEN=true;break;}}if(!hasEN)return false;}}
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
    this.unplace();return false;
  }
  getSnakeTip(){
    const sh=this.placedTiles.find(t=>t.tile===SH);if(!sh)return null;const shCells=targetCells(sh.r,sh.c,sh.deg);let sR=null,sC=null,sE=null;
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
    if(tilesLeft-(this.remaining[ET]||0)>0)tileNames=tileNames.filter(n=>n!==ET);
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

const blockerSet=new Set(BLOCKERS.map(b=>b[0]+","+b[1]));
function isValidPlacement(rows,cols,tn,r,c,deg){const cells=targetCells(r,c,deg);for(let i=0;i<cells.length;i++){const[cr,cc]=cells[i];if(cr<0||cr>=rows||cc<0||cc>=cols)return false;if(blockerSet.has(cr+","+cc))return false;
  const wh=i===0?"A":"B";const edges=edgesFor(tn,deg,wh);for(const e of edges){const nr=cr+(e==="N"?-1:e==="S"?1:0),nc=cc+(e==="W"?-1:e==="E"?1:0);if(nr<0||nr>=rows||nc<0||nc>=cols)return false;if(blockerSet.has(nr+","+nc))return false;}}return true;}
function overlaps(r1,c1,d1,r2,c2,d2){const c1s=targetCells(r1,c1,d1),c2s=targetCells(r2,c2,d2);for(const a of c1s)for(const b of c2s)if(a[0]===b[0]&&a[1]===b[1])return true;return false;}
function mirror180Hash(placements,rows,cols){const ps=new PuzzleSolver(rows,cols,{},BLOCKERS);for(const p of placements){const mr=rows-1-p.r,mc=cols-1-p.c,md=(p.deg+180)%360;const cells=targetCells(mr,mc,md);for(let i=0;i<cells.length;i++){const wh=i===0?"A":"B";if(!ps.board[cells[i][0]][cells[i][1]]?.blocked)ps.board[cells[i][0]][cells[i][1]]={tile:p.tile,deg:md,which:wh};}}return ps.hash();}

function expandNeutralPlacements(rows, cols, tiles){
  const entries = Object.entries(tiles)
    .filter(([name, count]) => NEUTRAL_TILES.has(name) && count > 0)
    .flatMap(([name, count]) => Array.from({length: count}, () => name));
  if(!entries.length) return [[]];

  const allPlacements = [];
  const seen = new Set();
  const chosen = [];

  function rec(i){
    if(i >= entries.length){
      const canon = chosen
        .map(p => `${p.tile}|${p.r}|${p.c}|${p.deg}`)
        .sort()
        .join(";");
      if(!seen.has(canon)){
        seen.add(canon);
        allPlacements.push(chosen.map(p => ({...p})));
      }
      return;
    }
    const tn = entries[i];
    const degSet = tileCellCountByName(tn) === 1 ? [0] : [0,90,180,270];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        for(const deg of degSet){
          if(!isValidPlacement(rows, cols, tn, r, c, deg)) continue;
          let ov = false;
          for(const p of chosen){
            if(overlaps(r, c, deg, p.r, p.c, p.deg)){ ov = true; break; }
          }
          if(ov) continue;
          chosen.push({ tile: tn, r, c, deg });
          rec(i + 1);
          chosen.pop();
        }
      }
    }
  }

  rec(0);
  return allPlacements;
}

function tileCellCountByName(tileName){
  const shape = tilesJson?.[tileName]?.shape;
  return Array.isArray(shape) && shape.length ? shape.length : 2;
}

function solveCombo(rows,cols,tiles){
  const allSolutions=[],allHashes=new Set();
  const useEdges=(rows*cols)>=16;
  const neutralVariants = expandNeutralPlacements(rows, cols, tiles);
  const shPlacements=[],shSeen=new Set();
  if(useEdges){
    const positions=[];
    for(let r=0;r<rows;r+=rows-1)for(let c=0;c<cols;c+=cols-1)positions.push([r,c]);
    for(let c=1;c<cols-1;c++){positions.push([0,c]);positions.push([rows-1,c]);}
    for(let r=1;r<rows-1;r++){positions.push([r,0]);positions.push([r,cols-1]);}
    for(const[sr,sc]of positions){for(let sd=0;sd<4;sd++){const sDeg=sd*90;if(!isValidPlacement(rows,cols,SH,sr,sc,sDeg))continue;
      const shCells=targetCells(sr,sc,sDeg);const shKey=shCells.map(cc=>cc[0]+","+cc[1]).sort().join("|")+":"+edgesFor(SH,sDeg,"B").join("");
      if(shSeen.has(shKey))continue;shSeen.add(shKey);shPlacements.push({r:sr,c:sc,deg:sDeg});}}
  }else{
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)for(let d=0;d<4;d++){const deg=d*90;if(!isValidPlacement(rows,cols,SH,r,c,deg))continue;
      const cells=targetCells(r,c,deg);const key=cells.map(cc=>cc[0]+","+cc[1]).sort().join("|")+":"+edgesFor(SH,deg,"B").join("");
      if(shSeen.has(key))continue;shSeen.add(key);shPlacements.push({r,c,deg});}
  }
  const etIter=[];
  if(useEdges){for(let r=0;r<rows;r+=rows-1)for(let c=0;c<cols;c+=cols-1)etIter.push([r,c]);for(let c=1;c<cols-1;c++){etIter.push([0,c]);etIter.push([rows-1,c]);}for(let r=1;r<rows-1;r++){etIter.push([r,0]);etIter.push([r,cols-1]);}}
  else{for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)etIter.push([r,c]);}

  for(const neutralFixed of neutralVariants){
    for(const sh of shPlacements){
      let shOverlap = false;
      for(const p of neutralFixed){ if(overlaps(sh.r, sh.c, sh.deg, p.r, p.c, p.deg)){ shOverlap = true; break; } }
      if(shOverlap) continue;
      for(const[er,ec]of etIter){
        for(let ed=0;ed<4;ed++){
          const eDeg=ed*90;
          if(!isValidPlacement(rows,cols,ET,er,ec,eDeg))continue;
          if(overlaps(sh.r,sh.c,sh.deg,er,ec,eDeg))continue;
          let etOverlap = false;
          for(const p of neutralFixed){ if(overlaps(er, ec, eDeg, p.r, p.c, p.deg)){ etOverlap = true; break; } }
          if(etOverlap) continue;
          const solver=new PuzzleSolver(rows,cols,{...tiles},BLOCKERS);
          const initial=[...neutralFixed, {tile:SH,r:sh.r,c:sh.c,deg:sh.deg},{tile:ET,r:er,c:ec,deg:eDeg}];
          const sols=solver.solve(initial);
          for(const sol of sols){
            const ts=new PuzzleSolver(rows,cols,{...tiles},BLOCKERS);
            for(const p of sol)ts.place(p.tile,p.r,p.c,p.deg);
            const h=ts.hash();
            if(!allHashes.has(h)){
              const mh=mirror180Hash(sol,rows,cols);
              if(!allHashes.has(mh)){allHashes.add(h);allHashes.add(mh);allSolutions.push(sol);}
            }
          }
          if(allSolutions.length>=200)return allSolutions;
        }
      }
    }
  }
  return allSolutions;
}

function* combosWithRepetition(items,k,start=0,current=[]){
  if(current.length===k){yield[...current];return;}
  for(let i=start;i<items.length;i++){current.push(items[i]);yield*combosWithRepetition(items,k,i,current);current.pop();}
}
function countCombos(n,k){let num=1,den=1;for(let i=0;i<k;i++){num*=(n+k-1-i);den*=(i+1);}return Math.round(num/den);}

const totalCombos=countCombos(BODY_TILES.length,bodySlots);
console.log("Total combinations to test: "+totalCombos);
console.log("Starting...\n");

const results=[];const outDir=path.resolve(__dirname);let tested=0,solvable=0;const t0=Date.now();

for(const bodyCombo of combosWithRepetition(BODY_TILES,bodySlots)){
  tested++;
  const tiles={ [SH]:1, [ET]:1, ...FIXED_EXTRA };
  for(const t of bodyCombo)tiles[t]=(tiles[t]||0)+1;
  if(tested%50===0||tested===1){const elapsed=((Date.now()-t0)/1000).toFixed(0);const shortNames=bodyCombo;
    process.stdout.write("  ["+tested+"/"+totalCombos+"] "+solvable+" solvable | "+elapsed+"s | "+shortNames.join(",")+"\r");}
  const solutions=solveCombo(ROWS,COLS,tiles);
  if(solutions.length>0){
    solvable++;const shortNames=bodyCombo;
    const tileKey=Object.entries(tiles).map(([k,v])=>k+(v>1?"x"+v:"")).sort().join("_");
    console.log("  FOUND #"+solvable+": "+shortNames.join(",")+" -> "+solutions.length+" solution(s)");
    const filename=(OUT_PREFIX ? OUT_PREFIX + "-" : "") + ROWS+"x"+COLS+"-"+modeTag+"-"+String(solvable).padStart(3,"0")+".json";
    const output={board:{rows:ROWS,cols:COLS,cells:CELLS},tileSet:"tiles-live-edges.json",tiles,tileKey,blockers:BLOCKERS.map(([r,c])=>[r,c,"B1"]),totalUniqueSolutions:solutions.length,generatedAt:new Date().toISOString(),
      solutions:solutions.map((s,i)=>({id:"solve-"+(i+1),label:ROWS+"x"+COLS+" #"+solvable+" solve "+(i+1),placements:s}))};
    fs.writeFileSync(path.join(outDir,filename),JSON.stringify(output,null,2));
    results.push({comboIndex:solvable,tiles,tileKey,solutionCount:solutions.length,file:filename});
  }
}

const totalElapsed=((Date.now()-t0)/1000).toFixed(1);
console.log("\n\nDONE: "+tested+" combos tested, "+solvable+" solvable, "+totalElapsed+"s");
const summaryFile = SUMMARY_OUT || ((OUT_PREFIX ? OUT_PREFIX + "-" : "") + "batch-"+ROWS+"x"+COLS+"-"+modeTag+"-results.json");
const summary={board:{rows:ROWS,cols:COLS},tilePool:modeLabel,totalCombos:tested,solvableCombos:solvable,elapsedSeconds:parseFloat(totalElapsed),
  results:results.sort((a,b)=>a.solutionCount-b.solutionCount)};
fs.writeFileSync(path.join(outDir,summaryFile),JSON.stringify(summary,null,2));
console.log("Summary written to "+summaryFile);
