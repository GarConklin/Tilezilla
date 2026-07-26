<#
.SYNOPSIS
  Remote overnight run: generate 5x6-0C levels that include CR, CQ, or CT.

.DESCRIPTION
  Same style as remote-run-all.ps1 / the 5x6-0B generator, but only 5x6-0C and
  only bags that contain at least one of CR, CQ, or CT.

  Run from repo root on the remote host.

.EXAMPLE
  .\tools\scripts\remote-run-5x6-0c-crcqct.ps1

.EXAMPLE
  .\tools\scripts\remote-run-5x6-0c-crcqct.ps1 -Parallel 12 -MaxTested 5000

.EXAMPLE
  .\scripts\remote-run-5x6-0c-crcqct.ps1
#>
param(
  [int]$Parallel = 8,
  [int]$MaxTested = 0,
  [int]$ProgressEvery = 50,
  [int]$MaxSolPerLevel = 1,
  [string]$PaletteSpec = "data/levels/specs/create-levels-6x6-palette-v2.json",
  [string]$ReserveCodesFrom = "data/levels/5x6-0C.json"
)

$ErrorActionPreference = "Stop"

$script = "tools/scripts/generate-levels-5x6-0c-crcqct-from-palette.js"
$args = @(
  $script,
  "--tier", "0C",
  "--parallel", $Parallel,
  "--progress-every", $ProgressEvery,
  "--max-sol-per-level", $MaxSolPerLevel,
  "--palette-spec", $PaletteSpec,
  "--reserve-codes-from", $ReserveCodesFrom
)
if ($MaxTested -gt 0) {
  $args += @("--max-tested", $MaxTested)
}

Write-Host "== 5x6-0C with CR/CQ/CT (parallel=$Parallel) =="
Write-Host "node $($args -join ' ')"
node @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done."
Write-Host "  Levels: data/levels/generated/5x6-0C.generated.json"
Write-Host "  Solves: solves/generated/5x6-0C/"
Write-Host "Promote later with: node tools/scripts/promote-0c-generated.js"
