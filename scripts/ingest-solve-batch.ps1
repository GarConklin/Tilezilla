<#
.SYNOPSIS
  Ingest concatenated solve JSON from a TilePz export file into the catalog.

.DESCRIPTION
  All script steps run via: docker compose run --rm web (repo mounted at /app).
  1. Ensures solves/ is populated (extracts solves.zip if the folder is nearly empty).
  2. Merge solve docs by tile bag (append-only).
  3. Sync catalog (totalUniqueSolutions, pathCount from tiles, pathMode) from solve files.
  4. Optionally repacks solves.zip and creates a git commit.

  Paste files often use wrong tier in levelId (e.g. 6x6-0C-* for a 0B bag). The merge
  script assigns the next free code in the correct bucket; do not rename files by hand.

.EXAMPLE
  .\scripts\ingest-solve-batch.ps1 -BatchFile "data\tilepz solves newset21.txt"

.EXAMPLE
  .\scripts\ingest-solve-batch.ps1 -BatchFile "data\my-batch.txt" -DryRun

.EXAMPLE
  .\scripts\ingest-solve-batch.ps1 -BatchFile "data\my-batch.txt" -RepackGit -CommitMessage "Ingest my-batch solve levels."
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$BatchFile,

  [string]$RepoRoot = "",

  [switch]$DryRun,

  [switch]$RepackGit,

  [string]$CommitMessage = "",

  [switch]$Push
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

. (Join-Path $PSScriptRoot "lib\Docker-Web.ps1")

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-SolvesFolder {
  param([string]$Root)

  $solvesDir = Join-Path $Root "solves"
  $zipPath = Join-Path $Root "solves.zip"

  if (-not (Test-Path $solvesDir)) {
    New-Item -ItemType Directory -Path $solvesDir -Force | Out-Null
  }

  $jsonCount = @(Get-ChildItem -Path $solvesDir -Filter "*.json" -File -ErrorAction SilentlyContinue).Count
  if ($jsonCount -ge 500) {
    Write-Host "solves/ has $($jsonCount) json files - skip zip extract."
    return
  }

  if (-not (Test-Path $zipPath)) {
    Write-Warning "solves/ has only $jsonCount files and solves.zip is missing. Ingest will create new files under solves/."
    return
  }

  Write-Step "Extracting solves.zip into solves/ - $jsonCount files present"
  if ($jsonCount -gt 0) {
    Write-Warning "Merging into a partial solves/ folder. Prefer a full extract first if results look wrong."
  }
  Expand-Archive -Path $zipPath -DestinationPath $solvesDir -Force
  $after = @(Get-ChildItem -Path $solvesDir -Filter "*.json" -File).Count
  Write-Host "solves/ now has $($after) json files."
}

function Repack-SolvesZip {
  param([string]$Root)

  $solvesDir = Join-Path $Root "solves"
  $zipPath = Join-Path $Root "solves.zip"

  if (-not (Test-Path $solvesDir)) {
    throw "Missing solves directory: $solvesDir"
  }

  $items = Get-ChildItem -Path $solvesDir -File -ErrorAction SilentlyContinue
  if ($items.Count -eq 0) {
    throw "solves/ is empty - nothing to zip."
  }

  if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
  }

  # Zip contents of solves/ (flat names at archive root, same as manual Compress-Archive solves\*)
  Compress-Archive -Path (Join-Path $solvesDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
  $mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
  Write-Host "Created solves.zip - $mb MB"
}

function Commit-Ingest {
  param(
    [string]$Root,
    [string]$Message,
    [bool]$DoPush
  )

  Push-Location $Root
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    $latestReport = Get-ChildItem -Path (Join-Path $Root "data/solver-runs") -Filter "ingest-report-*.md" -File |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    $latestLog = Get-ChildItem -Path (Join-Path $Root "data/solver-runs") -Filter "ingest-batch-*.log" -File |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    $toStage = @(
      "data/levels/5x6-0B.json",
      "data/levels/6x6-0B.json",
      "data/levels/index.json",
      "data/levels/levels.json",
      "solves.zip",
      "scripts/ingest-solve-batch.ps1"
    )
    $summary = Join-Path $Root "data/solver-runs/ingest-newset21-summary.md"
    if (Test-Path $summary) { $toStage += $summary }
    if ($latestReport) {
      $toStage += $latestReport.FullName
      $json = $latestReport.FullName -replace '\.md$', '.json'
      if (Test-Path $json) { $toStage += $json }
    }
    if ($latestLog) { $toStage += $latestLog.FullName }

    git add @toStage 2>&1 | Out-Null

    $ErrorActionPreference = $prevEap

    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      Write-Host "No staged changes to commit."
      return
    }

    if ([string]::IsNullOrWhiteSpace($Message)) {
      $batchName = [System.IO.Path]::GetFileName($BatchFile)
      $Message = "Ingest solve batch $batchName and repack solves.zip."
    }

    $msgFile = Join-Path $env:TEMP "git-commit-msg-$(Get-Random).txt"
    Set-Content -Path $msgFile -Value $Message -Encoding utf8
    git commit -F $msgFile
    Remove-Item -Path $msgFile -Force -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) {
      throw "git commit failed"
    }
    Write-Host "Committed."

    if ($DoPush) {
      git push origin HEAD
      Write-Host "Pushed to origin."
    }
  }
  finally {
    Pop-Location
  }
}

# --- main ---

if (-not (Test-DockerCompose -RepoRoot $RepoRoot)) {
  throw "Docker Compose not available. Start Docker Desktop, then run from repo root."
}

$batchAbs = $BatchFile
if (-not [System.IO.Path]::IsPathRooted($batchAbs)) {
  $batchAbs = Join-Path $RepoRoot ($BatchFile -replace '/', '\')
}
if (-not (Test-Path $batchAbs)) {
  throw "Batch file not found: $batchAbs"
}

$batchRel = ($batchAbs.Substring($RepoRoot.Length).TrimStart('\', '/') -replace '\\', '/')
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $RepoRoot "data/solver-runs/ingest-batch-$stamp.log"

Write-Host "Repo:  $RepoRoot"
Write-Host "Batch: $batchRel"

Ensure-SolvesFolder -Root $RepoRoot

Write-Step "Merge solve docs (append-only, bag-matched)"
$mergeArgs = @()
if ($DryRun) { $mergeArgs += "--dry-run" }
$mergeArgs += $batchRel

$mergeLog = New-Object System.Collections.Generic.List[string]
try {
  # merge script logs SKIP/WRITE to stderr; do not treat that as a terminating error
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $mergeScript = "merge-solve-docs-append.js"
  $dockerMerge = @('compose', 'run', '--rm', 'web', 'node', "scripts/$mergeScript") + $mergeArgs
  Write-Host "docker $($dockerMerge -join ' ')"
  Push-Location $RepoRoot
  try {
    $mergeOut = & docker @dockerMerge 2>&1
  }
  finally {
    Pop-Location
  }
  $ErrorActionPreference = $prevEap
  foreach ($item in $mergeOut) {
    $line = "$item"
    Write-Host $line
    $mergeLog.Add($line)
  }
  if ($LASTEXITCODE -ne 0) {
    throw "merge-solve-docs-append failed (exit $LASTEXITCODE)"
  }
}
finally {
  $runsDir = Join-Path $RepoRoot "data/solver-runs"
  if (-not (Test-Path $runsDir)) {
    New-Item -ItemType Directory -Path $runsDir -Force | Out-Null
  }
  $mergeLog | Set-Content -Path $logPath -Encoding utf8
  Write-Host "Log: $logPath"
}

if ($DryRun) {
  Write-Host ""
  Write-Host "Dry-run only - no catalog or solves written. Re-run without -DryRun to apply." -ForegroundColor Yellow
  exit 0
}

Write-Step "Sync catalog pathCount / pathMode from solves"
Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "sync-catalog-path-count-from-solves.js" -ExtraArgs @("--apply")

Write-Step "Tile bag audit + fix misfiled duplicate solve files"
Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "audit-level-solve-tile-bags.js" -ExtraArgs @(
  "--out", "data/solver-runs/level-solve-bag-match-latest.json"
)
Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "fix-misfiled-duplicate-solves.js" -ExtraArgs @(
  "--apply", "--report", "data/solver-runs/level-solve-bag-match-latest.json"
)
Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "sync-catalog-tiles-from-solves.js" -ExtraArgs @("--apply")

Write-Step "Ingest report (post-merge snapshot)"
Invoke-DockerWeb -RepoRoot $RepoRoot -ScriptRel "ingest-solve-file-with-report.js" -ExtraArgs @($batchRel, "--dry-run")

if ($RepackGit) {
  Write-Step "Repack solves.zip"
  Repack-SolvesZip -Root $RepoRoot

  Write-Step "Git commit"
  Commit-Ingest -Root $RepoRoot -Message $CommitMessage -DoPush:$Push
}
else {
  Write-Host ""
  Write-Host "Done. To ship in git, re-run with -RepackGit or:" -ForegroundColor Green
  Write-Host "  .\scripts\ingest-solve-batch.ps1 -BatchFile $BatchFile -RepackGit"
}
