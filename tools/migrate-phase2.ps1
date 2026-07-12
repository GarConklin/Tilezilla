# One-time Phase 2: move dev/solver scripts scripts/ -> tools/scripts/
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$Keep = @(
  'scripts/server.py',
  'scripts/refresh-system-stats.py',
  'scripts/health-check-production.sh',
  'scripts/install-production-health-check.sh',
  'scripts/restore-on-ubuntu.sh',
  'scripts/build-game-bundle.ps1',
  'scripts/game-bundle-config.ps1',
  'scripts/export-for-deploy.ps1',
  'scripts/lib/adventure_path_build.py',
  'scripts/lib/level_catalog.py',
  'scripts/lib/progress_store.py',
  'scripts/lib/session_auth.py',
  'scripts/lib/solve_match.py',
  'scripts/lib/system_info.py',
  'scripts/lib/system_stats.py'
) | ForEach-Object { $_.Replace('\', '/') }

$keepSet = @{}
foreach ($k in $Keep) { $keepSet[$k] = $true }
Get-ChildItem 'scripts/sql' -File -ErrorAction SilentlyContinue | ForEach-Object {
  $keepSet[("scripts/sql/" + $_.Name).Replace('\', '/')] = $true
}
Get-ChildItem 'scripts/systemd' -File -ErrorAction SilentlyContinue | ForEach-Object {
  $keepSet[("scripts/systemd/" + $_.Name).Replace('\', '/')] = $true
}

New-Item -ItemType Directory -Path 'tools/scripts/lib' -Force | Out-Null

$movedPs1 = @()
$toMove = @()
$tracked = git ls-files 'scripts' | ForEach-Object { $_.Replace('\', '/') }
foreach ($rel in $tracked) {
  if ($keepSet.ContainsKey($rel)) { continue }
  if ($rel -match '/__pycache__/') { continue }
  $toMove += $rel
}

Write-Host "Moving $($toMove.Count) files to tools/scripts/ ..."
foreach ($rel in ($toMove | Sort-Object)) {
  $dest = $rel -replace '^scripts/', 'tools/scripts/'
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }
  git mv -- $rel $dest 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Move-Item -LiteralPath $rel -Destination $dest -Force
  }
  if ($rel -match '\.ps1$') {
    $name = Split-Path $rel -Leaf
    $movedPs1 += $name
  }
}

Write-Host "Updating path references in tools/scripts/ ..."

function Update-TextFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($ext -notin @('.ps1', '.py', '.js', '.md', '.bat', '.sh')) { return }

  $raw = [System.IO.File]::ReadAllText($Path)
  $orig = $raw

  if ($ext -eq '.ps1') {
    $raw = $raw -replace 'Join-Path \$PSScriptRoot "\.\."', 'Join-Path $PSScriptRoot "../.."'
    $raw = $raw -replace 'python scripts/', 'python tools/scripts/'
    $raw = $raw -replace 'docker compose run --rm web python scripts/', 'docker compose run --rm web python tools/scripts/'
    $raw = $raw -replace 'docker compose run --rm web node scripts/', 'docker compose run --rm web node tools/scripts/'
    $raw = $raw -replace '\.\\scripts\\', '.\tools\scripts\'
  }

  if ($ext -eq '.js') {
    $raw = $raw -replace "path\.join\(__dirname, '\.\.'\)", "path.join(__dirname, '../..')"
    $raw = $raw -replace "path\.join\(ROOT, 'scripts/", "path.join(ROOT, 'tools/scripts/"
    $raw = $raw -replace 'node scripts/', 'node tools/scripts/'
    $raw = $raw -replace 'Run: docker compose run --rm web node scripts/', 'Run: docker compose run --rm web node tools/scripts/'
  }

  if ($ext -eq '.py') {
    $raw = $raw -replace 'Path\(__file__\)\.resolve\(\)\.parents\[1\]', 'Path(__file__).resolve().parents[2]'
    $raw = $raw -replace 'python scripts/', 'python tools/scripts/'
  }

  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($Path, $raw)
  }
}

Get-ChildItem 'tools/scripts' -Recurse -File | ForEach-Object { Update-TextFile $_.FullName }

# Docker-Web.ps1: container path prefix
$dockerWeb = Join-Path $RepoRoot 'tools/scripts/lib/Docker-Web.ps1'
if (Test-Path $dockerWeb) {
  $dw = [System.IO.File]::ReadAllText($dockerWeb)
  $dw = $dw -replace 'if \(-not \$scriptInContainer\.StartsWith\(''scripts/''\)\) \{\s+\$scriptInContainer = "scripts/\$scriptInContainer"\s+\}', @'
  if ($scriptInContainer.StartsWith('scripts/')) {
    # Runtime scripts stay under /app/scripts (e.g. refresh-system-stats.py)
  } elseif (-not $scriptInContainer.StartsWith('tools/scripts/')) {
    $scriptInContainer = "tools/scripts/$scriptInContainer"
  }
'@
  [System.IO.File]::WriteAllText($dockerWeb, $dw)
}

Write-Host "Creating $($movedPs1.Count) backward-compat wrappers in scripts/ ..."
foreach ($name in ($movedPs1 | Sort-Object -Unique)) {
  $wrapper = Join-Path $RepoRoot "scripts/$name"
  $content = @"
# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\$name
& "`$PSScriptRoot\..\tools\scripts\$name" @args
if (`$null -ne `$LASTEXITCODE) { exit `$LASTEXITCODE }
"@
  [System.IO.File]::WriteAllText($wrapper, $content.TrimEnd() + "`n")
}

Write-Host "Phase 2 migration done. Moved: $($toMove.Count) files, wrappers: $($movedPs1.Count)"
