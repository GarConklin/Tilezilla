<#
.SYNOPSIS
  Import Adventure puzzle map from CSV into MySQL.

.DESCRIPTION
  Reads data/adventure_solution_distribution.csv (single authoritative source).
  CH-lvl=T marks step boundaries; progression steps from data/LevelSystem.csv.

  Populates adventure_rank, adventure_progression, and adventure_puzzle.

.EXAMPLE
  .\scripts\import-adventure-map.ps1

.EXAMPLE
  .\scripts\import-adventure-map.ps1 -DryRun
#>
param(
  [string]$RepoRoot = "",

  [string]$Csv = "data/adventure_solution_distribution.csv",

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

. (Join-Path $PSScriptRoot "lib\Mysql-Docker.ps1")

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

Ensure-MySqlTilegameReady -RepoRoot $RepoRoot

$pyArgs = @(
  "scripts/import-adventure-map.py",
  "--csv", ($Csv -replace '\\', '/')
)
if ($DryRun) { $pyArgs += "--dry-run" }

Write-Step "Import adventure puzzle map"
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
