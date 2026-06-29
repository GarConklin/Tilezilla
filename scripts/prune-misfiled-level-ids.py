#!/usr/bin/env python3
"""Remove misfiled duplicate level ids from data/levels/levels.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REMOVE = {
    "3x6-0C-AAD",
    "3x6-0C-AAE",
    "3x6-0C-AAF",
    "3x6-0C-AAG",
    "4x4-0A-ADF",
}
path = ROOT / "data" / "levels" / "levels.json"
doc = json.loads(path.read_text(encoding="utf-8"))
before = len(doc["levels"])
doc["levels"] = [lv for lv in doc["levels"] if lv.get("id") not in REMOVE]
path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print(f"removed {before - len(doc['levels'])} from levels.json")
