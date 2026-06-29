<#
.SYNOPSIS
  Start MySQL + php-auth for local python dev server (port 8080).

.DESCRIPTION
  Does NOT start the docker web container or touch port 8081 (garz-puzzle-web-1).
  Auth is published on AUTH_PORT (default 8090) for scripts/server.py to proxy /auth/*.

.EXAMPLE
  .\scripts\start-local-auth.ps1
  $env:PORT = "8080"
  python scripts/server.py
#>
[CmdletBinding()]
param(
  [int]$DockerWaitSec = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AuthPort = if ($env:AUTH_PORT) { $env:AUTH_PORT } else { "8090" }

function Test-DockerReady {
  $job = Start-Job { docker info *> $null; return $LASTEXITCODE }
  $done = Wait-Job $job -Timeout 12
  if (-not $done) {
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -ErrorAction SilentlyContinue
    return $false
  }
  $code = Receive-Job $job
  Remove-Job $job -ErrorAction SilentlyContinue
  return ($code -eq 0)
}

function Wait-AuthHttp([string]$Url, [int]$Seconds = 90) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch {
      # keep waiting
    }
    Start-Sleep -Seconds 3
  }
  return $false
}

Push-Location $RepoRoot
try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker not found. Install Docker Desktop, then re-run this script."
  }

  if (-not (Test-DockerReady)) {
    Write-Host "Docker is not ready yet. Open Docker Desktop and wait for it to finish starting." -ForegroundColor Yellow
    $deadline = (Get-Date).AddSeconds($DockerWaitSec)
    while ((Get-Date) -lt $deadline) {
      if (Test-DockerReady) { break }
      Write-Host "  waiting for Docker..." -ForegroundColor DarkGray
      Start-Sleep -Seconds 5
    }
    if (-not (Test-DockerReady)) {
      throw "Docker did not become ready within ${DockerWaitSec}s. Start Docker Desktop manually, then re-run."
    }
  }

  & (Join-Path $RepoRoot "scripts\ensure-shared-mysql-volume.ps1")

  Write-Host "Starting mysql + php-auth (auth on http://127.0.0.1:$AuthPort)..." -ForegroundColor Cyan
  docker compose up -d mysql php-auth
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed (exit $LASTEXITCODE)"
  }

  $authUrl = "http://127.0.0.1:$AuthPort/api/check-session.php"
  Write-Host "Waiting for auth at $authUrl ..." -ForegroundColor DarkGray
  if (-not (Wait-AuthHttp $authUrl)) {
    throw "Auth container started but $authUrl is not responding. Try: docker compose logs php-auth mysql"
  }

  Write-Host ""
  Write-Host "Auth is up: http://127.0.0.1:$AuthPort" -ForegroundColor Green
  Write-Host "Game dev server: `$env:PORT='8080'; python scripts/server.py" -ForegroundColor Green
  Write-Host "Create account: http://127.0.0.1:8080/create-passport.html" -ForegroundColor Green
}
finally {
  Pop-Location
}
