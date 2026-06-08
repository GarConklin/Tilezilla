<#
.SYNOPSIS
  Full enumeration (Docker) for 38 new levels from Jun 1 ingest.

.DESCRIPTION
  Runs solves/solve-level.js for levels added from
  data/tilepz solves 01 jun 2026.txt:

    5x6-0B-AVB … 5x6-0B-AWK (36)
    6x6-0B-ACF, 6x6-0B-ACG (2)

.EXAMPLE
  .\scripts\run-jun01-enumerate.ps1

.EXAMPLE
  .\scripts\run-jun01-enumerate.ps1 -SyncCatalog

.EXAMPLE
  .\scripts\run-jun01-enumerate.ps1 -DryRun

.EXAMPLE
  .\scripts\run-jun01-enumerate.ps1 -ResumeFrom "5x6-0B-AVX" -ContinueOnError

  Stop a hung run: .\scripts\stop-solve-docker-runs.ps1 (2nd terminal), then Ctrl+C here.
#>
param(
  [string]$RepoRoot = "",

  [int]$MaxSol = 500000,

  [switch]$DryRun,

  [switch]$ContinueOnError,

  [switch]$SyncCatalog,

  [string]$ResumeFrom = "",

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

function Get-LevelIds {
  Push-Location $RepoRoot
  try {
    $dockerArgs = @(
      'compose', 'run', '--rm', 'web',
      'node', 'scripts/list-jun01-new-level-ids.js'
    )
    Write-Host "docker $($dockerArgs -join ' ')" -ForegroundColor DarkGray
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lines = @(& docker @dockerArgs 2>&1 | ForEach-Object { "$_" })
    $ErrorActionPreference = $prevEap
    if ($LASTEXITCODE -ne 0) {
      throw "list-jun01-new-level-ids.js failed: $($lines -join "`n")"
    }
    @($lines | Where-Object { $_ -match '^\d+x\d+-\S+-\S+$' })
  }
  finally {
    Pop-Location
  }
}

Write-Step "Jun 1 enumerate (MaxSol=$MaxSol)"
$ids = Get-LevelIds

if ($ResumeFrom) {
  $start = [array]::IndexOf($ids, $ResumeFrom)
  if ($start -lt 0) {
    throw "ResumeFrom not in queue: $ResumeFrom"
  }
  $ids = $ids[$start..($ids.Count - 1)]
  Write-Host "Resuming at [$($start + 1)/$($ids.Count + $start)]: $ResumeFrom"
}

if ($ids.Count -eq 0) {
  Write-Host "No levels in queue." -ForegroundColor Yellow
  exit 0
}

Write-Host "Queue ($($ids.Count)): $($ids -join ', ')"

$logRoot = Join-Path $RepoRoot ($LogDir -replace '/', '\')
if (-not (Test-Path $logRoot)) {
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logRoot "jun01-enumerate-$stamp.log"
$progressPath = Join-Path $logRoot "jun01-enumerate-$stamp.ndjson"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$progress = New-Object System.IO.StreamWriter($progressPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# jun01-enumerate stamp=$stamp maxSol=$MaxSol")
$log.WriteLine("# ids: $($ids -join ', ')")
$log.Flush()

if (-not $DryRun -and $PruneDockerEvery -gt 0) {
  Invoke-DockerHygiene "before batch"
}
$progress.WriteLine("{""event"":""start"",""count"":$($ids.Count),""ts"":""$(Get-Date -Format o)""}")
$progress.Flush()

$solverBase = @(
  "--viable-seeds-only",
  "--write-solves",
  "--json-summary",
  "--progress-every", "$ProgressEvery",
  "--progress-on-json",
  "--max-sol", "$MaxSol"
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

  $solverFlags = @($solverBase)

  if ($DryRun) {
    $dryParts = @("docker", "compose", "run", "--rm")
    if (-not $NoTty) { $dryParts += "-t" }
    $dryParts += @("web", "node", "solves/solve-level.js", $levelId) + $solverFlags
    Write-Host "[dry-run] $($dryParts -join ' ')" -ForegroundColor DarkYellow
    continue
  }

  Push-Location $RepoRoot
  try {
    $dockerArgs = @("compose", "run", "--rm")
    if (-not $NoTty) { $dockerArgs += "-t" }
    $dockerArgs += @("web", "node", "solves/solve-level.js", $levelId) + $solverFlags
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
        levelId = $levelId
        index   = $n
        total   = $ids.Count
        exit    = $LASTEXITCODE
        ts      = (Get-Date -Format 'o')
        totalUniqueSolutions = $summaryJson.totalUniqueSolutions
        hitMaxSolCap = $summaryJson.hitMaxSolCap
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

  if (-not $DryRun -and $PruneDockerEvery -gt 0 -and ($n % $PruneDockerEvery) -eq 0) {
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
if (-not $DryRun -and -not $SyncCatalog) {
  Write-Host "When done, sync + CSV:" -ForegroundColor DarkGray
  Write-Host "  .\scripts\run-jun01-enumerate.ps1 -SyncCatalog" -ForegroundColor DarkGray
}
