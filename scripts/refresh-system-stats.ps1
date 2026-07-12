# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\refresh-system-stats.ps1
& "$PSScriptRoot\..\tools\scripts\refresh-system-stats.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
