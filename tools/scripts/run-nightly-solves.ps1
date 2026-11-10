<#
.SYNOPSIS
  Nightly fast solver run on this PC. You run this from C:\Tilezilla-Test.

.DESCRIPTION
    .\tools\scripts\run-nightly-solves.ps1 -Workers 8 -Until "2026-11-11 07:00"

  1. Imports the waiting list from the old copy (read-only): pending puzzles and their specs, minus everything
     the old ledger already has. Re-running picks up new pending/done items.
  2. Solves the pair-swap drafts first, then the old waiting list smallest boards first (5x6-0A, then 5x6-0B).
     Plain Node on Windows, no Docker, no ports, so it never touches the old run's containers.
  3. Saves every result the moment it finishes, so closing the window loses at most the puzzles in progress.
     Run the same command again to carry on.

  Stop starting new puzzles at -Until; puzzles still running get -GraceMinutes to finish, then go back in the queue.
  Ctrl+C stops at once (puzzles in progress go back in the queue).
  From another window:
    .\tools\scripts\run-nightly-solves.ps1 -Stop      finish the puzzles in progress, then stop
    .\tools\scripts\watch-nightly-solves.ps1          live view
    .\tools\scripts\export-nightly-solves.ps1         file for the old ledger (record-many)

  -Limit / -PerGroup cap how many puzzles this run starts (for test runs).
#>
param(
  [int]$Workers = 8,
  [string]$Until = "",
  [int]$Limit = 0,
  [int]$PerGroup = 0,
  [double]$GraceMinutes = 10,
  [double]$TimeoutMinutes = 60,
  [switch]$RetryFailed,
  [switch]$SkipImport,
  [switch]$SkipOldRunResults,
  [switch]$Stop,
  [string]$OldRepo = "C:\Users\~Gar\Tile-Puzzle\Tilezilla"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot
$script = "tools/scripts/nightly-solves.js"

if ($Stop) { & node $script stop; exit $LASTEXITCODE }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed (needed to run the solver). Install it from https://nodejs.org and try again." -ForegroundColor Red
  exit 1
}

$untilArg = @()
if (-not [string]::IsNullOrWhiteSpace($Until)) {
  $deadline = [datetime]::ParseExact($Until.Trim(), "yyyy-MM-dd HH:mm", [Globalization.CultureInfo]::InvariantCulture)
  if ($deadline -le (Get-Date)) { throw "Until time is already past: $Until" }
  $untilArg = @("--until", $deadline.ToString("o"))
}

$host.UI.RawUI.WindowTitle = "TileZilla nightly solves ($Workers workers$(if ($Until) { ", until $Until" }))"
$stateDir = Join-Path $RepoRoot "tools\data\solver-runs\nightly"
New-Item -ItemType Directory -Path (Join-Path $stateDir "logs") -Force | Out-Null

if (-not $SkipImport) {
  $importLog = Join-Path $stateDir ("logs\import-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
  Write-Host "Step 1/2: importing the waiting list from the old copy (read-only)..." -ForegroundColor Cyan
  $importArgs = @($script, "import", "--old", $OldRepo)
  if ($SkipOldRunResults) { $importArgs += "--skip-old-run-results" }
  & node @importArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $importLog
  if ($LASTEXITCODE -ne 0) { Write-Host "Import failed (see $importLog)." -ForegroundColor Red; exit 1 }
}

Write-Host "Step 2/2: solving..." -ForegroundColor Cyan
$runArgs = @($script, "run", "--workers", "$Workers", "--grace-min", "$GraceMinutes", "--timeout-min", "$TimeoutMinutes") + $untilArg
if ($Limit -gt 0) { $runArgs += @("--limit", "$Limit") }
if ($PerGroup -gt 0) { $runArgs += @("--per-group", "$PerGroup") }
if ($RetryFailed) { $runArgs += "--retry-failed" }
& node @runArgs
& node $script status
