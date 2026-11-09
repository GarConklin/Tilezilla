#!/usr/bin/env python3
"""Open a browser page of random named swap puzzles to look over by eye.

Each puzzle shows the layout it came from next to its swapped layout, drawn
with the game's tile pictures. Arrow keys move between puzzles.

    python tools/scripts/make-swap-viewer.py
    python tools/scripts/make-swap-viewer.py --count 250 --seed 7
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import random
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "tools" / "data" / "solver-runs" / "swap-named"
SPECS = OUT / "specs"
WITNESSES = OUT / "witnesses"
VIEWER_DIR = OUT / "viewer"


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def source_layout(from_id, solution):
    witness_path = WITNESSES / f"{from_id}.json"
    if witness_path.exists():
        spec = read_json(SPECS / f"{from_id}.json")
        return spec.get("tiles") or {}, read_json(witness_path).get("placements") or []
    solve_path = ROOT / "solves" / f"{from_id}.json"
    if not solve_path.exists():
        return {}, []
    doc = read_json(solve_path)
    sols = doc.get("solutions") or []
    index = max(1, int(solution or 1)) - 1
    placements = sols[index].get("placements") if index < len(sols) else []
    return doc.get("tiles") or {}, placements or []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=250)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--last", type=int, default=0, help="pick only from the newest N named puzzles")
    args = parser.parse_args()

    checker = load_module("check_swap_witnesses", "check-swap-witnesses.py")
    queue = load_module("build_swap_solve_queue", "build-swap-solve-queue.py")

    print("reading the named list...", flush=True)
    ledger = read_json(OUT / "ledger.json")
    if args.last > 0:
        ids = list(ledger.get("pending") or [])[-args.last :]
    else:
        ids = list(ledger.get("pending") or []) + list((ledger.get("done") or {}).keys())
    ids = [i for i in ids if not i.startswith("6x6-")]
    seed = args.seed if args.seed is not None else random.randrange(1, 10**6)
    random.Random(seed).shuffle(ids)
    picks = []
    skipped = 0
    for pid in ids:
        if len(picks) >= args.count:
            break
        spec = read_json(SPECS / f"{pid}.json")
        src = spec.get("from") or ""
        if not (WITNESSES / f"{src}.json").exists() and not (ROOT / "solves" / f"{src}.json").exists():
            skipped += 1
            continue
        picks.append(pid)
    print(f"picked {len(picks)} of {len(ids)} (seed {seed}), skipped {skipped} whose source was removed", flush=True)

    puzzles = []
    for pid in picks:
        spec = read_json(SPECS / f"{pid}.json")
        witness = read_json(WITNESSES / f"{pid}.json")
        src_tiles, src_layout = source_layout(spec.get("from"), witness.get("solution"))
        family = queue.PAIR_FAMILY.get(tuple(sorted(spec.get("swapOut") or [])))
        set_number = spec.get("set")
        if set_number is None and family is not None:
            set_number = family + 1
        puzzles.append(
            {
                "id": pid,
                "from": spec.get("from"),
                "set": set_number,
                "swapOut": spec.get("swapOut") or [],
                "swapIn": spec.get("swapIn") or [],
                "squares": witness.get("squares") or [],
                "rows": spec["board"]["rows"],
                "cols": spec["board"]["cols"],
                "blockers": spec.get("blockers") or [],
                "tiles": spec.get("tiles") or {},
                "srcTiles": src_tiles,
                "after": witness.get("placements") or [],
                "before": src_layout,
                "check": checker.check(spec, witness) or "OK",
            }
        )

    tilesets = read_json(ROOT / "data" / "tiles" / "tilesets.json")
    active = tilesets["tilesets"][tilesets["activeTileset"]]
    VIEWER_DIR.mkdir(parents=True, exist_ok=True)
    img_base = os.path.relpath(ROOT / "img", VIEWER_DIR).replace("\\", "/")
    images = {name: f"{img_base}/{path}" for name, path in active.items() if isinstance(path, str)}
    used = {p["tile"] for z in puzzles for p in z["after"] + z["before"]}
    used |= {b[2] for z in puzzles for b in z["blockers"] if len(b) > 2}
    used |= {"B1"}
    tiles = {
        name: {
            "size": len(checker.TILES[name].get("shape") or [None, None]),
            "edges": {
                str(d): [checker.TILES[name][f"r{d}"].get("A", []), checker.TILES[name][f"r{d}"].get("B", [])]
                for d in (0, 90, 180, 270)
            },
        }
        for name in used
        if name in checker.TILES
    }

    html = PAGE.replace("__DATA__", json.dumps({"seed": seed, "puzzles": puzzles, "images": images, "tiles": tiles}))
    page = VIEWER_DIR / "viewer.html"
    page.write_text(html, encoding="utf-8")
    print(f"page: {page}", flush=True)
    webbrowser.open(page.as_uri())


PAGE = r"""<!doctype html>
<html><head><meta charset="utf-8"><title>Swap puzzle viewer</title>
<style>
 body{font-family:Segoe UI,Arial,sans-serif;background:#1d1f24;color:#e8e8e8;margin:16px}
 h1{font-size:20px;margin:0 0 6px}
 .bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
 button{background:#353a44;color:#eee;border:1px solid #555;padding:5px 12px;border-radius:4px;cursor:pointer}
 input{width:60px;background:#2a2d34;color:#eee;border:1px solid #555;padding:4px}
 .boards{display:flex;gap:28px;flex-wrap:wrap}
 .board h2{font-size:15px;margin:4px 0}
 canvas{background:#2a2d34;border:1px solid #444}
 .info{font-size:14px;line-height:1.6;margin:8px 0}
 .ok{color:#7fd67f}.bad{color:#ff7272}.mark{color:#ffcf4a}
 .bag span{display:inline-block;padding:1px 6px;margin:2px;border-radius:3px;background:#30343c}
 .bag span.out{background:#5a2a2a}.bag span.in{background:#2a5a33}
 .keys{font-size:12px;color:#aaa}
 textarea{width:100%;height:60px;background:#2a2d34;color:#eee;border:1px solid #555}
</style></head><body>
<h1 id="title"></h1>
<div class="bar">
 <button id="prev">&larr; Prev</button><button id="next">Next &rarr;</button>
 Go to <input id="jump" type="number" min="1"> <button id="mark">Mark (X)</button>
 <button id="edges">Openings (E)</button><button id="labels">Names (L)</button>
 <span id="marked" class="mark"></span>
</div>
<div class="info" id="info"></div>
<div class="boards">
 <div class="board"><h2 id="beforeTitle"></h2><canvas id="before"></canvas><div class="bag" id="beforeBag"></div></div>
 <div class="board"><h2>After the swap (new puzzle)</h2><canvas id="after"></canvas><div class="bag" id="afterBag"></div></div>
</div>
<p class="keys">Left/Right: previous/next. PageUp/PageDown: 10 at a time. Home/End: first/last.
 X: mark one that looks wrong. E: red openings. L: tile names. Yellow box: the swapped squares.</p>
<div>Marked puzzles (copy this list): <textarea id="markList" readonly></textarea></div>
<script>
const DATA = __DATA__;
const P = DATA.puzzles, IMG = {}, T = DATA.tiles;
let i = 0, showEdges = false, showLabels = false;
const marks = new Set(JSON.parse(localStorage.getItem('swapMarks-' + DATA.seed) || '[]'));

function load(name){
  if(!IMG[name]){ IMG[name] = new Image(); IMG[name].src = DATA.images[name] || ''; IMG[name].onload = draw; }
  return IMG[name];
}
function cells(name, r, c, deg){
  const all = deg===0?[[r,c],[r,c+1]]:deg===90?[[r,c],[r+1,c]]:deg===180?[[r,c],[r,c-1]]:[[r,c],[r-1,c]];
  return all.slice(0, (T[name]||{size:2}).size);
}
function drawTile(ctx, cell, name, r, c, deg){
  deg = ((deg%360)+360)%360;
  const cs = cells(name, r, c, deg);
  const rs = cs.map(x=>x[0]), ks = cs.map(x=>x[1]);
  const x0 = Math.min(...ks)*cell, y0 = Math.min(...rs)*cell;
  const w = (Math.max(...ks)-Math.min(...ks)+1)*cell, h = (Math.max(...rs)-Math.min(...rs)+1)*cell;
  const img = load(name), size = (T[name]||{size:2}).size;
  const iw = size===1 ? cell : 2*cell, ih = cell;
  if(img.complete && img.naturalWidth){
    ctx.save(); ctx.translate(x0+w/2, y0+h/2); ctx.rotate(deg*Math.PI/180);
    ctx.drawImage(img, -iw/2, -ih/2, iw, ih); ctx.restore();
  } else {
    ctx.fillStyle = '#555'; ctx.fillRect(x0+2, y0+2, w-4, h-4);
  }
  if(showEdges && T[name]){
    const e = T[name].edges[String(deg)];
    ctx.strokeStyle = 'red'; ctx.lineWidth = 3;
    cs.forEach(([rr,cc], k) => (e[k]||[]).forEach(d => {
      const x = cc*cell, y = rr*cell, p = 6; ctx.beginPath();
      if(d==='N'){ctx.moveTo(x+p,y+2);ctx.lineTo(x+cell-p,y+2);}
      if(d==='S'){ctx.moveTo(x+p,y+cell-2);ctx.lineTo(x+cell-p,y+cell-2);}
      if(d==='W'){ctx.moveTo(x+2,y+p);ctx.lineTo(x+2,y+cell-p);}
      if(d==='E'){ctx.moveTo(x+cell-2,y+p);ctx.lineTo(x+cell-2,y+cell-p);}
      ctx.stroke();
    }));
  }
  if(showLabels){
    ctx.font = 'bold 13px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(name).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x0+w/2-tw/2, y0+h/2-9, tw, 18);
    ctx.fillStyle = '#fff'; ctx.fillText(name, x0+w/2, y0+h/2);
  }
}
function drawBoard(canvas, z, layout){
  const cell = Math.max(36, Math.min(72, Math.floor(420 / Math.max(z.rows, z.cols))));
  canvas.width = z.cols*cell; canvas.height = z.rows*cell;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#3c4049'; ctx.lineWidth = 1;
  for(let r=0;r<z.rows;r++) for(let c=0;c<z.cols;c++) ctx.strokeRect(c*cell+.5, r*cell+.5, cell-1, cell-1);
  for(const b of z.blockers) drawTile(ctx, cell, b[2]||'B1', b[0], b[1], b[3]||0);
  for(const p of layout) drawTile(ctx, cell, p.tile, +p.r, +p.c, +p.deg);
  if(z.squares.length){
    const rs = z.squares.map(s=>s[0]), cs = z.squares.map(s=>s[1]);
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 4; ctx.setLineDash([8,5]);
    ctx.strokeRect(Math.min(...cs)*cell+2, Math.min(...rs)*cell+2,
      (Math.max(...cs)-Math.min(...cs)+1)*cell-4, (Math.max(...rs)-Math.min(...rs)+1)*cell-4);
    ctx.setLineDash([]);
  }
}
function bag(el, tiles, other, cls){
  el.innerHTML = Object.keys(tiles).sort().filter(k => +tiles[k] > 0).map(k => {
    const d = (+tiles[k]) - (+(other[k]||0));
    return `<span class="${d>0?cls:''}">${k} &times;${tiles[k]}</span>`;
  }).join('');
}
function draw(){
  const z = P[i];
  document.getElementById('title').textContent = `${i+1} / ${P.length}   ${z.id}`;
  const status = z.check === 'OK'
    ? '<span class="ok">Checker: SH to ET walks clean</span>'
    : `<span class="bad">Checker: ${z.check}</span>`;
  document.getElementById('info').innerHTML =
    `Board ${z.rows} rows &times; ${z.cols} cols &nbsp; Set ${z.set ?? '?'} &nbsp; ` +
    `Swap <b>${z.swapOut.join(' + ')}</b> &rarr; <b>${z.swapIn.join(' + ')}</b> &nbsp; From ${z.from} &nbsp; ${status}` +
    (marks.has(z.id) ? ' &nbsp; <span class="mark">MARKED</span>' : '');
  document.getElementById('beforeTitle').textContent =
    z.before.length ? `Before: ${z.from}` : `Before: ${z.from} (source removed)`;
  drawBoard(document.getElementById('before'), z, z.before);
  drawBoard(document.getElementById('after'), z, z.after);
  bag(document.getElementById('beforeBag'), z.srcTiles, z.tiles, 'out');
  bag(document.getElementById('afterBag'), z.tiles, z.srcTiles, 'in');
  document.getElementById('marked').textContent = marks.size ? `${marks.size} marked` : '';
  document.getElementById('markList').value = [...marks].join('\n');
}
function go(n){ i = Math.max(0, Math.min(P.length-1, n)); draw(); }
function toggleMark(){
  const id = P[i].id; marks.has(id) ? marks.delete(id) : marks.add(id);
  localStorage.setItem('swapMarks-' + DATA.seed, JSON.stringify([...marks])); draw();
}
document.getElementById('prev').onclick = () => go(i-1);
document.getElementById('next').onclick = () => go(i+1);
document.getElementById('mark').onclick = toggleMark;
document.getElementById('edges').onclick = () => { showEdges = !showEdges; draw(); };
document.getElementById('labels').onclick = () => { showLabels = !showLabels; draw(); };
document.getElementById('jump').onchange = e => go((+e.target.value||1)-1);
document.addEventListener('keydown', e => {
  if(e.target.tagName === 'INPUT') return;
  if(e.key==='ArrowRight') go(i+1);
  else if(e.key==='ArrowLeft') go(i-1);
  else if(e.key==='PageDown') go(i+10);
  else if(e.key==='PageUp') go(i-10);
  else if(e.key==='Home') go(0);
  else if(e.key==='End') go(P.length-1);
  else if(e.key==='x'||e.key==='X') toggleMark();
  else if(e.key==='e'||e.key==='E'){ showEdges = !showEdges; draw(); }
  else if(e.key==='l'||e.key==='L'){ showLabels = !showLabels; draw(); }
  else return;
  e.preventDefault();
});
draw();
</script></body></html>
"""

if __name__ == "__main__":
    main()
