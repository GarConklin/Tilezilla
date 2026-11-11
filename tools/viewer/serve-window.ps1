# Runs the solution-viewer server in the foreground of a visible window (started by view-solutions.ps1).
param(
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$Inputs,
    [Parameter(Mandatory = $true)][string]$Url
)
$host.UI.RawUI.WindowTitle = 'TileZilla solution viewer'
Write-Host ''
Write-Host '  TileZilla solution viewer' -ForegroundColor Yellow
Write-Host "  URL:    $Url" -ForegroundColor Cyan
Write-Host "  Inputs: $Inputs"
Write-Host ''
Write-Host '  Close this window to stop the viewer.' -ForegroundColor Green
Write-Host ''
node (Join-Path $PSScriptRoot 'serve.js') --port $Port --inputs $Inputs
Write-Host ''
Write-Host "Viewer server stopped (exit $LASTEXITCODE). Press Enter to close." -ForegroundColor Red
[void](Read-Host)
