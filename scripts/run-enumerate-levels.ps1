<#
.SYNOPSIS
  Full enumeration (Docker) for one or more catalog level ids.

.DESCRIPTION
  Overwrites each level's solve file with all unique solutions (--write-solves).
  Use when a level only has a seed layout from remote export (pathCount 1).

.EXAMPLE
  # May 31 ingest: pasted AIW → catalog 5x6-0B-AUY
  .\scripts\run-enumerate-levels.ps1 -LevelIds "5x6-0B-AUY" -SyncCatalog

.EXAMPLE
  .\scripts\run-enumerate-levels.ps1 -LevelIds "5x6-0B-AUY,5x6-0B-AUZ,5x6-0B-AVA" -SyncCatalog

.EXAMPLE
  .\scripts\run-enumerate-levels.ps1 -LevelIds "5x6-0B-AUY" -DryRun

  Stop: .\scripts\stop-solve-docker-runs.ps1 (2nd terminal), then Ctrl+C here.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$LevelIds,

  [string]$RepoRoot = "",

  [int]$MaxSol = 500000,

  [switch]$DryRun,

  [switch]$ContinueOnError,

  [switch]$SyncCatalog,

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

$ids = @(
  $LevelIds -split '[,\s]+' |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^\d+x\d+-\S+-\S+$' }
)

if ($ids.Count -eq 0) {
  throw "No valid level ids in -LevelIds (expected e.g. 5x6-0B-AUY)"
}

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-DockerHygiene([string]$Reason) {
  Write-Host "Docker hygiene ($Reason)..." -ForegroundColor DarkYellow
  Push-Location $RepoRoot
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $n = @(docker ps -aq --filter "name=garz-puzzle-web-run" 2>$null).Count
    docker container prune -f 2>&1 | Out-Null
    Write-Host "  pruned stopped containers (had $n garz-puzzle-web-run*)" -ForegroundColor DarkGray
    $ErrorActionPreference = $prevEap
  }
  finally {
    Pop-Location
  }
}

Write-Step "Enumerate $($ids.Count) level(s)"
Write-Host "Queue: $($ids -join ', ')"

$logRoot = Join-Path $RepoRoot ($LogDir -replace '/', '\')
if (-not (Test-Path $logRoot)) {
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$slug = ($ids[0] -replace '[^\w-]', '_')
if ($ids.Count -gt 1) { $slug = "batch$($ids.Count)" }
$logPath = Join-Path $logRoot "enumerate-$slug-$stamp.log"
$progressPath = Join-Path $logRoot "enumerate-$slug-$stamp.ndjson"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$progress = New-Object System.IO.StreamWriter($progressPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# enumerate-levels stamp=$stamp maxSol=$MaxSol")
$log.WriteLine("# ids: $($ids -join ', ')")
$log.Flush()

if (-not $DryRun -and $PruneDockerEvery -gt 0) {
  Invoke-DockerHygiene "before batch"
}

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
$hitCap = @()
$n = 0

foreach ($levelId in $ids) {
  $n++
  Write-Step "[$n/$($ids.Count)] $levelId"
  $log.WriteLine("")
  $log.WriteLine("=== [$n/$($ids.Count)] $levelId ===")
  $log.Flush()

  if ($DryRun) {
    $dryParts = @("docker", "compose", "run", "--rm")
    if (-not $NoTty) { $dryParts += "-t" }
    $dryParts += @("web", "node", "solves/solve-level.js", $levelId) + $solverBase
    Write-Host "[dry-run] $($dryParts -join ' ')" -ForegroundColor DarkYellow
    continue
  }

  Push-Location $RepoRoot
  try {
    $dockerArgs = @("compose", "run", "--rm")
    if (-not $NoTty) { $dockerArgs += "-t" }
    $dockerArgs += @("web", "node", "solves/solve-level.js", $levelId) + $solverBase
    Write-Host "docker $($dockerArgs -join ' ')"

    $summaryJson = $null
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker @dockerArgs 2>&1 | ForEach-Object {
      $line = "$_"
      $isProgress = $line -match '^\s*Progress:'
      $isSummary = $line -match '^\s*\{.*"totalUniqueSolutions"'
      Write-Host $line
      if (-not $isProgress) { $log.WriteLine($line) }
      if ($isSummary -or $line -match '^\[solve-level\]') { $log.Flush() }
      if ($isSummary) {
        try { $summaryJson = $line.Trim() | ConvertFrom-Json } catch { }
      }
    }
    $log.Flush()
    $ErrorActionPreference = $prevEap

    $progress.WriteLine((@{
        levelId              = $levelId
        index                = $n
        total                = $ids.Count
        exit                 = $LASTEXITCODE
        ts                   = (Get-Date -Format 'o')
        totalUniqueSolutions = $summaryJson.totalUniqueSolutions
        hitMaxSolCap         = $summaryJson.hitMaxSolCap
      } | ConvertTo-Json -Compress))
    $progress.Flush()

    $enumOk = $summaryJson -and $summaryJson.totalUniqueSolutions -gt 0 -and -not $summaryJson.hitMaxSolCap
    if ($summaryJson.hitMaxSolCap) { $hitCap += $levelId }

    if ($enumOk -and $LASTEXITCODE -eq 0) {
      Write-Host "OK: $levelId ($($summaryJson.totalUniqueSolutions) solution(s))" -ForegroundColor Green
    }
    else {
      $failed += $levelId
      Write-Host "FAILED: $levelId (exit $LASTEXITCODE)" -ForegroundColor Red
      if (-not $ContinueOnError) { throw "Solve failed for $levelId" }
    }
  }
  finally {
    Pop-Location
  }

  if ($PruneDockerEvery -gt 0 -and ($n % $PruneDockerEvery) -eq 0) {
    Invoke-DockerHygiene "every $PruneDockerEvery levels"
  }
}

$log.Close()
$progress.Close()

Write-Host ""
Write-Host "Log:      $logPath"
Write-Host "Progress: $progressPath"

if ($hitCap.Count -gt 0) {
  Write-Host "Hit --max-sol cap: $($hitCap -join ', ')" -ForegroundColor Yellow
}

if ($failed.Count -gt 0) {
  Write-Host "Failed: $($failed -join ', ')" -ForegroundColor Red
  exit 1
}

if (-not $DryRun -and $SyncCatalog) {
  Write-Step "Sync catalog from solve files"
  $syncIds = $ids -join ','
  Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "sync-catalog-path-count-from-solves.js" -ExtraArgs @("--apply", "--ids", $syncIds)
  Push-Location $RepoRoot
  try {
    & docker compose run --rm web python scripts/export_levels_csv.py --out data/solver-runs/levels-solution-counts.csv 2>&1 | ForEach-Object { Write-Host $_ }
  }
  finally { Pop-Location }
}

Write-Host "Finished $($ids.Count) level(s)." -ForegroundColor Green
