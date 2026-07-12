# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\run-6x6-enumerate.ps1
& "$PSScriptRoot\..\tools\scripts\run-6x6-enumerate.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
