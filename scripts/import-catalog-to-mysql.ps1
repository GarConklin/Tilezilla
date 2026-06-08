<#
.SYNOPSIS
  Import catalog levels (+ optional daily schedule) into MySQL tilegame.

.DESCRIPTION
  - Upserts all rows from data/levels/levels.json into `levels`
  - total_unique_solutions from solves/*.json (fallback: catalog field)
  - daily_eligible synced from daily_challenges (TRUE = daily-only, excluded from adventure)

.EXAMPLE
  .\scripts\import-catalog-to-mysql.ps1 -SyncDailyEligible
  - Upserts data/daily_challenges_import.csv into daily_challenges

  Canonical solve layouts remain in solves/*.json (not stored in MySQL V1).

.EXAMPLE
  .\scripts\import-catalog-to-mysql.ps1

.EXAMPLE
  .\scripts\import-catalog-to-mysql.ps1 -DryRun

.EXAMPLE
  .\scripts\import-catalog-to-mysql.ps1 -LevelsOnly
#>
param(
  [string]$RepoRoot = "",

  [switch]$DryRun,

  [switch]$LevelsOnly,

  [switch]$DailyOnly,

  [switch]$SyncDailyEligible
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

. (Join-Path $PSScriptRoot "lib\Docker-Web.ps1")

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-SolvesFolder {
  param([string]$Root)

  $solvesDir = Join-Path $Root "solves"
  $zipPath = Join-Path $Root "solves.zip"

  if (-not (Test-Path $solvesDir)) {
    New-Item -ItemType Directory -Path $solvesDir -Force | Out-Null
  }

  $jsonCount = @(Get-ChildItem -Path $solvesDir -Filter "*.json" -File -ErrorAction SilentlyContinue).Count
  if ($jsonCount -ge 500) {
    Write-Host "solves/ has $jsonCount json files — skip zip extract."
    return
  }

  if (-not (Test-Path $zipPath)) {
    throw "solves/ has only $jsonCount files and solves.zip is missing."
  }

  Write-Step "Extracting solves.zip into solves/"
  Expand-Archive -Path $zipPath -DestinationPath $solvesDir -Force
  $after = @(Get-ChildItem -Path $solvesDir -Filter "*.json" -File).Count
  Write-Host "solves/ now has $after json files."
}

if (-not (Test-DockerCompose -RepoRoot $RepoRoot)) {
  throw "docker compose not available"
}

$mysqlStatus = & docker compose -f (Join-Path $RepoRoot "docker-compose.yml") ps mysql --format json 2>$null | ConvertFrom-Json
if ($mysqlStatus.State -ne "running") {
  throw "MySQL is not running. Start it with: docker compose up -d mysql"
}

Ensure-SolvesFolder -Root $RepoRoot

$pyArgs = @("scripts/import-catalog-to-mysql.py")
if ($DryRun) { $pyArgs += "--dry-run" }
if ($LevelsOnly) { $pyArgs += "--levels-only" }
if ($DailyOnly) { $pyArgs += "--daily-only" }
if ($SyncDailyEligible) { $pyArgs += "--sync-daily-eligible" }

Write-Step "Import catalog to MySQL (via web container -> mysql service)"
Push-Location $RepoRoot
try {
  $dockerArgs = @(
    "compose", "run", "--rm",
    "-e", "MYSQL_HOST=mysql",
    "-e", "MYSQL_PORT=3306",
    "-e", "MYSQL_USER=tilegame",
    "-e", "MYSQL_PASSWORD=tilegame_dev",
    "-e", "MYSQL_DATABASE=tilegame",
    "web",
    "sh", "-c",
    ("pip install -q pymysql && python {0}" -f ($pyArgs -join ' '))
  )
  Write-Host ("docker " + ($dockerArgs -join ' '))
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Import failed (exit $LASTEXITCODE)"
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
