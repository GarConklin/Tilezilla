<#
.SYNOPSIS
  Seed gar / Arn dev accounts into the remote-test MySQL stack.
#>
[CmdletBinding()]
param(
  [string]$ComposeFile = "",
  [string]$EnvFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $ComposeFile) {
  $ComposeFile = Join-Path $RepoRoot "docker-compose.remote-test.yml"
}
if (-not $EnvFile) {
  $EnvFile = Join-Path $RepoRoot ".env.remote-test"
}

function Invoke-MysqlSql {
  param([string]$SqlPath)

  $rel = $SqlPath.Substring($RepoRoot.Length).TrimStart('\', '/')
  Write-Host "mysql <$rel" -ForegroundColor DarkGray
  Get-Content -Raw -Encoding UTF8 $SqlPath | docker compose -f $ComposeFile --env-file $EnvFile exec -T mysql `
    mysql -utilegame -ptilegame_dev
  if ($LASTEXITCODE -ne 0) {
    throw "mysql failed for $rel (exit $LASTEXITCODE)"
  }
}

Push-Location $RepoRoot
try {
  Invoke-MysqlSql -SqlPath (Join-Path $RepoRoot "scripts\seed-dev-users.sql")
  Invoke-MysqlSql -SqlPath (Join-Path $RepoRoot "scripts\seed-dev-words-users.sql")
  Write-Host "Seeded gar/gar, Arn/arn, and test/test for remote-test auth." -ForegroundColor Green
}
finally {
  Pop-Location
}
