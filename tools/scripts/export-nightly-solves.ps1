<#
.SYNOPSIS
  Write the nightly results as a record-many file for the old copy's ledger. Never writes to the old copy.

    .\tools\scripts\export-nightly-solves.ps1

  Prints the folder it made and the two commands to run in the old copy (copy solutions, then record-many).
#>
param([string]$OldRepo = "C:\Users\~Gar\Tile-Puzzle\Tilezilla")

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot
& node tools/scripts/nightly-solves.js export --old $OldRepo
