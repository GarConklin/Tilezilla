<#
.SYNOPSIS
  Enumerate and write solve files for levels that have pathCount > 0 but no solutions on disk.

.DESCRIPTION
  Finds single-snake levels (1 SH, 1 ET) missing solves/, optionally fixes catalog
  pathMode multi -> single (pathMode is for extra snakes, not multiple solutions),
  then runs solve-level.js once per level via Docker, sequentially.

  Typical case: 4x4 levels where misfiled solves were removed but pathCount was left set.

.EXAMPLE
  .\scripts\run-missing-solves.ps1 -DryRun

.EXAMPLE
  .\scripts\run-missing-solves.ps1 -OnlySizes 4x4

.EXAMPLE
  .\scripts\run-missing-solves.ps1 -LevelIds "4x4-0A-ADC,4x4-0A-ADD,4x4-0A-ADE"

.EXAMPLE
  .\scripts\run-missing-solves.ps1 -OnlySizes 4x4 -FixPathMode
#>
param(
  [string]$RepoRoot = "",

  [string]$OnlySizes = "",

  [string]$LevelIds = "",

  [switch]$FixPathMode,

  [switch]$DryRun,

  [switch]$ContinueOnError,

  [string]$LogDir = "data/solver-runs"
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

$listArgs = @()
if ($OnlySizes) { $listArgs += @("--only-sizes", $OnlySizes) }
if ($LevelIds) { $listArgs += @("--ids", $LevelIds) }
if ($FixPathMode) {
  $listArgs += @("--fix-path-mode")
  if (-not $DryRun) { $listArgs += @("--apply") }
}

Write-Step "Listing missing solve levels"
$ids = @(
  Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "list-missing-solve-levels.js" -ExtraArgs $listArgs |
    Where-Object { $_ -match '^\S+-\S+-\S+$' }
)

if ($ids.Count -eq 0) {
  Write-Host "No levels need solving (pathCount > 0, single-snake, empty/missing solve file)." -ForegroundColor Green
  exit 0
}

Write-Host "Queue ($($ids.Count)): $($ids -join ', ')"

$logRoot = Join-Path $RepoRoot ($LogDir -replace '/', '\')
if (-not (Test-Path $logRoot)) {
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logRoot "run-missing-solves-$stamp.log"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# run-missing-solves $stamp")
$log.WriteLine("# ids: $($ids -join ', ')")
$log.Flush()

$solverFlags = @(
  "--viable-seeds-only",
  "--write-solves",
  "--json-summary",
  "--progress-every", "1",
  "--progress-on-json"
)

$failed = @()
$n = 0

foreach ($levelId in $ids) {
  $n++
  Write-Step "[$n/$($ids.Count)] $levelId"
  $log.WriteLine("")
  $log.WriteLine("=== [$n/$($ids.Count)] $levelId ===")
  $log.Flush()

  if ($DryRun) {
    $cmd = "docker compose run --rm web node solves/solve-level.js $levelId $($solverFlags -join ' ')"
    Write-Host "[dry-run] $cmd" -ForegroundColor DarkYellow
    $log.WriteLine("[dry-run] $cmd")
    $log.Flush()
    continue
  }

  Push-Location $RepoRoot
  try {
    $dockerArgs = @(
      "compose", "run", "--rm", "web",
      "node", "solves/solve-level.js",
      $levelId
    ) + $solverFlags
    $cmdLine = "docker $($dockerArgs -join ' ')"
    Write-Host $cmdLine
    $log.WriteLine($cmdLine)
    $log.Flush()

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker @dockerArgs 2>&1 | ForEach-Object {
      $line = "$_"
      Write-Host $line
      $log.WriteLine($line)
      $log.Flush()
    }
    $ErrorActionPreference = $prevEap

    if ($LASTEXITCODE -ne 0) {
      $failed += $levelId
      Write-Host "FAILED: $levelId (exit $LASTEXITCODE)" -ForegroundColor Red
      $log.WriteLine("FAILED exit $LASTEXITCODE")
      $log.Flush()
      if (-not $ContinueOnError) {
        throw "Solve failed for $levelId"
      }
    }
    else {
      Write-Host "OK: $levelId" -ForegroundColor Green
      $log.WriteLine("OK")
      $log.Flush()
    }
  }
  finally {
    Pop-Location
  }
}

$log.WriteLine("")
$log.WriteLine("Done. failed: $($failed.Count)")
$log.Close()

Write-Host ""
Write-Host "Log: $logPath"

if ($failed.Count -gt 0) {
  Write-Host "Failed ($($failed.Count)): $($failed -join ', ')" -ForegroundColor Red
  exit 1
}

if (-not $DryRun) {
  Write-Step "Sync catalog pathCount from new solve files (pathMode unchanged)"
  $syncArgs = @("--apply")
  if ($LevelIds) { $syncArgs += @("--ids", $LevelIds) }
  Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "sync-catalog-path-count-from-solves.js" -ExtraArgs $syncArgs
  Write-Host "Re-export CSV: docker compose run --rm web python scripts/export_levels_csv.py --out data/solver-runs/levels-solution-counts.csv"
}

Write-Host "All $($ids.Count) level(s) finished." -ForegroundColor Green
