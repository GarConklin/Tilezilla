# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\ensure-shared-mysql-volume.ps1
& "$PSScriptRoot\..\tools\scripts\ensure-shared-mysql-volume.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
