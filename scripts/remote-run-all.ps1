# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\remote-run-all.ps1
& "$PSScriptRoot\..\tools\scripts\remote-run-all.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
