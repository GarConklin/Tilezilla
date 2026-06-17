<#
.SYNOPSIS
  Archive 6x6 enumeration artifacts from data/solver-runs (streams, logs).

.DESCRIPTION
  After 5x6 enumeration is done and you have built the 6x6 need-enumeration batch,
  use this to shrink data/solver-runs before copying the repo to a remote server.

  Moves to unused_old/solver-runs-6x6-archive-<date>/:
  - data/solver-runs/streams/6x6-*
  - jun05-enumerate-6x6-* logs/ndjson
  - jun13-enumerate-* logs that mention 6x6 levels (optional broad jun13 logs with -IncludeJun135x6Logs)

  Keeps: levels-solution-counts.csv, 6x6-need-enumeration-manifest.json, README.txt

.EXAMPLE
  .\scripts\cleanup-solver-runs-6x6.ps1 -DryRun

.EXAMPLE
  .\scripts\cleanup-solver-runs-6x6.ps1 -Include5x6Streams
#>
param(
  [string]$RepoRoot = "",
  [switch]$DryRun,
  [switch]$Include5x6Streams,
  [switch]$IncludeJun135x6Logs,
  [string]$ArchiveFolderName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$runsDir = Join-Path $RepoRoot "data\solver-runs"
$streamsDir = Join-Path $runsDir "streams"
if (-not (Test-Path $runsDir)) {
  throw "Missing: $runsDir"
}

if ([string]::IsNullOrWhiteSpace($ArchiveFolderName)) {
  $ArchiveFolderName = "solver-runs-6x6-archive-" + (Get-Date -Format "yyyyMMdd")
}
$archiveDir = Join-Path (Join-Path $RepoRoot "unused_old") $ArchiveFolderName
if (-not $DryRun -and -not (Test-Path $archiveDir)) {
  New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
}

$keepNames = @(
  'README.txt',
  '.gitkeep',
  'levels-solution-counts.csv',
  '6x6-need-enumeration-manifest.json',
  '6x6-need-enumeration-ids.txt',
  '6x6-enumeration-plan.md'
)

$toMove = @()

if (Test-Path $streamsDir) {
  $sixStreams = Get-ChildItem -Path $streamsDir -Directory -Filter "6x6-*" -ErrorAction SilentlyContinue
  $toMove += $sixStreams
  if ($Include5x6Streams) {
    $toMove += Get-ChildItem -Path $streamsDir -Directory -Filter "5x6-*" -ErrorAction SilentlyContinue
  }
}

$filePatterns = @(
  "jun05-enumerate-6x6-*.log",
  "jun05-enumerate-6x6-*.ndjson"
)
if ($IncludeJun135x6Logs) {
  $filePatterns += @(
    "jun13-enumerate-*.log",
    "jun13-enumerate-*.ndjson",
    "jun09-enumerate-*.log",
    "jun09-enumerate-*.ndjson"
  )
}

foreach ($pattern in $filePatterns) {
  $toMove += Get-ChildItem -Path $runsDir -Filter $pattern -File -ErrorAction SilentlyContinue
}

$toMove = $toMove | Where-Object { $keepNames -notcontains $_.Name } | Sort-Object FullName -Unique

Write-Host "Archive destination: $archiveDir"
Write-Host "Items to move: $($toMove.Count)"
if ($Include5x6Streams) { Write-Host "  (includes 5x6 stream folders)" -ForegroundColor DarkGray }

if ($toMove.Count -eq 0) {
  Write-Host "Nothing to archive."
  exit 0
}

$manifest = Join-Path $archiveDir ("moved-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".txt")

foreach ($item in $toMove) {
  $rel = $item.FullName.Substring($RepoRoot.Length).TrimStart('\', '/')
  if ($DryRun) {
    Write-Host "  [dry-run] $rel"
    continue
  }
  $dest = Join-Path $archiveDir $item.Name
  if ($item.PSIsContainer) {
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Move-Item -Path $item.FullName -Destination $dest -Force
  }
  else {
    if (Test-Path $dest) { Remove-Item $dest -Force }
    Move-Item -Path $item.FullName -Destination $dest -Force
  }
}

if (-not $DryRun) {
  $toMove | ForEach-Object { $_.FullName.Substring($RepoRoot.Length).TrimStart('\', '/') } |
    Set-Content -Path $manifest -Encoding utf8
  Write-Host "Moved $($toMove.Count) item(s). Manifest: $manifest" -ForegroundColor Green
  Write-Host ""
  Write-Host "Optional — archive ingest/dedupe proof files too:" -ForegroundColor DarkGray
  Write-Host "  .\scripts\archive-run-artifacts.ps1" -ForegroundColor DarkGray
}
