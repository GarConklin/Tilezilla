param(
  [int]$Parallel = 8,
  [int]$MaxTested = 0,
  [int]$ProgressEvery = 50,
  [int]$MaxSolPerLevel = 1,
  [string]$PaletteSpec = "data/levels/specs/create-levels-6x6-palette-v2.json"
)

$ErrorActionPreference = "Stop"

function Run-Gen {
  param(
    [string]$ScriptPath,
    [string]$Tier
  )
  $args = @(
    $ScriptPath,
    "--tier", $Tier,
    "--parallel", $Parallel,
    "--progress-every", $ProgressEvery,
    "--max-sol-per-level", $MaxSolPerLevel,
    "--palette-spec", $PaletteSpec
  )
  if ($MaxTested -gt 0) {
    $args += @("--max-tested", $MaxTested)
  }
  Write-Host "== $ScriptPath --tier $Tier =="
  node @args
}

Run-Gen "scripts/generate-levels-5x6-0bc-from-palette.js" "0B"
Run-Gen "scripts/generate-levels-5x6-0bc-from-palette.js" "0C"
Run-Gen "scripts/generate-levels-6x6-from-palette.js" "0A"
Run-Gen "scripts/generate-levels-6x6-from-palette.js" "0B"
Run-Gen "scripts/generate-levels-6x6-from-palette.js" "0C"

Write-Host "All runs completed."
