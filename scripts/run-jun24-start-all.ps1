<#
.SYNOPSIS
  Ingest Jun 24 5x6 batch, then launch 4 parallel enumerate workers.

.DESCRIPTION
  Requires Docker Desktop running.

  1. Ingest full 5x6 file (485 levels, solve-1 seeds)
  2. Start Batch1…Batch4 enumerate in background PowerShell jobs

.EXAMPLE
  .\scripts\run-jun24-start-all.ps1

.EXAMPLE
  .\scripts\run-jun24-start-all.ps1 -SkipIngest
#>
param(
  [switch]$SkipIngest,
  [string]$RepoRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

. (Join-Path $PSScriptRoot "lib\Docker-Web.ps1")
if (-not (Test-DockerCompose -RepoRoot $RepoRoot)) {
  throw "Docker compose not available. Start Docker Desktop, then re-run."
}

$batch5x6 = Join-Path $RepoRoot "data\5x6 tilepz solves 24 June  2026.txt"
if (-not (Test-Path $batch5x6)) {
  throw "Missing: $batch5x6"
}

Write-Host ""
Write-Host "Jun 24 — 5x6 only (485 levels, 4 parallel batches)" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipIngest) {
  Write-Host "==> Ingest 5x6 batch" -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot "ingest-solve-batch.ps1") -BatchFile $batch5x6 -RepoRoot $RepoRoot
}

Write-Host "==> Build enumerate manifest" -ForegroundColor Cyan
& node (Join-Path $RepoRoot "scripts\gen-jun24-enumerate-manifest.js")

$enumerate = Join-Path $PSScriptRoot "run-jun24-enumerate.ps1"
$common = @("-NoTty", "-ContinueOnError")
$jobs = @()

foreach ($phase in @("Batch1", "Batch2", "Batch3", "Batch4")) {
  Write-Host "Starting background job: $phase" -ForegroundColor Green
  $jobs += Start-Job -Name "jun24-$phase" -ScriptBlock {
    param($Script, $Phase, $Root, $Args)
    Set-Location $Root
    & $Script -Phase $Phase @Args
  } -ArgumentList $enumerate, $phase, $RepoRoot, $common
}

Write-Host ""
Write-Host "Started $($jobs.Count) enumerate jobs. Monitor:" -ForegroundColor Yellow
Write-Host "  Get-Job | Format-Table" -ForegroundColor DarkGray
Write-Host "  Receive-Job -Name jun24-Batch1 -Keep" -ForegroundColor DarkGray
Write-Host "  .\scripts\show-solve-runs-status.ps1 -Watch" -ForegroundColor DarkGray
Write-Host ""
Write-Host "When all batches finish:" -ForegroundColor Yellow
Write-Host "  .\scripts\run-jun24-enumerate.ps1 -Phase All -SyncCatalogOnly -NoTty" -ForegroundColor DarkGray
