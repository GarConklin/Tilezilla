# Resolve Tilezilla repo root from tools/scripts/ (two levels up).

function Get-TilezillaRepoRoot {
  param([string]$From = $PSScriptRoot)
  return (Resolve-Path (Join-Path $From "../..")).Path
}

function Get-TilezillaGameScriptsDir {
  return Join-Path (Get-TilezillaRepoRoot) "scripts"
}
