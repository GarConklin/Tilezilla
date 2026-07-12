# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\migrate-auth-to-tilegame.ps1
& "$PSScriptRoot\..\tools\scripts\migrate-auth-to-tilegame.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
