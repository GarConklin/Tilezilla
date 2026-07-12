# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\run-missing-solves.ps1
& "$PSScriptRoot\..\tools\scripts\run-missing-solves.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
