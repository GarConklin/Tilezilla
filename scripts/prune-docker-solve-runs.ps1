<#
.SYNOPSIS
  Free Docker Desktop resources after many "docker compose run" solve jobs.

.DESCRIPTION
  Long batch runs (e.g. run-may25-enumerate.ps1) create hundreds of stopped
  garz-puzzle-web-run-* containers. Docker Desktop on Windows often slows down
  until these are pruned or Docker is restarted.

.EXAMPLE
  .\scripts\prune-docker-solve-runs.ps1
#>
param(
  [string]$RepoRoot = "",
  [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Push-Location $RepoRoot
try {
  $stopped = @(docker ps -aq --filter "name=garz-puzzle-web-run" 2>$null)
  Write-Host "Stopped garz-puzzle-web-run containers: $($stopped.Count)"

  if ($WhatIf) {
    Write-Host "(WhatIf: would run docker container prune -f)"
    return
  }

  docker container prune -f 2>&1 | ForEach-Object { Write-Host $_ }
  Write-Host "Docker container prune done." -ForegroundColor Green
}
finally {
  Pop-Location
}
