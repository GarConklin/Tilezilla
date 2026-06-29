<#
.SYNOPSIS
  Re-run solve-level.js for levels emptied by loop-audit --fix (single-snake only).

.EXAMPLE
  .\scripts\run-retry-loop-audit-solves.ps1
  .\scripts\run-retry-loop-audit-solves.ps1 -ContinueOnError
#>
param(
  [string]$RepoRoot = "",
  [switch]$ContinueOnError,
  [string]$LogDir = "data/solver-runs"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

# Single-snake levels from loop-audit cleanup (two-snake needs future enumerator).
$LevelIds = @(
  "3x4-0C-AAG",
  "3x4-0B-AAA",
  "3x4-0B-ABD",
  "3x4-0B-ACH",
  "3x6-0C-AAG",
  "4x4-0C-AAB",
  "4x4-0C-AAD"
)

$solverFlags = @(
  "--viable-seeds-only",
  "--write-solves",
  "--json-summary",
  "--progress-every", "1",
  "--progress-on-json"
)

$logRoot = Join-Path $RepoRoot ($LogDir -replace '/', '\')
if (-not (Test-Path $logRoot)) {
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logRoot "run-retry-loop-audit-solves-$stamp.log"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# run-retry-loop-audit-solves $stamp")
$log.WriteLine("# ids: $($LevelIds -join ', ')")
$log.Flush()

$failed = @()
$n = 0

Push-Location $RepoRoot
try {
  foreach ($levelId in $LevelIds) {
    $n++
    Write-Host ""
    Write-Host "==> [$n/$($LevelIds.Count)] $levelId" -ForegroundColor Cyan
    $log.WriteLine("")
    $log.WriteLine("=== [$n/$($LevelIds.Count)] $levelId ===")
    $log.Flush()

    $dockerArgs = @(
      "compose", "-f", "docker-compose.yml", "run", "--rm", "web",
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
      if (-not $ContinueOnError) { break }
    }
    else {
      Write-Host "OK: $levelId" -ForegroundColor Green
      $log.WriteLine("OK")
      $log.Flush()
    }
  }
}
finally {
  Pop-Location
}

if ($failed.Count -eq 0) {
  Write-Host ""
  Write-Host "Syncing catalog totalUniqueSolutions from solve files..." -ForegroundColor Cyan
  $syncArgs = @("compose", "-f", "docker-compose.yml", "run", "--rm", "web", "node", "scripts/sync-catalog-path-count-from-solves.js", "--apply")
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & docker @syncArgs 2>&1 | ForEach-Object {
    Write-Host $_
    $log.WriteLine("$_")
  }
  $ErrorActionPreference = $prevEap
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

Write-Host "All $($LevelIds.Count) level(s) finished." -ForegroundColor Green
