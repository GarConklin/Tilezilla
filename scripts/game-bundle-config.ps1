# Shared rules for scripts/build-game-bundle.ps1
# Game runtime only — no solver, ingest, tuners, or dev compose on VPS.

Set-StrictMode -Version Latest

function Get-GameBundleRepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

# Directories excluded entirely from the production bundle (repo-relative).
$script:GameBundleExcludeDirs = @(
  '.git',
  '.vscode',
  '.cursor',
  'deploy-export',
  'Docs',
  'unused',
  'unused_old',
  'invalid solutions',
  'tools',
  'node_modules',
  'game',
  'data/solver-runs',
  'data/levels/specs',
  'data/levels/reports',
  'data/levels/generated',
  'data/cards',
  'img/Stuff',
  'img/Tile Ideas'
)

# Top-level or anywhere — file name / glob patterns to skip during copy.
$script:GameBundleExcludeFilePatterns = @(
  '*.ps1',
  '*.bat',
  '*.pdn',
  '*.docx',
  '*.log',
  'Thumbs.db',
  '.DS_Store',
  'solves.zip',
  'DockerHowToo.txt',
  'index.html'
)

# Dev compose at repo root — production bundle ships game/docker-compose.production.yml instead.
$script:GameBundleExcludeRootFiles = @(
  'docker-compose.yml',
  'docker-compose.remote-test.yml',
  'docker-compose.auth.yml',
  'docker-compose.production.yml',
  'Dockerfile'
)

# data/ files and patterns not needed on VPS.
$script:GameBundleExcludeDataPatterns = @(
  '*tilepz*solves*.txt',
  '*enumerate*.txt',
  '*-batch*.txt',
  '*-queue.txt',
  'handmade-*',
  'daily_challenges_workbench.sql',
  'solution-loop-audit*.json',
  'adventure_solution_distribution.csv',
  'LevelSystem.csv',
  'daily_challenges_import-org.csv'
)

# web/ dev-only pages (tuners, audit tools).
$script:GameBundleExcludeWebPatterns = @(
  '*-tuner.html',
  'tuners.html',
  'dev-*.html',
  'adventure-solution-audit.html',
  'cartographers-journal-tuner.html'
)

# scripts/ kept in the bundle (repo-relative paths).
$script:GameBundleScriptKeep = @(
  'scripts/server.py',
  'scripts/refresh-system-stats.py',
  'scripts/health-check-production.sh',
  'scripts/install-production-health-check.sh',
  'scripts/restore-on-ubuntu.sh'
)

$script:GameBundleScriptLibKeep = @(
  'scripts/lib/adventure_path_build.py',
  'scripts/lib/level_catalog.py',
  'scripts/lib/progress_store.py',
  'scripts/lib/session_auth.py',
  'scripts/lib/solve_match.py',
  'scripts/lib/system_info.py',
  'scripts/lib/system_stats.py'
)

function Test-GameBundleExcludedDataFile {
  param([string]$RelativePath)
  $name = Split-Path $RelativePath -Leaf
  foreach ($pat in $script:GameBundleExcludeDataPatterns) {
    if ($name -like $pat) { return $true }
  }
  if ($RelativePath -replace '\\', '/' -eq 'data/levels/levels.json') { return $true }
  if ($RelativePath -replace '\\', '/' -eq 'data/levels/solve-queue.json') { return $true }
  return $false
}

function Test-GameBundleExcludedWebFile {
  param([string]$RelativePath)
  if ($RelativePath -notmatch '(^|[\\/])web[\\/]') { return $false }
  $name = Split-Path $RelativePath -Leaf
  foreach ($pat in $script:GameBundleExcludeWebPatterns) {
    if ($name -like $pat) { return $true }
  }
  return $false
}

function Test-GameBundleExcludedFilePattern {
  param([string]$FileName)
  foreach ($pat in $script:GameBundleExcludeFilePatterns) {
    if ($FileName -like $pat) { return $true }
  }
  return $false
}

function Get-GameBundleScriptKeepSet {
  $keep = @{}
  foreach ($rel in ($script:GameBundleScriptKeep + $script:GameBundleScriptLibKeep)) {
    $keep[$rel.Replace('\', '/')] = $true
  }
  Get-ChildItem (Join-Path (Get-GameBundleRepoRoot) 'scripts/sql') -File -ErrorAction SilentlyContinue |
    ForEach-Object { $keep[("scripts/sql/" + $_.Name).Replace('\', '/')] = $true }
  return $keep
}

function Remove-GameBundleDevScripts {
  param([string]$BundleRoot)
  $scriptsDir = Join-Path $BundleRoot 'scripts'
  if (-not (Test-Path $scriptsDir)) { return 0 }
  $keep = Get-GameBundleScriptKeepSet
  $removed = 0
  foreach ($f in Get-ChildItem $scriptsDir -Recurse -File) {
    $rel = $f.FullName.Substring($BundleRoot.Length).TrimStart('\', '/').Replace('\', '/')
    if ($keep.ContainsKey($rel)) { continue }
    Remove-Item $f.FullName -Force
    $removed++
  }
  # Drop empty lib subdirs except we kept files — prune empty folders
  Get-ChildItem $scriptsDir -Recurse -Directory | Sort-Object FullName -Descending | ForEach-Object {
    if (-not (Get-ChildItem $_.FullName -Force | Select-Object -First 1)) {
      Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    }
  }
  return $removed
}
