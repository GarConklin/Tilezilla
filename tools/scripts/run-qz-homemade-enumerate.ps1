<#
.SYNOPSIS
  Full unique-solution counts for handmade drafts in tools/data/solver-runs/qz-drafts/.

.DESCRIPTION
  Solves each qz-homemade-N.json bag with solves/solve-level.js inside Docker.
  Writes full solve documents to tools/data/solver-runs/qz-drafts/enumerated/.
  Streams layouts to tools/data/solver-runs/streams/<id>/.
  Does not modify published data/levels catalogs or canonical solves/.

.EXAMPLE
  .\tools\scripts\run-qz-homemade-enumerate.ps1

.EXAMPLE
  .\tools\scripts\run-qz-homemade-enumerate.ps1 -Only "qz-homemade-3,qz-homemade-4"
#>
param(
  [string]$RepoRoot = "",
  [int]$MaxSol = 500000,
  [int]$ProgressEvery = 200,
  [string]$Only = "",
  [switch]$Force,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
}

. (Join-Path $PSScriptRoot "lib\Docker-Web.ps1")

if (-not (Test-DockerCompose -RepoRoot $RepoRoot)) {
  throw "docker compose not available from $RepoRoot"
}

$draftRel = "tools/data/solver-runs/qz-drafts"
$draftDir = Join-Path $RepoRoot "tools\data\solver-runs\qz-drafts"
$enumDir = Join-Path $draftDir "enumerated"
$streamRel = "tools/data/solver-runs/streams"
if (-not (Test-Path $enumDir)) {
  New-Item -ItemType Directory -Path $enumDir -Force | Out-Null
}

$files = @(Get-ChildItem -Path $draftDir -Filter "qz-homemade-*.json" | Sort-Object {
  [int]($_.BaseName -replace '\D', '')
})

if ($Only.Trim()) {
  $want = @($Only -split '[,\s]+' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $files = @($files | Where-Object { $want -contains $_.BaseName })
}

if ($files.Count -eq 0) {
  throw "No qz-homemade drafts matched."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $RepoRoot "tools\data\solver-runs\qz-homemade-enumerate-$stamp.log"
$progressPath = Join-Path $RepoRoot "tools\data\solver-runs\qz-homemade-enumerate-$stamp.ndjson"
$log = New-Object System.IO.StreamWriter($logPath, $false, [System.Text.UTF8Encoding]::new($false))
$progress = New-Object System.IO.StreamWriter($progressPath, $false, [System.Text.UTF8Encoding]::new($false))
$log.WriteLine("# qz-homemade-enumerate stamp=$stamp maxSol=$MaxSol count=$($files.Count)")
$log.Flush()

Write-Host "Enumerating $($files.Count) homemade draft(s). Log: $logPath"

if (-not $DryRun) {
  Push-Location $RepoRoot
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker compose run --rm -T web node -e "const fs=require('fs');const path=require('path');const dir='tools/data/solver-runs/qz-drafts';for (const f of fs.readdirSync(dir)) { if (!/^qz-homemade-\d+\.json$/.test(f)) continue; const p=path.join(dir,f); const doc=JSON.parse(fs.readFileSync(p,'utf8')); const id=f.replace(/\.json$/,''); if (doc.id===id) continue; doc.id=id; fs.writeFileSync(p, JSON.stringify(doc,null,2)+'\n'); console.log('id '+id); }"
    if ($LASTEXITCODE -ne 0) { throw "Failed to stamp draft ids" }
    $ErrorActionPreference = $prevEap
  }
  finally {
    Pop-Location
  }
}

$failed = @()
$n = 0

foreach ($file in $files) {
  $n++
  $id = $file.BaseName
  $spec = "$draftRel/$($file.Name)"
  $outRel = "$draftRel/enumerated/$id.json"
  $enumPath = Join-Path $enumDir "$id.json"
  $streamDir = Join-Path $RepoRoot "tools\data\solver-runs\streams\$id"

  Write-Host ""
  Write-Host "==> [$n/$($files.Count)] $id" -ForegroundColor Cyan
  $log.WriteLine("")
  $log.WriteLine("=== [$n/$($files.Count)] $id ===")
  $log.Flush()

  if (-not $Force -and (Test-Path $enumPath)) {
    Write-Host "Skip $id (enumerated file already exists). Use -Force to redo." -ForegroundColor DarkYellow
    $log.WriteLine("skip existing $outRel")
    $log.Flush()
    continue
  }

  if (Test-Path $streamDir) {
    Remove-Item $streamDir -Recurse -Force
  }

  $solverArgs = @(
    "--spec", $spec,
    "--viable-seeds-only",
    "--write-solves", $outRel,
    "--json-summary",
    "--progress-every", "$ProgressEvery",
    "--progress-on-json",
    "--max-sol", "$MaxSol",
    "--stream-solves-dir", $streamRel
  )

  if ($DryRun) {
    Write-Host "[dry-run] docker compose run --rm -T web node solves/solve-level.js $($solverArgs -join ' ')"
    continue
  }

  Push-Location $RepoRoot
  $summaryJson = $null
  try {
    $dockerArgs = @("compose", "run", "--rm", "-T", "web", "node", "solves/solve-level.js") + $solverArgs
    Write-Host "docker $($dockerArgs -join ' ')"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker @dockerArgs 2>&1 | ForEach-Object {
      $line = "$_"
      $isProgress = $line -match '^\s*Progress:'
      $isSummary = $line -match '^\s*\{.*"totalUniqueSolutions"'
      Write-Host $line
      if (-not $isProgress) {
        $log.WriteLine($line)
      }
      if ($isSummary -or $line -match '^\[solve-level\]') { $log.Flush() }
      if ($isSummary) {
        try { $summaryJson = $line.Trim() | ConvertFrom-Json } catch { }
      }
    }
    $solveExit = $LASTEXITCODE
    $log.Flush()
    $ErrorActionPreference = $prevEap
  }
  finally {
    Pop-Location
  }

  $count = $null
  $hitCap = $false
  if ($summaryJson) {
    $count = $summaryJson.totalUniqueSolutions
    $hitCap = [bool]$summaryJson.hitMaxSolCap
  }

  $recorded = $false
  if ($solveExit -eq 0 -and $count -ne $null -and (Test-Path $enumPath)) {
    Push-Location $RepoRoot
    try {
      $hitArg = $(if ($hitCap) { "1" } else { "0" })
      $prevEap = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      & docker compose run --rm -T web node tools/scripts/record-qz-homemade-enum.js $id $hitArg 2>&1 | ForEach-Object {
        $line = "$_"
        Write-Host $line
        $log.WriteLine($line)
      }
      $recorded = ($LASTEXITCODE -eq 0)
      $ErrorActionPreference = $prevEap
    }
    finally {
      Pop-Location
    }
  }

  $progress.WriteLine((@{
      id                   = $id
      index                = $n
      total                = $files.Count
      exit                 = $solveExit
      ts                   = (Get-Date -Format 'o')
      totalUniqueSolutions = $count
      hitMaxSolCap         = $hitCap
      recorded             = $recorded
    } | ConvertTo-Json -Compress))
  $progress.Flush()

  if ($recorded -and -not $hitCap) {
    Write-Host "OK: $id ($count solution(s))" -ForegroundColor Green
  }
  else {
    $failed += $id
    Write-Host "Problem: $id exit=$solveExit count=$count hitCap=$hitCap" -ForegroundColor Red
  }
}

$log.WriteLine("")
$log.WriteLine("# done failed=$($failed -join ', ')")
$log.Flush()
$log.Close()
$progress.Close()

Write-Host ""
Write-Host "Log: $logPath"
Write-Host "Progress: $progressPath"
if ($failed.Count) {
  Write-Host "Needs another look: $($failed -join ', ')" -ForegroundColor Yellow
  exit 1
}
Write-Host "All matched drafts enumerated." -ForegroundColor Green
