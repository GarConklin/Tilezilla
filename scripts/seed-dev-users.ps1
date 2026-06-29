<#
.SYNOPSIS
  Seed dev users Gar (newbie) and Arn (Adventure L4-1) into tilegame.

.DESCRIPTION
  Gar  — username gar, password gar, all stats 0, Adventure L1-1
  Arn  — username Arn, password arn, Adventure L4-1 (1141 puzzles through L3-10)

  Prerequisites:
    docker compose up -d mysql
    .\scripts\import-catalog-to-mysql.ps1
    .\scripts\import-adventure-map.ps1
    For existing volumes with WordsOnline accounts: .\scripts\migrate-auth-to-tilegame.ps1

.EXAMPLE
  .\scripts\seed-dev-users.ps1
#>
param(
  [string]$RepoRoot = "",

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

function Invoke-MysqlFile {
  param(
    [string]$ComposeFile,
    [string]$Service,
    [string]$SqlPath,
    [string]$User = "tilegame",
    [string]$Password = "tilegame_dev",
    [string]$Database = "tilegame"
  )

  $rel = $SqlPath.Substring($RepoRoot.Length).TrimStart('\', '/')
  Write-Host "mysql <$rel" -ForegroundColor DarkGray

  if ($DryRun) {
    Write-Host "(dry run — skipped)" -ForegroundColor Yellow
    return
  }

  Push-Location $RepoRoot
  try {
    Get-Content -Raw -Encoding UTF8 $SqlPath | docker compose -f $ComposeFile exec -T $Service `
      mysql "-u$User" "-p$Password" $Database
    if ($LASTEXITCODE -ne 0) {
      throw "mysql failed for $rel (exit $LASTEXITCODE)"
    }
  }
  finally {
    Pop-Location
  }
}

$composeTile = Join-Path $RepoRoot "docker-compose.yml"
$mysqlStatus = & docker compose -f $composeTile ps mysql --format json 2>$null | ConvertFrom-Json
if (-not $mysqlStatus -or $mysqlStatus.State -ne "running") {
  throw "MySQL is not running. Start it with: docker compose up -d mysql"
}

Write-Step "Seed tilegame dev users (Gar + Arn)"
Invoke-MysqlFile `
  -ComposeFile $composeTile `
  -Service "mysql" `
  -SqlPath (Join-Path $RepoRoot "scripts\seed-dev-users.sql")

Write-Step "Done"
Write-Host @"

Dev accounts:
  Gar  — username: gar   password: gar   (newbie, L1-1, stats 0)
  Arn  — username: Arn   password: arn   (Adventure L4-1)

"@ -ForegroundColor Green
