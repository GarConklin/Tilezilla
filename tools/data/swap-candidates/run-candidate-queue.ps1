<#
.SYNOPSIS
  Full solution enumeration for staged candidate puzzles (not in the live catalog).

.DESCRIPTION
  Reads <Set>/queue.txt, solves each <Set>/specs/<id>.json with solves/solve-level.js --spec,
  and writes the full solve document to <Set>/results/<id>.json. Never touches data/levels or solves/.
  Puzzles that already have a results file are skipped, so the queue can be stopped and resumed.

.EXAMPLE
  .\tools\data\swap-candidates\run-candidate-queue.ps1 -Set generated-0c-small

.EXAMPLE
  .\tools\data\swap-candidates\run-candidate-queue.ps1 -Set swap-bags -Limit 25

.EXAMPLE
  .\tools\data\swap-candidates\run-candidate-queue.ps1 -Set pair-swap-drafts
#>
param(
  [ValidateSet("generated-0c-small", "swap-bags", "pair-swap-drafts")]
  [string]$Set = "generated-0c-small",

  [int]$Limit = 0,

  [int]$MaxSol = 500000,

  [int]$ProgressEvery = 500
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$SetRel = "tools/data/swap-candidates/$Set"
$SetDir = Join-Path $RepoRoot ($SetRel -replace '/', '\')
$ResultsDir = Join-Path $SetDir "results"
New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null

$ids = @(Get-Content (Join-Path $SetDir "queue.txt") | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
$pending = @($ids | Where-Object { -not (Test-Path (Join-Path $ResultsDir "$_.json")) })
if ($Limit -gt 0) { $pending = @($pending | Select-Object -First $Limit) }

$host.UI.RawUI.WindowTitle = "TileZilla candidate solver - $Set"
Write-Host "Queue $Set : $($ids.Count) total, $($ids.Count - @($ids | Where-Object { -not (Test-Path (Join-Path $ResultsDir "$_.json")) }).Count) already done, $($pending.Count) to run now" -ForegroundColor Cyan

$progressLog = Join-Path $SetDir "results-progress.ndjson"
$started = Get-Date
$n = 0
foreach ($id in $pending) {
  $n++
  $elapsed = (Get-Date) - $started
  Write-Host ""
  Write-Host ("==> [{0}/{1}] {2}   (elapsed {3:hh\:mm\:ss})" -f $n, $pending.Count, $id, $elapsed) -ForegroundColor Cyan

  $summary = $null
  Push-Location $RepoRoot
  try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker compose run --rm -t web node solves/solve-level.js --spec "$SetRel/specs/$id.json" `
      --viable-seeds-only --write-solves "$SetRel/results/$id.json" --json-summary `
      --progress-every $ProgressEvery --progress-on-json --max-sol $MaxSol 2>&1 | ForEach-Object {
        $line = "$_"
        Write-Host $line
        if ($line -match '^\s*\{.*"totalUniqueSolutions"') {
          try { $summary = $line.Trim() | ConvertFrom-Json } catch { }
        }
      }
    $exit = $LASTEXITCODE
    $ErrorActionPreference = $prev
  }
  finally { Pop-Location }

  $total = if ($summary) { $summary.totalUniqueSolutions } else { $null }
  $capped = if ($summary) { [bool]$summary.hitMaxSolCap } else { $false }
  Add-Content -Path $progressLog -Value (@{ id = $id; exit = $exit; totalUniqueSolutions = $total; hitMaxSolCap = $capped; ts = (Get-Date -Format o) } | ConvertTo-Json -Compress)

  if ($exit -eq 0 -and $total -gt 0) {
    Write-Host "OK: $id -> $total solution(s)$(if ($capped) { ' (HIT MAX-SOL CAP)' })" -ForegroundColor Green
  } else {
    Write-Host "FAILED: $id (exit $exit) - continuing" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Finished $n puzzle(s) in $(((Get-Date) - $started).ToString('hh\:mm\:ss')). Results: $ResultsDir" -ForegroundColor Green
