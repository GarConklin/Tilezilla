<#
.SYNOPSIS
  Import Adventure ranks + progression thresholds (legacy fn CSV).

.DESCRIPTION
  Prefer .\scripts\import-adventure-map.ps1 with data/adventure_solution_distribution.csv
  (single authoritative source for puzzles + progression + challenges).

  This script remains for the older adventure_solution_distribution-fn.csv workflow only.

.EXAMPLE
  .\scripts\import-adventure-progression.ps1
#>
param(
  [string]$RepoRoot = "",

  [string]$Csv = "data/adventure_solution_distribution-fn.csv",

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$mysqlStatus = & docker compose -f (Join-Path $RepoRoot "docker-compose.yml") ps mysql --format json 2>$null | ConvertFrom-Json
if (-not $mysqlStatus -or $mysqlStatus.State -ne "running") {
  throw "MySQL is not running. Start it with: docker compose up -d mysql"
}

$pyArgs = @("scripts/import-adventure-progression.py", "--csv", ($Csv -replace '\\', '/'))
if ($DryRun) { $pyArgs += "--dry-run" }

Write-Step "Import adventure progression"
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
