<#
.SYNOPSIS
  Solve one named-swap sample. You run this. It does not build the queue.

.DESCRIPTION
  Finds one saved solution that contains a set you named, writes the new bag
  after swapping in the other set on the same squares and the same openings,
  then counts solutions for that one bag.

  From the Tilezilla repo root:

    .\tools\scripts\sample-swap-solve.ps1

  A count of 0 means this sample failed. A count of 1 or more means the
  swapped bag has solutions.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot

python (Join-Path $PSScriptRoot "sample-one-swap.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$solverArgs = @(
  "compose", "run", "--rm", "-T", "web", "node", "solves/solve-level.js",
  "--spec", "tools/data/solver-runs/swap-sample/spec.json",
  "--viable-seeds-only",
  "--json-summary",
  "--progress-every", "200",
  "--progress-on-json",
  "--max-sol", "500000",
  "--write-solves", "tools/data/solver-runs/swap-sample/solutions.json"
)

Write-Host ""
Write-Host ("docker " + ($solverArgs -join " "))

$summary = $null
& docker @solverArgs 2>&1 | ForEach-Object {
  $line = "$_"
  Write-Host $line
  if ($line -match '^\s*\{.*"totalUniqueSolutions"') {
    $summary = $line.Trim()
  }
}
$solveExit = $LASTEXITCODE

$count = $null
if ($summary) {
  try {
    $count = ($summary | ConvertFrom-Json).totalUniqueSolutions
  }
  catch {
    $count = $null
  }
}

Write-Host ""
if ($solveExit -eq 0 -and $null -ne $count -and $count -ge 1) {
  Write-Host "OK: sample-swap has $count solution(s)." -ForegroundColor Green
  exit 0
}

Write-Host "Problem: sample-swap exit=$solveExit count=$count" -ForegroundColor Red
exit 1
