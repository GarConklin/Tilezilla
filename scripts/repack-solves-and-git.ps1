param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$ZipName = "solves.zip",
  [string]$CommitMessage = "Repack solves.zip and stop tracking solves folder",
  [switch]$Push
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Add-GitignoreSolvesRules {
  param([string]$GitignorePath)

  if (!(Test-Path $GitignorePath)) {
    New-Item -ItemType File -Path $GitignorePath -Force | Out-Null
  }

  $raw = Get-Content -Path $GitignorePath -Raw
  $lines = $raw -split "`r?`n"
  $changed = $false

  if (-not ($lines -contains "solves/")) {
    Add-Content -Path $GitignorePath -Value "`n# Large generated solve library`nsolves/"
    $changed = $true
  }
  if (-not ($lines -contains "!solves.zip")) {
    Add-Content -Path $GitignorePath -Value "!solves.zip"
    $changed = $true
  }

  if ($changed) {
    Write-Host "Updated .gitignore with solves rules."
  } else {
    Write-Host ".gitignore already contains solves rules."
  }
}

Write-Host "Repo root: $RepoRoot"

$solvesDir = Join-Path $RepoRoot "solves"
$zipPath = Join-Path $RepoRoot $ZipName
$gitignorePath = Join-Path $RepoRoot ".gitignore"

if (!(Test-Path $solvesDir)) {
  throw "Missing solves directory: $solvesDir"
}

if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
  Write-Host "Deleted existing $ZipName"
}

Compress-Archive -Path $solvesDir -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "Created $ZipName from solves/"

Add-GitignoreSolvesRules -GitignorePath $gitignorePath

Push-Location $RepoRoot
try {
  # Untrack solves from git index while keeping local files.
  git rm -r --cached "solves" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "solves/ may already be untracked (continuing)."
  } else {
    Write-Host "Untracked solves/ from git index."
  }

  git add ".gitignore" $ZipName

  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "No staged changes to commit."
    if (Test-Path $zipPath) {
      $wt = git hash-object $ZipName
      $hd = git rev-parse "HEAD:$ZipName" 2>$null
      if ($LASTEXITCODE -eq 0 -and $wt -eq $hd) {
        Write-Host "$ZipName byte-for-byte matches HEAD -- repository already has this archive."
      }
    }
    exit 0
  }

  git commit -m $CommitMessage
  Write-Host "Committed changes."

  if ($Push) {
    git push origin HEAD
    Write-Host "Pushed to origin."
  } else {
    Write-Host "Commit created. Re-run with -Push to push."
  }
}
finally {
  Pop-Location
}

