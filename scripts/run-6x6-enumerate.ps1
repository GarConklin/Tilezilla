<#
.SYNOPSIS
  Full enumeration for 6x6 levels listed in the need-enumeration batch (Docker).

.DESCRIPTION
  1. Build batch (if missing):
       docker compose run --rm web node scripts/build-6x6-unsolved-batch.js --include-jun13-batch
  2. Ingest seeds once:
       .\scripts\ingest-solve-batch.ps1 -BatchFile "data\tilepz solves 6x6 need-enumeration.txt"
  3. Enumerate:
       .\scripts\run-6x6-enumerate.ps1 -NoTty -ContinueOnError
  4. After all finish:
       .\scripts\run-6x6-enumerate.ps1 -SyncCatalogOnly -NoTty
       .\scripts\dedupe-solve-rotations.ps1

.EXAMPLE
  .\scripts\run-6x6-enumerate.ps1 -DryRun

.EXAMPLE
  .\scripts\run-6x6-enumerate.ps1 -ResumeFrom 6x6-0C-AAH -NoTty
#>
param(
  [string]$RepoRoot = "",
  [string]$IdListFile = "data/solver-runs/6x6-need-enumeration-ids.txt",
  [int]$MaxSol = 500000,
  [switch]$DryRun,
  [switch]$ContinueOnError,
  [switch]$SyncCatalogOnly,
  [string]$ResumeFrom = "",
  [string]$EndAt = "",
  [string]$LogDir = "data/solver-runs",
  [int]$ProgressEvery = 500,
  [int]$PruneDockerEvery = 5,
  [switch]$NoTty
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

. (Join-Path $PSScriptRoot "lib\Docker-Web.ps1")

if (-not (Test-DockerCompose -RepoRoot $RepoRoot)) {
  throw "docker compose not available from $RepoRoot"
}

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-DockerHygiene([string]$Reason) {
  Write-Host "Docker hygiene ($Reason)…" -ForegroundColor DarkGray
  Push-Location $RepoRoot
  try {
    & docker compose run --rm web node scripts/docker-hygiene.js 2>&1 | ForEach-Object { Write-Host $_ }
  }
  catch { Write-Host "  (docker-hygiene skipped: $_)" -ForegroundColor DarkYellow }
  finally { Pop-Location }
}

$idPath = Join-Path $RepoRoot ($IdListFile -replace '/', '\')
if (-not (Test-Path $idPath)) {
  throw "Missing id list: $idPath`nRun: docker compose run --rm web node scripts/build-6x6-unsolved-batch.js --include-jun13-batch"
}

$ids = @(Get-Content -Path $idPath | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
if ($ids.Count -eq 0) {
  Write-Host "Id list is empty — all 6x6 levels may already be enumerated." -ForegroundColor Green
  exit 0
}

if ($ResumeFrom) {
  $start = [array]::IndexOf([string[]]$ids, $ResumeFrom)
  if ($start -lt 0) { throw "ResumeFrom not in queue: $ResumeFrom" }
  $ids = $ids[$start..($ids.Count - 1)]
}

if ($EndAt) {
  $end = [array]::IndexOf($ids, $EndAt)
  if ($end -lt 0) { throw "EndAt not in queue: $EndAt" }
  $ids = $ids[0..$end]
}

Write-Step "6x6 enumerate queue: $($ids.Count) level(s)"
Write-Host "$($ids[0]) … $($ids[-1])"

if ($SyncCatalogOnly) {
  if ($DryRun) {
    Write-Host "[dry-run] would sync catalog for $($ids.Count) level(s)" -ForegroundColor DarkYellow
    exit 0
  }
  $syncIds = $ids -join ','
  Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "sync-catalog-path-count-from-solves.js" -ExtraArgs @("--apply", "--ids", $syncIds)
  Push-Location $RepoRoot
  try {
    & docker compose run --rm web python scripts/export_levels_csv.py --out data/solver-runs/levels-solution-counts.csv 2>&1 | ForEach-Object { Write-Host $_ }
  }
  finally { Pop-Location }
  exit 0
}

Invoke-DockerHygiene "before 6x6 run"

$logRoot = Join-Path $RepoRoot ($LogDir -replace '/', '\')
if (-not (Test-Path $logRoot)) { New-Item -ItemType Directory -Path $logRoot -Force | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logRoot "6x6-enumerate-$stamp.log"
$progressPath = Join-Path $logRoot "6x6-enumerate-$stamp.ndjson"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$progress = New-Object System.IO.StreamWriter($progressPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# 6x6-enumerate stamp=$stamp maxSol=$MaxSol count=$($ids.Count)")
$log.Flush()

$solverBase = @(
  "--viable-seeds-only",
  "--write-solves",
  "--json-summary",
  "--progress-every", "$ProgressEvery",
  "--progress-on-json",
  "--max-sol", "$MaxSol",
  "--stream-solves-dir", "data/solver-runs/streams"
)

$failed = @()
$n = 0

foreach ($levelId in $ids) {
  $n++
  Write-Step "[$n/$($ids.Count)] $levelId"
  $log.WriteLine("=== [$n/$($ids.Count)] $levelId ===")
  $log.Flush()

  if ($DryRun) {
    Write-Host "[dry-run] solve-level.js $levelId" -ForegroundColor DarkYellow
    continue
  }

  $solverFlags = @($solverBase)
  if ($NoTty) { $solverFlags += "--quiet" }

  Push-Location $RepoRoot
  try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker compose run --rm web node solves/solve-level.js $levelId @solverFlags 2>&1 | ForEach-Object {
      $line = "$_"
      Write-Host $line
      $log.WriteLine($line)
      $log.Flush()
    }
    $ErrorActionPreference = $prev
    if ($LASTEXITCODE -ne 0) {
      $failed += $levelId
      $progress.WriteLine("{""event"":""fail"",""id"":""$levelId"",""ts"":""$(Get-Date -Format o)""}")
      $progress.Flush()
      if (-not $ContinueOnError) { throw "solve-level failed: $levelId (exit $LASTEXITCODE)" }
    }
    else {
      $progress.WriteLine("{""event"":""ok"",""id"":""$levelId"",""ts"":""$(Get-Date -Format o)""}")
      $progress.Flush()
    }
  }
  finally { Pop-Location }

  if ($PruneDockerEvery -gt 0 -and ($n % $PruneDockerEvery) -eq 0) {
    Invoke-DockerHygiene "after $n levels"
  }
}

$log.Dispose()
$progress.Dispose()

Write-Host ""
Write-Host "Log: $logPath" -ForegroundColor Green
if ($failed.Count -gt 0) {
  Write-Host "Failed ($($failed.Count)): $($failed -join ', ')" -ForegroundColor Red
}
Write-Host "When done: .\scripts\run-6x6-enumerate.ps1 -SyncCatalogOnly -NoTty" -ForegroundColor DarkGray
