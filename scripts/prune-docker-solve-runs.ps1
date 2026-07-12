# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\prune-docker-solve-runs.ps1
& "$PSScriptRoot\..\tools\scripts\prune-docker-solve-runs.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
