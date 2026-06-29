<#
.SYNOPSIS
  Refresh cached global stats in tilegame.system_info (hourly task).

.EXAMPLE
  .\scripts\refresh-system-stats.ps1

.EXAMPLE
  .\scripts\refresh-system-stats.ps1 -Force
#>
param(
  [string]$RepoRoot = "",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$composeFile = Join-Path $RepoRoot "docker-compose.remote-test.yml"
if (-not (Test-Path $composeFile)) {
  $composeFile = Join-Path $RepoRoot "docker-compose.yml"
}

$pyCmd = "pip install -q pymysql && python scripts/refresh-system-stats.py"
if ($Force) { $pyCmd += " --force" }

Push-Location $RepoRoot
try {
  $runningWeb = docker compose -f $composeFile ps web --format "{{.State}}" 2>$null
  if ($runningWeb -eq "running") {
    & docker compose -f $composeFile exec -T `
      -e MYSQL_HOST=mysql `
      -e MYSQL_PORT=3306 `
      -e MYSQL_USER=tilegame `
      -e MYSQL_PASSWORD=tilegame_dev `
      -e MYSQL_DATABASE=tilegame `
      web sh -c $pyCmd
  }
  else {
    & docker compose -f $composeFile run --rm `
      -e MYSQL_HOST=mysql `
      -e MYSQL_PORT=3306 `
      -e MYSQL_USER=tilegame `
      -e MYSQL_PASSWORD=tilegame_dev `
      -e MYSQL_DATABASE=tilegame `
      web sh -c $pyCmd
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}
