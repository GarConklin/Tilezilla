<#
.SYNOPSIS
  Zip stale data/solver-runs artifacts into data/unused/ and remove them from the active folder.

.DESCRIPTION
  Keeps only files still referenced by ingest/audit scripts. Everything else is copied
  into a staging tree, compressed to data/unused/solver-runs-archive-<timestamp>.zip,
  verified, then deleted. Writes a manifest JSON listing kept vs archived paths.

  Does NOT touch solves/, data/levels/*.json, or data/levels/reports/ (use -IncludeLevelReports
  to optionally archive empty or stale audit stream folders).

.EXAMPLE
  .\scripts\archive-solver-runs.ps1 -WhatIf

.EXAMPLE
  .\scripts\archive-solver-runs.ps1

.EXAMPLE
  .\scripts\archive-solver-runs.ps1 -IncludeLevelReports
#>
param(
  [string]$RepoRoot = "",
  [string]$ArchiveDir = "",
  [switch]$WhatIf,
  [switch]$IncludeLevelReports,
  [switch]$KeepLatestIngestReport,
  [string]$DeleteFromManifest = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$runsDir = Join-Path $RepoRoot "data\solver-runs"
if (-not (Test-Path $runsDir)) {
  throw "Missing: $runsDir"
}

if ($DeleteFromManifest) {
  $mf = $DeleteFromManifest
  if (-not [System.IO.Path]::IsPathRooted($mf)) {
    $mf = Join-Path $RepoRoot $mf
  }
  if (-not (Test-Path $mf)) { throw "Manifest not found: $mf" }
  $data = Get-Content $mf -Raw | ConvertFrom-Json
  $failed = @()
  foreach ($rel in $data.archived) {
    $full = Join-Path $RepoRoot ($rel -replace '/', '\')
    if (-not (Test-Path $full)) { continue }
    if ($WhatIf) {
      Write-Host "[WhatIf] delete $rel"
      continue
    }
    try { Remove-Item -LiteralPath $full -Force -ErrorAction Stop }
    catch { $failed += $rel }
  }
  foreach ($d in Get-ChildItem -Path $runsDir -Directory -Recurse -EA SilentlyContinue | Sort-Object FullName -Descending) {
    if (-not (Get-ChildItem -Path $d.FullName -Force -EA SilentlyContinue)) {
      if (-not $WhatIf) { Remove-Item -LiteralPath $d.FullName -Force -EA SilentlyContinue }
    }
  }
  if ($failed.Count) {
    Write-Warning "Still present ($($failed.Count)): close editors and re-run -DeleteFromManifest"
    $failed | Select-Object -First 10 | ForEach-Object { Write-Warning "  $_" }
  }
  else { Write-Host "Deleted all paths from manifest." -ForegroundColor Green }
  exit 0
}

if ([string]::IsNullOrWhiteSpace($ArchiveDir)) {
  $ArchiveDir = Join-Path $RepoRoot "data\unused"
}
New-Item -ItemType Directory -Force -Path $ArchiveDir | Out-Null

# Exact filenames always kept in data/solver-runs/
$keepFiles = @(
  ".gitkeep",
  "README.txt",
  "levels-solution-counts.csv",
  "level-solve-bag-match-latest.json",
  "level-solve-bag-match-latest.md"
)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "solver-runs-archive-$stamp.zip"
$zipPath = Join-Path $ArchiveDir $zipName
$manifestPath = Join-Path $ArchiveDir "solver-runs-archive-$stamp-manifest.json"
$stageRoot = Join-Path $ArchiveDir "_staging-solver-runs-$stamp"

function Get-LatestIngestReportPaths {
  $latest = Get-ChildItem -Path $runsDir -Filter "ingest-report-*.md" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $latest) { return @() }
  $paths = @($latest.FullName)
  $json = $latest.FullName -replace '\.md$', '.json'
  if (Test-Path $json) { $paths += $json }
  return $paths
}

$extraKeep = @()
if ($KeepLatestIngestReport) {
  $extraKeep = Get-LatestIngestReportPaths
}

$toArchive = New-Object System.Collections.Generic.List[string]
$kept = New-Object System.Collections.Generic.List[string]

# Top-level files
foreach ($f in Get-ChildItem -Path $runsDir -File -ErrorAction SilentlyContinue) {
  if ($keepFiles -contains $f.Name) {
    [void]$kept.Add($f.FullName.Substring($RepoRoot.Length + 1))
    continue
  }
  if ($extraKeep -contains $f.FullName) {
    [void]$kept.Add($f.FullName.Substring($RepoRoot.Length + 1))
    continue
  }
  [void]$toArchive.Add($f.FullName)
}

# All subdirectories under solver-runs (backups, chunks, etc.)
foreach ($d in Get-ChildItem -Path $runsDir -Directory -ErrorAction SilentlyContinue) {
  foreach ($f in Get-ChildItem -Path $d.FullName -Recurse -File -Force -ErrorAction SilentlyContinue) {
    [void]$toArchive.Add($f.FullName)
  }
}

# Optional: stale audit stream dirs under data/levels/reports
$reportArchive = New-Object System.Collections.Generic.List[string]
if ($IncludeLevelReports) {
  $reportsRoot = Join-Path $RepoRoot "data\levels\reports"
  if (Test-Path $reportsRoot) {
    foreach ($d in Get-ChildItem -Path $reportsRoot -Directory -Filter "audit-solved-layouts-*" -ErrorAction SilentlyContinue) {
      $files = @(Get-ChildItem -Path $d.FullName -Recurse -File -ErrorAction SilentlyContinue)
      if ($files.Count -eq 0) {
        [void]$reportArchive.Add($d.FullName)
        continue
      }
      $progress = Get-ChildItem -Path $reportsRoot -Filter "audit-enumerator-vs-catalog-progress-*" -File -ErrorAction SilentlyContinue
      $recentProgress = $progress | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($recentProgress -and $d.LastWriteTime -lt $recentProgress.LastWriteTime.AddDays(-7)) {
        foreach ($f in $files) { [void]$reportArchive.Add($f.FullName) }
      }
    }
    foreach ($f in Get-ChildItem -Path $reportsRoot -File -Filter "audit-enumerator-vs-catalog-*.json" -ErrorAction SilentlyContinue) {
      if ($f.Name -notlike "*-progress-*") {
        [void]$reportArchive.Add($f.FullName)
      }
    }
    $keepProgress = Get-ChildItem -Path $reportsRoot -Filter "audit-enumerator-vs-catalog-progress-*" -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($keepProgress) {
      [void]$kept.Add($keepProgress.FullName.Substring($RepoRoot.Length + 1))
    }
  }
}

$allArchive = @($toArchive) + @($reportArchive)
$totalBytes = ($allArchive | ForEach-Object { (Get-Item $_ -ErrorAction SilentlyContinue).Length } | Measure-Object -Sum).Sum
$totalMb = [math]::Round($totalBytes / 1MB, 2)

Write-Host ""
Write-Host "=== archive-solver-runs ===" -ForegroundColor Cyan
Write-Host "Repo:       $RepoRoot"
Write-Host "Archive to: $zipPath"
Write-Host "Files:      $($toArchive.Count) under solver-runs ($totalMb MB)"
if ($reportArchive.Count -gt 0) {
  Write-Host "Reports:    $($reportArchive.Count) under data/levels/reports"
}
Write-Host "Keeping:    $($kept.Count) path(s) in solver-runs"
foreach ($k in $kept) { Write-Host "  + $k" -ForegroundColor DarkGreen }

if ($allArchive.Count -eq 0) {
  Write-Host "Nothing to archive." -ForegroundColor Yellow
  exit 0
}

if ($WhatIf) {
  Write-Host ""
  Write-Host "[WhatIf] Would archive:" -ForegroundColor Yellow
  $allArchive | Select-Object -First 40 | ForEach-Object {
    Write-Host "  $_"
  }
  if ($allArchive.Count -gt 40) {
    Write-Host "  ... and $($allArchive.Count - 40) more"
  }
  exit 0
}

if (Test-Path $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null

foreach ($src in $allArchive) {
  if (-not (Test-Path $src)) { continue }
  $rel = $src.Substring($RepoRoot.Length).TrimStart('\', '/')
  $dest = Join-Path $stageRoot $rel
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  }
  Copy-Item -LiteralPath $src -Destination $dest -Force
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

$zipItem = Get-Item $zipPath
if ($zipItem.Length -lt 100) {
  throw "Zip looks invalid (too small): $zipPath"
}

# Quick open test
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$entryCount = $zip.Entries.Count
$zip.Dispose()
if ($entryCount -lt 1) {
  throw "Zip has no entries: $zipPath"
}

$manifest = [ordered]@{
  createdAt   = (Get-Date).ToString("o")
  zipFile     = $zipName
  zipBytes    = $zipItem.Length
  zipEntries  = $entryCount
  kept        = @($kept)
  archived    = @($allArchive | ForEach-Object { $_.Substring($RepoRoot.Length + 1) })
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "Created zip: $zipPath ($([math]::Round($zipItem.Length / 1MB, 2)) MB, $entryCount entries)" -ForegroundColor Green
Write-Host "Manifest:    $manifestPath"

$deleteFailed = New-Object System.Collections.Generic.List[string]
foreach ($src in $allArchive) {
  if (-not (Test-Path $src)) { continue }
  try {
    Remove-Item -LiteralPath $src -Force -ErrorAction Stop
  }
  catch {
    [void]$deleteFailed.Add($src.Substring($RepoRoot.Length + 1))
  }
}
if ($deleteFailed.Count -gt 0) {
  Write-Warning "Could not delete $($deleteFailed.Count) file(s) (in use?). Re-run after closing editors:"
  $deleteFailed | Select-Object -First 15 | ForEach-Object { Write-Warning "  $_" }
}

# Remove empty dirs under solver-runs
foreach ($d in Get-ChildItem -Path $runsDir -Directory -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending) {
  $remaining = Get-ChildItem -Path $d.FullName -Force -ErrorAction SilentlyContinue
  if (-not $remaining) {
    Remove-Item -LiteralPath $d.FullName -Force -ErrorAction SilentlyContinue
  }
}

if ($IncludeLevelReports) {
  foreach ($d in Get-ChildItem -Path (Join-Path $RepoRoot "data\levels\reports") -Directory -Filter "audit-solved-layouts-*" -EA SilentlyContinue) {
    $left = Get-ChildItem -Path $d.FullName -Recurse -Force -EA SilentlyContinue
    if (-not $left) {
      Remove-Item -LiteralPath $d.FullName -Force -EA SilentlyContinue
    }
  }
}

Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Active data/solver-runs/ now contains only:" -ForegroundColor Green
Get-ChildItem -Path $runsDir -Force | ForEach-Object { Write-Host "  $($_.Name)" }
