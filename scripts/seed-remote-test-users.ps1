# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\seed-remote-test-users.ps1
& "$PSScriptRoot\..\tools\scripts\seed-remote-test-users.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
