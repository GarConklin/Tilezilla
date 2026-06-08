<#
.SYNOPSIS
  Full enumeration (Docker) for 41 new levels from Jun 3 ingest.

.DESCRIPTION
  From data/tilepz solves 03 June  2026.txt (merge remaps pasted ids):

    5x6-0B-AWO … 5x6-0B-AXU (33) — pasted AKU…AMA reused existing codes (bag mismatch)
    6x6-0B-ACH … 6x6-0B-ACO (8)  — pasted 6x6-0A-AAL…AAS → 0B tier

.EXAMPLE
  .\scripts\run-jun03-enumerate.ps1 -Phase 5x6 -NoTty

.EXAMPLE
  .\scripts\run-jun03-enumerate.ps1 -Phase 6x6 -SyncCatalogOnly -NoTty

.EXAMPLE
  .\scripts\run-jun03-enumerate.ps1 -Phase 6x6 -SyncCatalog -NoTty

.EXAMPLE
  .\scripts\run-jun03-enumerate.ps1 -Phase All -SyncCatalog -ContinueOnError -NoTty

.EXAMPLE
  .\scripts\run-jun03-enumerate.ps1 -DryRun -Phase 5x6

.EXAMPLE
  .\scripts\run-jun03-enumerate.ps1 -ResumeFrom "6x6-0B-ACL" -EndAt "6x6-0B-ACM" -ContinueOnError -NoTty

.EXAMPLE
  .\scripts\run-jun03-enumerate.ps1 -ResumeFrom "6x6-0B-ACN" -ContinueOnError -NoTty

  Stop: .\scripts\stop-solve-docker-runs.ps1 (2nd terminal), then Ctrl+C here.
#>
param(
  [ValidateSet('5x6', '6x6', 'All')]
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

function ConvertFrom-ThreeLetterIndex([int]$index) {
  $a = [int]([math]::Floor($index / 676) % 26)
  $b = [int]([math]::Floor($index / 26) % 26)
  $c = [int]($index % 26)
  return ([char](65 + $a)).ToString() + ([char](65 + $b)).ToString() + ([char](65 + $c)).ToString()
}

function ConvertTo-ThreeLetterIndex([string]$code) {
  if ($code -notmatch '^([A-Z])([A-Z])([A-Z])$') { throw "Invalid code: $code" }
  $a = [byte][char]$Matches[1] - 65
  $b = [byte][char]$Matches[2] - 65
  $c = [byte][char]$Matches[3] - 65
  return $a * 676 + $b * 26 + $c
}

function Get-Jun03Ids5x6 {
  $start = ConvertTo-ThreeLetterIndex 'AWO'
  $end = ConvertTo-ThreeLetterIndex 'AXU'
  $out = [System.Collections.Generic.List[string]]::new()
  for ($i = $start; $i -le $end; $i++) {
    $out.Add("5x6-0B-$(ConvertFrom-ThreeLetterIndex $i)")
  }
  return @($out)
}

function Get-Jun03LevelIdsBuiltin([string]$ListPhase) {
  $six = @(
    '6x6-0B-ACH', '6x6-0B-ACI', '6x6-0B-ACJ', '6x6-0B-ACK',
    '6x6-0B-ACL', '6x6-0B-ACM', '6x6-0B-ACN', '6x6-0B-ACO'
  )
  $five = Get-Jun03Ids5x6
  switch ($ListPhase) {
    '5x6' { return @($five) }
    '6x6' { return @($six) }
    'All' { return @($five + $six) }
    default { return @() }
  }
}

function Get-LevelIds([string]$ListPhase) {
  if ($SyncCatalogOnly) {
    Write-Host "Using built-in Jun 3 id list (no Docker list step)." -ForegroundColor DarkGray
    return Get-Jun03LevelIdsBuiltin -ListPhase $ListPhase
  }

  $phaseArg = if ($ListPhase -eq 'All') { 'all' } else { $ListPhase.ToLower() }
  Push-Location $RepoRoot
  try {
    $dockerArgs = @(
      'compose', 'run', '--rm', 'web',
      'node', 'scripts/list-jun03-new-level-ids.js',
      '--phase', $phaseArg
    )
    Write-Host "docker $($dockerArgs -join ' ')" -ForegroundColor DarkGray
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lines = @(& docker @dockerArgs 2>&1 | ForEach-Object { "$_" })
    $ErrorActionPreference = $prevEap
    $ids = @($lines | Where-Object { $_ -match '^\d+x\d+-\S+-\S+$' })
    if ($LASTEXITCODE -ne 0 -or $ids.Count -eq 0) {
      if ($lines -match 'marked for removal|cannot be started') {
        Write-Host "Docker list failed (stale container). Retrying after hygiene..." -ForegroundColor Yellow
        Invoke-DockerHygiene "before list-jun03 retry"
        $lines = @(& docker @dockerArgs 2>&1 | ForEach-Object { "$_" })
        $ids = @($lines | Where-Object { $_ -match '^\d+x\d+-\S+-\S+$' })
      }
    }
    if ($ids.Count -eq 0) {
      Write-Host "Falling back to built-in Jun 3 id list." -ForegroundColor Yellow
      return Get-Jun03LevelIdsBuiltin -ListPhase $ListPhase
    }
    return $ids
  }
  finally {
    Pop-Location
  }
}

Invoke-DockerHygiene "before jun03 run"

if ($SyncCatalogOnly) {
  $SyncCatalog = $true
}

Write-Step "Jun 3 enumerate phase=$Phase (MaxSol=$MaxSol)"
$ids = Get-LevelIds -ListPhase $Phase

if ($ResumeFrom) {
  $start = [array]::IndexOf($ids, $ResumeFrom)
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

Write-Host "Queue ($($ids.Count)): $($ids -join ', ')"

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
$logPath = Join-Path $logRoot "jun03-enumerate-$Phase-$stamp.log"
$progressPath = Join-Path $logRoot "jun03-enumerate-$Phase-$stamp.ndjson"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$progress = New-Object System.IO.StreamWriter($progressPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# jun03-enumerate phase=$Phase stamp=$stamp maxSol=$MaxSol")
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
  Write-Host "When done, sync + CSV:" -ForegroundColor DarkGray
  Write-Host "  .\scripts\run-jun03-enumerate.ps1 -Phase $Phase -SyncCatalog -NoTty" -ForegroundColor DarkGray
}
