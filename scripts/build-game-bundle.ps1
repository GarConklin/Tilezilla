<#
.SYNOPSIS
  Build a production game bundle (Phase 1) — runtime files only, no solver/ingest.

.DESCRIPTION
  Copies a filtered subset of the repo into deploy-export/<stamp>/game/ suitable for VPS.
  Excludes solver scripts, ingest batches, tuner HTML, tools/data/solver-runs/, and dev compose.

  The bundle includes slim production Docker files from game/ (no Node.js in web image;
  no bind-mount of the full repo on the VPS).

.EXAMPLE
  .\scripts\build-game-bundle.ps1

.EXAMPLE
  .\scripts\build-game-bundle.ps1 -OutputDir C:\temp\tilezilla-game

.EXAMPLE
  .\scripts\build-game-bundle.ps1 -IncludeSolvesZip
#>
[CmdletBinding()]
param(
  [string]$OutputRoot = "",
  [string]$OutputDir = "",
  [switch]$IncludeSolvesZip,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "game-bundle-config.ps1")

$RepoRoot = Get-GameBundleRepoRoot
if (-not $OutputRoot) { $OutputRoot = Join-Path $RepoRoot "deploy-export" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ($OutputDir) {
  $BundleRoot = $OutputDir
} else {
  $BundleRoot = Join-Path (Join-Path $OutputRoot $stamp) "game"
}

if ((Test-Path $BundleRoot) -and (Get-ChildItem $BundleRoot -Force | Select-Object -First 1)) {
  if (-not $Force) {
    throw "Bundle output already exists: $BundleRoot (use -Force to overwrite)"
  }
  Remove-Item $BundleRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $BundleRoot -Force | Out-Null

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Should-SkipRelativePath {
  param([string]$RelativePath)

  $norm = $RelativePath.Replace('\', '/').TrimStart('/')
  if (-not $norm) { return $true }

  foreach ($dir in $script:GameBundleExcludeDirs) {
    $d = $dir.Replace('\', '/').TrimEnd('/')
    if ($norm -eq $d -or $norm.StartsWith("$d/")) { return $true }
  }

  $leaf = Split-Path $norm -Leaf
  if ($script:GameBundleExcludeRootFiles -contains $leaf) { return $true }
  if (Test-GameBundleExcludedFilePattern $leaf) { return $true }
  if (Test-GameBundleExcludedDataFile $norm) { return $true }
  if (Test-GameBundleExcludedWebFile $norm) { return $true }

  return $false
}

function Copy-GameBundleTree {
  $copied = 0
  $skipped = 0

  Get-ChildItem $RepoRoot -Force | ForEach-Object {
    $name = $_.Name
    if ($name -eq 'deploy-export' -or $name -eq 'game') { return }

    if ($_.PSIsContainer) {
      Copy-GameBundleDirectory -SourceDir $_.FullName -RelativePrefix $name
    } else {
      if (Should-SkipRelativePath $name) { $script:skipped++; return }
      $dest = Join-Path $BundleRoot $name
      Copy-Item $_.FullName $dest -Force
      $script:copied++
    }
  }
}

function Copy-GameBundleDirectory {
  param(
    [string]$SourceDir,
    [string]$RelativePrefix
  )

  if (Should-SkipRelativePath $RelativePrefix) { return }

  Get-ChildItem $SourceDir -Force | ForEach-Object {
    $rel = "$RelativePrefix/$($_.Name)"
    if ($_.PSIsContainer) {
      Copy-GameBundleDirectory -SourceDir $_.FullName -RelativePrefix $rel
    } else {
      if (Should-SkipRelativePath $rel) { $script:skipped++; return }
      $dest = Join-Path $BundleRoot ($rel.Replace('/', '\'))
      $destDir = Split-Path $dest -Parent
      if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      }
      Copy-Item $_.FullName $dest -Force
      $script:copied++
    }
  }
}

Write-Step "Building game bundle"
Write-Host "  Source: $RepoRoot"
Write-Host "  Output: $BundleRoot"

$copied = 0
$skipped = 0
Copy-GameBundleTree

Write-Step "Removing dev scripts from bundle..."
$scriptsRemoved = Remove-GameBundleDevScripts -BundleRoot $BundleRoot
Write-Host "  Removed $scriptsRemoved dev script files"

Write-Step "Installing production Docker files..."
Copy-Item (Join-Path $RepoRoot "game/Dockerfile") (Join-Path $BundleRoot "Dockerfile") -Force
Copy-Item (Join-Path $RepoRoot "game/docker-compose.production.yml") (Join-Path $BundleRoot "docker-compose.production.yml") -Force
Copy-Item (Join-Path $RepoRoot ".env.production.example") (Join-Path $BundleRoot ".env.production.example") -Force

$progressDir = Join-Path $BundleRoot "data/progress/users"
if (-not (Test-Path $progressDir)) {
  New-Item -ItemType Directory -Path $progressDir -Force | Out-Null
}
$guestLog = Join-Path $BundleRoot "data/guest_events.jsonl"
if (-not (Test-Path $guestLog)) {
  New-Item -ItemType File -Path $guestLog -Force | Out-Null
}

if ($IncludeSolvesZip) {
  $zip = Join-Path $RepoRoot "solves.zip"
  if (Test-Path $zip) {
    Copy-Item $zip (Join-Path $BundleRoot "solves.zip") -Force
    Write-Host "Included solves.zip for first-time VPS extract." -ForegroundColor Yellow
  } else {
    Write-Host "solves.zip not found - ensure solves/ is in git or copy solves.zip manually." -ForegroundColor Yellow
  }
}

$gitCommit = ""
$gitBranch = ""
try {
  Push-Location $RepoRoot
  $gitCommit = (git rev-parse HEAD 2>$null)
  $gitBranch = (git rev-parse --abbrev-ref HEAD 2>$null)
} finally {
  Pop-Location
}

$manifest = [ordered]@{
  bundleType = "game-runtime"
  phase = 1
  builtAt = (Get-Date).ToUniversalTime().ToString("o")
  gitCommit = $gitCommit
  gitBranch = $gitBranch
  filesCopied = $copied
  filesSkipped = $skipped
  devScriptsRemoved = $scriptsRemoved
  outputPath = $BundleRoot
  excludes = @{
    dirs = $script:GameBundleExcludeDirs
    webPatterns = $script:GameBundleExcludeWebPatterns
    dataPatterns = $script:GameBundleExcludeDataPatterns
  }
  deployHint = @(
    'scp -r deploy-export/<stamp>/game user@VPS:/opt/tilezilla/'
    'cd /opt/tilezilla; cp .env.production.example .env.production; nano .env.production'
    'docker compose -f docker-compose.production.yml --env-file .env.production up -d --build'
  )
}
$manifestPath = Join-Path $BundleRoot "game-bundle-manifest.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "Game bundle ready." -ForegroundColor Green
Write-Host "  Path:     $BundleRoot"
Write-Host "  Copied:   $copied files (skipped $skipped)"
Write-Host "  Manifest: $manifestPath"
Write-Host ""
Write-Host "Deploy to VPS:"
Write-Host "  scp -r" $BundleRoot "user@YOUR_SERVER:/opt/tilezilla/"
Write-Host "  ssh user@YOUR_SERVER"
Write-Host "  cd /opt/tilezilla; docker compose -f docker-compose.production.yml --env-file .env.production up -d --build"
Write-Host ""
Write-Host "Dev machine keeps full repo for solver/ingest. VPS gets this folder only."
Write-Host ""
