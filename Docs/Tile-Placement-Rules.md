# Snake Tile Puzzle - Solution Finder Rules

## Overview

The Solution Finder uses a path-following algorithm that extends a continuous snake from the Start tile (SH) until it reaches the End tile (ET), filling the entire board. The solver enforces multiple validation rules at each placement to ensure only valid configurations are attempted.

---

## 1. Board and Tile Fundamentals

### 1.1 Board Configuration
- **Grid Size**: 6 rows × 5 columns (30 cells total)
- **Tile Size**: Each tile is a 2-cell "domino" shape
- **Total Tiles**: 15 tiles (covering all 30 cells)

### 1.2 Tile Types and Counts

| Tile | Name  			| Count | Description |
|------|---------------	|-------|-------------|
|  SH  | Start			|	1 	| Snake head - where the path begins |
|  ET  | End   			| 	1	| Snake tail - where the path ends |
|  UT  | U-Turn 		| 	6 	| Both cells have parallel live edges |
|  LC  | L-Corner 		| 	2 	| One dead cell, one corner cell |
|  LL  | L-Left 		| 	1	| Entry turns left |
|  LR  | L-Right 		| 	1 	| Entry turns right |
|  HL  | Horizontal Line| 	1	| Straight horizontal passage |
|  VL  | Vertical Line 	| 	1 	| One cell passes through, one dead |
|  DB  | Double-Back 	| 	1	| Both cells have parallel live edges (N/S or E/W) |
 
### 1.3 Tile Structure
Each tile consists of two cells:
- **Cell A**: The anchor cell (at position r, c)
- **Cell B**: The offset cell (position depends on rotation)

### 1.4 Rotation System
Tiles can be placed at 0°, 90°, 180°, or 270°. The rotation determines:
1. The position of Cell B relative to Cell A
2. The direction of live edges on each cell

**Cell B offset by rotation:**
- **0°**: B is to the RIGHT of A → (r, c+1)
- **90°**: B is BELOW A → (r+1, c)
- **180°**: B is to the LEFT of A → (r, c-1)
- **270°**: B is ABOVE A → (r-1, c)

---

## 2. Live Edge Definitions

Each cell has "live edges" - directions where the snake path connects. Adjacent cells must have matching edges (live connects to live, dead connects to dead).

### 2.1 Edge Directions
- **N** (North): Points up (row - 1)
- **S** (South): Points down (row + 1)
- **E** (East): Points right (column + 1)
- **W** (West): Points left (column - 1)

### 2.2 Live Edges by Tile Type

#### SH (Start) - 1 live edge total
| Rotation  | Cell A | Cell B |
|---------- |--------|--------|
| 0°	  	| (none) | 	  E   |
| 90° 		| (none) | 	  S   |
| 180° 		| (none) | 	  W   |
| 270° 		| (none) | 	  N	  |

#### ET (End) - 1 live edge total
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0° 		| (none) | 	  S   |
| 90° 		| (none) | 	  W   |
| 180° 		| (none) | 	  N   |
| 270° 		| (none) | 	  E   |

#### UT (U-Turn) - 2 parallel live edges
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0° 		| 	S	 | 	  S	  |
| 90° 		| 	W	 | 	  W   |
| 180° 		|	N 	 | 	  N   |
| 270° 		| 	E 	 | 	  E   |

#### LC (L-Corner) - 2 live edges (corner shape)
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0° 		| (none) | 	N, E  |
| 90° 		| (none) | 	E, S  |
| 180° 		| (none) | 	S, W  |
| 270° 		| (none) | 	W, N  |

#### LL (L-Left) - 2 live edges
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0° 		| 	S 	 | 	 E 	  |
| 90° 		| 	W 	 | 	 S    |
| 180° 		| 	N 	 | 	 W    |
| 270° 		| 	E 	 |	 N    |

#### LR (L-Right) - 2 live edges
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0° 		| 	N 	 |	  E   |
| 90° 		| 	E 	 |	  S   |
| 180° 		| 	S 	 |	  W   |
| 270° 		| 	W  	 |	  N   |

#### HL (Horizontal Line) - 2 opposite live edges
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0°		| 	W	 | 	  E   |
| 90° 		| 	N 	 | 	  S   |
| 180° 		| 	E 	 | 	  W   |
| 270° 		| 	S 	 | 	  N   |

#### VL (Vertical Line) - 2 live edges on one cell
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0° 		| 	N, S | (none) |
| 90° 		| 	E, W | (none) |
| 180° 		| 	S, N | (none) |
| 270° 		| 	W, E | (none) |

#### DB (Double-Back) - 4 live edges (2 per cell, parallel)
| Rotation 	| Cell A | Cell B |
|----------	|--------|--------|
| 0° 		| 	N, S | 	N, S  |
| 90° 		| 	E, W | 	E, W  |
| 180° 		| 	S, N | 	S, N  |
| 270° 		| 	W, E | 	W, E  |

---

## 3. Core Placement Rules

### Rule 1: Tile Availability
A tile can only be placed if there is at least one remaining instance of that tile type.

```
✓ PASS: UT remaining = 3, placing UT
✗ FAIL: LR remaining = 0, cannot place LR
```

### Rule 2: Boundary Constraint
All live edges must point to cells within the board. A tile cannot be placed if any live edge would point off the board.

```
Board is 6×5 (rows 0-5, columns 0-4)

✓ PASS: Tile at (2,2) with live edge N → points to (1,2) which is valid
✗ FAIL: Tile at (0,2) with live edge N → points to (-1,2) which is off board
✗ FAIL: Tile at (3,4) with live edge E → points to (3,5) which is off board
```

### Rule 3: No Overlap
Both cells of a tile must be within bounds and unoccupied.

```
✓ PASS: Placing at (2,2) deg 0 → cells (2,2) and (2,3) are both empty
✗ FAIL: Placing at (2,2) deg 0 → cell (2,3) already occupied
```

### Rule 4: Edge Matching (Continuous Snake)
Adjacent cells must have compatible edges:
- **Live edge** must connect to **live edge**
- **Dead edge** (no live edge) must connect to **dead edge**

```
Example: Tile at (2,2) has live edge pointing East
         Cell (2,3) must have a live edge pointing West

✓ PASS: Neighbor at (2,3) has W in its live edges
✗ FAIL: Neighbor at (2,3) does NOT have W (edge mismatch - red line!)
```

### Rule 5: Live Connection Required
Every tile (except the first) must connect to the existing snake via at least one live-to-live edge connection. Tiles cannot "float" disconnected from the path.

```
✓ PASS: New tile has live edge E, neighbor has live edge W → connected
✗ FAIL: New tile only touches neighbors via dead edges → disconnected
```

---

## 4. Advanced Validation Rules

### Rule 6: No Isolated Cells
After placing a tile, every adjacent empty cell must have at least one OTHER empty neighbor. This prevents creating single isolated cells that cannot be filled by a 2-cell domino.

```
Before placement: Cells (3,2) and (3,3) are empty
Placement would cover (3,3)

✓ PASS: Cell (3,2) still has empty neighbor at (3,1)
✗ FAIL: Cell (3,2) has no other empty neighbors → isolated → cannot be filled
```

### Rule 7: Even Region Sizes
All connected regions of empty cells must have an EVEN count. Since each tile covers 2 cells, an odd-sized region can never be completely filled.

```
After placement, empty cells form a region of 7 cells

✗ FAIL: 7 is odd → region cannot be filled with 2-cell dominoes
✓ PASS: Region has 8 cells → can potentially be filled
```

### Rule 8: Cell Requirements Satisfaction
For each adjacent empty cell, there must exist at least one remaining tile that can satisfy the cell's edge requirements when placed.

**Requirements are determined by placed neighbors:**
- If a neighbor has a live edge toward the cell → cell REQUIRES a live edge in that direction
- If a neighbor has a dead edge toward the cell → cell REQUIRES a dead edge (no live edge) in that direction

```
Cell (2,3) has:
- Neighbor at (2,2) with live edge E → requires live edge W
- Neighbor at (1,3) with dead edge S → requires dead edge N

✓ PASS: Some remaining tile can provide W=live, N=dead
✗ FAIL: No remaining tile can satisfy both requirements
```

### Rule 9: Deep Adjacent Cell Validation
When checking if an adjacent empty cell can be filled, the solver verifies that the candidate tile can satisfy BOTH:
1. The target cell's requirements
2. The OTHER cell of the tile's requirements

This prevents placing tiles that would create impossible configurations for their second cell.

```
Checking if cell (2,3) can be filled by tile X:
- Cell A of X at (2,3) satisfies requirements ✓
- Cell B of X would be at (2,4)
- Cell (2,4) has its own requirements from ITS neighbors
- Cell B's edges must ALSO satisfy (2,4)'s requirements

✓ PASS: Both cells can satisfy their respective requirements
✗ FAIL: Cell B cannot satisfy (2,4)'s requirements → tile X invalid here
```

---

## 5. Connectivity Pruning Rules

### Rule 10: Snake-to-End Reachability
The current snake tip must be able to reach the End tile (ET) entry point through empty cells. If the snake tip and ET entry are in disconnected regions, no solution is possible.

**Snake Tip**: The empty cell where the snake path needs to extend next (found by following the path from SH until hitting an empty cell)

**ET Entry**: The empty cell adjacent to ET where the snake must eventually connect

```
Snake tip at (3,2), ET entry at (1,4)

✓ PASS: BFS from (3,2) through empty cells reaches (1,4)
✗ FAIL: Empty cells don't form a connected path between them → PRUNE
```

### Rule 11: Dead End Detection
If the snake has no valid next move (tip at dead end) but tiles remain to be placed and ET isn't connected, the configuration is invalid.

```
Snake tip exhausted (no empty cell with matching edge)
Tiles remaining: 5
ET entry not yet connected

✗ FAIL: Dead end with tiles remaining → PRUNE
```

---

## 6. Solution Deduplication

### Rule 12: Edge-Based Hashing
Solutions are deduplicated based on the actual edges at each cell, not the specific tile/rotation used. This handles:
- Multiple identical tiles (6 UTs are interchangeable)
- Rotational symmetry (DB at 0° = DB at 180°)
- Anchor position equivalence (HL at (3,0) deg 90 = HL at (4,0) deg 270)

```
Two solutions with same edge pattern at every cell → considered duplicates
Only one is kept in the solution set
```

---

## 7. Algorithm Flow

### Path-Following Strategy

1. **Initialize**: Place SH (Start) and optionally ET (End) as initial placements
2. **Find Snake Tip**: Follow the path from SH until reaching an empty cell
3. **Get Options**: Find all tiles/rotations that can fill the tip cell
4. **Validate Each Option**: Apply all placement rules
5. **Place Best Option**: Add tile to board, update remaining counts
6. **Recurse**: Repeat from step 2
7. **Backtrack**: If stuck, remove last tile and try next option
8. **Solution Found**: When all cells filled and snake connects SH to ET

### Validation Order (for efficiency)

1. Tile availability check
2. Boundary constraint check
3. Overlap check
4. Edge matching check
5. Live connection check
6. Isolated cell check
7. Adjacent cell fillability check (deep validation)
8. Connectivity check (snake can reach ET)
9. Even region check
10. Remaining tiles can fill empty cells

---

## 8. Special Tile Behaviors

### DB (Double-Back) Tile
The DB tile has 4 live edges (2 on each cell, parallel). This creates unique constraints:
- When placed vertically (deg 90 or 270), both cells have E/W edges
- When placed horizontally (deg 0 or 180), both cells have N/S edges
- Often pairs with UT tiles in solutions due to complementary edge patterns

### VL (Vertical Line) Tile
- Has live edges on only ONE cell (Cell A)
- Cell B is completely dead (no live edges)
- Useful for terminating branches or creating pass-through paths

### SH and ET Tiles
- Each has exactly ONE live edge (on Cell B)
- SH: Path exits from Cell B
- ET: Path enters through Cell B
- These define the snake's start and end points

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **Live Edge** | A direction where the snake path connects |
| **Dead Edge** | No live edge in that direction |
| **Anchor (Cell A)** | The primary cell at position (r, c) |
| **Offset (Cell B)** | The secondary cell, position based on rotation |
| **Snake Tip** | The empty cell where the path needs to extend |
| **ET Entry** | The cell adjacent to ET where the snake must connect |
| **Footprint** | The two cells a tile occupies |
| **PRUNE** | Rejecting a placement early due to rule violation |
| **Backtrack** | Undoing a placement to try alternatives |

---

*Document generated for Snake Tile Puzzle Solution Finder*
*Version: Path-Following Algorithm with Deep Validation*
