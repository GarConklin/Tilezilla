# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\cleanup-solver-runs-6x6.ps1
& "$PSScriptRoot\..\tools\scripts\cleanup-solver-runs-6x6.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
