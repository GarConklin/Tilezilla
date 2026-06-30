<#
.SYNOPSIS
  Export Tilezilla database + deploy bundle for Ubuntu / VPS.

.DESCRIPTION
  Creates a timestamped folder under deploy-export/ with:
    - tilegame.sql          (MySQL dump from Docker)
    - manifest.json         (git commit, export time, file list)
    - .env.production.example (template — edit on server)
    - solves.zip            (optional, large)

  After your last local changes, run this, copy the folder to the server,
  then run scripts/restore-on-ubuntu.sh on Ubuntu.

.EXAMPLE
  .\scripts\export-for-deploy.ps1

.EXAMPLE
  .\scripts\export-for-deploy.ps1 -IncludeSolves -IncludeEnv
#>
[CmdletBinding()]
param(
  [string]$OutputRoot = "",
  [switch]$IncludeSolves,
  [switch]$IncludeEnv
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutputRoot) {
  $OutputRoot = Join-Path $RepoRoot "deploy-export"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutDir = Join-Path $OutputRoot $stamp
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

function Read-EnvValue([string]$Key, [string]$Default = "") {
  foreach ($file in @(".env.production", ".env.remote-test", ".env")) {
    $path = Join-Path $RepoRoot $file
    if (-not (Test-Path $path)) { continue }
    foreach ($line in Get-Content $path) {
      if ($line -match "^\s*$Key=(.*)$") {
        return $Matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }
  return $Default
}

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

Write-Step "Export directory: $OutDir"

$mysqlContainer = "garz-puzzle-mysql"
$running = docker ps --filter "name=$mysqlContainer" --format "{{.Names}}" 2>$null
if (-not $running) {
  throw "MySQL container '$mysqlContainer' is not running. Start: docker compose up -d mysql"
}

$rootPass = Read-EnvValue "MYSQL_ROOT_PASSWORD" "root_dev_change_me"
$dbName = Read-EnvValue "MYSQL_DATABASE" "tilegame"

Write-Step "Dumping database '$dbName'..."
$sqlPath = Join-Path $OutDir "tilegame.sql"
docker exec $mysqlContainer mysqldump -uroot -p"$rootPass" --single-transaction --routines --triggers $dbName `
  | Out-File -FilePath $sqlPath -Encoding utf8

if (-not (Test-Path $sqlPath) -or (Get-Item $sqlPath).Length -lt 100) {
  throw "SQL dump looks empty. Check MYSQL_ROOT_PASSWORD and container logs."
}

Copy-Item (Join-Path $RepoRoot ".env.production.example") (Join-Path $OutDir ".env.production.example") -Force

if ($IncludeEnv) {
  foreach ($name in @(".env.production", ".env.remote-test", ".env")) {
    $src = Join-Path $RepoRoot $name
    if (Test-Path $src) {
      Copy-Item $src (Join-Path $OutDir $name) -Force
      Write-Host "Included $name (contains secrets — protect this export folder)." -ForegroundColor Yellow
      break
    }
  }
}

if ($IncludeSolves) {
  $solvesZip = Join-Path $RepoRoot "solves.zip"
  if (Test-Path $solvesZip) {
    Write-Step "Copying solves.zip (may take a while)..."
    Copy-Item $solvesZip (Join-Path $OutDir "solves.zip") -Force
  }
  else {
    Write-Host "solves.zip not found — skip or add manually." -ForegroundColor Yellow
  }
}

$gitCommit = ""
try {
  Push-Location $RepoRoot
  $gitCommit = (git rev-parse HEAD 2>$null)
}
finally {
  Pop-Location
}

$manifest = [ordered]@{
  exportedAt = (Get-Date).ToUniversalTime().ToString("o")
  gitCommit = $gitCommit
  database = $dbName
  files = @(Get-ChildItem $OutDir -File | ForEach-Object { $_.Name })
  restoreHint = "On Ubuntu: git pull, copy this folder, run ./scripts/restore-on-ubuntu.sh $stamp"
  productionUrl = "https://tile.skifflakegames.com"
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $OutDir "manifest.json") -Encoding UTF8

Write-Host ""
Write-Host "Export complete." -ForegroundColor Green
Write-Host "  Folder: $OutDir"
Write-Host "  SQL:    $([math]::Round((Get-Item $sqlPath).Length / 1MB, 2)) MB"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Finish minor local changes, commit, push to GitHub"
Write-Host "  2. scp -r `"$OutDir`" user@your-server:/opt/tilezilla/deploy-import/"
Write-Host "  3. On server: see Docs/deploy-ubuntu.md"
Write-Host ""
