<#
.SYNOPSIS
  Archive one-off solver run artifacts after ingest + catalog sync are done.

.DESCRIPTION
  Moves transient files from data/solver-runs to unused_old/.

  Safety gate: requires ingest-report-*.json and catalog-sync-*.json to exist
  (proves merge + sync ran) unless -SkipSafetyGate.

  Once the gate passes, ALL proof receipts are archived (ingest reports, catalog
  sync JSON, bag-match audit) — the real data is already in data/levels and solves/.

  Keeps in data/solver-runs: README.txt, .gitkeep, levels-solution-counts.csv

.EXAMPLE
  .\scripts\archive-run-artifacts.ps1 -DryRun

.EXAMPLE
  .\scripts\archive-run-artifacts.ps1
#>
param(
  [string]$RepoRoot = "",
  [switch]$DryRun,
  [string]$ArchiveFolderName = "",
  [int]$KeepLatestRunLogs = 0,
  [switch]$SkipSafetyGate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

if ($KeepLatestRunLogs -lt 0) {
  throw "-KeepLatestRunLogs must be >= 0"
}

$runsDir = Join-Path $RepoRoot "data\solver-runs"
if (-not (Test-Path $runsDir)) {
  throw "Missing directory: $runsDir"
}

if ([string]::IsNullOrWhiteSpace($ArchiveFolderName)) {
  $ArchiveFolderName = "solver-runs-archive-" + (Get-Date -Format "yyyyMMdd")
}
$archiveDir = Join-Path (Join-Path $RepoRoot "unused_old") $ArchiveFolderName
if (-not (Test-Path $archiveDir)) {
  New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
}

$keepInRuns = @('README.txt', '.gitkeep', 'levels-solution-counts.csv')

function LatestByPattern([string]$Pattern) {
  return Get-ChildItem -Path $runsDir -Filter $Pattern -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

$latestIngestReport = LatestByPattern "ingest-report-*.json"
$latestCatalogSync = LatestByPattern "catalog-sync-*.json"

if (-not $SkipSafetyGate) {
  if ($null -eq $latestIngestReport) {
    throw "Safety gate: no ingest-report-*.json in data/solver-runs. Run ingest + sync first, or use -SkipSafetyGate."
  }
  if ($null -eq $latestCatalogSync) {
    throw "Safety gate: no catalog-sync-*.json in data/solver-runs. Run sync first, or use -SkipSafetyGate."
  }
}

# Proof files: move every match (data already in catalog + solves).
$proofPatterns = @(
  "ingest-batch-*.log",
  "ingest-report-*.json",
  "ingest-report-*.md",
  "catalog-sync-*.json",
  "catalog-tiles-sync-*.json",
  "misfiled-solve-fix-*.json",
  "level-solve-bag-match-latest.json",
  "level-solve-bag-match-latest.md",
  "dedupe-rotations-*.log",
  "rotation-dedup-audit-*.json"
)

$runLogPatterns = @(
  "enumerate-*.log",
  "enumerate-*.ndjson",
  "may30-enumerate-*.log",
  "may30-enumerate-*.ndjson",
  "may31-enumerate-*.log",
  "may31-enumerate-*.ndjson",
  "jun01-enumerate-*.log",
  "jun01-enumerate-*.ndjson",
  "jun03-enumerate-*.log",
  "jun03-enumerate-*.ndjson",
  "jun05-enumerate-5x6-*.log",
  "jun05-enumerate-5x6-*.ndjson",
  "jun07-enumerate-5x6-*.log",
  "jun07-enumerate-5x6-*.ndjson"
)

function Select-ArchiveCandidates {
  param(
    [string[]]$Patterns,
    [int]$KeepLatest
  )
  $out = @()
  foreach ($pattern in $Patterns) {
    $all = @(Get-ChildItem -Path $runsDir -Filter $pattern -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending)
    if ($all.Count -eq 0) { continue }
    $skipCount = [Math]::Min($KeepLatest, $all.Count)
    $out += @($all | Select-Object -Skip $skipCount)
  }
  return $out
}

$toMove = @(
  Select-ArchiveCandidates -Patterns $proofPatterns -KeepLatest 0
  Select-ArchiveCandidates -Patterns $runLogPatterns -KeepLatest $KeepLatestRunLogs
) | Where-Object { $keepInRuns -notcontains $_.Name } |
  Sort-Object FullName -Unique

Write-Host "Safety proof:"
Write-Host "  skip safety gate:     $SkipSafetyGate"
Write-Host "  latest ingest report: $(if($latestIngestReport){$latestIngestReport.Name} else {'<none>'})"
Write-Host "  latest catalog sync:  $(if($latestCatalogSync){$latestCatalogSync.Name} else {'<none>'})"
Write-Host ""
Write-Host "Archive dir: $archiveDir"
Write-Host "Files selected: $($toMove.Count)"
Write-Host "Stays in data/solver-runs: $($keepInRuns -join ', ')"

if ($toMove.Count -eq 0) {
  Write-Host "Nothing to move."
  exit 0
}

$manifest = Join-Path $archiveDir ("moved-files-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".txt")

if ($DryRun) {
  Write-Host ""
  Write-Host "Dry run: planned moves"
  $toMove | ForEach-Object { Write-Host "  $($_.Name)" }
  $toMove.Name | Set-Content -Path $manifest -Encoding utf8
  Write-Host ""
  Write-Host "Wrote manifest: $manifest"
  exit 0
}

foreach ($file in $toMove) {
  $dest = Join-Path $archiveDir $file.Name
  if (Test-Path $dest) { Remove-Item $dest -Force }
  Move-Item -Path $file.FullName -Destination $dest -Force
}
$toMove.Name | Set-Content -Path $manifest -Encoding utf8

Write-Host ""
Write-Host "Moved $($toMove.Count) files."
Write-Host "Manifest: $manifest"
