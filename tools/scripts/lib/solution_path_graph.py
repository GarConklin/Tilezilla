"""Build live-edge routing graphs for solve placements and detect loops/branches."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

OPP = {"N": "S", "S": "N", "E": "W", "W": "E"}
NEUTRAL_TILES = {"E1", "E2", "B1", "B2"}
CT_LIKE = {"CT", "CQ"}


def tile_id(tile_ref: str) -> str:
    if not tile_ref or not isinstance(tile_ref, str):
        return ""
    head = tile_ref.split("#")[0].split("-")[0]
    return head if re.fullmatch(r"[A-Z0-9]{2,3}", head) else ""


def rot_name(deg: int) -> str:
    r = deg % 360
    if r == 0:
        return "r0"
    if r == 90:
        return "r90"
    if r == 180:
        return "r180"
    return "r270"


def target_cells(r: int, c: int, deg: int) -> List[Tuple[int, int]]:
    rot = deg % 360
    if rot == 0:
        return [(r, c), (r, c + 1)]
    if rot == 90:
        return [(r, c), (r + 1, c)]
    if rot == 180:
        return [(r, c), (r, c - 1)]
    return [(r, c), (r - 1, c)]


def tile_cell_count(tile_ref: str, live_edges: dict) -> int:
    tid = tile_id(tile_ref)
    shape = live_edges.get(tid, {}).get("shape")
    if isinstance(shape, list) and shape:
        return len(shape)
    return 2


def cells_for_tile(tile_ref: str, r: int, c: int, deg: int, live_edges: dict) -> List[Tuple[int, int]]:
    if tile_cell_count(tile_ref, live_edges) == 1:
        return [(r, c)]
    return target_cells(r, c, deg)


def edges_for(tile_ref: str, deg: int, which: str, live_edges: dict) -> List[str]:
    tid = tile_id(tile_ref)
    rn = rot_name(deg)
    cell = live_edges.get(tid, {}).get(rn, {})
    edges = cell.get(which, [])
    return list(edges) if isinstance(edges, list) else []


def path_specs_for_placement(tile_ref: str, deg: int, live_edges: dict) -> Optional[List[dict]]:
    tid = tile_id(tile_ref)
    rn = rot_name(deg)
    specs = live_edges.get(tid, {}).get(rn, {}).get("paths")
    return specs if isinstance(specs, list) else None


def path_uses_both_halves(path_obj: dict) -> bool:
    ends = path_obj.get("ends")
    if not isinstance(ends, list) or len(ends) != 2:
        return False
    p0, p1 = ends[0], ends[1]
    if not p0 or not p1:
        return False
    return (p0[0] == "A" and p1[0] == "B") or (p0[0] == "B" and p1[0] == "A")


def is_full_crossroads(tile_ref: str, deg: int, live_edges: dict) -> bool:
    specs = path_specs_for_placement(tile_ref, deg, live_edges)
    if not specs or len(specs) < 2:
        return False
    return all(path_uses_both_halves(spec) for spec in specs)


def tile_internally_links_halves(
    tile_ref: str,
    specs: Optional[List[dict]],
    path_pick: Dict[str, int],
    placed_id: str,
    expected_path_count: int,
    placed_by_id: Dict[str, dict],
    live_edges: dict,
) -> bool:
    tid = tile_id(tile_ref)
    if expected_path_count > 1:
        if tid not in CT_LIKE:
            return True
        t = placed_by_id.get(placed_id)
        if not t:
            return True
        rot = t["deg"] % 360
        cells = cells_for_tile(t["tile"], t["r"], t["c"], rot, live_edges)
        if len(cells) < 2:
            return True
        e0 = len(edges_for(t["tile"], rot, "A", live_edges))
        e1 = len(edges_for(t["tile"], rot, "B", live_edges))
        return e0 > 0 and e1 > 0

    if specs:
        pi = path_pick.get(placed_id, 0)
        crosses = path_uses_both_halves(specs[pi])
        if tid in CT_LIKE:
            return crosses
    return True


def compute_expected_path_count(
    placed: List[dict],
    *,
    path_mode: Optional[str] = None,
    path_count: int = 0,
    level_tiles: Optional[dict] = None,
) -> int:
    sh_placed = sum(1 for t in placed if tile_id(t.get("tile", "")) == "SH")
    et_placed = sum(1 for t in placed if tile_id(t.get("tile", "")) == "ET")
    sh_level = int((level_tiles or {}).get("SH", 0) or 0)
    et_level = int((level_tiles or {}).get("ET", 0) or 0)
    level_paths = min(sh_level, et_level) if sh_level > 0 and et_level > 0 else 0
    fallback = 2 if sh_placed == 2 and et_placed == 2 else 1
    if level_paths > 0:
        return level_paths
    if path_mode in ("multi", "multi-flex") and path_count > 0:
        return path_count
    if path_mode == "single":
        return 1
    return fallback


def _cell_key(r: int, c: int) -> str:
    return f"{r},{c}"


def _build_cell_info(
    placed: List[dict],
    rows: int,
    cols: int,
    live_edges: dict,
) -> Dict[str, dict]:
    cell_info: Dict[str, dict] = {}
    for i, t in enumerate(placed):
        rot = t.get("deg", 0) % 360
        cells = cells_for_tile(t.get("tile", ""), int(t["r"]), int(t["c"]), rot, live_edges)
        placed_id = str(t.get("id") or f"p{i}")
        for ci, (rr, cc) in enumerate(cells):
            if rr < 0 or rr >= rows or cc < 0 or cc >= cols:
                raise ValueError(f"Tile {t.get('tile')} off-board at ({rr},{cc})")
            key = _cell_key(rr, cc)
            if key in cell_info:
                raise ValueError(f"Overlap at ({rr},{cc})")
            which = "A" if ci == 0 else "B"
            cell_info[key] = {
                "tile": t.get("tile", ""),
                "deg": rot,
                "which": which,
                "placedId": placed_id,
                "r": rr,
                "c": cc,
            }
    return cell_info


def _resolved_edges_for_pick(
    cell_info: Dict[str, dict],
    placed_by_id: Dict[str, dict],
    path_pick: Dict[str, int],
    expected_paths: int,
    live_edges: dict,
) -> Optional[Dict[str, List[str]]]:
    adj: Dict[str, List[str]] = {}
    for key, info in cell_info.items():
        base = edges_for(info["tile"], info["deg"], info["which"], live_edges)
        if not base:
            continue
        adj.setdefault(key, [])
        for e in base:
            rr = info["r"] + (-1 if e == "N" else 1 if e == "S" else 0)
            cc = info["c"] + (-1 if e == "W" else 1 if e == "E" else 0)
            nk = _cell_key(rr, cc)
            if nk in cell_info:
                nbrs = adj.setdefault(key, [])
                if nk not in nbrs:
                    nbrs.append(nk)

    by_tile: Dict[str, List[str]] = {}
    for key, info in cell_info.items():
        if key not in adj and not edges_for(info["tile"], info["deg"], info["which"], live_edges):
            continue
        by_tile.setdefault(info["placedId"], []).append(key)

    for pid, cells in by_tile.items():
        if len(cells) < 2:
            continue
        t = placed_by_id.get(pid)
        if not t:
            continue
        specs = path_specs_for_placement(t["tile"], t["deg"], live_edges)
        if not tile_internally_links_halves(
            t["tile"], specs, path_pick, pid, expected_paths, placed_by_id, live_edges
        ):
            continue
        a, b = cells[0], cells[1]
        if b not in adj.setdefault(a, []):
            adj[a].append(b)
        if a not in adj.setdefault(b, []):
            adj[b].append(a)

    if not adj:
        return adj

    start = next(iter(adj))
    seen = {start}
    queue = [start]
    while queue:
        cur = queue.pop(0)
        for nb in adj.get(cur, []):
            if nb not in seen:
                seen.add(nb)
                queue.append(nb)
    if len(seen) != len(adj):
        return None

    deg1 = sum(1 for nbrs in adj.values() if len(nbrs) == 1)
    if deg1 != expected_paths * 2:
        return None
    return adj


def resolve_placement_path_choices(
    cell_info: Dict[str, dict],
    placed: List[dict],
    expected_paths: int,
    live_edges: dict,
) -> Optional[Dict[str, int]]:
    if expected_paths > 1:
        return {}

    placed_by_id = {str(t.get("id") or f"p{i}"): t for i, t in enumerate(placed)}
    ambig: List[str] = []
    fixed: Dict[str, int] = {}
    for i, t in enumerate(placed):
        pid = str(t.get("id") or f"p{i}")
        specs = path_specs_for_placement(t.get("tile", ""), t.get("deg", 0), live_edges)
        if not specs:
            continue
        if len(specs) == 1 or is_full_crossroads(t.get("tile", ""), t.get("deg", 0), live_edges):
            fixed[pid] = 0
            continue
        ambig.append(pid)

    def dfs(i: int, path_pick: Dict[str, int]) -> Optional[Dict[str, int]]:
        if i >= len(ambig):
            return path_pick if _resolved_edges_for_pick(
                cell_info, placed_by_id, path_pick, expected_paths, live_edges
            ) else None
        pid = ambig[i]
        t = placed_by_id[pid]
        specs = path_specs_for_placement(t["tile"], t["deg"], live_edges) or []
        for pi in range(len(specs)):
            path_pick[pid] = pi
            res = dfs(i + 1, path_pick)
            if res is not None:
                return res
        path_pick.pop(pid, None)
        return None

    if not ambig:
        return fixed if _resolved_edges_for_pick(
            cell_info, placed_by_id, fixed, expected_paths, live_edges
        ) else None
    return dfs(0, dict(fixed))


def build_live_edge_graph(
    cell_info: Dict[str, dict],
    placed: List[dict],
    path_pick: Dict[str, int],
    expected_paths: int,
    live_edges: dict,
) -> Dict[str, List[str]]:
    placed_by_id = {str(t.get("id") or f"p{i}"): t for i, t in enumerate(placed)}
    adj: Dict[str, List[str]] = {}

    for key, info in cell_info.items():
        tid = tile_id(info["tile"])
        if tid in NEUTRAL_TILES:
            continue
        edges = edges_for(info["tile"], info["deg"], info["which"], live_edges)
        if not edges:
            continue
        adj.setdefault(key, [])
        for e in edges:
            rr = info["r"] + (-1 if e == "N" else 1 if e == "S" else 0)
            cc = info["c"] + (-1 if e == "W" else 1 if e == "E" else 0)
            nk = _cell_key(rr, cc)
            if nk not in cell_info:
                continue
            nb = cell_info[nk]
            if tile_id(nb["tile"]) in NEUTRAL_TILES:
                continue
            nbrs = adj.setdefault(key, [])
            if nk not in nbrs:
                nbrs.append(nk)

    by_tile: Dict[str, List[str]] = {}
    for key, info in cell_info.items():
        if key not in adj:
            continue
        by_tile.setdefault(info["placedId"], []).append(key)

    for pid, cells in by_tile.items():
        if len(cells) < 2:
            continue
        t = placed_by_id.get(pid)
        if not t:
            continue
        specs = path_specs_for_placement(t["tile"], t["deg"], live_edges)
        if not tile_internally_links_halves(
            t["tile"], specs, path_pick, pid, expected_paths, placed_by_id, live_edges
        ):
            continue
        a, b = cells[0], cells[1]
        if b not in adj.setdefault(a, []):
            adj[a].append(b)
        if a not in adj.setdefault(b, []):
            adj[b].append(a)

    return adj


def _components(adj: Dict[str, List[str]]) -> List[List[str]]:
    seen: Set[str] = set()
    comps: List[List[str]] = []
    for start in adj:
        if start in seen:
            continue
        comp: List[str] = []
        queue = [start]
        seen.add(start)
        while queue:
            cur = queue.pop(0)
            comp.append(cur)
            for nb in adj.get(cur, []):
                if nb not in seen:
                    seen.add(nb)
                    queue.append(nb)
        comps.append(comp)
    return comps


def _edge_count(adj: Dict[str, List[str]]) -> int:
    return sum(len(nbrs) for nbrs in adj.values()) // 2


def _endpoint_cells(adj: Dict[str, List[str]], cell_info: Dict[str, dict]) -> Tuple[Optional[str], Optional[str]]:
    sh_keys = [k for k in adj if tile_id(cell_info[k]["tile"]) == "SH"]
    et_keys = [k for k in adj if tile_id(cell_info[k]["tile"]) == "ET"]
    if len(sh_keys) != 1 or len(et_keys) != 1:
        return None, None
    return sh_keys[0], et_keys[0]


def _hamiltonian_path_exists(adj: Dict[str, List[str]], start: str, goal: str) -> bool:
    nodes = set(adj.keys())
    target = len(nodes)

    def dfs(cur: str, visited: Set[str]) -> bool:
        if len(visited) == target:
            return cur == goal
        if cur == goal and len(visited) < target:
            return False
        for nb in adj.get(cur, []):
            if nb in visited:
                continue
            visited.add(nb)
            if dfs(nb, visited):
                return True
            visited.remove(nb)
        return False

    visited = {start}
    return dfs(start, visited)


@dataclass
class PathAnalysis:
    ok: bool
    issue: str
    detail: str
    endpoints: int = 0
    nodes: int = 0
    edges: int = 0
    max_degree: int = 0
    components: int = 0


def analyze_simple_path_graph(
    adj: Dict[str, List[str]],
    expected_paths: int,
    *,
    cell_info: Optional[Dict[str, dict]] = None,
) -> PathAnalysis:
    if not adj:
        return PathAnalysis(False, "empty", "No live-edge nodes")

    comps = _components(adj)
    nodes = len(adj)
    edges = _edge_count(adj)
    degrees = {k: len(v) for k, v in adj.items()}
    max_degree = max(degrees.values()) if degrees else 0
    endpoints = sum(1 for d in degrees.values() if d == 1)

    if len(comps) != expected_paths:
        return PathAnalysis(
            False,
            "disconnected",
            f"{len(comps)} component(s), expected {expected_paths}",
            endpoints,
            nodes,
            edges,
            max_degree,
            len(comps),
        )

    if endpoints != expected_paths * 2:
        return PathAnalysis(
            False,
            "endpoints",
            f"{endpoints} endpoint(s), expected {expected_paths * 2}",
            endpoints,
            nodes,
            edges,
            max_degree,
            len(comps),
        )

    for comp in comps:
        sub = {k: adj[k] for k in comp}
        cn = len(sub)
        ce = _edge_count(sub)
        cdeg = {k: len(adj[k]) for k in comp}
        cmax = max(cdeg.values()) if cdeg else 0
        cend = sum(1 for d in cdeg.values() if d == 1)

        if expected_paths == 1:
            if cell_info:
                sh, et = _endpoint_cells(sub, {k: cell_info[k] for k in comp})
                if sh and et:
                    if _hamiltonian_path_exists(sub, sh, et):
                        continue
                    return PathAnalysis(
                        False,
                        "loop",
                        "No single SH->ET route visits every live-edge cell",
                        endpoints,
                        nodes,
                        edges,
                        max_degree,
                        len(comps),
                    )
            if cmax > 2:
                return PathAnalysis(
                    False,
                    "branch",
                    f"degree {cmax} junction (loop or spur)",
                    endpoints,
                    nodes,
                    edges,
                    max_degree,
                    len(comps),
                )
            if ce > cn - 1:
                return PathAnalysis(
                    False,
                    "loop",
                    f"{ce} edges on {cn} nodes (expected {cn - 1} for a simple path)",
                    endpoints,
                    nodes,
                    edges,
                    max_degree,
                    len(comps),
                )
            if cend != 2:
                return PathAnalysis(
                    False,
                    "endpoints",
                    f"component has {cend} endpoint(s), expected 2",
                    endpoints,
                    nodes,
                    edges,
                    max_degree,
                    len(comps),
                )
        else:
            if ce > cn - 1:
                return PathAnalysis(
                    False,
                    "loop",
                    f"path component has cycle ({ce} edges, {cn} nodes)",
                    endpoints,
                    nodes,
                    edges,
                    max_degree,
                    len(comps),
                )
            if cend != 2:
                return PathAnalysis(
                    False,
                    "endpoints",
                    f"path component has {cend} endpoint(s), expected 2",
                    endpoints,
                    nodes,
                    edges,
                    max_degree,
                    len(comps),
                )

    return PathAnalysis(True, "ok", "simple path", endpoints, nodes, edges, max_degree, len(comps))


def analyze_placements(
    placements: List[dict],
    *,
    rows: int,
    cols: int,
    live_edges: dict,
    path_mode: Optional[str] = None,
    path_count: int = 0,
    level_tiles: Optional[dict] = None,
) -> PathAnalysis:
    placed: List[dict] = []
    for i, p in enumerate(placements or []):
        placed.append(
            {
                "id": p.get("id") or f"p{i}",
                "tile": p.get("tile", ""),
                "r": int(p["r"]),
                "c": int(p["c"]),
                "deg": int(p.get("deg", 0)),
            }
        )

    try:
        cell_info = _build_cell_info(placed, rows, cols, live_edges)
    except ValueError as e:
        return PathAnalysis(False, "layout", str(e))

    expected_paths = compute_expected_path_count(
        placed,
        path_mode=path_mode,
        path_count=path_count,
        level_tiles=level_tiles,
    )

    path_pick = resolve_placement_path_choices(cell_info, placed, expected_paths, live_edges)
    if path_pick is None:
        return PathAnalysis(False, "routing", "Cannot resolve path-aware tile wiring")

    adj = build_live_edge_graph(cell_info, placed, path_pick, expected_paths, live_edges)
    return analyze_simple_path_graph(adj, expected_paths, cell_info=cell_info)


def load_live_edges(repo_root: Path) -> dict:
    path = repo_root / "data" / "tiles" / "tiles-live-edges.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def board_size_from_level_id(level_id: str) -> Optional[str]:
    m = re.match(r"^(\d+x\d+)-", level_id or "")
    return m.group(1) if m else None
