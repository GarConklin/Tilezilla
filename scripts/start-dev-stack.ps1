# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\start-dev-stack.ps1
& "$PSScriptRoot\..\tools\scripts\start-dev-stack.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
