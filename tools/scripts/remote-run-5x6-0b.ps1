<#
.SYNOPSIS
  VM1: generate 5x6-0B levels (parallel 2 — safe for small VMs).

.EXAMPLE
  .\tools\scripts\remote-run-5x6-0b.ps1
  .\tools\scripts\remote-run-5x6-0b.ps1 -MaxTested 50
#>
param(
  [int]$Parallel = 2,
  [int]$MaxTested = 0,
  [int]$ProgressEvery = 50,
  [int]$MaxSolPerLevel = 1,
  [string]$PaletteSpec = "data/levels/specs/create-levels-6x6-palette-v2.json",
  [string]$ReserveCodesFrom = "data/levels/5x6-0B.json"
)

$ErrorActionPreference = "Stop"

$args = @(
  "tools/scripts/generate-levels-5x6-0bc-from-palette.js",
  "--tier", "0B",
  "--parallel", $Parallel,
  "--progress-every", $ProgressEvery,
  "--max-sol-per-level", $MaxSolPerLevel,
  "--palette-spec", $PaletteSpec,
  "--reserve-codes-from", $ReserveCodesFrom
)
if ($MaxTested -gt 0) { $args += @("--max-tested", $MaxTested) }

Write-Host "== 5x6-0B (parallel=$Parallel) =="
Write-Host "node $($args -join ' ')"
node @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done."
Write-Host "  Levels: data/levels/generated/5x6-0B.generated.json"
Write-Host "  Solves: solves/generated/5x6-0B/"
