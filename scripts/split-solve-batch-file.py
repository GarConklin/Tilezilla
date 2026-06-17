#!/usr/bin/env python3
"""Split concatenated TilePz JSON batch into N chunk files."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def split_json_docs(text: str) -> list[str]:
    out: list[str] = []
    depth = 0
    start = -1
    in_str = False
    esc = False
    for i, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start >= 0:
                    out.append(text[start : i + 1])
                    start = -1
    return out


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/split-solve-batch-file.py <batch.txt> [chunks=4]", file=sys.stderr)
        sys.exit(1)
    src = Path(sys.argv[1])
    chunks = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    docs = split_json_docs(src.read_text(encoding="utf-8"))
    per = (len(docs) + chunks - 1) // chunks
    base = str(src).replace(".txt", "")
    written = []
    for c in range(chunks):
        slice_docs = docs[c * per : (c + 1) * per]
        if not slice_docs:
            break
        out = Path(f"{base} - batch{c + 1}.txt")
        out.write_text("\n\n".join(slice_docs) + "\n", encoding="utf-8")
        first = json.loads(slice_docs[0]).get("levelId", "?")
        last = json.loads(slice_docs[-1]).get("levelId", "?")
        written.append((out, len(slice_docs), first, last))
    print(json.dumps({"total": len(docs), "chunks": written}, indent=2, default=str))


if __name__ == "__main__":
    main()
