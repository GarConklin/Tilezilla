<#
.SYNOPSIS
  Solve swap-queue puzzles in blocks of 50. Stop anytime and start again.

.DESCRIPTION
  Reads tools/data/solver-runs/swap-solve-queue/ (built by build-swap-solve-queue.py).
  Each worker claims one block, solves its specs, and writes:
    enumerated/<id>.json   full solve document
    results/<id>.json      short summary, including a zero-solution or a cap hit
  A spec that already has either file is skipped, so a stopped run resumes.

  All workers must share this queue folder (one disk, or a network share).
  Each extra VM is another copy of this script. Ctrl+C releases the block.
  A worker that dies is stale after -StaleMinutes with no progress, and another
  worker can pick up the rest of that block.

  Separate copies with no shared folder: give each VM its own range.
    -FromBlock 1 -ToBlock 400
  Copy enumerated/ and results/ back before another VM reuses that range.

.EXAMPLE
  .\tools\scripts\run-swap-solve-queue.ps1 -WorkerName "vm-1"

.EXAMPLE
  .\tools\scripts\run-swap-solve-queue.ps1 -Status

.EXAMPLE
  # One puzzle, to prove the solver and the new id.
  .\tools\scripts\run-swap-solve-queue.ps1 -WorkerName "test" -MaxPuzzles 1

.EXAMPLE
  .\tools\scripts\run-swap-solve-queue.ps1 -WorkerName "vm-1" -MaxBlocks 1 -DryRun
#>
param(
  [string]$WorkerName = "",
  [string]$RepoRoot = "",
  [int]$MaxBlocks = 0,
  [int]$MaxPuzzles = 0,
  [int]$FromBlock = 0,
  [int]$ToBlock = 0,
  [int]$MaxSol = 500000,
  [int]$ProgressEvery = 200,
  [int]$StaleMinutes = 45,
  [switch]$Status,
  [switch]$DryRun,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
}

. (Join-Path $PSScriptRoot "lib\Docker-Web.ps1")

$queue = Join-Path $RepoRoot "tools\data\solver-runs\swap-solve-queue"
$manifestPath = Join-Path $queue "manifest.json"
if (-not (Test-Path $manifestPath)) {
  throw "Queue not built. From Tilezilla: python tools/scripts/build-swap-solve-queue.py"
}
$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json

function Get-ResultPath([string]$PuzzleId) {
  Join-Path $queue "results\$PuzzleId.json"
}
function Get-EnumPath([string]$PuzzleId) {
  Join-Path $queue "enumerated\$PuzzleId.json"
}
function Test-PuzzleDone([string]$PuzzleId) {
  if ($Force) { return $false }
  return (Test-Path (Get-EnumPath $PuzzleId)) -or (Test-Path (Get-ResultPath $PuzzleId))
}
function Test-HasCross($spec) {
  foreach ($name in @("CQ", "CR", "CT")) {
    if ($spec.tiles.PSObject.Properties.Name -contains $name) { return $true }
  }
  return $false
}

if ($Status) {
  $done = 0
  $pending = 0
  $later = 0
  foreach ($block in $manifest.blocks) {
    $doc = Get-Content -Raw -Path (Join-Path $queue ($block.file -replace '/', '\')) | ConvertFrom-Json
    foreach ($spec in $doc.specs) {
      if (Test-HasCross $spec) { $later++; continue }
      if (Test-PuzzleDone $spec.id) { $done++ } else { $pending++ }
    }
  }
  $claims = @(Get-ChildItem -Path (Join-Path $queue "claims") -Filter "*.json" -ErrorAction SilentlyContinue)
  Write-Host "Puzzles: $($manifest.puzzleCount)   blocks: $($manifest.blockCount)   done: $done   waiting: $pending   cross tiles later: $later   claims: $($claims.Count)"
  Write-Host "Ids: $($manifest.idScheme) per size and tier ($($manifest.idNote))"
  foreach ($row in $manifest.buckets) {
    Write-Host ("  {0}-{1}  new {2}  catalog {3}  {4} .. {5}" -f $row.size, $row.tier, $row.new, $row.catalog, $row.first, $row.last)
  }
  exit 0
}

if ([string]::IsNullOrWhiteSpace($WorkerName)) {
  throw "Pass -WorkerName, or -Status to inspect the queue."
}
if (-not $DryRun -and -not (Test-DockerCompose -RepoRoot $RepoRoot)) {
  throw "docker compose not available from $RepoRoot"
}

foreach ($dir in @("claims", "enumerated", "results", "work")) {
  $path = Join-Path $queue $dir
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}

$logRoot = Join-Path $RepoRoot "tools\data\solver-runs"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logRoot "swap-queue-$WorkerName-$stamp.log"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# swap-queue worker=$WorkerName stamp=$stamp maxSol=$MaxSol")
$log.Flush()

$script:heldClaim = $null

function Release-Claim {
  if ($script:heldClaim -and (Test-Path $script:heldClaim)) {
    Remove-Item -LiteralPath $script:heldClaim -Force -ErrorAction SilentlyContinue
  }
  $script:heldClaim = $null
}

function Write-Claim([string]$Path, [int]$BlockNumber, [string]$PuzzleId) {
  $doc = @{
    block   = $BlockNumber
    worker  = $WorkerName
    heartbeat = (Get-Date).ToUniversalTime().ToString("o")
    puzzle  = $PuzzleId
  } | ConvertTo-Json
  [System.IO.File]::WriteAllText($Path, $doc)
}

function Try-ClaimBlock($block) {
  $claimPath = Join-Path $queue ("claims\block-{0:D5}.json" -f [int]$block.block)
  if (Test-Path $claimPath) {
    $existing = $null
    $beat = [datetime]::MinValue
    try {
      $existing = Get-Content -Raw -Path $claimPath | ConvertFrom-Json
      $beat = [datetime]::Parse([string]$existing.heartbeat).ToUniversalTime()
    }
    catch {
      $beat = [datetime]::MinValue
    }
    $owner = ""
    if ($null -ne $existing -and $existing.PSObject.Properties.Name -contains "worker") {
      $owner = [string]$existing.worker
    }
    $age = ([datetime]::UtcNow - $beat).TotalMinutes
    if ($age -lt $StaleMinutes -and $owner -ne $WorkerName) {
      return $false
    }
    Remove-Item -LiteralPath $claimPath -Force -ErrorAction SilentlyContinue
  }
  try {
    $fs = [System.IO.File]::Open($claimPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $fs.Close()
  }
  catch {
    return $false
  }
  Write-Claim $claimPath ([int]$block.block) ""
  $script:heldClaim = $claimPath
  return $true
}

function Invoke-OnePuzzle($spec, [string]$BlockPath) {
  $id = [string]$spec.id
  if (Test-PuzzleDone $id) {
    Write-Host "Skip $id" -ForegroundColor DarkYellow
    $log.WriteLine("skip $id")
    $log.Flush()
    return
  }

  $workPath = Join-Path $queue "work\$id.json"
  python -c "import json,sys; block,pid,out=sys.argv[1:]; doc=json.load(open(block,encoding='utf-8')); spec=next(s for s in doc['specs'] if s['id']==pid); json.dump(spec, open(out,'w',encoding='utf-8'), indent=2); open(out,'a',encoding='utf-8').write('\n')" $BlockPath $id $workPath
  if ($LASTEXITCODE -ne 0) { throw "Could not write spec for $id" }
  $specRel = "tools/data/solver-runs/swap-solve-queue/work/$id.json"
  $outRel = "tools/data/solver-runs/swap-solve-queue/enumerated/$id.json"
  $streamRel = "tools/data/solver-runs/streams/$id"
  $streamDir = Join-Path $RepoRoot "tools\data\solver-runs\streams\$id"
  if (Test-Path $streamDir) { Remove-Item $streamDir -Recurse -Force }

  $solverArgs = @(
    "--spec", $specRel,
    "--viable-seeds-only",
    "--write-solves", $outRel,
    "--json-summary",
    "--progress-every", "$ProgressEvery",
    "--progress-on-json",
    "--max-sol", "$MaxSol",
    "--stream-solves-dir", $streamRel
  )

  Write-Host "docker compose run --rm -T web node solves/solve-level.js $($solverArgs -join ' ')"
  if ($DryRun) { return }

  Push-Location $RepoRoot
  $summaryJson = $null
  try {
    $dockerArgs = @("compose", "run", "--rm", "-T", "web", "node", "solves/solve-level.js") + $solverArgs
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker @dockerArgs 2>&1 | ForEach-Object {
      $line = "$_"
      $isProgress = $line -match '^\s*Progress:'
      $isSummary = $line -match '^\s*\{.*"totalUniqueSolutions"'
      Write-Host $line
      if (-not $isProgress) { $log.WriteLine($line) }
      if ($isSummary -or $isProgress -or $line -match '^\[solve-level\]') { $log.Flush() }
      if ($isProgress -or $isSummary) {
        Write-Claim $script:heldClaim $script:heldBlock $id
      }
      if ($isSummary) {
        try { $summaryJson = $line.Trim() | ConvertFrom-Json } catch { }
      }
    }
    $solveExit = $LASTEXITCODE
    $log.Flush()
    $ErrorActionPreference = $prevEap
  }
  finally {
    Pop-Location
  }

  $count = $null
  $hitCap = $false
  if ($summaryJson) {
    $count = $summaryJson.totalUniqueSolutions
    $hitCap = [bool]$summaryJson.hitMaxSolCap
  }
  $marker = @{
    id                   = $id
    exit                 = $solveExit
    ts                   = (Get-Date).ToUniversalTime().ToString("o")
    worker               = $WorkerName
    totalUniqueSolutions = $count
    hitMaxSolCap         = $hitCap
  }
  $marker | ConvertTo-Json | Set-Content -Path (Get-ResultPath $id) -Encoding utf8
  if (Test-Path $streamDir) { Remove-Item $streamDir -Recurse -Force -ErrorAction SilentlyContinue }

  if ($solveExit -eq 0 -and $null -ne $count -and $count -gt 0 -and -not $hitCap) {
    Write-Host "OK: $id ($count solution(s))" -ForegroundColor Green
  }
  else {
    Write-Host "Problem: $id exit=$solveExit count=$count hitCap=$hitCap" -ForegroundColor Red
  }
}

$taken = 0
$solvedThisRun = 0
try {
  foreach ($block in $manifest.blocks) {
    $number = [int]$block.block
    if ($FromBlock -gt 0 -and $number -lt $FromBlock) { continue }
    if ($ToBlock -gt 0 -and $number -gt $ToBlock) { continue }
    if ($MaxBlocks -gt 0 -and $taken -ge $MaxBlocks) { break }

    $doc = Get-Content -Raw -Path (Join-Path $queue ($block.file -replace '/', '\')) | ConvertFrom-Json
    $waiting = @(
      $doc.specs |
        Where-Object { -not (Test-HasCross $_) } |
        Where-Object { -not (Test-PuzzleDone $_.id) }
    )
    if ($waiting.Count -eq 0) { continue }
    if (-not (Try-ClaimBlock $block)) { continue }

    $script:heldBlock = $number
    $taken++
    Write-Host ""
    Write-Host "==> block $number ($($waiting.Count) waiting) worker $WorkerName" -ForegroundColor Cyan
    $log.WriteLine("=== block $number waiting $($waiting.Count) ===")
    $log.Flush()
    foreach ($spec in $waiting) {
      if ($MaxPuzzles -gt 0 -and $solvedThisRun -ge $MaxPuzzles) { break }
      Write-Claim $script:heldClaim $number ([string]$spec.id)
      Invoke-OnePuzzle $spec (Join-Path $queue ($block.file -replace '/', '\'))
      $solvedThisRun++
    }
    Release-Claim
    if ($MaxPuzzles -gt 0 -and $solvedThisRun -ge $MaxPuzzles) { break }
  }
}
finally {
  Release-Claim
  $log.WriteLine("# worker $WorkerName released")
  $log.Flush()
  $log.Close()
}

Write-Host "Log: $logPath"
if ($taken -eq 0) {
  Write-Host "No waiting block in range." -ForegroundColor Yellow
}
