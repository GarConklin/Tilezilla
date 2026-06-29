# Audit solve JSON files for path loops / branch junctions.
# See: python scripts/audit-solution-loops.py --help

param(
    [string]$Size,
    [string]$MinSize,
    [string]$MaxSize,
    [string]$Level,
    [switch]$Fix,
    [string]$JsonOut = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root "scripts\audit-solution-loops.py"

$args = @()
if ($Size) { $args += @("--size", $Size) }
if ($MinSize) { $args += @("--min-size", $MinSize) }
if ($MaxSize) { $args += @("--max-size", $MaxSize) }
if ($Level) { $args += @("--level", $Level) }
if ($Fix) { $args += "--fix" }
if ($JsonOut) { $args += @("--json-out", $JsonOut) }

python $py @args
exit $LASTEXITCODE
