<#
.SYNOPSIS
  Full enumeration (Docker) for 5x6 levels from Jun 18 ingest (BFA…BSU, 359 levels).

.DESCRIPTION
  Ingest already done (359 new levels, 1 seed solve each). This replaces seed solves
  with full enumeration via solve-level.js --write-solves.

  Run two batches in parallel (separate terminals):

    .\scripts\run-jun18-enumerate.ps1 -Phase Batch1 -NoTty -ContinueOnError
    .\scripts\run-jun18-enumerate.ps1 -Phase Batch2 -NoTty -ContinueOnError

  Batch1: 5x6-0B-BFA … 5x6-0B-BLX (180 levels)
  Batch2: 5x6-0B-BLY … 5x6-0B-BSU (179 levels)

  After both finish:

    .\scripts\run-jun18-enumerate.ps1 -Phase All -SyncCatalogOnly -NoTty

  Stop:  .\scripts\stop-solve-docker-runs.ps1
  Status: .\scripts\show-solve-runs-status.ps1 -Watch

.EXAMPLE
  .\scripts\run-jun18-enumerate.ps1 -Phase Batch1 -NoTty -ContinueOnError

.EXAMPLE
  .\scripts\run-jun18-enumerate.ps1 -Phase Batch2 -NoTty -ContinueOnError -ResumeFrom "5x6-0B-BLY"
#>
param(
  [ValidateSet('Batch1', 'Batch2', 'All')]
  [string]$Phase = 'All',

  [string]$RepoRoot = "",

  [int]$MaxSol = 500000,

  [switch]$DryRun,

  [switch]$ContinueOnError,

  [switch]$SyncCatalog,

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
  Write-Host "Docker hygiene ($Reason)..." -ForegroundColor DarkYellow
  Push-Location $RepoRoot
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $stale = @(docker ps -aq --filter "name=garz-puzzle-web-run" 2>$null)
    foreach ($cid in $stale) {
      if ($cid) { docker rm -f $cid 2>&1 | Out-Null }
    }
    docker container prune -f 2>&1 | Out-Null
    Write-Host "  removed $($stale.Count) garz-puzzle-web-run container(s)" -ForegroundColor DarkGray
    $ErrorActionPreference = $prevEap
  }
  finally {
    Pop-Location
  }
}

function Get-jun18Manifest {
  $manifestPath = Join-Path $RepoRoot "data/solver-runs/jun18-enumerate-manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Host "Generating manifest..." -ForegroundColor DarkYellow
    Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "gen-jun18-enumerate-manifest.js"
  }
  if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Missing manifest: $manifestPath"
  }
  return Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
}

function Get-jun18LevelIds([string]$ListPhase) {
  $manifest = Get-jun18Manifest
  switch ($ListPhase) {
    'Batch1' { return @([string[]]$manifest.batches.Batch1.ids) }
    'Batch2' { return @([string[]]$manifest.batches.Batch2.ids) }
    'All' {
      $all = [System.Collections.Generic.List[string]]::new()
      foreach ($id in $manifest.batches.Batch1.ids) { $all.Add([string]$id) }
      foreach ($id in $manifest.batches.Batch2.ids) { $all.Add([string]$id) }
      return @($all.ToArray())
    }
    default { return @() }
  }
}

Invoke-DockerHygiene "before jun18 run"

if ($SyncCatalogOnly) {
  $SyncCatalog = $true
}

Write-Step "Jun 18 enumerate phase=$Phase (MaxSol=$MaxSol)"
$ids = @(Get-jun18LevelIds -ListPhase $Phase)

if ($ids.Count -eq 0) {
  throw "No level IDs loaded for phase '$Phase'. Run: node scripts/gen-jun18-enumerate-manifest.js"
}

if ($ResumeFrom) {
  $start = [array]::IndexOf([string[]]$ids, $ResumeFrom)
  if ($start -lt 0) {
    throw "ResumeFrom not in queue: $ResumeFrom"
  }
  $ids = $ids[$start..($ids.Count - 1)]
  Write-Host "Resuming at [$($start + 1)/$($ids.Count + $start)]: $ResumeFrom"
}

if ($EndAt) {
  $end = [array]::IndexOf($ids, $EndAt)
  if ($end -lt 0) {
    throw "EndAt not in queue (after ResumeFrom slice): $EndAt"
  }
  $ids = $ids[0..$end]
  Write-Host "EndAt: $EndAt ($($ids.Count) level(s) in this run)"
}

if ($ids.Count -eq 0) {
  Write-Host "No levels in queue." -ForegroundColor Yellow
  exit 0
}

Write-Host "Queue ($($ids.Count)): $($ids[0]) … $($ids[-1])"

if ($SyncCatalogOnly) {
  if ($DryRun) {
    Write-Host "[dry-run] would sync catalog for $($ids.Count) level(s)" -ForegroundColor DarkYellow
    exit 0
  }
  Write-Step "Sync catalog from solve files (catalog-only)"
  $syncIds = $ids -join ','
  Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "sync-catalog-path-count-from-solves.js" -ExtraArgs @("--apply", "--ids", $syncIds)
  Push-Location $RepoRoot
  try {
    & docker compose run --rm web python scripts/export_levels_csv.py --out data/solver-runs/levels-solution-counts.csv 2>&1 | ForEach-Object { Write-Host $_ }
  }
  finally { Pop-Location }
  Write-Host "Catalog sync finished for $($ids.Count) level(s)." -ForegroundColor Green
  exit 0
}

$logRoot = Join-Path $RepoRoot ($LogDir -replace '/', '\')
if (-not (Test-Path $logRoot)) {
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logRoot "jun18-enumerate-$Phase-$stamp.log"
$progressPath = Join-Path $logRoot "jun18-enumerate-$Phase-$stamp.ndjson"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$progress = New-Object System.IO.StreamWriter($progressPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# jun18-enumerate phase=$Phase stamp=$stamp maxSol=$MaxSol")
$log.WriteLine("# ids: $($ids -join ', ')")
$log.Flush()

if (-not $DryRun -and $PruneDockerEvery -gt 0) {
  Invoke-DockerHygiene "before batch"
}
$progress.WriteLine("{""event"":""start"",""phase"":""$Phase"",""count"":$($ids.Count),""ts"":""$(Get-Date -Format o)""}")
$progress.Flush()

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

    $totalSol = $null
    $hitCapFlag = $false
    if ($null -ne $summaryJson) {
      $totalSol = $summaryJson.totalUniqueSolutions
      if ($summaryJson.PSObject.Properties['hitMaxSolCap']) {
        $hitCapFlag = [bool]$summaryJson.hitMaxSolCap
      }
    }

    $progress.WriteLine((@{
        levelId = $levelId
        index   = $n
        total   = $ids.Count
        exit    = $LASTEXITCODE
        ts      = (Get-Date -Format 'o')
        totalUniqueSolutions = $totalSol
        hitMaxSolCap = $hitCapFlag
      } | ConvertTo-Json -Compress))
    $progress.Flush()

    $enumOk = $null -ne $summaryJson -and $totalSol -gt 0 -and -not $hitCapFlag
    if ($hitCapFlag) { $hitCap += $levelId }

    if ($enumOk -and $LASTEXITCODE -eq 0) {
      Write-Host "OK: $levelId ($totalSol solution(s))" -ForegroundColor Green
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
  Write-Host "When both batches done, sync catalog:" -ForegroundColor DarkGray
  Write-Host "  .\scripts\run-jun18-enumerate.ps1 -Phase All -SyncCatalogOnly -NoTty" -ForegroundColor DarkGray
}
