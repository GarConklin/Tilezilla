<#
.SYNOPSIS
  Remove rotational duplicate solutions from solves/*.json (via Docker).

.DESCRIPTION
  - Square boards (3x3, 4x4, 5x5, 6x6): drop duplicates under 90/180/270 rotation.
  - Rectangle boards (5x6, etc.): drop duplicates under 180 rotation only.
  Then syncs catalog pathCount (pathMode from tile bag) and re-exports levels-solution-counts.csv.

.EXAMPLE
  .\scripts\dedupe-solve-rotations.ps1

.EXAMPLE
  .\scripts\dedupe-solve-rotations.ps1 -AuditOnly

.EXAMPLE
  .\scripts\dedupe-solve-rotations.ps1 -OpenTail
#>
param(
  [string]$RepoRoot = "",
  [switch]$AuditOnly,
  [switch]$SkipCsv,
  [switch]$OpenTail
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "lib\Docker-Web.ps1")

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

if (-not (Test-DockerCompose -RepoRoot $RepoRoot)) {
  throw "Docker Compose not available."
}

$runsDir = Join-Path $RepoRoot "data\solver-runs"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $runsDir "dedupe-rotations-$stamp.log"
$logWriter = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$logWriter.AutoFlush = $true

function Write-RunLog {
  param([string]$Message, [string]$Color = "")
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
  $logWriter.WriteLine($line)
  if ($Color) { Write-Host $line -ForegroundColor $Color } else { Write-Host $line }
}

Write-RunLog "=== dedupe-solve-rotations ==="
Write-RunLog "LOG: $logPath"
Write-RunLog "AuditOnly: $AuditOnly"
Write-RunLog "Watch: Get-Content -LiteralPath '$logPath' -Wait -Tail 40"
Write-RunLog ""

if ($OpenTail) {
  Start-Process powershell -ArgumentList @('-NoExit', '-Command', "Get-Content -LiteralPath '$logPath' -Wait -Tail 40") | Out-Null
}

$reportPath = "data/solver-runs/rotation-dedup-audit-$stamp.json"
$dedupeArgs = @("--summary", "--report-out", $reportPath)
if (-not $AuditOnly) { $dedupeArgs += "--fix" }

Write-RunLog "STEP: audit-solve-dedup (all solves/*.json)" "Cyan"
Write-RunLog "Report: $reportPath"
Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "audit-solve-dedup.js" -ExtraArgs $dedupeArgs -LogWriter $logWriter
Write-RunLog "JSON report: $reportPath" "Green"

if ($AuditOnly) {
  Write-RunLog "Audit only - no files changed." "Yellow"
  $logWriter.Dispose()
  exit 0
}

Write-RunLog "STEP: sync catalog pathCount" "Cyan"
Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "sync-catalog-path-count-from-solves.js" -ExtraArgs @("--apply") -LogWriter $logWriter

if (-not $SkipCsv) {
  Write-RunLog "STEP: export levels-solution-counts.csv" "Cyan"
  Push-Location $RepoRoot
  try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $out = & docker compose run --rm web python scripts/export_levels_csv.py --out data/solver-runs/levels-solution-counts.csv 2>&1
    $ErrorActionPreference = $prev
    foreach ($line in $out) {
      Write-RunLog "$line"
    }
  }
  finally {
    Pop-Location
  }
}

Write-RunLog "=== finished ===" "Green"
$logWriter.Dispose()
Write-Host "Log: $logPath" -ForegroundColor Green
