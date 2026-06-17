"""Load adventure step progression from data/LevelSystem.csv."""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import List, TypedDict


class LevelSystemStep(TypedDict):
    rank_id: int
    sub_level: int
    levels_required: int
    adv_id_start: int


class ProgressionRow(TypedDict):
    rank_id: int
    sub_level: int
    levels_required: int
    cumulative_levels_required: int


def level_system_path(repo_root: Path | None = None) -> Path:
    root = repo_root or Path(__file__).resolve().parents[2]
    return root / "data" / "LevelSystem.csv"


def parse_rank_code(base_lvl: str) -> int:
    m = re.match(r"^L(\d+)$", str(base_lvl).strip(), re.I)
    if not m:
        raise ValueError(f"Invalid Base_Lvl: {base_lvl!r}")
    return int(m.group(1))


def load_level_system_steps(csv_path: Path | None = None, repo_root: Path | None = None) -> List[LevelSystemStep]:
    path = csv_path or level_system_path(repo_root)
    if not path.exists():
        raise FileNotFoundError(f"LevelSystem CSV not found: {path}")

    rows: List[LevelSystemStep] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        for raw in csv.DictReader(f):
            base = (raw.get("Base_Lvl") or raw.get("base_lvl") or "").strip()
            sub = (raw.get("Sub_Lvl") or raw.get("sub_lvl") or "").strip()
            amt = (raw.get("pzzle_amt") or raw.get("Pzzle_amt") or "").strip()
            adv_start = (raw.get("Adv_ID_Start") or raw.get("adv_id_start") or "").strip()
            if not base or not sub or not amt:
                continue
            levels_required = int(amt)
            if levels_required <= 0:
                raise ValueError(
                    f"Non-positive pzzle_amt at {base}-{sub}: {levels_required}"
                )
            rows.append(
                {
                    "rank_id": parse_rank_code(base),
                    "sub_level": int(sub),
                    "levels_required": levels_required,
                    "adv_id_start": int(adv_start) if adv_start else 0,
                }
            )

    rows.sort(key=lambda r: (r["rank_id"], r["sub_level"]))
    if not rows:
        raise ValueError(f"No rows in {path}")
    return rows


def derive_progression_from_level_system(
    csv_path: Path | None = None,
    repo_root: Path | None = None,
    max_rank_id: int | None = None,
) -> List[ProgressionRow]:
    steps = load_level_system_steps(csv_path, repo_root)
    if max_rank_id is not None:
        steps = [s for s in steps if 1 <= s["rank_id"] <= max_rank_id]
        if not steps:
            raise ValueError(f"No LevelSystem rows for rank_id 1..{max_rank_id}")

    cumulative = 0
    out: List[ProgressionRow] = []
    for step in steps:
        cumulative += step["levels_required"]
        out.append(
            {
                "rank_id": step["rank_id"],
                "sub_level": step["sub_level"],
                "levels_required": step["levels_required"],
                "cumulative_levels_required": cumulative,
            }
        )
    return out
