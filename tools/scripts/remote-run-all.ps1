param(
  [int]$Parallel = 2,
  [int]$MaxTested = 0,
  [int]$ProgressEvery = 50,
  [int]$MaxSolPerLevel = 1,
  [string]$PaletteSpec = "data/levels/specs/create-levels-6x6-palette-v2.json",
  [switch]$Include6x6
)

$ErrorActionPreference = "Stop"

Write-Host @"
This launcher is NOT the 3-VM plan.

Use one script per VM (parallel defaults to 2):
  VM1  .\tools\scripts\remote-run-5x6-0b.ps1
  VM2  .\tools\scripts\remote-run-5x6-0c-qse1e2.ps1
  VM3  .\tools\scripts\remote-run-5x6-0c-crcqct.ps1

See tools/scripts/REMOTE_GENERATOR_README.md
"@

if (-not $Include6x6) {
  Write-Host "Refusing to run the old all-tiers chain (includes 6x6). Pass -Include6x6 only if you really want that."
  exit 2
}

function Run-Gen {
  param(
    [string]$ScriptPath,
    [string]$Tier,
    [string]$ReserveCodesFrom = ""
  )
  $args = @(
    $ScriptPath,
    "--tier", $Tier,
    "--parallel", $Parallel,
    "--progress-every", $ProgressEvery,
    "--max-sol-per-level", $MaxSolPerLevel,
    "--palette-spec", $PaletteSpec
  )
  if ($ReserveCodesFrom) { $args += @("--reserve-codes-from", $ReserveCodesFrom) }
  if ($MaxTested -gt 0) { $args += @("--max-tested", $MaxTested) }
  Write-Host "== $ScriptPath --tier $Tier =="
  node @args
}

Run-Gen "tools/scripts/generate-levels-5x6-0bc-from-palette.js" "0B" "data/levels/5x6-0B.json"
Run-Gen "tools/scripts/generate-levels-5x6-0bc-from-palette.js" "0C" "data/levels/5x6-0C.json"
Run-Gen "tools/scripts/generate-levels-6x6-from-palette.js" "0A"
Run-Gen "tools/scripts/generate-levels-6x6-from-palette.js" "0B"
Run-Gen "tools/scripts/generate-levels-6x6-from-palette.js" "0C"

Write-Host "All runs completed."
