# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\start-remote-test.ps1
& "$PSScriptRoot\..\tools\scripts\start-remote-test.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
