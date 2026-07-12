# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\dedupe-solve-rotations.ps1
& "$PSScriptRoot\..\tools\scripts\dedupe-solve-rotations.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
