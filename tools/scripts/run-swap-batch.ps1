<#
.SYNOPSIS
  Name and solve swap puzzles, 25 at a time. You run this.

.DESCRIPTION
  From the Tilezilla repo root.

  One batch of 25:

    .\tools\scripts\run-swap-batch.ps1

  Keep going until a clock time. Leave the window open.

    .\tools\scripts\run-swap-batch.ps1 -Until "2026-10-13 08:00"

  One row of named swap sets at a time. Each new bag is named
  <size>-<tier>-<0000> and recorded. The same bag is not solved again.
  A different swap that builds a different bag is still done.
  Ctrl+C stops. The same command finishes named puzzles before it names more.
#>
param(
  [int]$Count = 25,
  [string]$Until = "",
  [int]$FromBlock = 0,
  [int]$ToBlock = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot

$deadline = $null
if (-not [string]::IsNullOrWhiteSpace($Until)) {
  $deadline = [datetime]::ParseExact($Until.Trim(), "yyyy-MM-dd HH:mm", [Globalization.CultureInfo]::InvariantCulture)
  if ($deadline -le (Get-Date)) {
    throw "Until time is already past: $($deadline.ToString('yyyy-MM-dd HH:mm'))"
  }
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $logDir = Join-Path $RepoRoot "tools\data\solver-runs"
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $logPath = Join-Path $logDir "swap-named-until-$stamp.log"
  Start-Transcript -Path $logPath | Out-Null
  Write-Host "Running until $($deadline.ToString('yyyy-MM-dd HH:mm')). Log: $logPath"
}

function Invoke-SwapBatch {
  if ($FromBlock -gt 0) {
    $last = $ToBlock
    if ($last -lt $FromBlock) { $last = $FromBlock }
    $prepOut = & python (Join-Path $PSScriptRoot "swap-batch.py") prepare-range --from-block $FromBlock --to-block $last 2>&1
  }
  else {
    $prepOut = & python (Join-Path $PSScriptRoot "swap-batch.py") prepare --count $Count 2>&1
  }
  $prepOut | ForEach-Object { Write-Host "$_" }
  if ($LASTEXITCODE -eq 2) { return 2 }
  if ($LASTEXITCODE -ne 0) { return [int]$LASTEXITCODE }

$batchPath = Join-Path $RepoRoot "tools\data\solver-runs\swap-named\batch.json"
$batch = Get-Content -Raw -Path $batchPath | ConvertFrom-Json
$specs = @($batch.specs)
if ($specs.Count -eq 0) { return 2 }

$enumDir = Join-Path $RepoRoot "tools\data\solver-runs\swap-named\enumerated"
if (-not (Test-Path $enumDir)) { New-Item -ItemType Directory -Path $enumDir | Out-Null }

foreach ($row in $specs) {
  $id = [string]$row.id
  $swapOut = @($row.swapOut) -join "+"
  $swapIn = @($row.swapIn) -join "+"
  Write-Host ""
  Write-Host "==> $id  from $($row.from)  $swapOut -> $swapIn" -ForegroundColor Cyan

  $specRel = "tools/data/solver-runs/swap-named/specs/$id.json"
  $outRel = "tools/data/solver-runs/swap-named/enumerated/$id.json"
  $solverArgs = @(
    "compose", "run", "--rm", "-T", "web", "node", "solves/solve-level.js",
    "--spec", $specRel,
    "--viable-seeds-only",
    "--json-summary",
    "--progress-every", "200",
    "--progress-on-json",
    "--max-sol", "500000",
    "--write-solves", $outRel
  )
  Write-Host ("docker " + ($solverArgs -join " "))

  $summary = $null
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & docker @solverArgs 2>&1 | ForEach-Object {
      $line = "$_"
      Write-Host $line
      if ($line -match '^\s*\{.*"totalUniqueSolutions"') {
        $summary = $line.Trim()
      }
    }
    $solveExit = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $prevEap
  }

  $count = $null
  if ($summary) {
    try { $count = ($summary | ConvertFrom-Json).totalUniqueSolutions } catch { $count = $null }
  }

  if ($solveExit -ne 0) {
    Write-Host "Solver stopped. $id was not recorded, so the next run does it again." -ForegroundColor Yellow
    return [int]$solveExit
  }

  $recordArgs = @(
    (Join-Path $PSScriptRoot "swap-batch.py"),
    "record", "--id", $id, "--exit", "$solveExit"
  )
  if ($null -ne $count) { $recordArgs += @("--solutions", "$count") }
  $recordOut = & python @recordArgs 2>&1
  $recordOut | ForEach-Object { Write-Host "$_" }
  if ($LASTEXITCODE -ne 0) { return [int]$LASTEXITCODE }

  Write-Host ""
  if ($solveExit -eq 0 -and $null -ne $count -and $count -ge 1) {
    Write-Host "OK: $id has $count solution(s)." -ForegroundColor Green
  }
  else {
    Write-Host "Problem: $id exit=$solveExit count=$count" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Batch finished."
return 0
}

function Get-BatchCode {
  $result = @(Invoke-SwapBatch)
  return [int]$result[-1]
}

if ($null -eq $deadline) {
  $code = Get-BatchCode
  if ($code -eq 2) {
    Write-Host "All swap sets are recorded."
    exit 0
  }
  exit $code
}

try {
  while ((Get-Date) -lt $deadline) {
    $code = Get-BatchCode
    if ($code -eq 2) {
      Write-Host "All swap sets are recorded."
      exit 0
    }
    if ($code -ne 0) { exit $code }
    if ((Get-Date) -ge $deadline) { break }
    Write-Host "Next 25. Clock stops at $($deadline.ToString('yyyy-MM-dd HH:mm'))."
  }
  Write-Host "Stopped at the clock. Run the same command again to continue."
  exit 0
}
finally {
  try { Stop-Transcript | Out-Null } catch { }
}
