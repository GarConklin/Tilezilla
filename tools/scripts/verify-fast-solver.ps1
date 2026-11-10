<#
.SYNOPSIS
  Check the fast solver against puzzles the old copy already solved (counts and layouts).

.DESCRIPTION
  From C:\Tilezilla-Test:

    .\tools\scripts\verify-fast-solver.ps1
    .\tools\scripts\verify-fast-solver.ps1 -Parallel 2 -Ids 5x6-0A-0000,5x5-0B-0001

  Reads the old copy read-only. Log: tools\data\solver-runs\nightly\verify\verify-<stamp>.log
#>
param(
  [int]$Parallel = 2,
  [string]$Ids = "",
  [string]$OldRepo = "C:\Users\~Gar\Tile-Puzzle\Tilezilla"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot
$host.UI.RawUI.WindowTitle = "TileZilla - verify fast solver vs old results"
$logDir = Join-Path $RepoRoot "tools\data\solver-runs\nightly\verify"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$log = Join-Path $logDir ("verify-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

$nodeArgs = @("tools/scripts/verify-fast-solver.js", "--old", $OldRepo, "--parallel", "$Parallel")
if ($Ids) { $nodeArgs += @("--ids", $Ids) }
Write-Host "Log: $log" -ForegroundColor Cyan
& node @nodeArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $log
Write-Host "[verify] finished (exit $LASTEXITCODE). Log: $log" -ForegroundColor Green
