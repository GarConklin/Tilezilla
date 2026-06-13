Docs/New Plan/Tilezilla-Hamburger-Menu-Specification.md

# Tilezilla Hamburger Menu Specification

## Purpose

Provide access to puzzle information, player assistance, previously discovered solutions, and game settings without cluttering the main gameplay toolbar.

The bottom toolbar should remain focused on active gameplay actions.

---

# Hamburger Menu Structure

Menu Icon:

```text
☰
```

Menu Contents:

```text
Puzzle Info

View Found Solutions

I'm Stuck

Hint Rules

Settings
```

Order should remain consistent throughout the game.

---

# Puzzle Info

Displays information about the current puzzle.

Examples:

```text
Puzzle ID
Puzzle Size
Challenge Status
Total Solutions Available
Solutions Found
```

Example:

```text
Puzzle: 5x6-0B-AAI

Challenge Puzzle

Solutions Found:
8 of 19
```

---

# View Found Solutions

## Purpose

Allow players to review solutions they have already discovered.

This is intended to help players identify patterns and discover additional solutions.

---

## Rules

Only previously discovered solutions may be viewed.

Never reveal undiscovered solutions.

---

## Example

Puzzle contains:

```text
19 solutions
```

Player has found:

```text
Solution #1
Solution #4
Solution #7
Solution #8
```

Display:

```text
Found Solutions

4 of 19 Found

Solution #1

Solution #4

Solution #7

Solution #8
```

---

## Solution Preview

Selecting a discovered solution displays:

```text
Mini Route Preview
```

The preview should show:

```text
Completed route shape
```

The preview should NOT show:

```text
Tile IDs
Tile Borders
Tile Rotations
Hotspots
Internal Tile Information
```

Purpose:

Allow players to study route patterns without exposing full solution construction details.

---

# I'm Stuck

## Purpose

Provide assistance when a player cannot solve a puzzle.

This is separate from the Hint System.

---

## Workflow

Player selects:

```text
I'm Stuck
```

Display confirmation:

```text
Would you like to view an example route?

This puzzle will not be marked as completed.

No rewards or progression will be awarded.

[Keep Trying]

[Show Example Route]
```

---

## Example Route

Display:

```text
One Example Solution
```

using a miniature route preview.

The preview should show:

```text
Completed route shape
```

The preview should NOT show:

```text
Tile IDs
Tile Borders
Tile Rotations
Hotspots
Internal Tile Information
```

---

## Progression Impact

Puzzle is marked:

```text
Viewed Example Route
```

Puzzle is NOT marked:

```text
Completed
```

Player receives:

```text
No Hint Tokens
No Progress Credit
No Achievements
No Rank Progress
```

Player may continue attempting the puzzle afterward.

---

# Hint Rules

Displays Hint System information.

Include:

```text
Hint Types

Random Tile
Reveal Start Tile
Reveal End Tile

Hint Costs

Puzzle Hint Limits

Hint Availability Rules
```

This screen is informational only.

---

# Settings

Provides access to player settings.

Includes:

```text
Live Edge Validation

Tile Border Display

Used Tile Handling

Additional Future Settings
```

Settings are stored in SQL and follow the player account across devices.

---

# Design Principles

1. Keep gameplay controls on the main toolbar.
2. Keep assistance and informational features in the hamburger menu.
3. Never reveal undiscovered solutions.
4. Reward discovery while preserving puzzle challenge.
5. Allow struggling players to continue without becoming permanently blocked.
6. Maintain consistency across Adventure, Challenge, and Postgame modes.

```
```
