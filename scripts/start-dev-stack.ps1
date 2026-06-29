<#
.SYNOPSIS
  Start Tilezilla dev stack on port 8080 (web + auth + shared MySQL).

.DESCRIPTION
  - Ensures tilezilla_shared_mysql_data exists (migrates legacy volumes if needed)
  - Replaces stale garz-puzzle-mysql only when it uses the wrong Docker volume
  - Does NOT touch garz-puzzle-web-1 or anything on port 8081

.EXAMPLE
  .\scripts\start-dev-stack.ps1
#>
[CmdletBinding()]
param(
  [switch]$NoBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SharedVolume = "tilezilla_shared_mysql_data"
$MysqlContainer = "garz-puzzle-mysql"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-MysqlDataVolume([string]$ContainerName) {
  if (-not $ContainerName) { return $null }
  try {
    $mounts = docker inspect $ContainerName --format "{{json .Mounts}}" 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { return $null }
    foreach ($m in $mounts) {
      if ($m.Destination -eq "/var/lib/mysql") { return $m.Name }
    }
  }
  catch {
    return $null
  }
  return $null
}

Push-Location $RepoRoot
try {
  Write-Step "Ensure shared MySQL volume"
  & (Join-Path $RepoRoot "scripts\ensure-shared-mysql-volume.ps1")

  $existingVol = Get-MysqlDataVolume $MysqlContainer
  if ($existingVol -and $existingVol -ne $SharedVolume) {
    Write-Host "Replacing $MysqlContainer (was on volume $existingVol, need $SharedVolume)" -ForegroundColor Yellow
    docker stop $MysqlContainer 2>$null | Out-Null
    docker rm $MysqlContainer 2>$null | Out-Null
  }

  foreach ($name in @("tilezilla-test-web-1", "tilezilla_auth", "tilezilla_remote_auth")) {
    try {
      $state = docker inspect $name --format "{{.State.Status}}" 2>$null
      if ($LASTEXITCODE -eq 0 -and $state -eq "running") {
        Write-Host "Stopping old stack container: $name" -ForegroundColor DarkGray
        docker stop $name 2>$null | Out-Null
      }
    }
    catch {
      continue
    }
  }

  $args = @("compose", "up", "-d")
  if (-not $NoBuild) { $args += "--build" }

  Write-Step "Starting docker compose (port 8080)"
  & docker @args
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed (exit $LASTEXITCODE)"
  }

  Write-Host ""
  Write-Host "Tilezilla: http://localhost:8080/" -ForegroundColor Green
  Write-Host "MySQL volume: $SharedVolume (accounts persist across restarts)" -ForegroundColor DarkGray
}
finally {
  Pop-Location
}
