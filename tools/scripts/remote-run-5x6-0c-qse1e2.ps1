<#
.SYNOPSIS
  VM2: generate 5x6-0C levels with QS/E1/E2 only (no CR/CQ/CT). Parallel 2.

.EXAMPLE
  .\tools\scripts\remote-run-5x6-0c-qse1e2.ps1
  .\tools\scripts\remote-run-5x6-0c-qse1e2.ps1 -MaxTested 50
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
  "tools/scripts/generate-levels-5x6-0c-qse1e2-from-palette.js",
  "--tier", "0C",
  "--parallel", $Parallel,
  "--progress-every", $ProgressEvery,
  "--max-sol-per-level", $MaxSolPerLevel,
  "--palette-spec", $PaletteSpec,
  "--reserve-codes-from", $ReserveCodesFrom,
  "--out-levels", "data/levels/generated/5x6-0C-qse1e2.generated.json",
  "--out-solves-dir", "solves/generated/5x6-0C-qse1e2"
)
if ($MaxTested -gt 0) { $args += @("--max-tested", $MaxTested) }

Write-Host "== 5x6-0C QS/E1/E2 only (parallel=$Parallel) =="
Write-Host "node $($args -join ' ')"
node @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done."
Write-Host "  Levels: data/levels/generated/5x6-0C-qse1e2.generated.json"
Write-Host "  Solves: solves/generated/5x6-0C-qse1e2/"
