# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\show-solve-runs-status.ps1
& "$PSScriptRoot\..\tools\scripts\show-solve-runs-status.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
