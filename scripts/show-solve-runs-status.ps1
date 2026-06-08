<#
.SYNOPSIS
  Show running solve/enumerate Docker jobs and batch progress.

.DESCRIPTION
  One place to see:
  - Each garz-puzzle-web-run-* container (level id, uptime)
  - Latest Progress: line from container logs
  - Recent *-enumerate-*.ndjson files (levels finished in each batch)

.EXAMPLE
  .\scripts\show-solve-runs-status.ps1

.EXAMPLE
  .\scripts\show-solve-runs-status.ps1 -Watch

.EXAMPLE
  .\scripts\show-solve-runs-status.ps1 -Watch -IntervalSeconds 15

.EXAMPLE
  .\scripts\show-solve-runs-status.ps1 -FollowLogs
#>
param(
  [string]$RepoRoot = "",

  [switch]$Watch,

  [int]$IntervalSeconds = 30,

  [switch]$FollowLogs,

  [int]$LogTail = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-LevelFromContainer {
  param([string]$ContainerName)
  $args = docker inspect --format '{{join .Args " "}}' $ContainerName 2>$null
  if ($args -match 'solve-level\.js\s+(\S+)') {
    return $Matches[1]
  }
  return "(unknown)"
}

function Get-LastProgressLine {
  param([string]$ContainerName)
  $lines = @(docker logs --tail $LogTail $ContainerName 2>&1 | ForEach-Object { "$_" })
  for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    if ($lines[$i] -match 'Progress:') { return $lines[$i].Trim() }
    if ($lines[$i] -match '"totalUniqueSolutions"') { return $lines[$i].Trim() }
  }
  return "(no progress in last $LogTail log lines yet)"
}

function Get-Uptime {
  param([string]$ContainerName)
  $started = docker inspect --format '{{.State.StartedAt}}' $ContainerName 2>$null
  if (-not $started) { return "?" }
  try {
    $dt = [DateTime]::Parse($started).ToLocalTime()
    $span = (Get-Date) - $dt
    if ($span.TotalHours -ge 1) {
      return "{0:0.#}h" -f $span.TotalHours
    }
    return "{0:0.#}m" -f $span.TotalMinutes
  }
  catch {
    return $started
  }
}

function Get-JsonProp {
  param($Obj, [string]$Name)
  if ($null -eq $Obj) { return $null }
  $p = $Obj.PSObject.Properties | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
  if ($null -eq $p) { return $null }
  return $p.Value
}

function Show-BatchProgress {
  param([string]$RunsDir)

  $ndjson = Get-ChildItem -Path $RunsDir -Filter "*-enumerate-*.ndjson" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 8

  if (-not $ndjson -or $ndjson.Count -eq 0) {
    Write-Host "  (no *-enumerate-*.ndjson under data/solver-runs)" -ForegroundColor DarkGray
    return
  }

  foreach ($file in $ndjson) {
    $lines = @(Get-Content -Path $file.FullName -ErrorAction SilentlyContinue | Where-Object { $_.Trim() })
    if ($lines.Count -eq 0) { continue }

    $start = $null
    $done = @()
    foreach ($line in $lines) {
      try {
        $o = $line | ConvertFrom-Json
      }
      catch { continue }
      $ev = Get-JsonProp $o 'event'
      $lid = Get-JsonProp $o 'levelId'
      if ($ev -eq 'start') {
        $start = $o
      }
      elseif ($null -ne $lid) {
        $done += $o
      }
    }

    $label = $file.Name
    if ($start) {
      $phaseVal = Get-JsonProp $start 'phase'
      $phase = if ($null -ne $phaseVal) { " phase=$phaseVal" } else { "" }
      $startCount = Get-JsonProp $start 'count'
      $label += " ($($done.Count)/$startCount done$phase)"
    }

    Write-Host ""
    Write-Host "  $label" -ForegroundColor Cyan
    Write-Host "    updated: $($file.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"

    if ($done.Count -gt 0) {
      $last = $done[-1]
      $solCount = Get-JsonProp $last 'totalUniqueSolutions'
      $sol = if ($null -ne $solCount) { " -> $solCount sol" } else { "" }
      $idx = Get-JsonProp $last 'index'
      $tot = Get-JsonProp $last 'total'
      $ts = Get-JsonProp $last 'ts'
      $lvl = Get-JsonProp $last 'levelId'
      Write-Host "    last finished: $lvl [$idx/$tot]$sol at $ts"
    }
    elseif ($start) {
      Write-Host "    (started, no level finished yet — check running containers above)" -ForegroundColor DarkGray
    }
  }
}

function Show-Status {
  param([switch]$ClearScreen)

  if ($ClearScreen) {
    try { Clear-Host } catch { }
  }
  $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "=== Solve runs status === $now ===" -ForegroundColor White
  Write-Host ""

  Write-Host "Running Docker solvers (garz-puzzle-web-run-*)" -ForegroundColor Yellow
  $containers = @(docker ps --filter "name=garz-puzzle-web-run" --format "{{.Names}}" 2>$null |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

  if ($containers.Count -eq 0) {
    Write-Host "  None. (MySQL may still be up — that is normal.)" -ForegroundColor Green
  }
  else {
    foreach ($c in $containers) {
      $level = Get-LevelFromContainer -ContainerName $c
      $up = Get-Uptime -ContainerName $c
      $prog = Get-LastProgressLine -ContainerName $c
      Write-Host ""
      Write-Host "  $level" -ForegroundColor Green
      Write-Host "    container: $c  uptime: $up"
      Write-Host "    $prog"
    }
  }

  Write-Host ""
  Write-Host "Recent batch logs (data/solver-runs/*-enumerate-*.ndjson)" -ForegroundColor Yellow
  $runsDir = Join-Path $RepoRoot "data\solver-runs"
  Show-BatchProgress -RunsDir $runsDir

  Write-Host ""
  Write-Host "Tips:" -ForegroundColor DarkGray
  Write-Host "  Refresh:  .\scripts\show-solve-runs-status.ps1 -Watch"
  Write-Host "  Stop all: .\scripts\stop-solve-docker-runs.ps1"
  Write-Host "  Live log: docker logs -f <container-name>"
}

if ($FollowLogs) {
  $containers = @(docker ps --filter "name=garz-puzzle-web-run" --format "{{.Names}}" 2>$null |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($containers.Count -eq 0) {
    Write-Host "No running solver containers to follow."
    exit 0
  }
  if ($containers.Count -gt 1) {
    Write-Host "Multiple containers — following the first. Use: docker logs -f $($containers[0])"
  }
  docker logs -f $containers[0]
  exit $LASTEXITCODE
}

if ($Watch) {
  while ($true) {
    Show-Status -ClearScreen
    Start-Sleep -Seconds $IntervalSeconds
  }
}

Show-Status
