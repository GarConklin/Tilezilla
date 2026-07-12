# Phase 4: move dev/tuner HTML to tools/web/
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

New-Item -ItemType Directory -Path "tools/web/js" -Force | Out-Null
New-Item -ItemType Directory -Path "tools/web/css" -Force | Out-Null

$toolsJsNames = @(
  'journal-tuner.js', 'records-tuner.js', 'tilebag-tuner.js', 'tilebag-v2-tuner.js',
  'game-data-v2-tuner.js', 'preview-data-v2-zone-tuner.js', 'auth-screen-tuner.js',
  'adventure-solution-audit.js', 'dev-localhost-ipv4.js'
)

function Move-GitFile {
  param([string]$From, [string]$To)
  $destDir = Split-Path $To -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  if (-not (Test-Path $From)) { return }
  git mv -- $From $To 2>$null
  if ($LASTEXITCODE -ne 0) {
    Move-Item -LiteralPath $From -Destination $To -Force
  }
}

Write-Host "Moving dev HTML from web/ to tools/web/ ..."
Get-ChildItem "web" -Filter "*.html" -File | ForEach-Object {
  $name = $_.Name
  $move = $false
  if ($name -like '*-tuner.html') { $move = $true }
  elseif ($name -eq 'tuners.html') { $move = $true }
  elseif ($name -like 'dev-*.html') { $move = $true }
  elseif ($name -in @('adventure-solution-audit.html', 'main-screen-v2.html', 'rank-badge-preview.html', 'live-edges-viewer.html')) { $move = $true }
  if (-not $move) { return }
  Write-Host "  $name"
  Move-GitFile "web/$name" "tools/web/$name"
}

Write-Host "Moving tuner JS/CSS ..."
foreach ($js in $toolsJsNames) {
  if ($js -eq 'dev-localhost-ipv4.js') {
    if (Test-Path "web/js/$js") { Move-GitFile "web/js/$js" "tools/web/js/$js" }
    continue
  }
  if (Test-Path "web/js/$js") { Move-GitFile "web/js/$js" "tools/web/js/$js" }
}
foreach ($css in @('auth-screen-tuner.css', 'auth-screen-tuner-page.css', 'preview-data-v2-zone-tuner-page.css')) {
  if (Test-Path "web/css/$css") { Move-GitFile "web/css/$css" "tools/web/css/$css" }
}

function Update-DevWebFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  $raw = [System.IO.File]::ReadAllText($Path)
  $orig = $raw

  # Shared game assets (absolute from site root)
  $raw = $raw -replace 'href="css/tilezilla-shell\.css"', 'href="/css/tilezilla-shell.css"'
  $raw = $raw -replace 'href="css/auth-screen\.css"', 'href="/css/auth-screen.css"'
  $raw = $raw -replace 'href="css/profile-passport-layout\.css"', 'href="/css/profile-passport-layout.css"'
  $raw = $raw -replace 'href="css/styles\.css"', 'href="/css/styles.css"'
  $raw = $raw -replace 'href="css/auth-screen-tuner', 'href="/tools/css/auth-screen-tuner'
  $raw = $raw -replace 'href="css/preview-data-v2-zone-tuner-page\.css"', 'href="/tools/css/preview-data-v2-zone-tuner-page.css"'

  $raw = $raw -replace 'src="js/dev-localhost-ipv4\.js"', 'src="/tools/js/dev-localhost-ipv4.js"'
  $raw = $raw -replace 'src="\./js/', 'src="/tools/js/'
  $raw = $raw -replace "from '\./js/", "from '/tools/js/"
  $raw = $raw -replace 'from "\./js/', 'from "/tools/js/'

  # Dev page links → /tools/
  $devPages = @(
    'tuners.html', 'dev-player-select.html', 'dev-auto-login.html',
    'adventure-solution-audit.html', 'main-screen-v2.html', 'rank-badge-preview.html',
    'live-edges-viewer.html'
  )
  foreach ($page in ($devPages + (Get-ChildItem "tools/web" -Filter "*-tuner.html" -File).Name)) {
    $raw = $raw -replace "href=`"/$([regex]::Escape($page))`"", "href=`"/tools/$page`""
    $raw = $raw -replace "href='$page'", "href='/tools/$page'"
    $raw = $raw -replace "url=/$([regex]::Escape($page))", "url=/tools/$page"
    $raw = $raw -replace ":8080/$([regex]::Escape($page))", ":8080/tools/$page"
    $raw = $raw -replace ":3000/$([regex]::Escape($page))", ":3000/tools/$page"
  }

  # Relative dev links without leading slash
  $raw = $raw -replace 'href="([a-z0-9-]+-tuner\.html)"', 'href="/tools/$1"'
  $raw = $raw -replace 'href="rank-badge-preview\.html"', 'href="/tools/rank-badge-preview.html"'
  $raw = $raw -replace 'href="tilezilla-v2\.html"', 'href="/tilezilla-v2.html"'

  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($Path, $raw)
  }
}

Get-ChildItem "tools/web" -Recurse -File | ForEach-Object {
  if ($_.Extension -in @('.html', '.js', '.css')) { Update-DevWebFile $_.FullName }
}

Write-Host "Fixing ES module imports in tools/web/js/ ..."
Get-ChildItem "tools/web/js" -Filter "*.js" -File | ForEach-Object {
  $raw = [System.IO.File]::ReadAllText($_.FullName)
  $orig = $raw
  $raw = [regex]::Replace($raw, "from '\./([^']+)'", {
    param($m)
    $mod = $m.Groups[1].Value -replace '\?.*$', ''
    $base = Split-Path $mod -Leaf
    if ($toolsJsNames -contains $base) { return "from '/tools/js/$mod'" }
    return "from '/js/$mod'"
  })
  $raw = [regex]::Replace($raw, 'from "\./([^"]+)"', {
    param($m)
    $mod = $m.Groups[1].Value -replace '\?.*$', ''
    $base = Split-Path $mod -Leaf
    if ($toolsJsNames -contains $base) { return "from `"/tools/js/$mod`"" }
    return "from `"/js/$mod`""
  })
  if ($raw -ne $orig) { [System.IO.File]::WriteAllText($_.FullName, $raw) }
}

# Runtime JS that detects tuner pages
$cartJournal = Join-Path $RepoRoot "web/js/cartographers-journal-layout.js"
if (Test-Path $cartJournal) {
  $raw = [System.IO.File]::ReadAllText($cartJournal)
  $raw = $raw -replace '/cartographers-journal-tuner(?:\.html)?\$/i\.test\(window\.location\.pathname\)',
    "/(?:^|\/)cartographers-journal-tuner(?:\.html)?$/i.test(window.location.pathname)"
  [System.IO.File]::WriteAllText($cartJournal, $raw)
}

Write-Host "Phase 4 file migration done."
