# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\audit-solution-loops.ps1
& "$PSScriptRoot\..\tools\scripts\audit-solution-loops.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
