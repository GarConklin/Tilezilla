# Tilezilla Screen Layout — Current Reference

Use this doc to see where everything is, and to note changes you want.

**Open in:** `Docs/Tilezilla_Layout_Reference.md`  
**Live code:** `web/css/tilezilla-shell.css` (all `--tz-*` variables at top)

---

## How to read coordinates

| Term | Meaning |
|------|---------|
| **Artboard** | Full phone screen: **390 × 844 px** |
| **Shell** | Game area above nav: **390 × 782 px** (y = 0…782) |
| **x, y** | Top-left corner of a box |
| **w, h** | Width and height |
| **Nudge** | Extra px added on top of calculated position |

**When telling me changes**, use region letters (A–J) or CSS variable names:

> “Move **G** (tile bag) down 8 px”  
> “Change **tile bag count** x from 235 to 240”  
> “Increase gap between **F** and **G** to 12 px”

---

## Full screen map (390 × 844)

Y axis runs down. X axis runs right.

```
 0                                                                 390
  ┌──────────────────────────────────────────────────────────────────┐
 0│ A  HEADER                                    h=48               │
  ├──────────────────────────────────────────────────────────────────┤
56│ B  STATUS (Rank | Daily Challenge | Timer)   h=72               │
  ├──────────────────────────────────────────────────────────────────┤
136│ C  BOARD FRAME                               h=360  w=360       │
   │     (puzzle grid inside, 60px cells)                            │
498│ D  GAME MESSAGE                              h=10               │
  ├──────────────────────────────────────────────────────────────────┤
489│ F  PREVIEW TILE                              h≈185  w=381       │
   │     Rotate L | tile preview | Rotate R                          │
674│     (preview bottom)                                              │
   │ ~4px gap                                                         │
678│ G  TILE BAG (collapsed)                      total h=88         │
   │     frame h=74 + expand handle h=14                             │
766│     (tile bag bottom incl. handle)                                │
726│ H  ACTION BAR (overlaps tile bag slightly)   h=56               │
  ├──────────────────────────────────────────────────────────────────┤
782│ (shell ends)                                                      │
782│ I  BOTTOM NAV                                h=62               │
844└──────────────────────────────────────────────────────────────────┘
```

Background image fills the full 390×844 stage behind everything.

---

## Region cheat sheet (copy / edit)

Fill in **Your notes** when you want changes.

| ID | Region | Class / ID | x | y | w | h | CSS variable to tweak |
|----|--------|------------|---|---|---|---|------------------------|
| A | Header | `.tz-header` | 0 | 0 | 390 | 48 | `--tz-y-header`, `--tz-h-header` |
| B | Status row | `.tz-status` | 8 | 56 | 374 | 72 | `--tz-y-status`, `--tz-w-status-card` |
| C | Board | `.tz-board-section` | 15 | 136 | 360 | 360 | `--tz-y-board`, `--tz-x-board`, `--tz-cell-size` |
| D | Game message | `#gameMessage` | 8 | 498 | 374 | 10 | `--tz-y-message` |
| F | Preview | `.tz-preview-section` | ~4.5 | ~489 | 381 | ~185 | `--tz-y-preview-nudge`, `--tz-w-preview` |
| G | Tile bag | `#tileBagContainer` | ~4.5 | ~678 | 381 | 88 | `--tz-y-tilebag-nudge`, `--tz-tilebag-actions-offset` |
| H | Actions | `.tz-actions` | 4 | 726 | 382 | 56 | `--tz-y-actions`, `--tz-gap-above-nav` |
| I | Bottom nav | `.tz-bottom-nav` | 0 | 782 | 390 | 62 | `--tz-nav-h`, `--tz-nav-item-w` |

**Your notes:**

| ID | What I want changed |
|----|---------------------|
| A | |
| B | |
| C | |
| D | |
| F | |
| G | |
| H | |
| I | |

---

## Vertical stack (exact computed values)

These are the **effective** tops after nudges (1× scale):

| Region | Base y | Nudge | Effective top | Bottom |
|--------|--------|-------|---------------|--------|
| Header | 0 | — | **0** | 48 |
| Status | 56 | — | **56** | 128 |
| Board | 136 | — | **136** | 496 |
| Game message | 498 | — | **498** | 508 |
| Preview | 479.1 | +10 | **489.1** | **674.0** |
| Tile bag | 668 | +10 | **678** | **766** (incl. handle) |
| Actions | 726 | — | **726** | 782 |
| Nav | 782 | — | **782** | 844 |

**Spacing formulas** (in CSS):

```
y-actions     = 782 − 56 = 726
y-tilebag     = 726 − 58 = 668        ← --tz-tilebag-actions-offset
y-preview     = 668 − 4 − 185 = 479   ← --tz-gap-preview-tilebag
preview top   = y-preview + 10          ← --tz-y-preview-nudge
tile bag top  = y-tilebag + 10          ← --tz-y-tilebag-nudge
```

To move **preview** without moving **tile bag**: change `--tz-y-preview-nudge` only.  
To move **tile bag** (and preview follows): change `--tz-y-tilebag-nudge` or `--tz-tilebag-actions-offset`.

---

## C — Board detail

```
  x=15                    x=375
  y=136 ┌────────────────────────┐
        │   BOARD FRAME 360×360   │
        │   ┌──────────────────┐  │
        │   │  grid (centered)  │  │
        │   │  cell = 60×60     │  │
        │   │  max 5×6          │  │
        │   └──────────────────┘  │
  y=496 └────────────────────────┘
```

| Item | Value |
|------|-------|
| Asset | `img/Board Area.png` |
| Cell substrate | `img/E1-Blank-G-Tile.png` |
| Max grid | 5 cols × 6 rows = 300×360 px |

---

## F — Preview detail (asset 919×446 → shown 381×185)

Centered on screen (x ≈ 4.5).

```
┌────────── PREVIEW FRAME 381×185 ──────────┐
│  [Rotate L]   [tile render]   [Rotate R]  │
│              Rotation: 0°                    │
└────────────────────────────────────────────┘
```

Hit areas (coords inside **919×446 asset**, not screen px):

| Part | x | y | w | h |
|------|---|---|---|---|
| Rotate left | 65 | 173 | 160 | 105 |
| Tile renderer | 275 | 130 | 370 | 220 |
| Rotate right | 695 | 173 | 160 | 105 |

Asset: `img/preview tile Area bubble.png`

---

## G — Tile bag detail (asset 381×74 + handle)

```
┌──────────── TILE BAG FRAME 381×74 ────────────┐
│  TILE BAG  🍃 15/15   ← header (art + overlays)│
│ ◀ │ [tile][tile][tile][tile]...            ▶ │
└───────────────────────────────────────────────┘
              ═══ expand handle ═══  (72×14)
```

### Header overlays (381×74 art coordinates)

| Part | x | y | w | h | HTML / CSS |
|------|---|---|---|---|------------|
| Leaf icon | 220 | 2 | 11 | — | `.tz-tilebag-header-leaf` |
| Count `15/15` | 235 | 2 | 60 | 16 | `.tz-tilebag-count-overlay` / `#tileBagCount` |

Count style: 11px, bold, `#D4B04A`, shadow `0 1px 2px rgba(0,0,0,.75)`

**CSS variables:** `--tz-tilebag-leaf-x`, `--tz-tilebag-count-x`, `--tz-tilebag-count-w`

### Carousel (381×74 art coordinates)

| Part | x | y | w | h |
|------|---|---|---|---|
| Track | 18 | 12 | 345 | 50 |
| Scroll left | 0 | 12 | 15 | 50 |
| Scroll right | 366 | 12 | 15 | 50 |

### Tiles in track

| State | Size |
|-------|------|
| Normal | 44×44 |
| Selected | 48×48 |
| Gap | 5 px |

### Expand handle

| Property | Value |
|----------|-------|
| Position | Centered under frame |
| Hit area | 72 × 14 px |
| Collapsed | Single row, horizontal scroll |
| Expanded | 2–4 rows, grows upward |

Asset: `img/390x840-tile bag.png` · Leaf: `img/tilebag-leaf.png`

**Your tile bag notes:**

| Part | Current | Change to |
|------|---------|-------------|
| Leaf x | 220 | |
| Count x | 235 | |
| Count w | 60 | |
| Tile bag top (y) | 678 | |
| Gap below preview | 4 | |

---

## H — Action bar detail

Bar: x=4, y=726, 382×56. Buttons left → right (8 px gaps):

| Button | x (approx) | w | h | Asset |
|--------|------------|---|---|-------|
| Undo | 4 | 62 | 42 | `Undo bubble.png` |
| Reset | 74 | 62 | 42 | `reset bubble.png` |
| Hint | 144 | 104 | 48 | `use hint bubble.png` |
| View Solutions | 256 | 92 | 42 | `view solutions.png` |
| Settings | 356 | 28 | 46 | `setup_config bubble.png` |

**Your action bar notes:**

| Button | Change |
|--------|--------|
| | |

---

## A — Header

| Column | Width | Asset |
|--------|-------|-------|
| Menu | 44 px | `Menu Bubble.png` |
| Title | flex | `Title.png` |
| Hint tokens | 112 px | `Hint Tokens bubble.png` |

---

## B — Status cards

Three cards × 118 px wide at y=56.

| Card | Content |
|------|---------|
| Rank | `#rankName`, progress bar |
| Daily Challenge | `#challengeDate`, `#puzzleCode`, `#solutionCount` |
| Timer | `#timerCurrent`, `#timerBest` |

---

## I — Bottom nav

5 tabs × 78 px = 390 px. Default active: **Daily Challenge**.

| Tab | data-nav |
|-----|----------|
| Adventure | `adventure` |
| Daily Challenge | `daily-challenge` |
| Random Puzzle | `random` |
| Puzzle Library | `library` |
| Profile | `profile` |

---

## Quick “move this” guide

| I want to… | Edit this variable |
|------------|-------------------|
| Move tile bag up/down | `--tz-y-tilebag-nudge` (currently `10px`) |
| Move preview only | `--tz-y-preview-nudge` (currently `10px`) |
| Space preview ↔ tile bag | `--tz-gap-preview-tilebag` (currently `4px`) |
| Move whole bottom stack | `--tz-tilebag-actions-offset` (currently `58px`) |
| Move actions vs nav | `--tz-gap-above-nav` (currently `0px`) |
| Move board | `--tz-y-board`, `--tz-x-board` |
| Move tile count | `--tz-tilebag-count-x`, `--tz-tilebag-count-y`, `--tz-tilebag-count-w` |
| Move leaf icon | `--tz-tilebag-leaf-x`, `--tz-tilebag-leaf-y` |

All variables live at the top of `web/css/tilezilla-shell.css` inside `:root { ... }`.

---

## Files map

| File | What it controls |
|------|------------------|
| `web/tilezilla.html` | Structure / element IDs |
| `web/css/tilezilla-shell.css` | All layout positions & sizes |
| `web/js/tilezilla-bootstrap.js` | Tile count text, expand handle, scroll |
| `web/js/app_v16.js` | Board, palette tiles, game logic |

---

## Example change requests

```
Move region G down 12px
→ "Set --tz-y-tilebag-nudge from 10px to 22px"

Move count right 5px
→ "Set --tz-tilebag-count-x from 235 to 240"

More space between preview and tile bag
→ "Set --tz-gap-preview-tilebag from 4px to 12px"
  OR increase --tz-y-tilebag-nudge

Hide expand handle / change handle size
→ Tell me and reference region G handle section
```

---

*Updated: June 2026 — matches current `tilezilla-shell.css`*
