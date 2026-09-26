<#
.SYNOPSIS
  VM3: generate 5x6-0C levels that include CR, CQ, or CT. Parallel 2.

.DESCRIPTION
  Only bags with at least one of CR, CQ, or CT. Writes to separate paths so
  VM2 (QS/E1/E2) does not collide. Skips bags already in 5x6-0C.json.

.EXAMPLE
  .\tools\scripts\remote-run-5x6-0c-crcqct.ps1
  .\tools\scripts\remote-run-5x6-0c-crcqct.ps1 -MaxTested 50
#>
param(
  [int]$Parallel = 2,
  [int]$MaxTested = 0,
  [int]$ProgressEvery = 50,
  [int]$MaxSolPerLevel = 1,
  [string]$PaletteSpec = "data/levels/specs/create-levels-6x6-palette-v2.json",
  [string]$ReserveCodesFrom = "data/levels/5x6-0C.json"
)

$ErrorActionPreference = "Stop"

$args = @(
  "tools/scripts/generate-levels-5x6-0c-crcqct-from-palette.js",
  "--tier", "0C",
  "--parallel", $Parallel,
  "--progress-every", $ProgressEvery,
  "--max-sol-per-level", $MaxSolPerLevel,
  "--palette-spec", $PaletteSpec,
  "--reserve-codes-from", $ReserveCodesFrom,
  "--out-levels", "data/levels/generated/5x6-0C-crcqct.generated.json",
  "--out-solves-dir", "solves/generated/5x6-0C-crcqct"
)
if ($MaxTested -gt 0) { $args += @("--max-tested", $MaxTested) }

Write-Host "== 5x6-0C with CR/CQ/CT (parallel=$Parallel) =="
Write-Host "node $($args -join ' ')"
node @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done."
Write-Host "  Levels: data/levels/generated/5x6-0C-crcqct.generated.json"
Write-Host "  Solves: solves/generated/5x6-0C-crcqct/"
Write-Host "Promote later with: node tools/scripts/promote-0c-generated.js"
