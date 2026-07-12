# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\start-local-auth.ps1
& "$PSScriptRoot\..\tools\scripts\start-local-auth.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
