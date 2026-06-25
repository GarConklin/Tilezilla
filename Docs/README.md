# Snake Tile Board (Refactor)

This is a refactored version that separates:
- `index.html` (layout only)
- `css/styles.css`
- `js/app.js` (UI + placement)
- `js/solver.js` (solver + visible log)
- `js/solutions.js` (save/load solutions)

## Run (Docker)
```bash
docker compose up --build
```
Open http://127.0.0.1:8081/tilezilla-v2.html

## Files you must provide
Put your real files in `img/`:
- tile images: `img/*.png`
- `img/tiles.json` (array of filenames)
- `/data/tiles/tiles-live-edges.json` (your live-edge map)
