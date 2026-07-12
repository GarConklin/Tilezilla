# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\ingest-solve-batch.ps1
& "$PSScriptRoot\..\tools\scripts\ingest-solve-batch.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
