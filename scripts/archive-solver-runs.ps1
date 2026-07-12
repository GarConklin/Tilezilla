# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\archive-solver-runs.ps1
& "$PSScriptRoot\..\tools\scripts\archive-solver-runs.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
