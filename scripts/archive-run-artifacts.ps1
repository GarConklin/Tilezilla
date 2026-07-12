# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\archive-run-artifacts.ps1
& "$PSScriptRoot\..\tools\scripts\archive-run-artifacts.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
