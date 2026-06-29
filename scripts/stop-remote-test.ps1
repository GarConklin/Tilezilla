<#
.SYNOPSIS
  Stop the Tilezilla remote-test Docker stack.
#>
[CmdletBinding()]
param(
  [switch]$RemoveVolumes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ComposeFile = Join-Path $RepoRoot "docker-compose.remote-test.yml"
$EnvFile = Join-Path $RepoRoot ".env.remote-test"

if (-not (Test-Path $EnvFile)) {
  $EnvFile = Join-Path $RepoRoot ".env.remote-test.example"
}

Push-Location $RepoRoot
try {
  $args = @("compose", "-f", $ComposeFile, "--env-file", $EnvFile, "down")
  if ($RemoveVolumes) {
    $args += "-v"
  }

  Write-Host "Stopping remote test stack..." -ForegroundColor Cyan
  & docker @args
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose down failed (exit $LASTEXITCODE)"
  }

  if ($RemoveVolumes) {
    Write-Host "Removed containers and shared MySQL volume tilezilla_shared_mysql_data." -ForegroundColor Red
    Write-Host "WARNING: All registered accounts and game DB rows in that volume are gone." -ForegroundColor Red
  }
  else {
    Write-Host "Stopped. MySQL data volume preserved." -ForegroundColor Green
  }
}
finally {
  Pop-Location
}
