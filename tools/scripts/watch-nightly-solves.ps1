<#
.SYNOPSIS
  Live view of the nightly solver run (safe to open and close any time; it only reads the status file).

    .\tools\scripts\watch-nightly-solves.ps1
    .\tools\scripts\watch-nightly-solves.ps1 -Totals     solved / waiting / failed per group, then exit
#>
param([switch]$Totals)

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot
if ($Totals) { & node tools/scripts/nightly-solves.js status; exit $LASTEXITCODE }
$host.UI.RawUI.WindowTitle = "TileZilla nightly solves - watch"
& node tools/scripts/nightly-solves.js watch
