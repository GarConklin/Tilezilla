# Validate a deploy-export game bundle (Phase 5).
param(
  [Parameter(Mandatory = $true)]
  [string]$BundleRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BundleRoot = (Resolve-Path $BundleRoot).Path
$errors = @()

function Fail([string]$Msg) { $script:errors += $Msg }

if (-not (Test-Path (Join-Path $BundleRoot "Dockerfile"))) {
  Fail "Missing Dockerfile at bundle root"
}
if (-not (Test-Path (Join-Path $BundleRoot "docker-compose.production.yml"))) {
  Fail "Missing docker-compose.production.yml"
}
if (-not (Test-Path (Join-Path $BundleRoot ".dockerignore"))) {
  Fail "Missing .dockerignore (production build context)"
}
if (Test-Path (Join-Path $BundleRoot "tools")) {
  Fail "tools/ must not be in production bundle"
}
if (Test-Path (Join-Path $BundleRoot "docker-compose.yml")) {
  Fail "dev docker-compose.yml must not be in bundle"
}

$df = Get-Content (Join-Path $BundleRoot "Dockerfile") -Raw
if ($df -match 'nodejs|npm') {
  Fail "Production Dockerfile must not install Node.js"
}

Get-ChildItem (Join-Path $BundleRoot "web") -Filter "*tuner*.html" -File -ErrorAction SilentlyContinue |
  ForEach-Object { Fail "Tuner HTML in bundle web/: $($_.Name)" }

$scriptsDir = Join-Path $BundleRoot "scripts"
if (Test-Path $scriptsDir) {
  $keepLib = @('adventure_path_build.py', 'level_catalog.py', 'progress_store.py', 'session_auth.py', 'solve_match.py', 'system_info.py', 'system_stats.py')
  Get-ChildItem $scriptsDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($BundleRoot.Length).TrimStart('\', '/').Replace('\', '/')
    if ($rel -eq 'scripts/server.py') { return }
    if ($rel -eq 'scripts/refresh-system-stats.py') { return }
    if ($rel -match '^scripts/(health-check-production|install-production-health-check|restore-on-ubuntu)\.sh$') { return }
    if ($rel -like 'scripts/sql/*') { return }
    if ($rel -like 'scripts/lib/*' -and ($keepLib -contains $_.Name)) { return }
    Fail "Unexpected script in bundle: $rel"
  }
}

if ($errors.Count -gt 0) {
  Write-Host "Bundle validation FAILED:" -ForegroundColor Red
  foreach ($e in $errors) { Write-Host "  - $e" -ForegroundColor Red }
  exit 1
}

Write-Host "Bundle validation OK: $BundleRoot" -ForegroundColor Green
