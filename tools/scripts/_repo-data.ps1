# Tilezilla dev data paths (Phase 3).

function Get-TilezillaToolsDataDir {
  param([string]$From = $PSScriptRoot)
  return Join-Path (Get-TilezillaRepoRoot -From $From) "tools\data"
}

function Get-TilezillaSolverRunsDir {
  param([string]$From = $PSScriptRoot)
  return Join-Path (Get-TilezillaToolsDataDir -From $From) "solver-runs"
}

function Get-TilezillaToolsBatchesDir {
  param([string]$From = $PSScriptRoot)
  return Join-Path (Get-TilezillaToolsDataDir -From $From) "batches"
}

# Resolve dev data paths; map legacy data/... to tools/data/... when the old path is gone.
function Resolve-TilezillaDevDataPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  if ([System.IO.Path]::IsPathRooted($RelativePath)) {
    return $RelativePath
  }

  $rel = $RelativePath -replace '\\', '/'
  $full = Join-Path $RepoRoot ($rel -replace '/', [System.IO.Path]::DirectorySeparatorChar)
  if (Test-Path -LiteralPath $full) { return $full }

  if ($rel -match '^data/(.+)$') {
    $name = $Matches[1]
    foreach ($prefix in @('tools/data/batches/', 'tools/data/solver-runs/', 'tools/data/')) {
      $altRel = $prefix + $name
      $alt = Join-Path $RepoRoot ($altRel -replace '/', [System.IO.Path]::DirectorySeparatorChar)
      if (Test-Path -LiteralPath $alt) { return $alt }
    }
  }

  return $full
}
