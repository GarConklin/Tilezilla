<#
.SYNOPSIS
  Zip superseded / one-off scripts into data/unused/ and remove from scripts/.

.EXAMPLE
  .\scripts\archive-old-scripts.ps1 -WhatIf

.EXAMPLE
  .\scripts\archive-old-scripts.ps1

.EXAMPLE
  .\scripts\archive-old-scripts.ps1 -IncludeLevelReports
#>
param(
  [string]$RepoRoot = "",
  [string]$ArchiveDir = "",
  [switch]$WhatIf,
  [switch]$IncludeLevelReports
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$scriptsDir = Join-Path $RepoRoot "scripts"
if ([string]::IsNullOrWhiteSpace($ArchiveDir)) {
  $ArchiveDir = Join-Path $RepoRoot "data\unused"
}
New-Item -ItemType Directory -Force -Path $ArchiveDir | Out-Null

# Active maintenance scripts — do not archive
$keepRel = @(
  "lib\Docker-Web.ps1",
  "lib\web-validate-board-node.js",
  "ingest-solve-batch.ps1",
  "merge-solve-docs-append.js",
  "sync-catalog-path-count-from-solves.js",
  "sync-catalog-tiles-from-solves.js",
  "audit-level-solve-tile-bags.js",
  "fix-misfiled-duplicate-solves.js",
  "ingest-solve-file-with-report.js",
  "dedupe-solve-rotations.ps1",
  "audit-solve-dedup.js",
  "archive-solver-runs.ps1",
  "archive-old-scripts.ps1",
  "reconcile-audit-solved-layouts.js",
  "audit-enumerator-vs-catalog.js",
  "export_levels_csv.py",
  "repack-solves-and-git.ps1",
  "refresh-solve-queue.js",
  "run-solve-queue-docker.bat",
  "normalize-solve-id-labels.js",
  "validate-solve-docs-web-checker.js"
)
$keepSet = [System.Collections.Generic.HashSet[string]]::new(
  [StringComparer]::OrdinalIgnoreCase
)
foreach ($k in $keepRel) { [void]$keepSet.Add($k) }

$toArchive = New-Object System.Collections.Generic.List[string]
foreach ($f in Get-ChildItem -Path $scriptsDir -Recurse -File -Force) {
  $rel = $f.FullName.Substring($scriptsDir.Length).TrimStart('\', '/')
  if ($keepSet.Contains($rel)) { continue }
  [void]$toArchive.Add($f.FullName)
}

$reportArchive = New-Object System.Collections.Generic.List[string]
if ($IncludeLevelReports) {
  $reportsRoot = Join-Path $RepoRoot "data\levels\reports"
  if (Test-Path $reportsRoot) {
    foreach ($item in Get-ChildItem -Path $reportsRoot -Force) {
      if ($item.PSIsContainer) {
        foreach ($f in Get-ChildItem -Path $item.FullName -Recurse -File -Force) {
          [void]$reportArchive.Add($f.FullName)
        }
      }
      else {
        [void]$reportArchive.Add($item.FullName)
      }
    }
  }
}

$all = @($toArchive) + @($reportArchive)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipPath = Join-Path $ArchiveDir "scripts-archive-$stamp.zip"
$manifestPath = Join-Path $ArchiveDir "scripts-archive-$stamp-manifest.json"

Write-Host "=== archive-old-scripts ===" -ForegroundColor Cyan
Write-Host "Archive: $zipPath"
Write-Host "Scripts to archive: $($toArchive.Count)"
if ($IncludeLevelReports) { Write-Host "Reports to archive: $($reportArchive.Count)" }
Write-Host "Keeping $($keepSet.Count) script paths in scripts/"

if ($all.Count -eq 0) {
  Write-Host "Nothing to archive."
  exit 0
}

if ($WhatIf) {
  $all | ForEach-Object { Write-Host "  $_" }
  exit 0
}

$stageRoot = Join-Path $ArchiveDir "_staging-scripts-$stamp"
if (Test-Path $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null

foreach ($src in $all) {
  $rel = $src.Substring($RepoRoot.Length).TrimStart('\', '/')
  $dest = Join-Path $stageRoot $rel
  $parent = Split-Path $dest -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  Copy-Item -LiteralPath $src -Destination $dest -Force
}

if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$entryCount = $zip.Entries.Count
$zip.Dispose()
if ($entryCount -lt 1) { throw "Zip empty: $zipPath" }

$manifest = [ordered]@{
  createdAt = (Get-Date).ToString("o")
  zipFile   = [IO.Path]::GetFileName($zipPath)
  zipBytes  = (Get-Item $zipPath).Length
  zipEntries = $entryCount
  keptScripts = @($keepRel | Sort-Object)
  archived  = @($all | ForEach-Object { $_.Substring($RepoRoot.Length + 1) })
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

$failed = @()
foreach ($src in $all) {
  if (-not (Test-Path $src)) { continue }
  try { Remove-Item -LiteralPath $src -Force -ErrorAction Stop }
  catch { $failed += $src }
}

foreach ($d in Get-ChildItem -Path $scriptsDir -Directory -Recurse -EA SilentlyContinue | Sort-Object FullName -Descending) {
  if (-not (Get-ChildItem -Path $d.FullName -Force -EA SilentlyContinue)) {
    Remove-Item -LiteralPath $d.FullName -Force -EA SilentlyContinue
  }
}

if ($IncludeLevelReports) {
  $reportsRoot = Join-Path $RepoRoot "data\levels\reports"
  foreach ($d in Get-ChildItem -Path $reportsRoot -Directory -EA SilentlyContinue) {
    if (-not (Get-ChildItem -Path $d.FullName -Force -EA SilentlyContinue)) {
      Remove-Item -LiteralPath $d.FullName -Force -EA SilentlyContinue
    }
  }
}

Remove-Item -LiteralPath $stageRoot -Recurse -Force -EA SilentlyContinue

Write-Host "Created: $zipPath ($([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB, $entryCount entries)" -ForegroundColor Green
Write-Host "Manifest: $manifestPath"
if ($failed.Count) {
  Write-Warning "Could not delete $($failed.Count) file(s) (in use?)"
}
Write-Host "Remaining in scripts/:" -ForegroundColor Green
Get-ChildItem -Path $scriptsDir -Recurse -File | ForEach-Object {
  $_.FullName.Substring($scriptsDir.Length + 1)
}
