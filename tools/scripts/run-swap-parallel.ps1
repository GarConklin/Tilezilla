<#
.SYNOPSIS
  Solve waiting swap puzzles with several solver containers at once. You run this.

.DESCRIPTION
  From the Tilezilla repo root. Do not run run-swap-batch.ps1 at the same time.

    .\tools\scripts\run-swap-parallel.ps1 -Workers 8 -Count 300 -Until "2026-10-20 08:00"

  Takes the -Count smallest boards on the waiting list (3x4 first, then by name) and shares them between
  -Workers solver containers. Each worker stops starting new puzzles at -Until.
  Results are written to the ledger once at the end (record-many).
  Live view of every worker, in a second window:

    .\tools\scripts\watch-swap-parallel.ps1

  If the window is closed early, record what finished with:

    python tools/scripts/swap-batch.py record-many --file tools/data/solver-runs/swap-parallel/<run folder>
#>
param(
  [int]$Workers = 8,
  [int]$Count = 300,
  [string]$Until = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot

$deadline = [datetime]::MaxValue
if (-not [string]::IsNullOrWhiteSpace($Until)) {
  $deadline = [datetime]::ParseExact($Until.Trim(), "yyyy-MM-dd HH:mm", [Globalization.CultureInfo]::InvariantCulture)
  if ($deadline -le (Get-Date)) { throw "Until time is already past: $Until" }
}

& docker info --format "{{.ServerVersion}}" *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Start Docker Desktop, wait until it says running, then run this again." -ForegroundColor Red
  exit 1
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $RepoRoot "tools\data\solver-runs\swap-parallel\$stamp"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$listCode = "import json; d = json.load(open('tools/data/solver-runs/swap-named/ledger.json', encoding='utf-8')); area = lambda i: eval(i.split('-')[0].replace('x', '*')); print('\n'.join(sorted(d['pending'], key=lambda i: (area(i), i))[:$Count]))"
$ids = @(& python -c $listCode | Where-Object { $_.Trim() })
if ($ids.Count -eq 0) { Write-Host "Nothing waiting."; exit 0 }
Write-Host "Run folder: $runDir"
Write-Host "Puzzles: $($ids.Count)  workers: $Workers  stop starting new puzzles at: $(if ($Until) { $Until } else { 'never' })"

$worker = {
  param($RepoRoot, $Ids, $OutFile, $LogFile, $Deadline)
  Set-Location $RepoRoot
  foreach ($id in $Ids) {
    if ((Get-Date) -ge $Deadline) { break }
    "==> $id  $(Get-Date -Format 'HH:mm:ss')" | Add-Content -Path $LogFile
    $solverArgs = @(
      "compose", "run", "--rm", "-T", "web", "node", "solves/solve-level.js",
      "--spec", "tools/data/solver-runs/swap-named/specs/$id.json",
      "--viable-seeds-only", "--json-summary", "--progress-every", "200", "--progress-on-json",
      "--max-sol", "500000",
      "--write-solves", "tools/data/solver-runs/swap-named/enumerated/$id.json"
    )
    $summary = $null
    $dockerDown = $false
    & docker @solverArgs 2>&1 | ForEach-Object {
      $line = "$_"
      if ($line -notmatch '^\s*Container ') { $line | Add-Content -Path $LogFile }
      if ($line -match '^\s*\{.*"totalUniqueSolutions"') { $summary = $line.Trim() }
      if ($line -match 'failed to connect to the docker API|daemon is not running') { $dockerDown = $true }
    }
    if ($dockerDown) {
      "STOPPED: Docker is not running ($id stays waiting)" | Add-Content -Path $LogFile
      break
    }
    $code = $LASTEXITCODE
    $count = $null
    if ($summary) { try { $count = ($summary | ConvertFrom-Json).totalUniqueSolutions } catch { $count = $null } }
    if ($code -eq 0 -and $null -ne $count) {
      "$id $count 0" | Add-Content -Path $OutFile
    }
    else {
      "FAILED $id exit=$code" | Add-Content -Path $LogFile
    }
  }
}

$jobs = @()
for ($w = 0; $w -lt $Workers; $w++) {
  $mine = @(for ($i = $w; $i -lt $ids.Count; $i += $Workers) { $ids[$i] })
  if ($mine.Count -eq 0) { continue }
  $out = Join-Path $runDir "worker-$w.txt"
  $log = Join-Path $runDir "worker-$w.log"
  New-Item -ItemType File -Path $out -Force | Out-Null
  $jobs += Start-Job -ScriptBlock $worker -ArgumentList $RepoRoot, $mine, $out, $log, $deadline
}

$began = Get-Date
try {
  while (@($jobs | Where-Object { $_.State -eq "Running" }).Count -gt 0) {
    Start-Sleep -Seconds 60
    $done = @(Get-ChildItem $runDir -Filter "worker-*.txt" | Get-Content | Where-Object { $_.Trim() }).Count
    $running = @($jobs | Where-Object { $_.State -eq "Running" }).Count
    $spent = (Get-Date) - $began
    $left = if ($done -gt 0) { [timespan]::FromSeconds($spent.TotalSeconds / $done * ($ids.Count - $done)) } else { $null }
    $leftText = if ($left) { "{0}h{1:00}m" -f [int][math]::Floor($left.TotalHours), $left.Minutes } else { "?" }
    Write-Host ("{0}  solved {1} of {2}  workers running {3}  elapsed {4}h{5:00}m  left about {6}" -f (Get-Date -Format "HH:mm"), $done, $ids.Count, $running, [int][math]::Floor($spent.TotalHours), $spent.Minutes, $leftText)
  }
}
finally {
  $jobs | Stop-Job -ErrorAction SilentlyContinue
  $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
  Write-Host "Recording results..."
  & python (Join-Path $PSScriptRoot "swap-batch.py") record-many --file $runDir
  $stopped = @(Get-ChildItem $runDir -Filter "worker-*.log" | Select-String -Pattern "^STOPPED: Docker").Count
  if ($stopped -gt 0) { Write-Host "$stopped worker(s) stopped because Docker was not running. Start Docker Desktop and run again." -ForegroundColor Red }
  $failed = @(Get-ChildItem $runDir -Filter "worker-*.log" | Select-String -Pattern "^FAILED").Count
  if ($failed -gt 0) { Write-Host "$failed puzzle(s) failed; they stay on the waiting list. See worker-*.log in $runDir" -ForegroundColor Yellow }
}
