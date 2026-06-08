# Tilezilla

This is a refactored version that separates:
- `web/index.html` (layout only)
- `web/css/styles.css`
- `web/js/app.js` (UI + placement)
- `web/js/solver.js` (solver + visible log)
- `web/js/solutions.js` (save/load solutions)

## Run (Docker)
```bash
docker compose up --build
```
Open http://localhost:8080

## Files you must provide
Put your real files in `web/img/`:
- tile images: `web/img/*.png`
- `web/img/tiles.json` (array of filenames)
- `data/tiles/tiles-live-edges.json` (your live-edge map)
