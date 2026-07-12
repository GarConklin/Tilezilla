# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\bootstrap-mysql-tilegame.ps1
& "$PSScriptRoot\..\tools\scripts\bootstrap-mysql-tilegame.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
