"""Repo paths for tools/scripts Python entrypoints."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOLS_DATA = ROOT / "tools" / "data"
SOLVER_RUNS = TOOLS_DATA / "solver-runs"
BATCHES = TOOLS_DATA / "batches"
SOLVE_QUEUE = TOOLS_DATA / "solve-queue.json"
