<#
.SYNOPSIS
  Start the production Docker stack locally (full repo checkout).

.DESCRIPTION
  Uses docker-compose.production.yml with game/Dockerfile (no full-repo bind mount).
  Requires .env.production — copy from .env.production.example and set:
    PROD_WEB_DOCKERFILE=game/Dockerfile

.EXAMPLE
  .\scripts\start-production-stack.ps1
#>
param(
  [string]$RepoRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$envFile = Join-Path $RepoRoot ".env.production"
if (-not (Test-Path $envFile)) {
  throw "Missing $envFile — copy .env.production.example and set PROD_WEB_DOCKERFILE=game/Dockerfile"
}

Push-Location $RepoRoot
try {
  if (-not (docker volume inspect tilezilla_shared_mysql_data 2>$null)) {
    docker volume create tilezilla_shared_mysql_data | Out-Null
    Write-Host "Created volume tilezilla_shared_mysql_data"
  }

  $env:PROD_WEB_DOCKERFILE = "game/Dockerfile"
  Write-Host "Starting production stack (PROD_WEB_DOCKERFILE=game/Dockerfile) ..."
  docker compose -f docker-compose.production.yml --env-file $envFile up -d --build
  Write-Host ""
  Write-Host "Gateway: http://127.0.0.1:3000/tilezilla-v2.html" -ForegroundColor Green
  Write-Host "Health:  .\scripts\health-check-production.sh" -ForegroundColor Green
}
finally {
  Pop-Location
}
