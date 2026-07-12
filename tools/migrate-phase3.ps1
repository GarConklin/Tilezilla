# Phase 3: move dev data data/ -> tools/data/
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

New-Item -ItemType Directory -Path "tools/data/batches" -Force | Out-Null
New-Item -ItemType Directory -Path "tools/data/solver-runs" -Force | Out-Null

# Tracked batch / queue / audit files
$batchPatterns = @(
  '*tilepz*solves*.txt',
  '*enumerate*.txt',
  '*-batch*.txt',
  '*-queue.txt',
  'handmade-*'
)

foreach ($pat in $batchPatterns) {
  Get-ChildItem "data" -Filter $pat -File -ErrorAction SilentlyContinue | ForEach-Object {
    $dest = "tools/data/batches/$($_.Name)"
    if (Test-Path $dest) { Write-Host "Skip (exists): $dest"; return }
    Write-Host "Move batch: $($_.Name)"
    git mv -- $_.FullName.Replace('\', '/').Replace("$RepoRoot/", '').Replace('\', '/') $dest 2>$null
    if ($LASTEXITCODE -ne 0) {
      Move-Item -LiteralPath $_.FullName -Destination (Join-Path $RepoRoot $dest) -Force
    }
  }
}

# solve-queue + loop audits
$moves = @(
  @{ From = 'data/levels/solve-queue.json'; To = 'tools/data/solve-queue.json' },
  @{ From = 'data/solution-loop-audit.json'; To = 'tools/data/solution-loop-audit.json' },
  @{ From = 'data/solution-loop-audit-4x5.json'; To = 'tools/data/solution-loop-audit-4x5.json' }
)
foreach ($m in $moves) {
  if (-not (Test-Path $m.From)) { continue }
  Write-Host "Move: $($m.From) -> $($m.To)"
  $destDir = Split-Path $m.To -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  git mv -- $m.From $m.To 2>$null
  if ($LASTEXITCODE -ne 0) {
    Move-Item -LiteralPath $m.From -Destination $m.To -Force
  }
}

# solver-runs scaffold
foreach ($f in @('.gitkeep', 'README.txt')) {
  $src = "data/solver-runs/$f"
  $dest = "tools/data/solver-runs/$f"
  if (Test-Path $src) {
    git mv -- $src $dest 2>$null
    if ($LASTEXITCODE -ne 0) { Move-Item -LiteralPath $src -Destination $dest -Force }
  }
}

# Untracked solver-runs content (logs, streams, etc.)
$oldRuns = Join-Path $RepoRoot "data/solver-runs"
$newRuns = Join-Path $RepoRoot "tools/data/solver-runs"
if (Test-Path $oldRuns) {
  Get-ChildItem $oldRuns -Force | ForEach-Object {
    if ($_.Name -in @('.', '..', '.gitkeep', 'README.txt')) { return }
    $dest = Join-Path $newRuns $_.Name
    Write-Host "Move solver-runs artifact: $($_.Name)"
    if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue }
    Move-Item -LiteralPath $_.FullName -Destination $dest -Force
  }
  if (-not (Get-ChildItem $oldRuns -Force | Where-Object { $_.Name -notin @('.', '..') })) {
    Remove-Item -LiteralPath $oldRuns -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Updating path references..."

function Update-DevDataPaths {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($ext -notin @('.ps1', '.py', '.js', '.md', '.sh', '.bat', '.gitignore', '.dockerignore', '.cursorignore')) { return }

  $raw = [System.IO.File]::ReadAllText($Path)
  $orig = $raw

  $raw = $raw -replace 'data/solver-runs', 'tools/data/solver-runs'
  $raw = $raw -replace 'data\\solver-runs', 'tools\data\solver-runs'
  $raw = $raw -replace "path\.join\(ROOT, 'data', 'levels', 'solve-queue\.json'\)", "path.join(ROOT, 'tools', 'data', 'solve-queue.json')"
  $raw = $raw -replace "path\.join\(ROOT, 'data', 'tilepz solves", "path.join(ROOT, 'tools', 'data', 'batches', 'tilepz solves"
  $raw = $raw -replace "path\.join\(ROOT, 'data', 'new solves", "path.join(ROOT, 'tools', 'data', 'batches', 'new solves"

  # Example batch paths in docs/comments
  $raw = $raw -replace 'data/tilepz solves', 'tools/data/batches/tilepz solves'
  $raw = $raw -replace 'data\\tilepz solves', 'tools\data\batches\tilepz solves'
  $raw = $raw -replace 'data/june30-enumerate-queue', 'tools/data/batches/june30-enumerate-queue'
  $raw = $raw -replace 'data/july10-enumerate-queue', 'tools/data/batches/july10-enumerate-queue'
  $raw = $raw -replace '\| `data/tilepz solves \*\.txt`', '| `tools/data/batches/*tilepz*solves*.txt`'
  $raw = $raw -replace 'data/tilepz solves \*\.txt', 'tools/data/batches/*tilepz*solves*.txt'
  $raw = $raw -replace 'BatchFile "data\\', 'BatchFile "tools\data\batches\'
  $raw = $raw -replace 'BatchFile "data/', 'BatchFile "tools/data/batches/'
  $raw = $raw -replace 'LevelListFile "data/', 'LevelListFile "tools/data/batches/'

  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($Path, $raw)
  }
}

Get-ChildItem "tools/scripts" -Recurse -File | ForEach-Object { Update-DevDataPaths $_.FullName }
@(
  'scripts/game-bundle-config.ps1',
  'scripts/build-game-bundle.ps1',
  'game/README.md',
  'tools/README.md',
  'Docs/json-data-spec.md',
  '.gitignore',
  '.dockerignore',
  '.cursorignore'
) | ForEach-Object { Update-DevDataPaths (Join-Path $RepoRoot $_) }

# export_levels_csv default via Python module
$exportPy = Join-Path $RepoRoot 'tools/scripts/export_levels_csv.py'
if (Test-Path $exportPy) {
  $py = [System.IO.File]::ReadAllText($exportPy)
  if ($py -notmatch '_repo_paths') {
    $py = $py -replace '(from pathlib import Path\n)', "`$1`nfrom _repo_paths import SOLVER_RUNS`n"
    $py = $py -replace 'default="tools/data/solver-runs/levels-solution-counts\.csv"', 'default=str(SOLVER_RUNS / "levels-solution-counts.csv")'
    [System.IO.File]::WriteAllText($exportPy, $py)
  }
}

Write-Host "Phase 3 migration done."
