# Solution viewer

Step through every solution of a puzzle, drawn with the game's tile art (tilesets from
`data/tiles/tilesets.json`, same rotate/footprint code as `web/js/app_v16.js`). Each board is
checked in the page by the game validator (`tools/scripts/lib/web-validate-board-node.js`) and by
the strict single-snake check (`strict-check.js`).

## Open

```powershell
.\tools\scripts\view-solutions.ps1 -Id 5x6-0B-01L4              # finds spec + solutions (nightly run, candidate sets)
.\tools\scripts\view-solutions.ps1 -Id 5x6-0B-01L4 -FindLoops   # also list loop boards (exhaustive fill)
.\tools\scripts\view-solutions.ps1 -Spec <spec.json> -Solutions <solutions.json[.gz]> [-Loops <loops.json>]
```

Options: `-Tileset <name>`, `-Port <n>`, `-Width/-Height`, `-NoBrowser`.

The launcher copies inputs to `%TEMP%\tz_solution_viewer\<id>\` (originals are only read), starts
`serve.js` on 127.0.0.1 in a visible window titled **TileZilla solution viewer** (close it to stop),
and opens an Edge `--app` popup (Chrome as fallback). A `loops.json` from an earlier `-FindLoops`
run in that folder is reused.

## Keys

| Key | Action |
| --- | --- |
| Right / Left | next / previous |
| PageDown / PageUp | +100 / -100 |
| Home / End | first / last |
| G | go to number |
| P | path order numbers (SH = 1, ET = last) |
| L | switch solutions / loop boards |

## URL parameters

`/viewer/solution-viewer.html?spec=<url>&solutions=<url>[&loops=<url>][&tileset=<name>][&cell=<px>][&n=<number>][&mode=loops][&path=1][&title=<text>]`

URLs are served by `serve.js`: `/inputs/*` is the `--inputs` folder (`.gz` is served unzipped),
`/img`, `/js`, `/css`, `/data/tiles` and `/lib` map to the repo the same way as production nginx.

## Loop boards

`node tools/viewer/find-loop-boards.js --spec <spec.json> --out <loops.json> [--solutions <solutions.json>]`
fills the board with the bag in every possible way and writes the finished layouts the game
validator accepts but the strict rule rejects (a path loop hanging off the snake, usually joined
through a tile whose two halves the game treats as linked). With `--solutions` it also reports
whether the strict layouts it found match the solutions file one-for-one.
