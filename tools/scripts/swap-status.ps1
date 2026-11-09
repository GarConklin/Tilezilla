<#
.SYNOPSIS
  What is solved and what is left in the swap puzzles. Safe to run any time, even during a night run.

.DESCRIPTION
  From the Tilezilla repo root:

    .\tools\scripts\swap-status.ps1

  Prints solved and waiting per board size and the recent solver runs, and writes
  tools\data\solver-runs\swap-named\status\solved.txt (name and solution count)
  and waiting.txt (smallest boards first).
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
& python (Join-Path $PSScriptRoot "swap-batch.py") status
