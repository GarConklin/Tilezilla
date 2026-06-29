<#
.SYNOPSIS
  Merge WordsOnline.users into tilegame.users (one-time upgrade).

.DESCRIPTION
  1. Applies auth columns to tilegame.users (16-tilegame-auth-users.sql)
  2. Copies accounts from WordsOnline if that database exists
  Preserves numeric user ids (localStorage tilezilla_user_id unchanged).

.EXAMPLE
  .\scripts\migrate-auth-to-tilegame.ps1
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

$composeFile = Join-Path $RepoRoot "docker-compose.yml"
$mysqlStatus = & docker compose -f $composeFile ps mysql --format json 2>$null | ConvertFrom-Json
if (-not $mysqlStatus -or $mysqlStatus.State -ne "running") {
  throw "MySQL is not running. Start with: docker compose up -d mysql"
}

$rootPass = if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { "root_dev_change_me" }

function Invoke-MysqlRootFile([string]$SqlPath) {
  $rel = $SqlPath.Substring($RepoRoot.Length).TrimStart('\', '/')
  Write-Host "mysql (root) < $rel" -ForegroundColor Cyan
  if ($DryRun) {
    Write-Host "(dry run - skipped)" -ForegroundColor Yellow
    return
  }
  Push-Location $RepoRoot
  try {
    Get-Content -Raw -Encoding UTF8 $SqlPath | docker compose -f $composeFile exec -T mysql `
      mysql "-uroot" "-p$rootPass"
    if ($LASTEXITCODE -ne 0) {
      throw "mysql failed for $rel (exit $LASTEXITCODE)"
    }
  }
  finally {
    Pop-Location
  }
}

Write-Host "Tilezilla auth migration: WordsOnline -> tilegame" -ForegroundColor Green
Invoke-MysqlRootFile (Join-Path $RepoRoot "docker\mysql\init\16-tilegame-auth-users.sql")
Invoke-MysqlRootFile (Join-Path $RepoRoot "scripts\migrate-auth-to-tilegame.sql")
Write-Host "Done. Restart php-auth: docker compose up -d php-auth" -ForegroundColor Green
