# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\stop-remote-test.ps1
& "$PSScriptRoot\..\tools\scripts\stop-remote-test.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
