# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\import-adventure-progression.ps1
& "$PSScriptRoot\..\tools\scripts\import-adventure-progression.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
