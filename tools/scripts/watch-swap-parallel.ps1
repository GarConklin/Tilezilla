<#
.SYNOPSIS
  Live view of run-swap-parallel.ps1: each worker's puzzle and how far it is. Ctrl+C to close.

    .\tools\scripts\watch-swap-parallel.ps1
#>
param([string]$RunDir = "", [int]$Seconds = 20)

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
if (-not $RunDir) {
  $RunDir = (Get-ChildItem (Join-Path $RepoRoot "tools\data\solver-runs\swap-parallel") -Directory | Sort-Object Name | Select-Object -Last 1).FullName
}

while ($true) {
  $lines = @()
  $done = 0
  foreach ($log in Get-ChildItem $RunDir -Filter "worker-*.log" | Sort-Object Name) {
    $out = $log.FullName -replace '\.log$', '.txt'
    $mine = if (Test-Path $out) { @(Get-Content $out | Where-Object { $_.Trim() }).Count } else { 0 }
    $done += $mine
    $text = Get-Content $log.FullName -Tail 60
    $start = $text | Where-Object { $_ -match '^==> ' } | Select-Object -Last 1
    $prog = $text | Where-Object { $_ -match 'Progress: seeds (\d+)/(\d+), unique layouts (\d+)' } | Select-Object -Last 1
    $puzzle = if ($start -match '^==> (\S+)\s+(\S+)') { "$($Matches[1]) started $($Matches[2])" } else { "starting" }
    $where = "seeds ?"
    if ($prog -and $start -and ($text.IndexOf($prog) -gt $text.IndexOf($start))) {
      $null = $prog -match 'seeds (\d+)/(\d+), unique layouts (\d+)'
      $where = "{0,3}%  ({1}/{2} seeds)  layouts {3}" -f [int](100 * [int]$Matches[1] / [int]$Matches[2]), $Matches[1], $Matches[2], $Matches[3]
    }
    elseif ($start) { $where = "  0%  (just started)" }
    $lines += ("  {0}  done {1,3}   {2}   {3}" -f $log.BaseName, $mine, $puzzle, $where)
  }
  Clear-Host
  Write-Host "Run: $RunDir"
  Write-Host ("{0}   puzzles solved this run: {1}" -f (Get-Date -Format "HH:mm:ss"), $done)
  $lines | ForEach-Object { Write-Host $_ }
  Write-Host ""
  Write-Host "Refreshes every $Seconds s. Ctrl+C closes this view only; the run keeps going."
  Start-Sleep -Seconds $Seconds
}
