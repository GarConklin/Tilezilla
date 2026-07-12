# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\stop-solve-docker-runs.ps1
& "$PSScriptRoot\..\tools\scripts\stop-solve-docker-runs.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
