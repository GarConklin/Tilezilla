<#
.SYNOPSIS
  Open the TileZilla solution viewer for one puzzle in a popup browser window.

.EXAMPLE
  .\tools\scripts\view-solutions.ps1 -Id 5x6-0B-01L4
  .\tools\scripts\view-solutions.ps1 -Id 5x6-0B-01L4 -FindLoops
  .\tools\scripts\view-solutions.ps1 -Spec path\spec.json -Solutions path\solutions.json [-Loops path\loops.json]

.DESCRIPTION
  -Id looks for the spec and solutions in the nightly run (tools/data/solver-runs/nightly/specs, /enumerated)
  and the candidate sets (tools/data/swap-candidates/<set>/specs, /results). Inputs are copied to
  %TEMP%\tz_solution_viewer\<id>\ (originals are only read). -FindLoops runs tools/viewer/find-loop-boards.js
  to list the boards the game validator accepts but the strict single-snake rule rejects; a loops.json
  from an earlier run in that folder is reused. The server runs in a visible window titled
  'TileZilla solution viewer'; closing that window stops it.
#>
param(
    [string]$Id,
    [string]$Spec,
    [string]$Solutions,
    [string]$Loops,
    [switch]$FindLoops,
    [int]$Port = 0,
    [string]$Tileset,
    [int]$Width = 1600,
    [int]$Height = 1080,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$viewerDir = Join-Path $repo 'tools\viewer'

function Find-First([string[]]$patterns) {
    foreach ($p in $patterns) {
        $hit = Get-ChildItem -Path $p -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

if ($Id) {
    $nightly = Join-Path $repo 'tools\data\solver-runs\nightly'
    $cand = Join-Path $repo 'tools\data\swap-candidates'
    if (-not $Spec) { $Spec = Find-First @("$nightly\specs\$Id.json", "$cand\*\specs\$Id.json") }
    if (-not $Solutions) {
        $Solutions = Find-First @("$nightly\enumerated\$Id.json", "$nightly\enumerated\$Id.json.gz",
            "$cand\*\results\$Id.json", "$cand\*\results\$Id.json.gz")
    }
}
if (-not $Spec -or -not (Test-Path $Spec)) { throw "Spec not found (use -Id <id> or -Spec <path>)." }
if (-not $Solutions -or -not (Test-Path $Solutions)) { throw "Solutions file not found (use -Id <id> or -Solutions <path>)." }
if (-not $Id) { $Id = [IO.Path]::GetFileNameWithoutExtension(($Spec -replace '\.gz$', '')) }

$inputs = Join-Path $env:TEMP "tz_solution_viewer\$Id"
New-Item -ItemType Directory -Force -Path $inputs | Out-Null
Copy-Item -LiteralPath $Spec -Destination (Join-Path $inputs 'spec.json') -Force
$solName = if ($Solutions -like '*.gz') { 'solutions.json.gz' } else { 'solutions.json' }
Remove-Item -LiteralPath (Join-Path $inputs 'solutions.json'), (Join-Path $inputs 'solutions.json.gz') -ErrorAction SilentlyContinue
Copy-Item -LiteralPath $Solutions -Destination (Join-Path $inputs $solName) -Force
Write-Host "Spec:      $Spec"
Write-Host "Solutions: $Solutions"

$loopsFile = Join-Path $inputs 'loops.json'
if ($Loops) {
    Copy-Item -LiteralPath $Loops -Destination $loopsFile -Force
} elseif ($FindLoops) {
    Write-Host 'Finding loop boards (exhaustive fill)...'
    node (Join-Path $viewerDir 'find-loop-boards.js') --spec (Join-Path $inputs 'spec.json') --solutions (Join-Path $inputs $solName) --out $loopsFile
    if ($LASTEXITCODE -ne 0) { throw "find-loop-boards.js failed ($LASTEXITCODE)" }
}
$hasLoops = Test-Path $loopsFile
Write-Host ("Loops:     " + $(if ($hasLoops) { $loopsFile } else { '(none; add -FindLoops or -Loops <path>)' }))

if ($Port -le 0) {
    $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $l.Start(); $Port = $l.LocalEndpoint.Port; $l.Stop()
}
$query = "spec=/inputs/spec.json&solutions=/inputs/$solName&title=$([uri]::EscapeDataString($Id))"
if ($hasLoops) { $query += '&loops=/inputs/loops.json' }
if ($Tileset) { $query += "&tileset=$([uri]::EscapeDataString($Tileset))" }
$url = "http://127.0.0.1:$Port/viewer/solution-viewer.html?$query"

Start-Process powershell.exe -ArgumentList @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    "`"$(Join-Path $viewerDir 'serve-window.ps1')`"", '-Port', $Port, '-Inputs', "`"$inputs`"", '-Url', "`"$url`"")

$ready = $false
for ($i = 0; $i -lt 60 -and -not $ready; $i++) {
    Start-Sleep -Milliseconds 250
    try { $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/viewer/solution-viewer.html" -TimeoutSec 2; $ready = $true } catch { }
}
if (-not $ready) { throw "Viewer server did not start on port $Port (see the 'TileZilla solution viewer' window)." }
Write-Host "Viewer:    $url" -ForegroundColor Cyan

if (-not $NoBrowser) {
    $browserArgs = @("--app=$url", "--window-size=$Width,$Height", '--window-position=40,20')
    try { Start-Process msedge -ArgumentList $browserArgs }
    catch {
        try { Start-Process chrome -ArgumentList $browserArgs }
        catch { Write-Warning "Could not start Edge or Chrome; open the URL above yourself." }
    }
}
