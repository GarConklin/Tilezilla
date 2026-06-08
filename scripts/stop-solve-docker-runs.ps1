<#
.SYNOPSIS
  Stop running solve / enumerate Docker containers immediately.

.DESCRIPTION
  run-may25-enumerate.ps1 and Ctrl+C often feel "stuck" because the current
  docker compose run must finish (or be killed) before PowerShell exits.

  This script force-stops all running garz-puzzle-web-run-* containers.

.EXAMPLE
  .\scripts\stop-solve-docker-runs.ps1

.EXAMPLE
  .\scripts\stop-solve-docker-runs.ps1 -ThenPrune
#>
param(
  [string]$RepoRoot = "",
  [switch]$WhatIf,
  [switch]$ThenPrune
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Push-Location $RepoRoot
try {
  $running = @(docker ps --filter "name=garz-puzzle-web-run" --format "{{.ID}} {{.Names}} {{.Status}}" 2>$null)
  if ($running.Count -eq 0 -or [string]::IsNullOrWhiteSpace($running[0])) {
    Write-Host "No running garz-puzzle-web-run containers." -ForegroundColor Green
  }
  else {
    Write-Host "Running containers to stop:" -ForegroundColor Yellow
    $running | ForEach-Object { Write-Host "  $_" }
    foreach ($line in $running) {
      if ([string]::IsNullOrWhiteSpace($line)) { continue }
      $id = ($line -split '\s+', 2)[0]
      if ($WhatIf) {
        Write-Host "(WhatIf: docker kill $id)"
        continue
      }
      docker kill $id 2>&1 | Out-Null
      Write-Host "Killed $id" -ForegroundColor Green
    }
  }

  if ($ThenPrune -and -not $WhatIf) {
    & (Join-Path $PSScriptRoot "prune-docker-solve-runs.ps1") -RepoRoot $RepoRoot
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "If PowerShell is still hung, press Ctrl+C again or close that terminal window." -ForegroundColor DarkGray
